use axum::extract::{Query, State};
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::routing::get;
use axum::Router;
use futures::stream::Stream;
use serde::Deserialize;
use std::convert::Infallible;
use tokio_stream::wrappers::BroadcastStream;
use tokio_stream::StreamExt;

use crate::auth;
use crate::state::AppState;

pub fn routes() -> Router<AppState> {
    Router::new().route("/events", get(sse_handler))
}

#[derive(Deserialize)]
struct EventsQuery {
    token: String,
}

async fn sse_handler(
    State(state): State<AppState>,
    Query(query): Query<EventsQuery>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, axum::http::StatusCode> {
    // Auth via query param (EventSource doesn't support headers)
    let claims = auth::verify_token(&query.token, &state.jwt_secret)
        .map_err(|_| axum::http::StatusCode::UNAUTHORIZED)?;
    let user_id = claims.sub;

    let rx = state.events_tx.subscribe();
    let stream = BroadcastStream::new(rx).filter_map(move |msg| {
        match msg {
            Ok(event) if event.user_id == user_id => {
                let data = serde_json::to_string(&event).unwrap_or_default();
                Some(Ok(Event::default().data(data)))
            }
            _ => None, // skip errors and other users' events
        }
    });

    Ok(Sse::new(stream).keep_alive(KeepAlive::default()))
}
