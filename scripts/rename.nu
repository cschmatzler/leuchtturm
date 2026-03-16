#!/usr/bin/env nu
# Project-wide rename with case variants.
#
# Generates lowercase, UPPERCASE, and Capitalized variants, plus package scope
# and hyphenated patterns. Default is dry-run; use --apply to modify files.
def main [old_name: string, new_name: string, --apply] {
    if $old_name == $new_name {
        print -e "Error: old-name and new-name must be different"
        exit 1
    }
    let old_lower = $old_name | str downcase
    let old_upper = $old_name | str upcase
    let old_cap = ($old_name | str substring 0..1 | str upcase) + ($old_name | str substring 1.. | str downcase)
    let new_lower = $new_name | str downcase
    let new_upper = $new_name | str upcase
    let new_cap = ($new_name | str substring 0..1 | str upcase) + ($new_name | str substring 1.. | str downcase)
    let patterns = [
        [
            $"@($old_lower)/"
            $"@($new_lower)/"
            "Package scope"
        ]
        [
            $"($old_lower)-"
            $"($new_lower)-"
            "Hyphenated identifier"
        ]
        [
            $"\\b($old_lower)\\b"
            $new_lower
            "Lowercase name"
        ]
        [
            $"\\b($old_cap)\\b"
            $new_cap
            "Capitalized name"
        ]
        [
            $"\\b($old_upper)\\b"
            $new_upper
            "Uppercase name"
        ]
    ]
    let exclude = [
        "node_modules"
        ".git"
        ".jj"
        "dist"
        "build"
        ".devenv"
        "pnpm-lock.yaml"
        ".devenv.flake.nix"
    ]
    let files = glob "**/*.{ts,tsx,js,jsx,json,nix,md,html,css,yaml,yml,toml}" | where { |f| $exclude | all { |ex| not ($f | str contains $ex) } } | sort
    let results = $files | each { |file|
		let content = open --raw $file
		let count = $patterns | each { |p|
			$content | parse --regex ($p | get 0) | length
		} | math sum
		if $count > 0 {
			{ file: $file, count: $count }
		} else {
			null
		}
	} | compact
    if ($results | is-empty) {
        print "No matches found."
        return
    }
    let file_count = $results | length
    let total_count = $results | get count | math sum
    if $apply {
        for r in $results {
            mut content = open --raw $r.file
            for p in $patterns { $content = $content | str replace --all --regex ($p | get 0) ($p | get 1) }
            $content | save --force $r.file
        }
        print $"Renamed \"($old_name)\" -> \"($new_name)\": ($file_count) files, ($total_count) replacements."
    } else {
        for r in $results {
            let rel = $r.file | str replace $"(pwd)/" ""
            print $"  ($rel): ($r.count) replacements"
        }
        print $"\n($file_count) files, ($total_count) replacements. Run with --apply to apply."
    }
}
