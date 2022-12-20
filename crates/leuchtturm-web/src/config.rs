//! Configuration for the web service
//!
//! Defines all items that can be externally configured and are used in the `web` domain.

use std::net::IpAddr;

/// Web service configuration
#[derive(Debug)]
pub struct Config {
	/// Host the web server should bind to
	pub host: IpAddr,
	/// Port the web server should bind to
	pub port: u16,
	/// Database connection URL - in standard PostgreSQL URI format
	pub database_url: String,
}
