use clap::Parser;
use color_eyre::Result;
use leuchtturm_migrations;
use leuchtturm_web;

use crate::cli::{Cli, Commands, Database::Migrate};

mod cli;

#[tokio::main]
async fn main() -> Result<()> {
	let cli = Cli::parse();

	match cli.command {
		Commands::Web(args) => leuchtturm_web::serve(args.into()).await?,
		Commands::Database(Migrate(args)) => {
			leuchtturm_migrations::run(&args.database_url).await?
		}
	}

	Ok(())
}
