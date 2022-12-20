use axum::{response::Html, Form};
use serde::Deserialize;

#[derive(Deserialize, Debug)]
pub(crate) struct PostRequestBody {
	email: String,
	password: String
}

pub(crate) async fn post(Form(body): Form<PostRequestBody>) -> Html<String> {
	dbg!(body);
	Html("bla".to_owned())
}
