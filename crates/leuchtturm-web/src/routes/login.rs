use axum::{response::Html, Form};
use serde::Deserialize;

use crate::{template::TEMPLATES, htmx::Htmx};

#[derive(Debug, Deserialize)]
pub(crate) struct LoginForm {
	email: Option<String>,
	password: Option<String>,
}

pub(crate) async fn get() -> Html<String> {
	Html(TEMPLATES.render("login.html", &tera::Context::new()).unwrap())
}

pub(crate) async fn post(htmx: Htmx, Form(login_form): Form<LoginForm>) -> Html<&'static str> {
	dbg!(htmx);
	dbg!(login_form);

	Html("Hello")
}
