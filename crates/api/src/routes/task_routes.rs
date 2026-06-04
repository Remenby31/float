use axum::extract::{Path, State};
use axum::routing::get;
use axum::{Json, Router};
use sea_orm::*;
use sea_orm::sea_query::Expr;
use serde::Deserialize;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::error::{ApiResult, AppError};
use crate::state::AppState;
use float_db::entities::{project, task};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/tasks", get(list_all))
        .route("/projects/{project_id}/tasks", get(list).post(create))
        .route("/projects/{project_id}/tasks/{id}", get(get_one).put(update).delete(delete))
        .route("/projects/{project_id}/tasks/reorder", axum::routing::put(reorder))
}

#[derive(Deserialize)]
struct CreateTask {
    title: String,
    description: Option<String>,
    weight: Option<String>,
    due_date: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Deserialize)]
struct UpdateTask {
    title: Option<String>,
    description: Option<Option<String>>,
    weight: Option<String>,
    position: Option<i32>,
    is_done: Option<bool>,
    due_date: Option<Option<chrono::DateTime<chrono::Utc>>>,
    new_project_id: Option<Uuid>,
}

#[derive(Deserialize)]
struct ReorderInput {
    task_ids: Vec<Uuid>,
}

async fn list_all(
    State(state): State<AppState>,
    auth: AuthUser,
) -> ApiResult<Json<Vec<task::Model>>> {
    let user_projects = project::Entity::find()
        .filter(project::Column::UserId.eq(auth.user_id))
        .all(&state.db)
        .await?;
    let project_ids: Vec<Uuid> = user_projects.iter().map(|p| p.id).collect();

    let tasks = task::Entity::find()
        .filter(task::Column::ProjectId.is_in(project_ids))
        .order_by_asc(task::Column::ProjectId)
        .order_by_asc(task::Column::Position)
        .all(&state.db)
        .await?;
    Ok(Json(tasks))
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
) -> ApiResult<Json<Vec<task::Model>>> {
    verify_project_owner(&state.db, project_id, auth.user_id).await?;
    let tasks = task::Entity::find()
        .filter(task::Column::ProjectId.eq(project_id))
        .order_by_asc(task::Column::Position)
        .all(&state.db)
        .await?;
    Ok(Json(tasks))
}

async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
    Json(input): Json<CreateTask>,
) -> ApiResult<Json<task::Model>> {
    verify_project_owner(&state.db, project_id, auth.user_id).await?;

    let has_children = project::Entity::find()
        .filter(project::Column::ParentId.eq(project_id))
        .count(&state.db)
        .await?;
    if has_children > 0 {
        return Err(AppError::BadRequest("cannot add tasks to a project with sub-projects".into()));
    }

    let now = chrono::Utc::now();
    let max_pos: i32 = task::Entity::find()
        .filter(task::Column::ProjectId.eq(project_id))
        .select_only()
        .column_as(task::Column::Position.max(), "max_pos")
        .into_tuple::<Option<i32>>()
        .one(&state.db)
        .await?
        .flatten()
        .unwrap_or(0);

    let weight = input.weight.unwrap_or_else(|| "medium".to_string());
    let new = task::ActiveModel {
        id: Set(Uuid::new_v4()),
        project_id: Set(project_id),
        title: Set(input.title),
        description: Set(input.description),
        weight: Set(weight),
        position: Set(max_pos + 1),
        is_done: Set(false),
        done_at: Set(None),
        due_date: Set(input.due_date.map(Into::into)),
        created_at: Set(now.into()),
        updated_at: Set(now.into()),
    };
    let task = new.insert(&state.db).await?;
    state.emit("task", "created", &task.id.to_string(), &auth.user_id.to_string());
    Ok(Json(task))
}

async fn get_one(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, id)): Path<(Uuid, Uuid)>,
) -> ApiResult<Json<task::Model>> {
    verify_project_owner(&state.db, project_id, auth.user_id).await?;
    let task = task::Entity::find_by_id(id)
        .filter(task::Column::ProjectId.eq(project_id))
        .one(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(task))
}

async fn update(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, id)): Path<(Uuid, Uuid)>,
    Json(input): Json<UpdateTask>,
) -> ApiResult<Json<task::Model>> {
    verify_project_owner(&state.db, project_id, auth.user_id).await?;
    let task = task::Entity::find_by_id(id)
        .filter(task::Column::ProjectId.eq(project_id))
        .one(&state.db)
        .await?
        .ok_or(AppError::NotFound)?;

    let mut active: task::ActiveModel = task.into();
    if let Some(title) = input.title { active.title = Set(title); }
    if let Some(desc) = input.description { active.description = Set(desc); }
    if let Some(weight) = input.weight { active.weight = Set(weight); }
    if let Some(pos) = input.position { active.position = Set(pos); }
    if let Some(due) = input.due_date { active.due_date = Set(due.map(Into::into)); }
    if let Some(new_pid) = input.new_project_id {
        verify_project_owner(&state.db, new_pid, auth.user_id).await?;
        active.project_id = Set(new_pid);
    }
    if let Some(is_done) = input.is_done {
        active.is_done = Set(is_done);
        active.done_at = Set(if is_done { Some(chrono::Utc::now().into()) } else { None });
    }
    active.updated_at = Set(chrono::Utc::now().into());

    let updated = active.update(&state.db).await?;
    state.emit("task", "updated", &updated.id.to_string(), &auth.user_id.to_string());
    Ok(Json(updated))
}

async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, id)): Path<(Uuid, Uuid)>,
) -> ApiResult<Json<serde_json::Value>> {
    verify_project_owner(&state.db, project_id, auth.user_id).await?;
    let result = task::Entity::delete_many()
        .filter(task::Column::Id.eq(id))
        .filter(task::Column::ProjectId.eq(project_id))
        .exec(&state.db)
        .await?;

    if result.rows_affected == 0 {
        return Err(AppError::NotFound);
    }
    state.emit("task", "deleted", &id.to_string(), &auth.user_id.to_string());
    Ok(Json(serde_json::json!({ "deleted": true })))
}

async fn reorder(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(project_id): Path<Uuid>,
    Json(input): Json<ReorderInput>,
) -> ApiResult<Json<serde_json::Value>> {
    verify_project_owner(&state.db, project_id, auth.user_id).await?;

    for (pos, task_id) in input.task_ids.iter().enumerate() {
        task::Entity::update_many()
            .filter(task::Column::Id.eq(*task_id))
            .filter(task::Column::ProjectId.eq(project_id))
            .col_expr(task::Column::Position, Expr::value(pos as i32))
            .exec(&state.db)
            .await?;
    }

    Ok(Json(serde_json::json!({ "reordered": true })))
}
