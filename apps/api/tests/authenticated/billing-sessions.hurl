# Billing session endpoints should require an organization id before creating sessions.
POST {{BASE_URL}}/billing/checkout
Cookie: {{AUTH_COOKIE}}
HTTP 400

POST {{BASE_URL}}/billing/portal
Cookie: {{AUTH_COOKIE}}
HTTP 400
