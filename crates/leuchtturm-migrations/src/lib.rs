//! Tiny module that allows us to execute database migrations at runtime.
//!
//! Wrapper around `sqlx` database pool and migrate macro that can be called with a database URL.

use sqlx::{migrate, migrate::MigrateError, postgres::PgPoolOptions};

/// Run all database migrations.
pub async fn run(database_url: &String) -> Result<(), MigrateError> {
	let db = PgPoolOptions::new()
		.max_connections(50)
		.connect(database_url)
		.await?;

	migrate!().run(&db).await?;

	Ok(())
}
