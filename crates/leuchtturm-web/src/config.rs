//! Configuration for our web service
//!
//! Defines all items that can be externally configured and are used in the `web` domain.
use std::net::IpAddr;

/// Web service configuration
#[derive(Debug)]
pub struct Config {
	/// Host the web server will bind to
	pub host: IpAddr,
	/// Port the web server will bind to
	pub port: u16,
	/// PostgreSQL database URL that will be used for all persistence inside web-accessible
	/// routes
	pub database_url: String,
}
