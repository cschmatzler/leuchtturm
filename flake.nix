# DO-NOT-EDIT. This file was auto-generated using github:vic/flake-file.
# Use `nix run .#write-flake` to regenerate it.
{
	outputs = inputs: inputs.flake-parts.lib.mkFlake {inherit inputs;} {};

	inputs = {
		den.url = "github:vic/den";
		deploy-rs = {
			url = "github:serokell/deploy-rs";
			inputs.nixpkgs.follows = "nixpkgs";
		};
		disko = {
			url = "github:nix-community/disko";
			inputs.nixpkgs.follows = "nixpkgs";
		};
		flake-aspects.url = "github:vic/flake-aspects";
		flake-file.url = "github:vic/flake-file";
		flake-parts = {
			url = "github:hercules-ci/flake-parts";
			inputs.nixpkgs-lib.follows = "nixpkgs";
		};
		home-manager = {
			url = "github:nix-community/home-manager";
			inputs.nixpkgs.follows = "nixpkgs";
		};
		import-tree.url = "github:vic/import-tree";
		nixos-config = {
			url = "git+https://git.schmatzler.com/cschmatzler/nixos-config";
			inputs.nixpkgs.follows = "nixpkgs";
		};
		nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
		nixpkgs-lib.follows = "nixpkgs";
		nixvim.url = "github:nix-community/nixvim";
		sops-nix = {
			url = "github:Mic92/sops-nix";
			inputs.nixpkgs.follows = "nixpkgs";
		};
	};
}
