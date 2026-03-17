{
	fetchPnpmDeps,
	lib,
	nodejs_25,
	pnpm_10,
	pnpmConfigHook,
	stdenvNoCC,
	...
}: let
	cfg = import ../../nix/config.nix;
	pnpm = pnpm_10.override {nodejs = nodejs_25;};
	rootPath = ../..;
	src =
		lib.fileset.toSource {
			root = rootPath;
			fileset =
				lib.fileset.unions [
					(rootPath + "/package.json")
					(rootPath + "/pnpm-lock.yaml")
					(rootPath + "/pnpm-workspace.yaml")
					(rootPath + "/tsconfig.json")
					(rootPath + "/tsconfig.node.json")
					(rootPath + "/tsconfig.web.json")
					(rootPath + "/apps/api/package.json")
					(rootPath + "/apps/web")
					(rootPath + "/apps/zero-cache/package.json")
					(rootPath + "/packages")
				];
		};
in
	stdenvNoCC.mkDerivation (finalAttrs: {
			pname = "chevrotain-web";
			version = "rolling";
			inherit src;

			meta = with lib; {
				description = "Roasted Web";
				platforms = platforms.all;
			};

			pnpmDeps =
				fetchPnpmDeps {
					inherit (finalAttrs) pname version;
					inherit src;
					pnpm = pnpm;
					fetcherVersion = 3;
					hash = "sha256-b+ECw+NSIQ+9u8hJeD56sLGzrsnbLm/s+brdQLSJ1kI=";
				};

			nativeBuildInputs = [nodejs_25 pnpm pnpmConfigHook];

			preBuild = ''
								# Write .env.production (takes precedence over .env in production builds)
								cat > apps/web/.env.production <<EOF
				VITE_BASE_URL=https://${cfg.domain}
				EOF
			'';

			VITE_BASE_URL = "https://${cfg.domain}";

			buildPhase = ''
				runHook preBuild
				pnpm --filter @chevrotain/web build
				runHook postBuild
			'';

			installPhase = ''
				runHook preInstall
				cp -r apps/web/dist $out
				runHook postInstall
			'';
		})
