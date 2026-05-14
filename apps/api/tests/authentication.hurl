# Protected API endpoints must reject unauthenticated requests.
GET {{BASE_URL}}/api/autumn/products
HTTP 401

POST {{BASE_URL}}/api/autumn/checkout
HTTP 401
