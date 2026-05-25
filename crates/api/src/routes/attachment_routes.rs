use axum::body::Body;
use axum::extract::{Multipart, Path, State};
use axum::http::header;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::{Json, Router};
use serde::Serialize;
use std::path::PathBuf;
use tokio::fs;

use uuid::Uuid;

use crate::auth::AuthUser;
use crate::error::{ApiResult, AppError};
use crate::state::AppState;
use float_db::entities::project;
use sea_orm::*;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/projects/{project_id}/tasks/{task_id}/attachments",
            get(list).post(upload),
        )
        .route(
            "/projects/{project_id}/tasks/{task_id}/attachments/{filename}",
            get(download).delete(delete),
        )
}

fn files_dir() -> PathBuf {
    PathBuf::from(std::env::var("FILES_DIR").unwrap_or_else(|_| "./files".to_string()))
}

fn task_dir(task_id: Uuid) -> PathBuf {
    files_dir().join(format!("task_{task_id}"))
}

async fn verify_owner(db: &DatabaseConnection, project_id: Uuid, user_id: Uuid) -> ApiResult<()> {
    project::Entity::find_by_id(project_id)
        .filter(project::Column::UserId.eq(user_id))
        .one(db)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(())
}

#[derive(Serialize)]
struct AttachmentInfo {
    name: String,
    size: u64,
}

async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, task_id)): Path<(Uuid, Uuid)>,
) -> ApiResult<Json<Vec<AttachmentInfo>>> {
    verify_owner(&state.db, project_id, auth.user_id).await?;

    let dir = task_dir(task_id);
    let mut files = Vec::new();
    if dir.exists() {
        let mut entries = fs::read_dir(&dir).await.map_err(|e| AppError::Other(e.into()))?;
        while let Some(entry) = entries.next_entry().await.map_err(|e| AppError::Other(e.into()))? {
            if let Ok(meta) = entry.metadata().await {
                if meta.is_file() {
                    files.push(AttachmentInfo {
                        name: entry.file_name().to_string_lossy().to_string(),
                        size: meta.len(),
                    });
                }
            }
        }
    }
    Ok(Json(files))
}

async fn upload(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, task_id)): Path<(Uuid, Uuid)>,
    mut multipart: Multipart,
) -> ApiResult<Json<Vec<AttachmentInfo>>> {
    verify_owner(&state.db, project_id, auth.user_id).await?;

    let dir = task_dir(task_id);
    fs::create_dir_all(&dir).await.map_err(|e| AppError::Other(e.into()))?;

    let mut uploaded = Vec::new();

    while let Some(field) = multipart.next_field().await.map_err(|e| AppError::BadRequest(e.to_string()))? {
        let filename = field
            .file_name()
            .map(|s| s.to_string())
            .unwrap_or_else(|| format!("file_{}", chrono::Utc::now().timestamp_millis()));

        // Sanitize filename
        let safe_name: String = filename
            .chars()
            .map(|c| if c.is_alphanumeric() || c == '.' || c == '-' || c == '_' { c } else { '_' })
            .collect();

        let data = field.bytes().await.map_err(|e| AppError::BadRequest(e.to_string()))?;
        let size = data.len() as u64;

        // Max 20MB
        if size > 20 * 1024 * 1024 {
            return Err(AppError::BadRequest("file too large (max 20MB)".into()));
        }

        let path = dir.join(&safe_name);
        fs::write(&path, &data).await.map_err(|e| AppError::Other(e.into()))?;

        uploaded.push(AttachmentInfo { name: safe_name, size });
    }

    Ok(Json(uploaded))
}

async fn download(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, task_id, filename)): Path<(Uuid, Uuid, String)>,
) -> Result<impl IntoResponse, AppError> {
    verify_owner(&state.db, project_id, auth.user_id).await?;

    let path = task_dir(task_id).join(&filename);
    if !path.exists() {
        return Err(AppError::NotFound);
    }

    let data = fs::read(&path).await.map_err(|e| AppError::Other(e.into()))?;

    let content_type = if filename.ends_with(".pdf") {
        "application/pdf"
    } else if filename.ends_with(".png") {
        "image/png"
    } else if filename.ends_with(".jpg") || filename.ends_with(".jpeg") {
        "image/jpeg"
    } else {
        "application/octet-stream"
    };

    Ok((
        [
            (header::CONTENT_TYPE, content_type.to_string()),
            (
                header::CONTENT_DISPOSITION,
                format!("attachment; filename=\"{filename}\""),
            ),
        ],
        Body::from(data),
    ))
}

async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, task_id, filename)): Path<(Uuid, Uuid, String)>,
) -> ApiResult<Json<serde_json::Value>> {
    verify_owner(&state.db, project_id, auth.user_id).await?;

    let path = task_dir(task_id).join(&filename);
    if path.exists() {
        fs::remove_file(&path).await.map_err(|e| AppError::Other(e.into()))?;
    }
    Ok(Json(serde_json::json!({ "deleted": true })))
}
