use axum::extract::{Path, State};
use axum::routing::get;
use axum::{Json, Router};
use sea_orm::*;
use serde::Deserialize;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::error::{ApiResult, AppError};
use crate::state::AppState;
use float_db::entities::{label, project, task_label};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/projects/{project_id}/labels", get(list).post(create))
        .route("/projects/{project_id}/labels/{id}", axum::routing::delete(delete))
        .route("/projects/{project_id}/tasks/{task_id}/labels/{label_id}", axum::routing::put(attach).delete(detach))
}

#[derive(Deserialize)]
struct CreateLabel {
    title: String,
    color: Option<String>,
}

async fn verify_project_owner(db: &DatabaseConnection, project_id: Uuid, user_id: Uuid) -> ApiResult<()> {
    project::Entity::find_by_id(project_id)
        .filter(project::Column::UserId.eq(user_id))
        .one(db)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(())
}

async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
) -> ApiResult<Json<Vec<label::Model>>> {
    verify_project_owner(&state.db, project_id, auth.user_id).await?;
    let labels = label::Entity::find()
        .filter(label::Column::ProjectId.eq(project_id))
        .all(&state.db)
        .await?;
    Ok(Json(labels))
}

async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
    Json(input): Json<CreateLabel>,
) -> ApiResult<Json<label::Model>> {
    verify_project_owner(&state.db, project_id, auth.user_id).await?;
    let new = label::ActiveModel {
        id: Set(Uuid::new_v4()),
        project_id: Set(project_id),
        title: Set(input.title),
        color: Set(input.color.unwrap_or_else(|| "#737373".to_string())),
        created_at: Set(chrono::Utc::now().into()),
    };
    let label = new.insert(&state.db).await?;
    Ok(Json(label))
}

async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, id)): Path<(Uuid, Uuid)>,
) -> ApiResult<Json<serde_json::Value>> {
    verify_project_owner(&state.db, project_id, auth.user_id).await?;
    label::Entity::delete_by_id(id).exec(&state.db).await?;
    Ok(Json(serde_json::json!({ "deleted": true })))
}

async fn attach(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, task_id, label_id)): Path<(Uuid, Uuid, Uuid)>,
) -> ApiResult<Json<serde_json::Value>> {
    verify_project_owner(&state.db, project_id, auth.user_id).await?;
    let link = task_label::ActiveModel {
        task_id: Set(task_id),
        label_id: Set(label_id),
    };
    link.insert(&state.db).await.ok();
    Ok(Json(serde_json::json!({ "attached": true })))
}

async fn detach(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, task_id, label_id)): Path<(Uuid, Uuid, Uuid)>,
) -> ApiResult<Json<serde_json::Value>> {
    verify_project_owner(&state.db, project_id, auth.user_id).await?;
    task_label::Entity::delete_many()
        .filter(task_label::Column::TaskId.eq(task_id))
        .filter(task_label::Column::LabelId.eq(label_id))
        .exec(&state.db)
        .await?;
    Ok(Json(serde_json::json!({ "detached": true })))
}
