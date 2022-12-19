use opentelemetry::{
	sdk::{trace, Resource},
	trace::TraceError,
	KeyValue,
};
use opentelemetry_otlp::{TonicExporterBuilder, WithExportConfig};
use thiserror::Error;
use tonic::{
	metadata::{errors::InvalidMetadataValue, MetadataMap},
	transport::ClientTlsConfig,
};
use tracing_subscriber::{
	layer::SubscriberExt,
	util::{SubscriberInitExt, TryInitError},
};

#[derive(Debug, Error)]
pub(crate) enum TracingError {
	#[error("The access token could not be parsed. It can only contain ASCII characters.")]
	AccessToken(#[from] InvalidMetadataValue),
	#[error("Error initialising pipeline")]
	Pipeline(#[from] TraceError),
	#[error("Error initialising subscriber")]
	Subscriber(#[from] TryInitError),
}

/// Initialises tracing for the application.
///
/// When the `lightstep_token` parameter is `None`, uses local tracing without any further setup to
/// authentication. This can be used together with the Jaeger setup provided by running `docker
/// compose -f docker-compose.dev.yaml up -d` for tracing during development.
/// In case a token is provided, it will be parsed into a gRPC metadata value and used to set up
/// trace exporting to Lightstep.
///
/// There are currently no observability providers available but Lightstep, as they are the current
/// primary and only choice for this project.
pub(crate) fn init(lightstep_token: Option<String>) -> Result<(), TracingError> {
	let resource = Resource::new(vec![KeyValue::new("service.name", "leuchtturm")]);

	let exporter = if let Some(lightstep_token) = lightstep_token {
		lightstep_exporter(lightstep_token)?
	} else {
		// FIXME: this is broken and I have no idea why
		// `Exporter otlp encountered the following error(s): the grpc server returns error (The
		// service is currently unavailable): , detailed error message: error trying to connect:
		// received corrupt message`
		opentelemetry_otlp::new_exporter().tonic()
	};

	let tracer = opentelemetry_otlp::new_pipeline()
		.tracing()
		.with_exporter(exporter)
		.with_trace_config(trace::config().with_resource(resource))
		.install_batch(opentelemetry::runtime::Tokio)?;

	let telemetry = tracing_opentelemetry::layer().with_tracer(tracer);
	tracing_subscriber::registry()
		// TODO: Make this configurable through CLI instead of using `EnvFilter`
		.with(
			tracing_subscriber::EnvFilter::try_from_default_env()
				.unwrap_or_else(|_| "leuchtturm=debug,tower_http=debug".into()),
		)
		.with(telemetry)
		.try_init()?;

	Ok(())
}

fn lightstep_exporter(token: String) -> Result<TonicExporterBuilder, TracingError> {
	let mut metadata = MetadataMap::with_capacity(1);
	metadata.insert("lightstep-access-token", token.parse()?);

	let exporter = opentelemetry_otlp::new_exporter()
		.tonic()
		.with_endpoint("https://ingest.lightstep.com:443")
		.with_tls_config(ClientTlsConfig::new())
		.with_metadata(metadata);

	Ok(exporter)
}
