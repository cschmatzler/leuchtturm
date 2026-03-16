#!/usr/bin/env nu
const PACKAGE_NIX_FILES = ["apps/api/package.nix", "apps/web/package.nix"]
const HASH_PATTERN = 'hash\s*=\s*"(sha256-[A-Za-z0-9+/=]+)";'
const FAKE_HASH = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
def get-current-hash [file: string] {
    let content = open --raw $file
    let matches = $content | parse --regex $HASH_PATTERN
    if ($matches | is-empty) { null } else {
        $matches | first | get capture0
    }
}
def set-hash [file: string, new_hash: string] {
    let content = open --raw $file
    let updated = $content | str replace --regex $HASH_PATTERN $'hash = "($new_hash)";'
    $updated | save --force $file
}
# Update pnpm dependency hash in Nix package files.
#
# Without --hash, computes the correct hash by triggering a nix build with a
# fake hash and extracting the expected hash from the error output.
def main [--hash: string, --dry-run] {
    let new_hash = if $hash != null {
        if not ($hash | str starts-with "sha256-") {
            print -e 'Error: Hash must start with "sha256-"'
            exit 1
        }
        $hash
    } else { compute-correct-hash }
    for file in $PACKAGE_NIX_FILES {
        let current = get-current-hash $file
        if $current == null {
            print $"Warning: ($file): Could not find hash pattern, skipping"
            continue
        }
        if $current == $new_hash { continue }
        if $dry_run { print $"($file): ($current) -> ($new_hash)" } else {
            set-hash $file $new_hash
            print $"($file): Updated"
        }
    }
    if $dry_run { print "Dry run — run without --dry-run to apply." }
}
def compute-correct-hash [] {
    let nix_file = $PACKAGE_NIX_FILES | first
    let original_hash = get-current-hash $nix_file
    if $original_hash == null { error make {
        msg: $"Could not find hash in ($nix_file)"
    } }
    for file in $PACKAGE_NIX_FILES { set-hash $file $FAKE_HASH }
    try {
        print "Computing hash via nix build..."
        let result = do { ^nix build ".#api" --no-link } | complete
        let output = $"($result.stdout)($result.stderr)"
        let got_matches = $output | parse --regex 'got:\s+(sha256-[A-Za-z0-9+/=]+)'
        if not ($got_matches | is-empty) {
            let correct_hash = $got_matches | first | get capture0
            for file in $PACKAGE_NIX_FILES { set-hash $file $original_hash }
            return $correct_hash
        }
        for file in $PACKAGE_NIX_FILES { set-hash $file $original_hash }
        print "\n--- Nix output ---"
        print ($output | str trim)
        print "--- End output ---\n"
        error make {msg: "Could not extract hash from nix output"}
    } catch {|err|
        for file in $PACKAGE_NIX_FILES {
            let current = get-current-hash $file
            if $current == $FAKE_HASH { set-hash $file $original_hash }
        }
        error make {
            msg: $"Hash computation failed: ($err.msg)\n\nManual steps:\n  1. Edit apps/api/package.nix, set hash = \"\";\n  2. Run: nix build .#api\n  3. Copy the \"got: sha256-...\" hash from the error\n  4. Run: nu scripts/update-pnpm-hash.nu --hash \"sha256-...\""
        }
    }
}
