use sea_orm::DatabaseConnection;
use serde::Serialize;
use tokio::sync::broadcast;

#[derive(Clone, Debug, Serialize)]
pub struct SyncEvent {
    pub kind: String,   // "project" | "task" | "attachment"
    pub action: String, // "created" | "updated" | "deleted"
    pub id: String,
    pub user_id: String,
}

#[derive(Clone)]
pub struct AppState {
    pub db: DatabaseConnection,
    pub jwt_secret: String,
    pub events_tx: broadcast::Sender<SyncEvent>,
}

impl AppState {
    pub fn new(db: DatabaseConnection, jwt_secret: String) -> Self {
        let (events_tx, _) = broadcast::channel(256);
        Self { db, jwt_secret, events_tx }
    }

    pub fn emit(&self, kind: &str, action: &str, id: &str, user_id: &str) {
        self.events_tx.send(SyncEvent {
            kind: kind.to_string(),
            action: action.to_string(),
            id: id.to_string(),
            user_id: user_id.to_string(),
        }).ok(); // ignore if no listeners
    }
}
