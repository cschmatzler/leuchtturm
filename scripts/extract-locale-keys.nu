#!/usr/bin/env nu
# Extract locale keys from source and sync locale JSON files.
#
# Scans source for t("key") patterns and updates locale translation files.
def main [--json] {
    let src_dir = "apps/web/src"
    let locales_dir = "apps/web/public/locales"
    let source_files = glob $"($src_dir)/**/*.{ts,tsx,js,jsx}"
    let used_keys = $source_files | each { |file|
		let content = open --raw $file
		let dq = $content | parse --regex '\bt\(\s*"(?P<key>[^"]+)"' | get key
		let sq = $content | parse --regex "\bt\\(\\s*'(?P<key>[^']+)'" | get key
		let bt = $content | parse --regex '\bt\(\s*`(?P<key>[^`]+)`' | get key
		$dq | append $sq | append $bt
	} | flatten | uniq | sort
    let locales = ls $locales_dir | where type == dir | get name | each { |dir|
			let locale = $dir | path basename
			let translation_path = $"($dir)/translation.json"
			let translations = if ($translation_path | path exists) {
				open $translation_path
			} else {
				"{}\n" | save --force $translation_path
				{}
			}
			{ locale: $locale, path: $translation_path, translations: $translations }
		}
    let locale_names = $locales | get locale
    let defined_keys = if ($locales | is-empty) { [] } else {
        let all_key_sets = $locales | each { |loc| $loc.translations | columns }
        $all_key_sets | reduce { |keys, acc|
            let current = $keys
            $acc | where { |key| $key in $current }
        } | sort
    }
    let missing_keys = $used_keys | where { |key| $key not-in $defined_keys }
    let unused_keys = $defined_keys | where { |key| $key not-in $used_keys }
    let empty_translations = $locales | each { |loc|
		let empty_keys = $loc.translations | columns | where { |key|
			($loc.translations | get $key | str trim) == ""
		} | sort
		if ($empty_keys | is-empty) { null } else {
			{ locale: $loc.locale, keys: $empty_keys }
		}
	} | compact
    if $json {
        let empty_record = $empty_translations | reduce --fold {} { |it, acc|
			$acc | insert $it.locale $it.keys
		}
        let output = {
            summary: {
                totalUsedKeys: ($used_keys | length)
                totalDefinedKeys: ($defined_keys | length)
                missingKeysCount: ($missing_keys | length)
                unusedKeysCount: ($unused_keys | length)
                locales: $locale_names
            }
            missingKeys: $missing_keys
            unusedKeys: $unused_keys
            emptyTranslations: $empty_record
            usedKeys: $used_keys
            definedKeys: $defined_keys
        }
        $output | to json
    } else {
        if ($missing_keys | is-empty) and ($unused_keys | is-empty) {
            print "All locale files are up to date."
            return
        }
        for loc in $locales {
            let after_remove = $unused_keys | reduce --fold $loc.translations { |key, acc|
				$acc | reject $key
			}
            let after_add = $missing_keys | reduce --fold $after_remove { |key, acc|
				if $key in ($acc | columns) {
					$acc
				} else {
					let value = if $loc.locale == "en" { $key } else { "" }
					$acc | insert $key $value
				}
			}
            let sorted_keys = $after_add | columns | sort
            let sorted = $sorted_keys | reduce --fold {} { |key, acc|
				$acc | insert $key ($after_add | get $key)
			}
            $sorted | to json --indent 2 | $"($in)\n" | save --force $loc.path
        }
        mut parts = []
        if not ($missing_keys | is-empty) { $parts = ($parts | append $"+($missing_keys | length) missing") }
        if not ($unused_keys | is-empty) { $parts = ($parts | append $"-($unused_keys | length) unused") }
        print $"Updated ($locale_names | length) locales: ($parts | str join ', ')."
    }
}
