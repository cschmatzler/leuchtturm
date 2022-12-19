use axum::{response::Html, Router, routing::get};
use sqlx::PgPool;
use tower_http::trace::TraceLayer;

pub(crate) fn build(db_pool: PgPool) -> Router {
	Router::new()
		.with_state(db_pool)
		.route("/", get(handler))
		.layer(TraceLayer::new_for_http())
}

async fn handler() -> Html<&'static str> {
	Html("<h1>Hello, World!</h1>")
}
