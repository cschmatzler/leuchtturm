//! TODO: write module doc

/// Collection of all errors that the web service can return
#[derive(Debug, thiserror::Error)]
pub enum WebError {
	/// Error representing the situation when socket constructed from [Config]'s `host` and
	/// `port` is unavailable or the user does not have the permission to bind to it
	#[error("Error binding to given socket address")]
	BindError,
}
