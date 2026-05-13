#!/usr/bin/env fish

set stage $USER
if set -q SST_STAGE
	set stage $SST_STAGE
end
if set -q STAGE
	set stage $STAGE
end

set base_url https://api.$stage.leuchtturm.dev
set auth_email hurl@leuchtturm.dev
set auth_password api-test-password
set organization_id org_01KRGY2EF40Y4QAG4MGQ9B9YMP
set cookie_jar (mktemp)
set exit_code 0

function cleanup --on-event fish_exit
	rm -f $cookie_jar
end

hurl --test \
	--variable BASE_URL=$base_url \
	apps/api/tests/*.hurl
if test $status -ne 0
	set exit_code 1
end

hurl --test \
	--cookie-jar $cookie_jar \
	--variable BASE_URL=$base_url \
	--variable AUTH_EMAIL=$auth_email \
	--variable AUTH_PASSWORD=$auth_password \
	apps/api/tests/setup/*.hurl
if test $status -ne 0
	exit 1
end

hurl --test \
	--cookie $cookie_jar \
	--cookie-jar $cookie_jar \
	--variable BASE_URL=$base_url \
	--variable ORGANIZATION_ID=$organization_id \
	apps/api/tests/authenticated/*.hurl
if test $status -ne 0
	set exit_code 1
end

exit $exit_code
