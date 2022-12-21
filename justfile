set dotenv-load

watch-web:
	systemfd --no-pid -q -s http::3000 -- cargo watch -c -w src/ -w crates/ -x "run web"
