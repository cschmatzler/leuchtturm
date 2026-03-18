{
	fetchPnpmDeps,
	lib,
	makeWrapper,
	ncurses,
	nodejs_25,
	nodePackages,
	pnpm_10,
	pnpmConfigHook,
	pkg-config,
	python312,
	readline,
	stdenv,
	...
}: let
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
					(rootPath + "/apps/api")
					(rootPath + "/apps/web/package.json")
					(rootPath + "/apps/zero-cache/package.json")
					(rootPath + "/packages")
				];
		};
in
	stdenv.mkDerivation (finalAttrs: {
			pname = "chevrotain-api";
			version = "rolling";
			inherit src;

			meta = with lib; {
				description = "Roasted API";
				mainProgram = "chevrotain-api";
				platforms = platforms.all;
			};

			pnpmDeps =
				fetchPnpmDeps {
					inherit (finalAttrs) pname version;
					inherit src;
					pnpm = pnpm;
					fetcherVersion = 3;
					hash = "sha256-vhzJu0KbAfpzM8YAHrTwLGoEL4nWwkuicOLd1GQihwA=";
				};

			nativeBuildInputs = [
				makeWrapper
				nodejs_25
				nodePackages.node-gyp
				pnpm
				pnpmConfigHook
				pkg-config
				python312
			];
			buildInputs = [ncurses nodejs_25 readline];
			PYTHON = "${python312}/bin/python3";
			CI = "true";
			npm_config_build_from_source = "true";
			npm_config_foreground_scripts = "true";
			npm_config_nodedir = "${nodejs_25}";

			buildPhase = ''
				runHook preBuild
				patchShebangs apps/api/node_modules
				pnpm --filter @chevrotain/api build
				runHook postBuild
			'';

			installPhase = ''
					runHook preInstall
					mkdir -p $out/lib/chevrotain-api
					cp -r apps/api/dist $out/lib/chevrotain-api/

				# Copy externalized runtime deps that can't be bundled.
				# pg has native bindings that must remain as node_modules.
				#
				# Strategy: merge each virtual store entry's node_modules/ tree
				# into one flat output. Each entry already contains the package
				# itself plus symlinks to all its direct deps at the correct
				# versions. cp -rL resolves symlinks, producing real copies.
				local nm=$out/lib/chevrotain-api/node_modules
				mkdir -p $nm

				merge_vstore_deps() {
					local pattern=$1
					local found=0
					for src in node_modules/.pnpm/$pattern/node_modules; do
						if [ -d "$src" ]; then
							cp -rL --no-preserve=mode "$src"/. "$nm"/
							found=1
						fi
					done
					if [ "$found" -eq 0 ]; then
						echo "ERROR: no match for pnpm virtual store pattern: $pattern" >&2
						exit 1
					fi
				}

				# pg and its sub-dependency trees
				merge_vstore_deps "pg@[0-9]*"
				merge_vstore_deps "pg-types@*"
				merge_vstore_deps "pgpass@*"
				merge_vstore_deps "postgres-bytea@*"
				merge_vstore_deps "postgres-interval@*"

				mkdir -p $out/bin
				makeWrapper ${nodejs_25}/bin/node $out/bin/chevrotain-api \
					--add-flags "$out/lib/chevrotain-api/dist/server.js"
					runHook postInstall
			'';
		})
