mod auth;
mod error;
mod routes;
mod state;

use axum::Router;
use sea_orm::Database;
use sea_orm_migration::MigratorTrait;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "float_api=debug,tower_http=debug".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://float:float@localhost:5432/float".to_string());
    let jwt_secret = std::env::var("JWT_SECRET")
        .unwrap_or_else(|_| "dev-secret-change-in-production".to_string());
    let port = std::env::var("PORT").unwrap_or_else(|_| "3000".to_string());

    let db = Database::connect(&database_url).await?;
    float_migration::Migrator::up(&db, None).await?;

    let state = state::AppState::new(db, jwt_secret);

    let app = Router::new()
        .nest("/api", routes::api_routes())
        .with_state(state)
        .layer(TraceLayer::new_for_http())
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        );

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{port}")).await?;
    tracing::info!("float api listening on port {port}");
    axum::serve(listener, app).await?;

    Ok(())
}
