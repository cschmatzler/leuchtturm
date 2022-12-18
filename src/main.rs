use clap::Parser;
use color_eyre::Result;
use leuchtturm_migrations;
use leuchtturm_web;

use crate::cli::{Cli, Database::Migrate, Run};

mod cli;

#[tokio::main]
async fn main() -> Result<()> {
	let cli = Cli::parse();

	match cli.command {
		Run::Web(args) => leuchtturm_web::serve(args.into()).await?,
		Run::Database(Migrate(args)) => leuchtturm_migrations::run(&args.database_url).await,
	}

	Ok(())
}
