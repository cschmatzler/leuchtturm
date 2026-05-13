# API documentation should expose the generated OpenAPI contracts.
GET {{BASE_URL}}/docs
HTTP 200
[Asserts]
header "content-type" contains "text/html"
body contains "Leuchtturm API"
body contains "scalar-api-reference"
body contains "/open-api"
body contains "/auth/open-api/generate-schema"
