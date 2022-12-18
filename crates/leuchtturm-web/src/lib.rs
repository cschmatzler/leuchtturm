//! Leuchtturm's web service
//!
//! The vast majority of the project is accessible through it's web interface. This crate is
//! handling all HTTP requests and represents an imperative shell calling the necessary business
//! domains.

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

use std::net::SocketAddr;

use axum::{Router, Server};
pub use config::Config;
use web_error::WebError;

pub mod config;
pub mod web_error;

/// Spins up the main web service
///
/// Since this is going to be the main entrypoint for the long-running service, its configuration
/// also takes related fields like database pools. This is then passed onto route handlers where
/// it's further passed down to the business logic.
pub async fn serve(config: Config) -> Result<(), WebError> {
	let router = Router::new();

	Server::bind(&SocketAddr::new(config.host, config.port))
		.serve(router.into_make_service())
		.await
		.map_err(|_| WebError::BindError)?;

	Ok(())
}
