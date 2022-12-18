# Leuchtturm

<!--toc:start-->
- [Leuchtturm](#leuchtturm)
  - [Style](#style)
<!--toc:end-->

## Style

All library crates should come with the following lint setup:
```rust
#![warn(
	clippy::correctness,
	clippy::suspicious,
	clippy::complexity,
	clippy::perf,
	clippy::style,
	rust_2018_idioms,
	future_incompatible,
	nonstandard_style,
	missing_debug_implementations,
	missing_docs
)]
#![deny(unreachable_pub, private_in_public)]
```
