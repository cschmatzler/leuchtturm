//! The service's main router
//!
//! There isn't much more to say here. An [axum::Router] that dispatches all of our routes,
//! handles shared state and sets up a tracing layer.

use axum::{
	http::{header, HeaderMap},
	response::IntoResponse,
	routing::{get, post},
	Router,
};
use sqlx::PgPool;
use tower_http::trace::TraceLayer;

use crate::{routes, template::STYLESHEET};

/// Builds the main router running the service
///
/// Embeds all state that is needed by route handlers to access various functions, such as
/// database connections.
pub(crate) fn build(db_pool: PgPool) -> Router {
	Router::new()
		.with_state(db_pool)
		.route("/styles.css", get(serve_styles))
		.route("/login", get(routes::login::get).post(routes::login::post))
		.route("/signup", post(routes::signup::post))
		.layer(TraceLayer::new_for_http())
}

async fn serve_styles() -> impl IntoResponse {
	let mut headers = HeaderMap::with_capacity(1);
	headers.insert(header::CONTENT_TYPE, "text/css".parse().unwrap());
	(headers, STYLESHEET)
}
