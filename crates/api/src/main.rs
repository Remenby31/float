mod auth;
mod error;
mod login_guard;
mod routes;
mod state;

use anyhow::Context;
use axum::Router;
use sea_orm::{ConnectionTrait, Database};
use sea_orm_migration::MigratorTrait;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "float_api=info,tower_http=warn".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite://./float.db?mode=rwc".to_string());
    let jwt_secret = std::env::var("JWT_SECRET")
        .context("JWT_SECRET must be configured before starting the API")?;
    auth::validate_secret(&jwt_secret)?;
    let port = std::env::var("PORT").unwrap_or_else(|_| "3000".to_string());

    let db = Database::connect(&database_url).await?;
    db.execute_unprepared("PRAGMA journal_mode=WAL").await?;
    db.execute_unprepared("PRAGMA foreign_keys=ON").await?;
    float_migration::Migrator::up(&db, None).await?;

    let state = state::AppState::new(db, jwt_secret);

    let app = Router::new()
        .nest("/api", routes::api_routes())
        .with_state(state)
        .layer(
            TraceLayer::new_for_http().make_span_with(|request: &axum::http::Request<axum::body::Body>| {
                // EventSource authenticates via a query parameter: never log query strings.
                tracing::debug_span!("http_request", method = %request.method(), path = %request.uri().path())
            }),
        );

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{port}")).await?;
    tracing::info!("float api listening on port {port}");
    axum::serve(listener, app).await?;

    Ok(())
}
