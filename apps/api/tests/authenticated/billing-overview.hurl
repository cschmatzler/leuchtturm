# Authenticated billing overview contract test.
GET {{BASE_URL}}/billing/overview?organizationId={{ORGANIZATION_ID}}
Cookie: {{AUTH_COOKIE}}
HTTP 200
[Asserts]
jsonpath "$.activeSubscription" exists
