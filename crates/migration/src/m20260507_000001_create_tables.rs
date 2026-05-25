use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Users
        manager
            .create_table(
                Table::create()
                    .table(Users::Table)
                    .if_not_exists()
                    .col(pk_auto(Users::Id))
                    .col(string_uniq(Users::Email))
                    .col(string(Users::Username))
                    .col(string(Users::PasswordHash))
                    .col(timestamp_with_time_zone(Users::CreatedAt).default(Expr::current_timestamp()))
                    .col(timestamp_with_time_zone(Users::UpdatedAt).default(Expr::current_timestamp()))
                    .to_owned(),
            )
            .await?;

        // Projects
        manager
            .create_table(
                Table::create()
                    .table(Projects::Table)
                    .if_not_exists()
                    .col(pk_auto(Projects::Id))
                    .col(integer(Projects::UserId))
                    .col(string(Projects::Title))
                    .col(text_null(Projects::Description))
                    .col(string_null(Projects::Color))
                    .col(boolean(Projects::IsArchived).default(false))
                    .col(integer(Projects::Position).default(0))
                    .col(timestamp_with_time_zone(Projects::CreatedAt).default(Expr::current_timestamp()))
                    .col(timestamp_with_time_zone(Projects::UpdatedAt).default(Expr::current_timestamp()))
                    .foreign_key(
                        ForeignKey::create()
                            .from(Projects::Table, Projects::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // Tasks
        manager
            .create_table(
                Table::create()
                    .table(Tasks::Table)
                    .if_not_exists()
                    .col(pk_auto(Tasks::Id))
                    .col(integer(Tasks::ProjectId))
                    .col(string(Tasks::Title))
                    .col(text_null(Tasks::Description))
                    .col(string(Tasks::Weight).default("medium"))
                    .col(integer(Tasks::Position).default(0))
                    .col(boolean(Tasks::IsDone).default(false))
                    .col(timestamp_with_time_zone_null(Tasks::DoneAt))
                    .col(timestamp_with_time_zone_null(Tasks::DueDate))
                    .col(timestamp_with_time_zone(Tasks::CreatedAt).default(Expr::current_timestamp()))
                    .col(timestamp_with_time_zone(Tasks::UpdatedAt).default(Expr::current_timestamp()))
                    .foreign_key(
                        ForeignKey::create()
                            .from(Tasks::Table, Tasks::ProjectId)
                            .to(Projects::Table, Projects::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // Labels
        manager
            .create_table(
                Table::create()
                    .table(Labels::Table)
                    .if_not_exists()
                    .col(pk_auto(Labels::Id))
                    .col(integer(Labels::ProjectId))
                    .col(string(Labels::Title))
                    .col(string(Labels::Color).default("#737373"))
                    .col(timestamp_with_time_zone(Labels::CreatedAt).default(Expr::current_timestamp()))
                    .foreign_key(
                        ForeignKey::create()
                            .from(Labels::Table, Labels::ProjectId)
                            .to(Projects::Table, Projects::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // Task-Labels junction
        manager
            .create_table(
                Table::create()
                    .table(TaskLabels::Table)
                    .if_not_exists()
                    .col(integer(TaskLabels::TaskId))
                    .col(integer(TaskLabels::LabelId))
                    .primary_key(
                        Index::create()
                            .col(TaskLabels::TaskId)
                            .col(TaskLabels::LabelId),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(TaskLabels::Table, TaskLabels::TaskId)
                            .to(Tasks::Table, Tasks::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(TaskLabels::Table, TaskLabels::LabelId)
                            .to(Labels::Table, Labels::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // Comments
        manager
            .create_table(
                Table::create()
                    .table(Comments::Table)
                    .if_not_exists()
                    .col(pk_auto(Comments::Id))
                    .col(integer(Comments::TaskId))
                    .col(integer(Comments::UserId))
                    .col(text(Comments::Body))
                    .col(timestamp_with_time_zone(Comments::CreatedAt).default(Expr::current_timestamp()))
                    .col(timestamp_with_time_zone(Comments::UpdatedAt).default(Expr::current_timestamp()))
                    .foreign_key(
                        ForeignKey::create()
                            .from(Comments::Table, Comments::TaskId)
                            .to(Tasks::Table, Tasks::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .from(Comments::Table, Comments::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager.drop_table(Table::drop().table(Comments::Table).to_owned()).await?;
        manager.drop_table(Table::drop().table(TaskLabels::Table).to_owned()).await?;
        manager.drop_table(Table::drop().table(Labels::Table).to_owned()).await?;
        manager.drop_table(Table::drop().table(Tasks::Table).to_owned()).await?;
        manager.drop_table(Table::drop().table(Projects::Table).to_owned()).await?;
        manager.drop_table(Table::drop().table(Users::Table).to_owned()).await?;
        Ok(())
    }
}

#[derive(DeriveIden)]
enum Users {
    Table, Id, Email, Username, PasswordHash, CreatedAt, UpdatedAt,
}

#[derive(DeriveIden)]
enum Projects {
    Table, Id, UserId, Title, Description, Color, IsArchived, Position, CreatedAt, UpdatedAt,
}

#[derive(DeriveIden)]
enum Tasks {
    Table, Id, ProjectId, Title, Description, Weight, Position, IsDone, DoneAt, DueDate, CreatedAt, UpdatedAt,
}

#[derive(DeriveIden)]
enum Labels {
    Table, Id, ProjectId, Title, Color, CreatedAt,
}

#[derive(DeriveIden)]
enum TaskLabels {
    Table, TaskId, LabelId,
}

#[derive(DeriveIden)]
enum Comments {
    Table, Id, TaskId, UserId, Body, CreatedAt, UpdatedAt,
}
