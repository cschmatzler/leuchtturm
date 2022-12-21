use argon2::{Argon2, PasswordHash, PasswordVerifier};
use chrono::{DateTime, Utc};
use sqlx::{FromRow, PgPool};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AuthenticationError {
	#[error("Database error")]
	Database(#[from] sqlx::Error),
	#[error("Hash parsing error")]
	HashParsing(#[from] argon2::password_hash::Error),
	#[error("Password error")]
	Password(#[from] argon2::Error),
	#[error("User not found")]
	NotFound,
}

#[derive(Debug, Default, FromRow)]
pub struct User {
	user_id: String,
	email: String,
	password_hash: String,
	created_at: DateTime<Utc>,
	updated_at: Option<DateTime<Utc>>,
}

pub async fn get(db_pool: &PgPool, id: String) -> Result<Option<User>, sqlx::Error> {
	sqlx::query_as::<_, User>("select * from authentication.user WHERE id = ?")
		.bind(id)
		.fetch_optional(db_pool)
		.await
}

pub async fn get_by_email(db_pool: &PgPool, email: String) -> Result<Option<User>, sqlx::Error> {
	sqlx::query_as::<_, User>("select * from authentication.user WHERE email = ?")
		.bind(email)
		.fetch_optional(db_pool)
		.await
}

pub async fn get_with_email_and_password(
	db_pool: &PgPool,
	email: String,
	password: String,
) -> Result<User, AuthenticationError> {
	let user = get_by_email(db_pool, email)
		.await?
		.ok_or(AuthenticationError::NotFound)?;

	let hash = PasswordHash::new(&user.password_hash)?;
	Argon2::default().verify_password(password.as_bytes(), &hash)?;

	Ok(user)
}
