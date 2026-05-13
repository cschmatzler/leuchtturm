# Authenticated billing overview contract test.
GET {{BASE_URL}}/billing/overview?organizationId={{ORGANIZATION_ID}}
HTTP 200
[Asserts]
jsonpath "$.activeSubscription" exists
