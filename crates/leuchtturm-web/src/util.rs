use axum::{http::{HeaderMap, header, HeaderValue, StatusCode}, response::IntoResponse};

pub(crate) fn redirect_to(path: &'static str) -> impl IntoResponse {
	let mut headers = HeaderMap::with_capacity(1);
	headers.insert(header::LOCATION, HeaderValue::from_static(path));

	(StatusCode::SEE_OTHER, headers)
}
