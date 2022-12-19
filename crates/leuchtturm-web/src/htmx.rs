use axum::{async_trait, extract::FromRequestParts, http::request::Parts, response::Response};

#[derive(Debug)]
pub(crate) struct Htmx {
	pub(crate) is_htmx: bool,
}

#[async_trait]
impl<S> FromRequestParts<S> for Htmx
where
	S: Send + Sync,
{
	type Rejection = Response;

	async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
		// FIXME: This is ugly af
		match parts.headers.get("HX-Request").map(|val| val.to_str()) {
			Some(Ok("true")) => Ok(Htmx { is_htmx: true }),
			_ => Ok(Htmx { is_htmx: false }),
		}
	}
}
