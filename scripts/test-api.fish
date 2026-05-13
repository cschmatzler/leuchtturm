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

function cleanup --on-event fish_exit
	rm -f $cookie_jar
end

curl --fail --silent --show-error --output /dev/null \
	--cookie-jar $cookie_jar \
	--header "Content-Type: application/json" \
	--data "{\"email\":\"$auth_email\",\"password\":\"$auth_password\"}" \
	$base_url/auth/sign-in/email
if test $status -ne 0
	exit 1
end

set auth_cookie
while read -l line
	if string match --quiet "# " $line; or test -z "$line"
		continue
	end

	set fields (string split \t $line)
	if test (count $fields) -ge 7
		set auth_cookie $auth_cookie "$fields[6]=$fields[7]"
	end
end < $cookie_jar
set auth_cookie (string join "; " $auth_cookie)

if test -z "$auth_cookie"
	echo "Sign-in did not return auth cookies."
	exit 1
end

hurl --test \
	--variable BASE_URL=$base_url \
	--variable AUTH_EMAIL=$auth_email \
	--variable AUTH_PASSWORD=$auth_password \
	--variable AUTH_COOKIE=$auth_cookie \
	--variable ORGANIZATION_ID=$organization_id \
	apps/api/tests/*.hurl \
	apps/api/tests/setup/*.hurl \
	apps/api/tests/authenticated/*.hurl

exit $status
