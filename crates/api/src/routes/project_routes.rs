use axum::extract::{Path, State};
use axum::routing::get;
use axum::{Json, Router};
use sea_orm::*;
use serde::Deserialize;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::error::{ApiResult, AppError};
use crate::state::AppState;
use float_db::entities::{project, task};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/projects", get(list).post(create))
        .route("/projects/{id}", get(get_one).put(update).delete(delete))
}

#[derive(Deserialize)]
struct CreateProject {
    title: String,
    description: Option<String>,
    color: Option<String>,
    icon: Option<String>,
    parent_id: Option<Uuid>,
}

#[derive(Deserialize)]
struct UpdateProject {
    title: Option<String>,
    description: Option<Option<String>>,
    color: Option<Option<String>>,
    icon: Option<Option<String>>,
    is_archived: Option<bool>,
    position: Option<i32>,
}

async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
) -> ApiResult<Json<Vec<project::Model>>> {
    let projects = project::Entity::find()
        .filter(project::Column::UserId.eq(auth.user_id))
        .order_by_asc(project::Column::Position)
        .all(&state.db)
        .await?;
    Ok(Json(projects))
}

async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(input): Json<CreateProject>,
) -> ApiResult<Json<project::Model>> {
    // Validate parent_id
    if let Some(pid) = input.parent_id {
        let parent = project::Entity::find_by_id(pid)
            .filter(project::Column::UserId.eq(auth.user_id))
            .one(&state.db)
            .await?
            .ok_or(AppError::NotFound)?;
        if parent.parent_id.is_some() {
            return Err(AppError::BadRequest("cannot nest deeper than one level".into()));
        }
    }

    let now = chrono::Utc::now();
    let max_pos: i32 = project::Entity::find()
        .filter(project::Column::UserId.eq(auth.user_id))
        .select_only()
        .column_as(project::Column::Position.max(), "max_pos")
        .into_tuple::<Option<i32>>()
        .one(&state.db)
        .await?
        .flatten()
        .unwrap_or(0);

    let new = project::ActiveModel {
        id: Set(Uuid::new_v4()),
        user_id: Set(auth.user_id),
        title: Set(input.title),
        description: Set(input.description),
        color: Set(input.color),
        icon: Set(input.icon),
        parent_id: Set(input.parent_id),
        is_archived: Set(false),
        position: Set(max_pos + 1),
        created_at: Set(now.into()),
        updated_at: Set(now.into()),
    };
    let project = new.insert(&state.db).await?;

    // Transfer parent's tasks to first child
    if let Some(pid) = input.parent_id {
        let siblings = project::Entity::find()
            .filter(project::Column::ParentId.eq(pid))
            .count(&state.db)
            .await?;
        if siblings == 1 {
            task::Entity::update_many()
                .filter(task::Column::ProjectId.eq(pid))
                .col_expr(task::Column::ProjectId, sea_orm::sea_query::Expr::value(project.id))
                .exec(&state.db)
                .await?;
        }
    }

    Ok(Json(project))
}

async fn get_one(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<project::Model>> {
    let project = project::Entity::find_by_id(id)
        .filter(project::Column::UserId.eq(auth.user_id))
        .one(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(project))
}

async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(input): Json<UpdateProject>,
) -> ApiResult<Json<project::Model>> {
    let project = project::Entity::find_by_id(id)
        .filter(project::Column::UserId.eq(auth.user_id))
        .one(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;

    let mut active: project::ActiveModel = project.into();
    if let Some(title) = input.title { active.title = Set(title); }
    if let Some(desc) = input.description { active.description = Set(desc); }
    if let Some(color) = input.color { active.color = Set(color); }
    if let Some(icon) = input.icon { active.icon = Set(icon); }
    if let Some(archived) = input.is_archived { active.is_archived = Set(archived); }
    if let Some(pos) = input.position { active.position = Set(pos); }
    active.updated_at = Set(chrono::Utc::now().into());

    let updated = active.update(&state.db).await?;
    Ok(Json(updated))
}

async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<serde_json::Value>> {
    let result = project::Entity::delete_many()
        .filter(project::Column::Id.eq(id))
        .filter(project::Column::UserId.eq(auth.user_id))
        .exec(&state.db)
        .await?;

    if result.rows_affected == 0 {
        return Err(AppError::NotFound);
    }
    Ok(Json(serde_json::json!({ "deleted": true })))
}
