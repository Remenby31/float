pub use sea_orm_migration::prelude::*;

mod m20260507_000001_create_tables;
mod m20260525_000002_add_parent_id;
mod m20260525_000003_uuid_ids;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20260507_000001_create_tables::Migration),
            Box::new(m20260525_000002_add_parent_id::Migration),
            Box::new(m20260525_000003_uuid_ids::Migration),
        ]
    }
}
