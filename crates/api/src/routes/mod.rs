mod auth_routes;
mod project_routes;
mod task_routes;
mod label_routes;
mod attachment_routes;
mod events;

use axum::Router;
use crate::state::AppState;

pub fn api_routes() -> Router<AppState> {
    Router::new()
        .merge(auth_routes::routes())
        .merge(project_routes::routes())
        .merge(task_routes::routes())
        .merge(label_routes::routes())
        .merge(attachment_routes::routes())
        .merge(events::routes())
}
