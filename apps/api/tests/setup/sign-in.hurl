# Authenticate subsequent API contract tests with Better Auth.
POST {{BASE_URL}}/auth/sign-in/email
Content-Type: application/json
{
  "email": "{{AUTH_EMAIL}}",
  "password": "{{AUTH_PASSWORD}}"
}
HTTP 200
[Asserts]
jsonpath "$.token" exists
jsonpath "$.user.email" == "{{AUTH_EMAIL}}"
