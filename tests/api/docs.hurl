# API documentation should expose the generated OpenAPI contract.
GET {{BASE_URL}}/docs
HTTP 200
[Asserts]
header "content-type" contains "text/html"
body contains "Leuchtturm API"
body contains "Operational health checks for the API"
body contains "/up"
body contains "/billing/overview"
body contains "/billing/checkout"
body contains "/billing/portal"
body contains "/query"
body contains "/mutate"
