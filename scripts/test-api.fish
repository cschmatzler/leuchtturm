#!/usr/bin/env fish

set base_url http://localhost:3000
if set -q BASE_URL
	set base_url $BASE_URL
end

set exit_code 0

hurl --test --variable BASE_URL=$base_url tests/api/*.hurl
if test $status -ne 0
	set exit_code 1
end

if set -q AUTH_COOKIE; and set -q ORGANIZATION_ID
	hurl --test \
		--variable BASE_URL=$base_url \
		--variable AUTH_COOKIE=$AUTH_COOKIE \
		--variable ORGANIZATION_ID=$ORGANIZATION_ID \
		tests/api/authenticated/*.hurl
	if test $status -ne 0
		set exit_code 1
	end
else
	echo "Skipping authenticated API tests. Set AUTH_COOKIE and ORGANIZATION_ID to run them."
end

exit $exit_code
