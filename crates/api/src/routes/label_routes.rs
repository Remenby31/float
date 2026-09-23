use axum::extract::{Path, State};
use axum::routing::get;
use axum::{Json, Router};
use sea_orm::*;
use serde::Deserialize;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::error::{ApiResult, AppError};
use crate::state::AppState;
use float_db::entities::{label, project, task, task_label};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/projects/{project_id}/labels", get(list).post(create))
        .route(
            "/projects/{project_id}/labels/{id}",
            axum::routing::delete(delete),
        )
        .route(
            "/projects/{project_id}/tasks/{task_id}/labels/{label_id}",
            axum::routing::put(attach).delete(detach),
        )
}

#[derive(Deserialize)]
struct CreateLabel {
    title: String,
    color: Option<String>,
}

async fn verify_project_owner(
    db: &DatabaseConnection,
    project_id: Uuid,
    user_id: Uuid,
) -> ApiResult<()> {
    project::Entity::find_by_id(project_id)
        .filter(project::Column::UserId.eq(user_id))
        .one(db)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(())
}

async fn verify_label_link_owner(
    db: &DatabaseConnection,
    project_id: Uuid,
    task_id: Uuid,
    label_id: Uuid,
    user_id: Uuid,
) -> ApiResult<()> {
    verify_project_owner(db, project_id, user_id).await?;
    task::Entity::find_by_id(task_id)
        .filter(task::Column::ProjectId.eq(project_id))
        .one(db)
        .await?
        .ok_or(AppError::NotFound)?;
    label::Entity::find_by_id(label_id)
        .filter(label::Column::ProjectId.eq(project_id))
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
    label::Entity::delete_many()
        .filter(label::Column::Id.eq(id))
        .filter(label::Column::ProjectId.eq(project_id))
        .exec(&state.db)
        .await?;
    Ok(Json(serde_json::json!({ "deleted": true })))
}

async fn attach(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((project_id, task_id, label_id)): Path<(Uuid, Uuid, Uuid)>,
) -> ApiResult<Json<serde_json::Value>> {
    verify_label_link_owner(&state.db, project_id, task_id, label_id, auth.user_id).await?;
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
    verify_label_link_owner(&state.db, project_id, task_id, label_id, auth.user_id).await?;
    task_label::Entity::delete_many()
        .filter(task_label::Column::TaskId.eq(task_id))
        .filter(task_label::Column::LabelId.eq(label_id))
        .exec(&state.db)
        .await?;
    Ok(Json(serde_json::json!({ "detached": true })))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::{to_bytes, Body};
    use axum::http::{header, Method, Request, StatusCode};
    use axum::response::Response;
    use sea_orm_migration::MigratorTrait;
    use serde_json::{json, Value};
    use tower::ServiceExt;

    #[derive(Clone, Copy)]
    struct ProjectObjects {
        project_id: Uuid,
        task_id: Uuid,
        label_id: Uuid,
    }

    impl ProjectObjects {
        async fn create(db: &DatabaseConnection, owner: Uuid) -> Self {
            let objects = Self {
                project_id: Uuid::new_v4(),
                task_id: Uuid::new_v4(),
                label_id: Uuid::new_v4(),
            };
            db.execute(Statement::from_sql_and_values(
                DbBackend::Sqlite,
                "INSERT INTO projects (id, user_id, title) VALUES (?, ?, 'test')",
                [objects.project_id.into(), owner.into()],
            ))
            .await
            .unwrap();
            db.execute(Statement::from_sql_and_values(
                DbBackend::Sqlite,
                "INSERT INTO tasks (id, project_id, title) VALUES (?, ?, 'test')",
                [objects.task_id.into(), objects.project_id.into()],
            ))
            .await
            .unwrap();
            db.execute(Statement::from_sql_and_values(
                DbBackend::Sqlite,
                "INSERT INTO labels (id, project_id, title) VALUES (?, ?, 'test')",
                [objects.label_id.into(), objects.project_id.into()],
            ))
            .await
            .unwrap();
            objects
        }

        fn labels_path(self) -> String {
            format!("/projects/{}/labels", self.project_id)
        }

        fn link_path(self, task: Uuid, label: Uuid) -> String {
            format!("/projects/{}/tasks/{task}/labels/{label}", self.project_id)
        }
    }

    struct Fixture {
        db: DatabaseConnection,
        app: Router,
        token: String,
        own: ProjectObjects,
        foreign: ProjectObjects,
        sibling: ProjectObjects,
    }

    impl Fixture {
        async fn new() -> Self {
            let mut options = ConnectOptions::new("sqlite::memory:");
            options.max_connections(1);
            let db = Database::connect(options).await.unwrap();
            float_migration::Migrator::up(&db, None).await.unwrap();
            let owner = Uuid::new_v4();
            let other_owner = Uuid::new_v4();
            for id in [owner, other_owner] {
                db.execute(Statement::from_sql_and_values(
                    DbBackend::Sqlite,
                    "INSERT INTO users (id, email, username, password_hash) VALUES (?, ?, 'test', 'unused')",
                    [id.into(), format!("{id}@example.test").into()],
                )).await.unwrap();
            }

            let own = ProjectObjects::create(&db, owner).await;
            let foreign = ProjectObjects::create(&db, other_owner).await;
            let sibling = ProjectObjects::create(&db, owner).await;
            let secret = "label-tests-only-not-a-deployed-secret";
            let token = crate::auth::create_token(owner, secret, 3600).unwrap();
            Self {
                app: routes().with_state(AppState::new(db.clone(), secret.to_string())),
                db,
                token,
                own,
                foreign,
                sibling,
            }
        }

        async fn request(&self, method: Method, path: &str, body: Option<Value>) -> Response {
            let mut request = Request::builder()
                .method(method)
                .uri(path)
                .header(header::AUTHORIZATION, format!("Bearer {}", self.token));
            let body = if let Some(value) = body {
                request = request.header(header::CONTENT_TYPE, "application/json");
                Body::from(serde_json::to_vec(&value).unwrap())
            } else {
                Body::empty()
            };
            self.app
                .clone()
                .oneshot(request.body(body).unwrap())
                .await
                .unwrap()
        }

        async fn seed_link(&self, task: Uuid, label: Uuid) {
            task_label::ActiveModel {
                task_id: Set(task),
                label_id: Set(label),
            }
            .insert(&self.db)
            .await
            .unwrap();
        }

        async fn link_exists(&self, task: Uuid, label: Uuid) -> bool {
            task_label::Entity::find_by_id((task, label))
                .one(&self.db)
                .await
                .unwrap()
                .is_some()
        }

        fn mismatched_members(&self) -> [(Uuid, Uuid); 6] {
            [
                (self.own.task_id, self.foreign.label_id),
                (self.foreign.task_id, self.own.label_id),
                (self.foreign.task_id, self.foreign.label_id),
                (self.own.task_id, self.sibling.label_id),
                (self.sibling.task_id, self.own.label_id),
                (self.sibling.task_id, self.sibling.label_id),
            ]
        }
    }

    async fn response_json(response: Response) -> Value {
        serde_json::from_slice(&to_bytes(response.into_body(), 8192).await.unwrap()).unwrap()
    }

    #[tokio::test]
    async fn label_delete_cannot_remove_labels_from_other_projects() {
        let fixture = Fixture::new().await;
        for objects in [fixture.foreign, fixture.sibling] {
            fixture.seed_link(objects.task_id, objects.label_id).await;
            let path = format!("{}/{}", fixture.own.labels_path(), objects.label_id);
            let response = fixture.request(Method::DELETE, &path, None).await;
            assert!(
                label::Entity::find_by_id(objects.label_id)
                    .one(&fixture.db)
                    .await
                    .unwrap()
                    .is_some(),
                "foreign label was deleted"
            );
            assert!(fixture.link_exists(objects.task_id, objects.label_id).await);
            // Preserve the existing idempotent response without revealing whether
            // the label exists in a project the request cannot mutate.
            assert_eq!(response.status(), StatusCode::OK);
            assert_eq!(response_json(response).await, json!({"deleted": true}));
        }
    }

    #[tokio::test]
    async fn label_delete_remains_idempotent_and_cascades_owned_links() {
        let fixture = Fixture::new().await;
        fixture
            .seed_link(fixture.own.task_id, fixture.own.label_id)
            .await;
        for id in [fixture.own.label_id, fixture.own.label_id, Uuid::new_v4()] {
            let path = format!("{}/{}", fixture.own.labels_path(), id);
            let response = fixture.request(Method::DELETE, &path, None).await;
            assert_eq!(response.status(), StatusCode::OK);
            assert_eq!(response_json(response).await, json!({"deleted": true}));
        }
        assert!(label::Entity::find_by_id(fixture.own.label_id)
            .one(&fixture.db)
            .await
            .unwrap()
            .is_none());
        assert!(
            !fixture
                .link_exists(fixture.own.task_id, fixture.own.label_id)
                .await
        );
        assert_eq!(label::Entity::find().count(&fixture.db).await.unwrap(), 2);
    }

    #[tokio::test]
    async fn label_attach_rejects_cross_project_task_or_label() {
        let fixture = Fixture::new().await;
        for (task, label) in fixture.mismatched_members() {
            let path = fixture.own.link_path(task, label);
            let response = fixture.request(Method::PUT, &path, None).await;
            assert!(
                !fixture.link_exists(task, label).await,
                "unauthorized task-label link was created"
            );
            assert_eq!(response.status(), StatusCode::NOT_FOUND, "{path}");
        }
    }

    #[tokio::test]
    async fn label_detach_rejects_cross_project_task_or_label() {
        let fixture = Fixture::new().await;
        for (task, label) in fixture.mismatched_members() {
            // Model even pre-existing invalid cross-project links without giving
            // this project's request permission to remove another project's data.
            fixture.seed_link(task, label).await;
            let path = fixture.own.link_path(task, label);
            let response = fixture.request(Method::DELETE, &path, None).await;
            assert!(
                fixture.link_exists(task, label).await,
                "unauthorized task-label link was removed"
            );
            assert_eq!(response.status(), StatusCode::NOT_FOUND, "{path}");
        }
    }

    #[tokio::test]
    async fn label_link_operations_reject_nonexistent_members() {
        let fixture = Fixture::new().await;
        for (task, label) in [
            (Uuid::new_v4(), fixture.own.label_id),
            (fixture.own.task_id, Uuid::new_v4()),
            (Uuid::new_v4(), Uuid::new_v4()),
        ] {
            let path = fixture.own.link_path(task, label);
            for method in [Method::PUT, Method::DELETE] {
                let response = fixture.request(method.clone(), &path, None).await;
                assert_eq!(response.status(), StatusCode::NOT_FOUND, "{method} {path}");
            }
        }
        assert_eq!(
            task_label::Entity::find().count(&fixture.db).await.unwrap(),
            0
        );
    }

    #[tokio::test]
    async fn label_routes_require_an_owned_project() {
        let fixture = Fixture::new().await;
        fixture
            .seed_link(fixture.foreign.task_id, fixture.foreign.label_id)
            .await;
        for project in [fixture.foreign.project_id, Uuid::new_v4()] {
            let base = format!("/projects/{project}/labels");
            let link = format!(
                "/projects/{project}/tasks/{}/labels/{}",
                fixture.foreign.task_id, fixture.foreign.label_id
            );
            for (method, path, body) in [
                (Method::GET, base.clone(), None),
                (
                    Method::POST,
                    base.clone(),
                    Some(json!({"title": "blocked"})),
                ),
                (
                    Method::DELETE,
                    format!("{base}/{}", fixture.foreign.label_id),
                    None,
                ),
                (Method::PUT, link.clone(), None),
                (Method::DELETE, link, None),
            ] {
                let response = fixture.request(method.clone(), &path, body).await;
                assert_eq!(response.status(), StatusCode::NOT_FOUND, "{method} {path}");
            }
        }
        assert!(
            fixture
                .link_exists(fixture.foreign.task_id, fixture.foreign.label_id)
                .await
        );
        assert_eq!(label::Entity::find().count(&fixture.db).await.unwrap(), 3);
    }

    #[tokio::test]
    async fn label_list_and_create_preserve_scoping_titles_and_colors() {
        let fixture = Fixture::new().await;
        for objects in [fixture.own, fixture.sibling] {
            let response = fixture
                .request(Method::GET, &objects.labels_path(), None)
                .await;
            assert_eq!(response.status(), StatusCode::OK);
            let labels = response_json(response).await;
            assert_eq!(labels.as_array().unwrap().len(), 1);
            assert_eq!(labels[0]["id"], objects.label_id.to_string());
        }

        let mut expected_ids = vec![fixture.own.label_id.to_string()];
        for (input, expected_color) in [
            (json!({"title": "À faire"}), "#737373"),
            (json!({"title": "Urgent", "color": "#ef4444"}), "#ef4444"),
        ] {
            let response = fixture
                .request(
                    Method::POST,
                    &fixture.own.labels_path(),
                    Some(input.clone()),
                )
                .await;
            assert_eq!(response.status(), StatusCode::OK);
            let created = response_json(response).await;
            assert_eq!(created["title"], input["title"]);
            assert_eq!(created["color"], expected_color);
            assert_eq!(created["project_id"], fixture.own.project_id.to_string());
            expected_ids.push(created["id"].as_str().unwrap().to_string());
        }
        let response = fixture
            .request(Method::GET, &fixture.own.labels_path(), None)
            .await;
        assert_eq!(response.status(), StatusCode::OK);
        let listed = response_json(response).await;
        let mut actual_ids: Vec<_> = listed
            .as_array()
            .unwrap()
            .iter()
            .map(|item| item["id"].as_str().unwrap().to_string())
            .collect();
        actual_ids.sort();
        expected_ids.sort();
        assert_eq!(actual_ids, expected_ids);
    }

    #[tokio::test]
    async fn label_attach_and_detach_remain_idempotent_for_valid_members() {
        let fixture = Fixture::new().await;
        for objects in [fixture.own, fixture.sibling] {
            let path = objects.link_path(objects.task_id, objects.label_id);
            for _ in 0..2 {
                let response = fixture.request(Method::PUT, &path, None).await;
                assert_eq!(response.status(), StatusCode::OK);
                assert_eq!(response_json(response).await, json!({"attached": true}));
                assert!(fixture.link_exists(objects.task_id, objects.label_id).await);
                assert_eq!(
                    task_label::Entity::find().count(&fixture.db).await.unwrap(),
                    1
                );
            }
            for _ in 0..2 {
                let response = fixture.request(Method::DELETE, &path, None).await;
                assert_eq!(response.status(), StatusCode::OK);
                assert_eq!(response_json(response).await, json!({"detached": true}));
                assert!(!fixture.link_exists(objects.task_id, objects.label_id).await);
            }
        }
        assert_eq!(label::Entity::find().count(&fixture.db).await.unwrap(), 3);
    }
}
