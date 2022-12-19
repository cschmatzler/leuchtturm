use sqlx::{postgres::PgPoolOptions, PgPool};

use crate::web_error::WebError;

pub(crate) async fn connect(database_url: &str) -> Result<PgPool, WebError> {
	let pool = PgPoolOptions::new()
		.max_connections(5)
		.connect(database_url)
		.await?;

	Ok(pool)
}
