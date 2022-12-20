use axum::{async_trait, extract::FromRequestParts, http::request::Parts, response::Response};

#[derive(Debug)]
pub(crate) struct Htmx {
	pub(crate) is_htmx: bool,
	pub(crate) _trigger: Option<String>,
	pub(crate) _target: Option<String>,
}

#[async_trait]
// NOTE: this can probably be done nicer by using `TypedHeader`
impl<S> FromRequestParts<S> for Htmx
where
	S: Send + Sync,
{
	type Rejection = Response;

	async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
		Ok(Htmx {
			is_htmx: get_header_value(parts, "HX-Request")
				.map(|val| val.parse::<bool>().unwrap_or(false))
				.unwrap_or(false),
			_trigger: get_header_value(parts, "HX-Trigger").map(|val| val.to_owned()),
			_target: get_header_value(parts, "HX-Target").map(|val| val.to_owned()),
		})
	}
}

fn get_header_value<'a>(parts: &'a mut Parts, header_name: &'static str) -> Option<&'a str> {
	parts
		.headers
		.get(header_name)
		.map(|val| val.to_str().unwrap_or_default())
}
