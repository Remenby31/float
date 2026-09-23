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
use float_db::entities::{project, task};
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

async fn verify_task_owner(
    db: &DatabaseConnection,
    project_id: Uuid,
    task_id: Uuid,
    user_id: Uuid,
) -> ApiResult<()> {
    task::Entity::find_by_id(task_id)
        .filter(task::Column::ProjectId.eq(project_id))
        .inner_join(project::Entity)
        .filter(project::Column::UserId.eq(user_id))
        .one(db)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(())
}

fn validate_filename(filename: &str) -> ApiResult<()> {
    // Path extractors have already percent-decoded route parameters. Reject
    // separators on both Unix and Windows, rather than sanitizing a path into
    // a different filename. Quotes/control characters cannot safely be used
    // in the download's Content-Disposition header either.
    if filename.is_empty()
        || matches!(filename, "." | "..")
        || filename
            .chars()
            .any(|c| c.is_control() || matches!(c, '/' | '\\' | ':' | '"'))
    {
        return Err(AppError::BadRequest("invalid attachment filename".into()));
    }
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
    verify_task_owner(&state.db, project_id, task_id, auth.user_id).await?;

    let dir = task_dir(task_id);
    let mut files = Vec::new();
    if dir.exists() {
        let mut entries = fs::read_dir(&dir)
            .await
            .map_err(|e| AppError::Other(e.into()))?;
        while let Some(entry) = entries
            .next_entry()
            .await
            .map_err(|e| AppError::Other(e.into()))?
        {
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
    verify_task_owner(&state.db, project_id, task_id, auth.user_id).await?;

    let dir = task_dir(task_id);
    fs::create_dir_all(&dir)
        .await
        .map_err(|e| AppError::Other(e.into()))?;

    let mut uploaded = Vec::new();

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(e.to_string()))?
    {
        let filename = field
            .file_name()
            .map(|s| s.to_string())
            .unwrap_or_else(|| format!("file_{}", chrono::Utc::now().timestamp_millis()));
        validate_filename(&filename)?;

        // Sanitize filename
        let safe_name: String = filename
            .chars()
            .map(|c| {
                if c.is_alphanumeric() || c == '.' || c == '-' || c == '_' {
                    c
                } else {
                    '_'
                }
            })
            .collect();
        validate_filename(&safe_name)?;

        let data = field
            .bytes()
            .await
            .map_err(|e| AppError::BadRequest(e.to_string()))?;
        let size = data.len() as u64;

        // Max 20MB
        if size > 20 * 1024 * 1024 {
            return Err(AppError::BadRequest("file too large (max 20MB)".into()));
        }

        let path = dir.join(&safe_name);
        fs::write(&path, &data)
            .await
            .map_err(|e| AppError::Other(e.into()))?;

        uploaded.push(AttachmentInfo {
            name: safe_name,
            size,
        });
    }

    Ok(Json(uploaded))
}

async fn download(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, task_id, filename)): Path<(Uuid, Uuid, String)>,
) -> Result<impl IntoResponse, AppError> {
    verify_task_owner(&state.db, project_id, task_id, auth.user_id).await?;
    validate_filename(&filename)?;

    let path = task_dir(task_id).join(&filename);
    if !path.exists() {
        return Err(AppError::NotFound);
    }

    let data = fs::read(&path)
        .await
        .map_err(|e| AppError::Other(e.into()))?;

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
    verify_task_owner(&state.db, project_id, task_id, auth.user_id).await?;
    validate_filename(&filename)?;

    let path = task_dir(task_id).join(&filename);
    if path.exists() {
        fs::remove_file(&path)
            .await
            .map_err(|e| AppError::Other(e.into()))?;
    }
    Ok(Json(serde_json::json!({ "deleted": true })))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::to_bytes;
    use axum::http::{Method, Request, StatusCode};
    use axum::response::Response;
    use sea_orm_migration::MigratorTrait;
    use tower::ServiceExt;

    struct Fixture {
        app: Router,
        token: String,
        project_id: Uuid,
        task_id: Uuid,
        other_project_id: Uuid,
        other_task_id: Uuid,
        sibling_task_id: Uuid,
    }

    impl Fixture {
        async fn new() -> Self {
            let mut options = ConnectOptions::new("sqlite::memory:");
            options.max_connections(1);
            let db = Database::connect(options).await.unwrap();
            float_migration::Migrator::up(&db, None).await.unwrap();

            let owner_id = Uuid::new_v4();
            let other_owner_id = Uuid::new_v4();
            for id in [owner_id, other_owner_id] {
                db.execute(Statement::from_sql_and_values(
                    DbBackend::Sqlite,
                    "INSERT INTO users (id, email, username, password_hash) VALUES (?, ?, 'test', 'unused')",
                    [id.into(), format!("{id}@example.test").into()],
                ))
                .await
                .unwrap();
            }

            let project_id = Uuid::new_v4();
            let other_project_id = Uuid::new_v4();
            let sibling_project_id = Uuid::new_v4();
            let task_id = Uuid::new_v4();
            let other_task_id = Uuid::new_v4();
            let sibling_task_id = Uuid::new_v4();
            for (project, task, owner) in [
                (project_id, task_id, owner_id),
                (other_project_id, other_task_id, other_owner_id),
                (sibling_project_id, sibling_task_id, owner_id),
            ] {
                db.execute(Statement::from_sql_and_values(
                    DbBackend::Sqlite,
                    "INSERT INTO projects (id, user_id, title) VALUES (?, ?, 'test')",
                    [project.into(), owner.into()],
                ))
                .await
                .unwrap();
                db.execute(Statement::from_sql_and_values(
                    DbBackend::Sqlite,
                    "INSERT INTO tasks (id, project_id, title) VALUES (?, ?, 'test')",
                    [task.into(), project.into()],
                ))
                .await
                .unwrap();
                fs::create_dir_all(task_dir(task)).await.unwrap();
                fs::write(task_dir(task).join("existing.txt"), b"existing attachment")
                    .await
                    .unwrap();
            }

            let secret = "attachment-tests-only-not-a-deployed-secret";
            let token = crate::auth::create_token(owner_id, secret, 3600).unwrap();
            Self {
                app: routes().with_state(AppState::new(db, secret.to_string())),
                token,
                project_id,
                task_id,
                other_project_id,
                other_task_id,
                sibling_task_id,
            }
        }

        fn base(project: Uuid, task: Uuid) -> String {
            format!("/projects/{project}/tasks/{task}/attachments")
        }

        async fn request(&self, method: Method, path: &str, filename: Option<&str>) -> Response {
            let mut request = Request::builder()
                .method(method)
                .uri(path)
                .header(header::AUTHORIZATION, format!("Bearer {}", self.token));
            let body = if let Some(filename) = filename {
                request = request.header(
                    header::CONTENT_TYPE,
                    "multipart/form-data; boundary=attachment-test",
                );
                Body::from(format!(
                    "--attachment-test\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\nContent-Type: application/octet-stream\r\n\r\nnew attachment\r\n--attachment-test--\r\n"
                ))
            } else {
                Body::empty()
            };
            self.app
                .clone()
                .oneshot(request.body(body).unwrap())
                .await
                .unwrap()
        }

        async fn assert_all_operations_denied(&self, project: Uuid, task: Uuid) {
            let base = Self::base(project, task);
            for (method, path, filename) in [
                (Method::GET, base.clone(), None),
                (Method::POST, base.clone(), Some("new.txt")),
                (Method::GET, format!("{base}/existing.txt"), None),
                (Method::DELETE, format!("{base}/existing.txt"), None),
            ] {
                let response = self.request(method.clone(), &path, filename).await;
                assert_eq!(response.status(), StatusCode::NOT_FOUND, "{method} {path}");
            }
        }
    }

    impl Drop for Fixture {
        fn drop(&mut self) {
            for task in [self.task_id, self.other_task_id, self.sibling_task_id] {
                let _ = std::fs::remove_dir_all(task_dir(task));
            }
        }
    }

    fn encode_segment(value: &str) -> String {
        value.bytes().map(|byte| format!("%{byte:02X}")).collect()
    }

    #[tokio::test]
    async fn attachment_operations_reject_another_users_task_under_own_project() {
        let fixture = Fixture::new().await;
        fixture
            .assert_all_operations_denied(fixture.project_id, fixture.other_task_id)
            .await;
        assert_eq!(
            fs::read(task_dir(fixture.other_task_id).join("existing.txt"))
                .await
                .unwrap(),
            b"existing attachment",
        );
        assert!(!task_dir(fixture.other_task_id).join("new.txt").exists());
    }

    #[tokio::test]
    async fn attachment_operations_reject_another_users_project() {
        let fixture = Fixture::new().await;
        fixture
            .assert_all_operations_denied(fixture.other_project_id, fixture.other_task_id)
            .await;
    }

    #[tokio::test]
    async fn attachment_operations_reject_task_in_a_different_owned_project() {
        let fixture = Fixture::new().await;
        fixture
            .assert_all_operations_denied(fixture.project_id, fixture.sibling_task_id)
            .await;
    }

    #[tokio::test]
    async fn attachment_operations_reject_a_nonexistent_task() {
        let fixture = Fixture::new().await;
        let missing_task = Uuid::new_v4();
        fixture
            .assert_all_operations_denied(fixture.project_id, missing_task)
            .await;
        assert!(!task_dir(missing_task).exists());
    }

    #[tokio::test]
    async fn attachment_download_and_delete_reject_unsafe_path_segments() {
        let fixture = Fixture::new().await;
        let base = Fixture::base(fixture.project_id, fixture.task_id);
        let absolute = std::fs::canonicalize(task_dir(fixture.other_task_id).join("existing.txt"))
            .unwrap()
            .to_string_lossy()
            .to_string();
        for name in [
            format!("../task_{}/existing.txt", fixture.other_task_id),
            absolute,
            ".".into(),
            "..".into(),
            "nested/existing.txt".into(),
            r"..\existing.txt".into(),
            r"C:\existing.txt".into(),
            "bad\0name".into(),
            "bad\r\nname".into(),
        ] {
            for method in [Method::GET, Method::DELETE] {
                let path = format!("{base}/{}", encode_segment(&name));
                let response = fixture.request(method.clone(), &path, None).await;
                assert_eq!(
                    response.status(),
                    StatusCode::BAD_REQUEST,
                    "{method}: {name:?}"
                );
            }
        }
        assert_eq!(
            fs::read(task_dir(fixture.other_task_id).join("existing.txt"))
                .await
                .unwrap(),
            b"existing attachment",
        );
    }

    #[tokio::test]
    async fn attachment_upload_rejects_unsafe_filenames() {
        let fixture = Fixture::new().await;
        let base = Fixture::base(fixture.project_id, fixture.task_id);
        for name in [
            "../outside.txt",
            "/absolute.txt",
            ".",
            "..",
            r"..\outside.txt",
            r"C:\outside.txt",
            "",
        ] {
            let response = fixture.request(Method::POST, &base, Some(name)).await;
            assert_eq!(
                response.status(),
                StatusCode::BAD_REQUEST,
                "filename: {name:?}"
            );
        }
        let mut entries = fs::read_dir(task_dir(fixture.task_id)).await.unwrap();
        assert_eq!(
            entries.next_entry().await.unwrap().unwrap().file_name(),
            "existing.txt"
        );
        assert!(entries.next_entry().await.unwrap().is_none());
    }

    #[tokio::test]
    async fn attachment_existing_files_and_sanitized_uploads_still_work() {
        let fixture = Fixture::new().await;
        let base = Fixture::base(fixture.project_id, fixture.task_id);
        let response = fixture
            .request(Method::GET, &format!("{base}/existing.txt"), None)
            .await;
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            to_bytes(response.into_body(), 4096).await.unwrap().as_ref(),
            b"existing attachment"
        );

        for name in ["résumé_2026.pdf", ".hidden", "report..final.txt"] {
            fs::write(task_dir(fixture.task_id).join(name), b"legacy attachment")
                .await
                .unwrap();
            let path = format!("{base}/{}", encode_segment(name));
            let response = fixture.request(Method::GET, &path, None).await;
            assert_eq!(response.status(), StatusCode::OK, "{name}");
            assert_eq!(
                to_bytes(response.into_body(), 4096).await.unwrap().as_ref(),
                b"legacy attachment"
            );
            assert_eq!(
                fixture.request(Method::DELETE, &path, None).await.status(),
                StatusCode::OK
            );
            assert!(!task_dir(fixture.task_id).join(name).exists());
        }

        let response = fixture
            .request(Method::POST, &base, Some("rapport été (final).pdf"))
            .await;
        assert_eq!(response.status(), StatusCode::OK);
        let body: serde_json::Value =
            serde_json::from_slice(&to_bytes(response.into_body(), 4096).await.unwrap()).unwrap();
        let stored_name = body[0]["name"].as_str().unwrap();
        assert_eq!(stored_name, "rapport_été__final_.pdf");
        assert_eq!(
            fs::read(task_dir(fixture.task_id).join(stored_name))
                .await
                .unwrap(),
            b"new attachment"
        );
        let response = fixture.request(Method::GET, &base, None).await;
        assert_eq!(response.status(), StatusCode::OK);
        let body: serde_json::Value =
            serde_json::from_slice(&to_bytes(response.into_body(), 4096).await.unwrap()).unwrap();
        assert_eq!(body.as_array().unwrap().len(), 2);
    }
}
