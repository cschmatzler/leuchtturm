//! Web-related error handling

use thiserror::Error;

/// Collection of all error types that the web service can return
#[derive(Debug, Error)]
pub enum WebError {
	/// Error representing the situation when socket constructed from
	/// [Config](crate::config::Config)'s `host` and `port` is unavailable or the user does not
	/// have the permission to bind to it
	#[error("Error binding to given socket address")]
	Bind,
	/// Database connection failure
	#[error("Error connecting to the database")]
	Database(#[from] sqlx::Error),
}
