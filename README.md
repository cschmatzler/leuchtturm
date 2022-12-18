# Leuchtturm

⚠️  **This is currently my project to explore rust and just mess around. It's not going to compile, have reasonable documentation, and don't even get me started on commit messages (we all love `WIP`, am I right?)**

It's really fun, though, and I do enjoy working out in the open, so if you want to learn with me, send me a message!

## Table of contents

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
