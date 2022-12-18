use std::net::{IpAddr, Ipv4Addr};

use clap::{Args, Parser, Subcommand};

#[derive(Parser)]
#[command(author, version, about, long_about = None)]
pub(crate) struct Cli {
	#[command(subcommand)]
	pub(crate) command: Commands,
}

#[derive(Subcommand)]
pub(crate) enum Commands {
	#[command(subcommand, about = "Database management tools")]
	Database(Database),
	#[command(about = "Run the Leuchtturm web server")]
	Web(Web),
}

#[derive(Args, Debug)]
pub(crate) struct Web {
	#[arg(long, env, help = "Host to bind the server on", default_value_t = IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)))]
	host: IpAddr,
	#[arg(long, env, help = "Port to bind the server on", default_value_t = 1872)]
	port: u16,
	#[arg(long, env, help = "PostgreSQL connection URL")]
	database_url: String,
}

impl Into<leuchtturm_web::Config> for Web {
	fn into(self) -> leuchtturm_web::Config {
		leuchtturm_web::Config {
			host: self.host,
			port: self.port,
			database_url: self.database_url,
		}
	}
}

#[derive(Subcommand)]
pub(crate) enum Database {
	#[command(about = "Run database migrations")]
	Migrate(Migrate),
}

#[derive(Args, Debug)]
pub(crate) struct Migrate {
	#[arg(long, env, help = "PostgreSQL connection URL")]
	pub(crate) database_url: String,
}
