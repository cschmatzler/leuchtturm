use lazy_static::lazy_static;
use tera::Tera;

lazy_static! {
	pub static ref TEMPLATES: Tera = {
		// This has to be relative to the root crate.
		match Tera::new("crates/leuchtturm-web/src/templates/**/*.html") {
			Ok(t) => t,
			Err(e) => {
				// TODO: make this nicer?
				println!("Parsing error(s): {}", e);
				::std::process::exit(1);
			}
		}
	};
}
