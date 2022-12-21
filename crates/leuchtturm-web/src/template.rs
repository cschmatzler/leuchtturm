//! Collection of templates that are rendered to HTML and sent as response.
//!
//! Uses [tera] for parsing.

use lazy_static::lazy_static;
use tera::Tera;

pub(crate) const STYLESHEET: &'static str = include_str!("../assets/styles.css");

lazy_static! {
	pub static ref TEMPLATES: Tera = {
		// This has to be relative to the root crate.
		match Tera::new("crates/leuchtturm-web/src/templates/**/*.html") {
			Ok(t) => t,
			Err(e) => {
				println!("Error parsing templates with errors: {e}");
				std::process::exit(1);
			}
		}
	};
}
