use axum::extract::State;
use axum::routing::post;
use axum::{Json, Router};
use sea_orm::*;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::{create_token, AuthUser};
use crate::error::{ApiResult, AppError};
use crate::state::AppState;
use float_db::entities::user;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/auth/login", post(login))
        .route("/auth/me", axum::routing::get(me))
}

#[derive(Deserialize)]
struct LoginInput {
    email: String,
    password: String,
}

#[derive(Serialize)]
struct AuthResponse {
    token: String,
    user: UserResponse,
}

#[derive(Serialize)]
struct UserResponse {
    id: Uuid,
    email: String,
    username: String,
}

async fn login(
    State(state): State<AppState>,
    Json(input): Json<LoginInput>,
) -> ApiResult<Json<AuthResponse>> {
    if !state.login_guard.allow(&input.email) {
        return Err(AppError::TooManyRequests);
    }
    let permit = state
        .login_slots
        .clone()
        .try_acquire_owned()
        .map_err(|_| AppError::TooManyRequests)?;
    let user = user::Entity::find()
        .filter(user::Column::Email.eq(&input.email))
        .one(&state.db)
        .await?
        .ok_or(AppError::Unauthorized)?;

    let password_hash = user.password_hash.clone();
    let valid = tokio::task::spawn_blocking(move || {
        let _permit = permit;
        bcrypt::verify(&input.password, &password_hash)
    })
    .await
    .map_err(|e| AppError::Other(e.into()))?
    .map_err(|e| AppError::Other(e.into()))?;

    if !valid {
        return Err(AppError::Unauthorized);
    }

    let token = create_token(user.id, &state.jwt_secret, 86400 * 7)?;

    Ok(Json(AuthResponse {
        token,
        user: UserResponse {
            id: user.id,
            email: user.email,
            username: user.username,
        },
    }))
}

async fn me(State(state): State<AppState>, auth: AuthUser) -> ApiResult<Json<UserResponse>> {
    let user = user::Entity::find_by_id(auth.user_id)
        .one(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;

    Ok(Json(UserResponse {
        id: user.id,
        email: user.email,
        username: user.username,
    }))
}
