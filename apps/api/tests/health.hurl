# Health endpoint smoke test.
GET {{BASE_URL}}/up
HTTP 200
[Asserts]
jsonpath "$.success" == true
jsonpath "$.database.status" == "up"
jsonpath "$.database.latencyMs" exists
jsonpath "$.totalTimeMs" exists
