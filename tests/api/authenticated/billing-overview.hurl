# Authenticated billing overview contract test.
# Requires AUTH_COOKIE and ORGANIZATION_ID in the environment.
GET {{BASE_URL}}/billing/overview?organizationId={{ORGANIZATION_ID}}
Cookie: {{AUTH_COOKIE}}
HTTP 200
[Asserts]
jsonpath "$.activeSubscription" exists
