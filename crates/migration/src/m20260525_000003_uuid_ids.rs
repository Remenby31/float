use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Drop all tables in reverse dependency order and recreate with UUID PKs
        manager.drop_table(Table::drop().table(Alias::new("comments")).if_exists().to_owned()).await?;
        manager.drop_table(Table::drop().table(Alias::new("task_labels")).if_exists().to_owned()).await?;
        manager.drop_table(Table::drop().table(Alias::new("labels")).if_exists().to_owned()).await?;
        manager.drop_table(Table::drop().table(Alias::new("tasks")).if_exists().to_owned()).await?;
        manager.drop_table(Table::drop().table(Alias::new("projects")).if_exists().to_owned()).await?;
        manager.drop_table(Table::drop().table(Alias::new("users")).if_exists().to_owned()).await?;

        // Enable uuid extension
        manager.get_connection().execute_unprepared("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"").await?;

        // Users
        manager.get_connection().execute_unprepared(
            "CREATE TABLE users (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                email VARCHAR NOT NULL UNIQUE,
                username VARCHAR NOT NULL,
                password_hash VARCHAR NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )"
        ).await?;

        // Projects
        manager.get_connection().execute_unprepared(
            "CREATE TABLE projects (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR NOT NULL,
                description TEXT,
                color VARCHAR,
                parent_id UUID REFERENCES projects(id) ON DELETE CASCADE,
                is_archived BOOLEAN NOT NULL DEFAULT false,
                position INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )"
        ).await?;

        // Tasks
        manager.get_connection().execute_unprepared(
            "CREATE TABLE tasks (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                title VARCHAR NOT NULL,
                description TEXT,
                weight VARCHAR NOT NULL DEFAULT 'medium',
                position INTEGER NOT NULL DEFAULT 0,
                is_done BOOLEAN NOT NULL DEFAULT false,
                done_at TIMESTAMPTZ,
                due_date TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )"
        ).await?;

        // Labels
        manager.get_connection().execute_unprepared(
            "CREATE TABLE labels (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                title VARCHAR NOT NULL,
                color VARCHAR NOT NULL DEFAULT '#737373',
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )"
        ).await?;

        // Task Labels
        manager.get_connection().execute_unprepared(
            "CREATE TABLE task_labels (
                task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                label_id UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
                PRIMARY KEY (task_id, label_id)
            )"
        ).await?;

        Ok(())
    }

    async fn down(&self, _manager: &SchemaManager) -> Result<(), DbErr> {
        // No going back
        Ok(())
    }
}
