use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();

        db.execute_unprepared("PRAGMA foreign_keys = ON").await?;

        db.execute_unprepared(
            "CREATE TABLE IF NOT EXISTS users (
                id BLOB PRIMARY KEY NOT NULL,
                email TEXT NOT NULL UNIQUE,
                username TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )"
        ).await?;

        db.execute_unprepared(
            "CREATE TABLE IF NOT EXISTS projects (
                id BLOB PRIMARY KEY NOT NULL,
                user_id BLOB NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                description TEXT,
                color TEXT,
                icon TEXT,
                parent_id BLOB REFERENCES projects(id) ON DELETE CASCADE,
                is_archived INTEGER NOT NULL DEFAULT 0,
                position INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )"
        ).await?;

        db.execute_unprepared(
            "CREATE TABLE IF NOT EXISTS tasks (
                id BLOB PRIMARY KEY NOT NULL,
                project_id BLOB NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                description TEXT,
                weight TEXT NOT NULL DEFAULT 'medium',
                position INTEGER NOT NULL DEFAULT 0,
                is_done INTEGER NOT NULL DEFAULT 0,
                done_at TEXT,
                due_date TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )"
        ).await?;

        db.execute_unprepared(
            "CREATE TABLE IF NOT EXISTS labels (
                id BLOB PRIMARY KEY NOT NULL,
                project_id BLOB NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                color TEXT NOT NULL DEFAULT '#737373',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )"
        ).await?;

        db.execute_unprepared(
            "CREATE TABLE IF NOT EXISTS task_labels (
                task_id BLOB NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                label_id BLOB NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
                PRIMARY KEY (task_id, label_id)
            )"
        ).await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();
        db.execute_unprepared("DROP TABLE IF EXISTS task_labels").await?;
        db.execute_unprepared("DROP TABLE IF EXISTS labels").await?;
        db.execute_unprepared("DROP TABLE IF EXISTS tasks").await?;
        db.execute_unprepared("DROP TABLE IF EXISTS projects").await?;
        db.execute_unprepared("DROP TABLE IF EXISTS users").await?;
        Ok(())
    }
}
