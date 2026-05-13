# Generated OpenAPI contract should expose documented API endpoints.
GET {{BASE_URL}}/open-api
HTTP 200
[Asserts]
header "content-type" contains "application/json"
jsonpath "$.info.title" == "Leuchtturm API"
jsonpath "$.paths['/up'].get" exists
jsonpath "$.paths['/billing/overview'].get" exists
jsonpath "$.paths['/billing/checkout'].post" exists
jsonpath "$.paths['/billing/portal'].post" exists
jsonpath "$.paths['/query']" not exists
jsonpath "$.paths['/mutate']" not exists
