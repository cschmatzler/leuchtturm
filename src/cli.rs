use std::net::{IpAddr, Ipv4Addr};

use clap::{Args, Parser, Subcommand};

#[derive(Parser)]
#[command(author, version, about, long_about = None)]
pub(crate) struct Cli {
	#[command(subcommand)]
	pub(crate) command: Run,
}

#[derive(Subcommand)]
pub(crate) enum Run {
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
	#[arg(long, env, help = "Enable tracing")]
	pub(crate) enable_tracing: bool,
	#[arg(
		long,
		env,
		help = "Lightstep Access Token - presence enables trace export to Lightstep"
	)]
	pub(crate) lightstep_token: Option<String>,
}

impl From<Web> for leuchtturm_web::Config {
	fn from(web: Web) -> Self {
		leuchtturm_web::Config {
			host: web.host,
			port: web.port,
			database_url: web.database_url,
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
