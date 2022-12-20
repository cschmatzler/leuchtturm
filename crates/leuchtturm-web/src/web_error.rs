//! Web-related error handling

use thiserror::Error;

/// Collection of all error types that the web service can return
#[derive(Debug, Error)]
pub enum WebError {
	/// Failed to bind to given host and port
	#[error("Error binding to given socket address")]
	Bind,
	/// Database connection failure
	#[error("Error connecting to the database")]
	Database(#[from] sqlx::Error),
}
