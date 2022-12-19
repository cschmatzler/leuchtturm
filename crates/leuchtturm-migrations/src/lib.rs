//! Tiny crate that allows executing database migrations at runtime.
//!
//! Essentially just a wrapper around around [sqlx::postgres::PgPool] and [sqlx::migrate!] that
//! can be called with a database URL.

#![warn(
	clippy::correctness,
	clippy::suspicious,
	clippy::complexity,
	clippy::perf,
	clippy::style,
	rust_2018_idioms,
	future_incompatible,
	nonstandard_style,
	missing_debug_implementations,
	missing_docs
)]
#![deny(unreachable_pub, private_in_public)]

use sqlx::{migrate, postgres::PgPoolOptions};

/// Run all database migrations.
///
/// Since this function can only be triggered as a singular execution and is not part of any
/// long-running processes, it will panic instead of returning a [Result]. Errors should then be
/// debugged, handled and the execution triggered again.
///
/// # Panics
/// This function panics in two scenarios:
/// - Database connection cannot be established. This could be because the `database_url`
///   parameter is incorrect, or if the database is not currently available.
/// - Running migrations failed. This just panics on [sqlx::migrate::MigrateError]. The migration
///   files might contain invalid SQL or something else failed.
pub async fn run(database_url: &str) {
	let db = PgPoolOptions::new()
		.max_connections(25)
		.connect(database_url)
		.await
		.expect("Could not connect to database");

	migrate!().run(&db).await.expect("Failed to run migrations");
}
