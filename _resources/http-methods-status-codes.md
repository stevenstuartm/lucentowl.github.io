---
title: "HTTP Methods and Status Codes Reference"
layout: resource
type: cheatsheet
description: "HTTP method semantics (safe/idempotent) and a categorized status code reference for designing and debugging REST APIs."
last_updated: 2026-07-02
tags: [architecture, api-design, rest, http, web-development]
related_guides:
  - /study-guides/architecture/api-design-architecture.html
---

## HTTP Methods

**Safe**: no side effects on the server (read-only). **Idempotent**: repeating the request produces the same result as a single request — safe to retry after a network failure.

| Method | Semantics | Safe? | Idempotent? | Use For |
| --- | --- | --- | --- | --- |
| GET | Retrieve representation | Yes | Yes | Reading data |
| POST | Create subordinate resource | No | No | Creating resources, non-idempotent operations |
| PUT | Replace resource | No | Yes | Full updates, idempotent creates |
| PATCH | Partial update | No | No | Partial updates |
| DELETE | Remove resource | No | Yes | Deleting resources |
| HEAD | GET without body | Yes | Yes | Checking existence, metadata |
| OPTIONS | Describe capabilities | Yes | Yes | CORS preflight, capability discovery |

## Status Codes

### Success

| Code | Name | Meaning |
| --- | --- | --- |
| 200 | OK | Request succeeded (GET, PUT, PATCH with response body) |
| 201 | Created | Resource created (POST) |
| 202 | Accepted | Request accepted for async processing |
| 204 | No Content | Success with no response body (DELETE, PUT) |

### Client Error

| Code | Name | Meaning |
| --- | --- | --- |
| 400 | Bad Request | Invalid syntax or validation failure |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Authenticated but not authorized |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Request conflicts with current state (duplicate, version mismatch) |
| 422 | Unprocessable Entity | Syntax valid but semantic validation failed |
| 429 | Too Many Requests | Rate limit exceeded |

### Server Error

| Code | Name | Meaning |
| --- | --- | --- |
| 500 | Internal Server Error | Unexpected server failure |
| 502 | Bad Gateway | Upstream service failure |
| 503 | Service Unavailable | Temporary unavailability (overload, maintenance) |
| 504 | Gateway Timeout | Upstream service timeout |
