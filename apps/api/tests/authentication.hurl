# Protected API endpoints must reject unauthenticated requests.
GET {{BASE_URL}}/billing/overview?organizationId=org_test
HTTP 401

POST {{BASE_URL}}/billing/checkout?organizationId=org_test
HTTP 401

POST {{BASE_URL}}/billing/portal?organizationId=org_test
HTTP 401

