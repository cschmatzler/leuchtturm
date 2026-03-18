{packages, ...}: let
	cfg = import ../../../nix/config.nix;
in {
	services.caddy = {
		enable = true;

		# Static SPA
		virtualHosts.${cfg.domain} = {
			extraConfig = ''
				header {
					X-Content-Type-Options nosniff
					X-Frame-Options DENY
					Referrer-Policy strict-origin-when-cross-origin
					X-XSS-Protection "1; mode=block"
					Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
					Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://images.unsplash.com; font-src 'self' data:; connect-src 'self' https://api.${cfg.domain} wss://sync.${cfg.domain}; frame-ancestors 'none'"
					-Server
				}

				handle /* {
					root * ${packages.web}
					try_files {path} /index.html
					file_server

					@html file /index.html
					header @html Cache-Control "no-cache, no-store, must-revalidate"

					@assets path *.js *.css *.woff *.woff2 *.png *.jpg *.svg *.ico
					header @assets Cache-Control "public, max-age=31536000, immutable"
				}
			'';
		};

		# API reverse proxy
		virtualHosts."api.${cfg.domain}" = {
			extraConfig = ''
				handle /api/metrics {
					respond 403
				}

				handle /api/* {
					reverse_proxy localhost:${toString cfg.ports.api}
				}
			'';
		};
	};

	networking.firewall.allowedTCPPorts = [80 443];
}
