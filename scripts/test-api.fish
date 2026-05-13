#!/usr/bin/env fish

set stage $USER
if set -q SST_STAGE
	set stage $SST_STAGE
end
if set -q STAGE
	set stage $STAGE
end

set base_url https://api.$stage.leuchtturm.dev
set auth_email api-test@leuchtturm.dev
set auth_password api-test-password
set organization_id org_01KQCM8F5VKQW180D65BWXDN8N
set cookie_jar (mktemp)
set authenticated_tests tests/api/authenticated/*.hurl
set authenticated_tests (string match --invert tests/api/authenticated/sign-in.hurl $authenticated_tests)
set exit_code 0

function cleanup --on-event fish_exit
	rm -f $cookie_jar
end

hurl --test --variable BASE_URL=$base_url tests/api/*.hurl
if test $status -ne 0
	set exit_code 1
end

hurl --test \
	--cookie-jar $cookie_jar \
	--variable BASE_URL=$base_url \
	--variable AUTH_EMAIL=$auth_email \
	--variable AUTH_PASSWORD=$auth_password \
	tests/api/authenticated/sign-in.hurl
if test $status -ne 0
	exit 1
end

hurl --test \
	--cookie $cookie_jar \
	--variable BASE_URL=$base_url \
	--variable ORGANIZATION_ID=$organization_id \
	$authenticated_tests
if test $status -ne 0
	set exit_code 1
end

exit $exit_code
