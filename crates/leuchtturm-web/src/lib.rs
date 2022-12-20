//! Leuchtturm's web service
//!
//! The vast majority of the project is accessible through it's web interface. This crate is
//! handling all HTTP requests and represents an imperative shell calling the necessary business
//! domains.

// #![feature(async_fn_in_trait)]
#![warn(
	missing_docs,
	missing_debug_implementations,
	rust_2018_idioms,
	future_incompatible,
	clippy::correctness,
	clippy::suspicious,
	clippy::complexity,
	clippy::perf,
	nonstandard_style,
	clippy::style
)]
#![deny(unreachable_pub, private_in_public)]

use std::net::SocketAddr;

use axum::Server;

pub use crate::config::Config;
use crate::web_error::WebError;

pub mod config;
mod database;
mod htmx;
mod template;
mod router;
mod routes;
pub mod web_error;

/// Spins up the main web service
///
/// Since this is going to be the main entrypoint for the long-running service, its configuration
/// also takes related fields like database pools. This is then passed onto route handlers where
/// it's further passed down to the business logic.
pub async fn serve(config: Config) -> Result<(), WebError> {
	let db_pool = database::connect(&config.database_url).await?;
	let router = router::build(db_pool);

	Server::bind(&SocketAddr::new(config.host, config.port))
		.serve(router.into_make_service())
		.await
		.map_err(|_| WebError::Bind)?;

	Ok(())
}
