use clap::Parser;
use color_eyre::Result;

use crate::cli::{Cli, Database::Migrate, Run};

mod cli;
mod tracing;

#[tokio::main]
async fn main() -> Result<()> {
	let cli = Cli::parse();

	match cli.command {
		Run::Web(args) => {
			if args.enable_tracing {
				tracing::init(args.lightstep_token.clone())?;
			}
			leuchtturm_web::serve(args.into()).await?;
		}
		Run::Database(Migrate(args)) => leuchtturm_migrations::run(&args.database_url).await,
	}

	Ok(())
}
