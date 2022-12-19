//! The service's main router
//!
//! There isn't much more to say here. An [axum::Router] that dispatches all of our routes,
//! handles shared state and sets up a tracing layer.
use axum::{response::Html, routing::get, Router};
use sqlx::PgPool;
use tera::Context;
use tower_http::trace::TraceLayer;

use crate::{htmx::Htmx, template::TEMPLATES};

pub(crate) fn init(db_pool: PgPool) -> Router {
	Router::new()
		.with_state(db_pool)
		.route("/", get(handler))
		.layer(TraceLayer::new_for_http())
}

async fn handler(htmx: Htmx) -> Html<String> {
	let context = Context::new();
	let html = if htmx.is_htmx {
		TEMPLATES.render("small.html", &context).unwrap()
	} else {
		TEMPLATES.render("index.html", &context).unwrap()
	};

	Html(html)
}
