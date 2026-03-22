{inputs, ...}: {
	imports = [
		(inputs.den.flakeModules.dendritic or {})
		(inputs.flake-file.flakeModules.dendritic or {})
		(inputs.nixos-config.flakeModules.core or {})
		(inputs.nixos-config.flakeModules.nixos-system or {})
		(inputs.nixos-config.flakeModules.network or {})
		(inputs.nixos-config.flakeModules.user or {})
		(inputs.nixos-config.flakeModules.shell or {})
		(inputs.nixos-config.flakeModules.ssh-client or {})
		(inputs.nixos-config.flakeModules.dev-tools or {})
		(inputs.nixos-config.flakeModules.neovim or {})
	];

	# Use alejandra with tabs for flake.nix formatting (matches alejandra.toml)
	flake-file.outputs = ''
		inputs: inputs.flake-parts.lib.mkFlake {inherit inputs;} (inputs.import-tree ./platform/modules)
	'';

	flake-file.formatter = pkgs:
		pkgs.writeShellApplication {
			name = "alejandra-tabs";
			runtimeInputs = [pkgs.alejandra];
			text = ''
				echo 'indentation = "Tabs"' > alejandra.toml
				alejandra "$@"
			'';
		};

	# Declare all framework and module inputs via flake-file
	flake-file.inputs = {
		nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
		den.url = "github:vic/den";
		flake-file.url = "github:vic/flake-file";
		import-tree.url = "github:vic/import-tree";
		flake-parts = {
			url = "github:hercules-ci/flake-parts";
			inputs.nixpkgs-lib.follows = "nixpkgs";
		};
		flake-aspects.url = "github:vic/flake-aspects";
		nixos-config = {
			url = "git+https://git.schmatzler.com/cschmatzler/nixos-config";
			inputs.nixpkgs.follows = "nixpkgs";
		};
		disko = {
			url = "github:nix-community/disko";
			inputs.nixpkgs.follows = "nixpkgs";
		};
		sops-nix = {
			url = "github:Mic92/sops-nix";
			inputs.nixpkgs.follows = "nixpkgs";
		};
		home-manager = {
			url = "github:nix-community/home-manager";
			inputs.nixpkgs.follows = "nixpkgs";
		};
		nixvim.url = "github:nix-community/nixvim";
		deploy-rs = {
			url = "github:serokell/deploy-rs";
			inputs.nixpkgs.follows = "nixpkgs";
		};
	};
}
