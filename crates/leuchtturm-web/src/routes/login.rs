use axum::{
	extract::State,
	response::{Html, IntoResponse},
	Form,
};
use leuchtturm_core::authentication::user;
use serde::Deserialize;
use sqlx::PgPool;

use crate::{htmx::Htmx, template::TEMPLATES, util::redirect_to};

#[derive(Debug, Deserialize)]
pub(crate) struct LoginForm {
	email: Option<String>,
	password: Option<String>,
}

pub(crate) async fn get() -> Html<String> {
	Html(
		TEMPLATES
			.render("login.html", &tera::Context::new())
			.unwrap(),
	)
}

pub(crate) async fn post(
	_htmx: Htmx,
	State(db_pool): State<PgPool>,
	Form(login_form): Form<LoginForm>,
) -> impl IntoResponse {
	if let Some(email) = login_form.email && let Some(password) = login_form.password {
		let _user = user::get_with_email_and_password(&db_pool, email, password).await;
	}

	redirect_to("/")
}

