use std::process::Command;

fn main() {
	Command::new("npm")
		.args(["run", "build-css"])
		.status()
		.expect("Building styles has failed.");
}
