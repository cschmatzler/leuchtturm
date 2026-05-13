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
set test_file (mktemp --suffix=.hurl)
set cookie_jar (mktemp)

function cleanup --on-event fish_exit
	rm -f $test_file $cookie_jar
end

for file in apps/api/tests/*.hurl apps/api/tests/setup/*.hurl apps/api/tests/authenticated/*.hurl
	cat $file >> $test_file
	echo >> $test_file
end

hurl --test \
	--cookie $cookie_jar \
	--cookie-jar $cookie_jar \
	--variable BASE_URL=$base_url \
	--variable AUTH_EMAIL=$auth_email \
	--variable AUTH_PASSWORD=$auth_password \
	--variable ORGANIZATION_ID=$organization_id \
	$test_file

exit $status
