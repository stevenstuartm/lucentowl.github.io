---
title: "AWS API Gateway for System Architects"
layout: guide
category: AWS
subcategory: Networking & Content Delivery
description: "How API Gateway fronts backends with managed APIs: REST, HTTP, and WebSocket API types, endpoint types, authorizers, throttling and usage plans, caching, integrations and VPC links, and the limits and costs that shape a design."
tags: [api-gateway, rest-api, http-api, authorizers, throttling, websocket, fundamentals]
---

## What API Gateway Does

Amazon API Gateway is a managed front door for APIs. It receives HTTPS requests, decides whether the caller is allowed in, applies rate limits, and forwards each request to a backend, which API Gateway calls an **integration**: a Lambda function, an HTTP service, a private service in a VPC, or an AWS service API called directly. It handles the parts every API needs and no backend wants to build, such as TLS, custom domains, authorization, throttling, and access logging.

An API is a **Regional** resource, created in one account and one Region. It is published through **stages**, such as `dev` and `prod`, which are named, separately deployable snapshots of the API with their own settings and variables. Throttling quotas apply per account per Region, across all of that account's APIs.

The unit that settings attach to differs by API type. A REST API is a tree of **resources** (paths such as `/orders/{id}`), each with **methods** (`GET`, `POST`, and so on). An HTTP API is a flat list of **routes**, each a method and path such as `GET /orders/{id}`. Authorizers, throttling limits, and caching are set per method or per route, which is why this guide refers to both.

---

## Choosing an API Type

API Gateway offers three kinds of API. REST and HTTP APIs both serve request-response HTTP traffic, and they differ in features and price. WebSocket APIs hold long-lived, two-way connections.

| | REST API | HTTP API |
|---|---|---|
| **Price (US East, first tier)** | $3.50 per million requests | $1.00 per million requests, metered in 512 KB increments |
| **Endpoint types** | Edge-optimized, Regional, private | Regional |
| **Authorization** | IAM, resource policies, Cognito user pools, Lambda authorizers | IAM, JWT authorizers (including Cognito), Lambda authorizers |
| **API keys, usage plans, per-client throttling** | Yes | No |
| **Caching** | Yes | No |
| **Request validation and body transformation** | Yes | No, only parameter mapping (adding, changing, or removing headers and query strings, and overwriting the path) |
| **AWS WAF** | Yes | No |
| **Mutual TLS** | Yes | Yes |
| **Canary deployments** | Yes | No |
| **X-Ray tracing** | Yes | No |
| **Response streaming** | Yes | No |
| **Private integrations** | NLBs and ALBs through VPC links | NLBs, ALBs, and Cloud Map services through VPC links |
| **Integration timeout** | 29 seconds by default, raisable for Regional and private APIs | 30 seconds maximum, can't be raised |

An HTTP API is the leaner, cheaper option, and it suits most APIs whose authorization is IAM or a standard OAuth or OpenID Connect token. A REST API earns its higher price when the design needs something only it has, most often WAF, a private endpoint, per-client throttling with API keys, caching, request validation, or X-Ray. Because features are what separate them, the choice is easier to make feature by feature than by treating one type as the default. Two REST-only features need a word. **Request validation** rejects requests whose parameters or JSON body don't match a schema before the backend sees them. A **canary deployment** sends a set percentage of a stage's traffic to a new deployment before promoting it.

Both types support **mutual TLS**, where clients present a certificate that API Gateway checks against a trust store you provide. HTTP APIs meter large requests in 512 KB increments, so a 2 MB request counts as four, and APIs whose calls routinely carry large payloads can cost less on REST.

### WebSocket APIs

A **WebSocket API** keeps a connection open between the client and API Gateway and routes each message by a route key, such as the value of an `action` field in the message body. The backend doesn't hold the connections. API Gateway holds them and gives each one an ID, and the backend sends messages to a client by posting to a callback URL with that ID. Connections are billed per message (in 32 KB increments) and per connection-minute. They suit chat, notifications, and live dashboards, where the server needs to push to clients.

Three limits shape every WebSocket design. A connection lasts at most two hours, an idle connection closes after ten minutes, and a message can be at most 128 KB, sent in frames of up to 32 KB. Clients therefore need reconnect logic and a periodic keepalive message, and the backend has to treat a connection ID as short-lived.

---

## Endpoint Types

A REST API's endpoint type decides how clients reach it, and a **VPC link**, covered under integrations, is the separate path from the API out to private backends:

{% include figure.html id="aws-apigw-endpoints" %}

- **Regional.** Clients connect to the API in its Region. This is the usual choice. A custom domain with your own CloudFront distribution in front gives full control over caching and WAF at the edge.
- **Edge-optimized.** API Gateway puts an AWS-managed CloudFront distribution in front of the API. Clients far from the Region get a nearby TLS termination, but the distribution isn't yours to configure, so teams that want caching or edge logic usually choose Regional behind their own CloudFront instead.
- **Private.** The API is reachable only through an interface VPC endpoint for API Gateway (a set of network interfaces in your subnets that carry traffic to the service privately), from inside a VPC or networks connected to it. A resource policy, a JSON policy attached to the API itself (covered under authorization), decides which VPCs or endpoints may call it.

HTTP APIs are Regional only. Both types support custom domain names with certificates from AWS Certificate Manager, and a custom domain lets clients keep one hostname while the API behind it changes, so set one up from the start.

---

## Authorization

API Gateway can check who the caller is before a request reaches the backend. Each route or method has one authorizer:

| Authorizer | Caller presents | Checked by | Fits |
|---|---|---|---|
| **IAM** | A request signed with AWS credentials (Signature Version 4) | IAM, against policies allowing `execute-api:Invoke` on the route | Services and scripts that already hold AWS credentials, including other accounts |
| **JWT authorizer** (HTTP API) | An OAuth 2.0 or OpenID Connect token | API Gateway itself: signature, issuer, audience, expiry, and required scopes | Users signed in through Cognito or any standard identity provider |
| **Cognito user pool authorizer** (REST API) | A token from an Amazon Cognito user pool | API Gateway, against that user pool | REST APIs whose users are in Cognito |
| **Lambda authorizer** | Any token, header, or request data | Your Lambda function, which returns allow or deny | Custom schemes, such as opaque tokens or per-tenant rules looked up in a database |

REST APIs offer two kinds of Lambda authorizer. A **TOKEN** authorizer receives only one header, usually `Authorization`. A **REQUEST** authorizer receives the headers, query strings, stage variables, and context values you name as its **identity sources**, and AWS recommends it for new work because it sees more of the request.

A REST API can also have a **resource policy**, which restricts calls by source VPC, VPC endpoint, IP range, or AWS account on top of whichever authorizer runs. Private APIs require one.

### Lambda Authorizer Caching

A Lambda authorizer can cache its result, keyed on the token or on its identity sources, for up to an hour. On a REST API the default is five minutes, and on an HTTP API caching is off until you set a TTL. Caching cuts the added latency and Lambda cost to one call per caller per TTL, and it has a trap. By default, the cached answer is reused for that caller on every method or route that uses the authorizer. On a REST API, where the authorizer returns an IAM policy, a policy that allows only the method being called gets the caller's next request to a different method denied from the cache, and the symptom looks random.

There are two fixes. Return a policy covering everything the caller may call, which works with either kind of authorizer. Or make the cache key include the method, using API Gateway's `$context` variables, which describe the request being handled. Add `$context.httpMethod` and `$context.path` to a REST REQUEST authorizer's identity sources, or `$context.routeKey` to an HTTP API authorizer's.

---

## Throttling and Usage Plans

### How Throttling Works

API Gateway throttles with a **token bucket**. The bucket holds up to the **burst** limit in tokens and refills at the **rate** limit per second. Each request takes a token, and a request that arrives to an empty bucket gets `429 Too Many Requests`. A rate of 1,000 with a burst of 2,000 lets an idle client send 2,000 requests at once, then settles to 1,000 a second.

Limits apply at several levels, in this order:

1. Per-client or per-method limits set for a stage in a usage plan
2. Per-method limits set on the stage itself
3. The account's limit for the Region, 10,000 requests per second with a burst of 5,000 by default across all of the account's APIs
4. AWS's own Regional limits, which no customer setting can exceed

The account limit is shared by every API in the Region, so a load test or a misbehaving client on one API can throttle production APIs beside it. Stage and method limits protect the rest and shield a fragile backend, and keeping test traffic in a separate account removes the risk. AWS applies all these limits on a best-effort basis, as targets rather than guaranteed ceilings. Clients should treat `429` as a signal to retry with exponential backoff and jitter, not immediately.

### Usage Plans and API Keys (REST API)

A **usage plan** sets throttling limits and a request quota, such as a million requests a month, for each **API key** associated with it. That is how a REST API offers tiers to different customers or partners.

Two warnings from AWS shape how they should be used. First, **API keys are identifiers, not credentials.** Clients send them in a header that is easily logged or leaked, anyone who copies one from a log or an app binary can use it, and a key valid for one API in a usage plan works for every API in that plan. An API protected only by a key is effectively public. Authorize callers with IAM, Cognito, or a Lambda authorizer, and use the key only to associate traffic with a plan. Second, **usage plan throttling and quotas are best-effort.** Clients can exceed them at times, so they can't be relied on to cap costs or block a caller. AWS Budgets for spend and AWS WAF for request control do those jobs.

HTTP APIs have no usage plans. Per-tenant limits there need a Lambda authorizer that tracks usage, or a REST API.

---

## Caching (REST API)

A REST API stage can have a dedicated cache, from 0.5 GB to 237 GB, billed by the hour for as long as it exists (from about $0.02 an hour at the smallest size). Turning it on caches only `GET` methods unless you enable caching on other methods individually. Responses are cached by method and by the request parameters you choose as cache keys, for 300 seconds by default and up to an hour, and a single cached response can be up to 1 MB.

The cache only saves money when it replaces backend work that costs more than the cache's hourly charge. It always costs something while it exists, whether or not requests hit it, and it doesn't reduce API Gateway's own per-request charge. Caching a Lambda-backed endpoint that runs in milliseconds for fractions of a cent often costs more than it saves, while caching one that runs an expensive database query can pay off quickly. For public, cacheable responses, CloudFront in front of a Regional API often does the same job more cheaply, because it caches near users rather than in the Region.

The same rule applies here as in any cache. A cache keyed only on the path serves one user's `GET /me` response to the next caller, so per-user methods either have caching turned off or include the caller's identity in the cache key.

---

## Integrations

### Lambda Proxy and HTTP Proxy

With a **proxy integration**, API Gateway passes the whole request to the backend and returns its response as is. A Lambda function receives the request as a JSON event and returns a status code, headers, and body. Proxy integrations are the common case, because the backend owns request handling and the API definition stays thin.

REST APIs also support **non-proxy integrations**, where mapping templates written in the Velocity Template Language (VTL) reshape the request before it reaches the backend and the response before it reaches the client. They exist for backends whose format can't change, and they move logic into a place that is hard to test.

### Direct AWS Service Integrations

An API can call an AWS service API directly, with no Lambda function in between, for example sending a request body to an SQS queue, starting a Step Functions execution, or writing an item to DynamoDB. API Gateway calls the service with an IAM role you give it. That removes a function whose only job was to forward data, along with its cost and its cold starts (the extra delay when Lambda starts a new instance of a function). HTTP APIs support a set of first-class integrations for common cases such as SQS, EventBridge, Kinesis, and Step Functions. REST APIs can call almost any AWS action, with mapping templates to shape the request.

### Private Integrations With VPC Links

A **VPC link** lets an API reach a load balancer or service that has no public address, sitting in private subnets. REST APIs connect through VPC links to Network Load Balancers and Application Load Balancers. HTTP APIs connect to Network and Application Load Balancers and to services registered in AWS Cloud Map, AWS's service discovery registry. The backend never needs an internet-facing endpoint, and API Gateway becomes the only public way in.

### Timeouts and Long-Running Work

A REST API waits at most 29 seconds for an integration by default. That can be raised for Regional and private APIs through a quota request, possibly at the cost of a lower account throttle limit, but not for edge-optimized APIs. An HTTP API waits at most 30 seconds. Payloads in either direction are limited to 10 MB.

Work that can take longer shouldn't hold the request open. The usual pattern accepts the request, starts the work asynchronously, for example by queueing a message or starting a Step Functions execution, and returns `202 Accepted` with a job ID the client can poll or be notified about. REST APIs can also **stream** a response, which suits large or incremental results that begin arriving quickly even when the full response takes a while.

---

## Observability

API Gateway publishes CloudWatch metrics for request count, latency, integration latency, and 4xx and 5xx errors, per API and stage. The gap between **latency** and **integration latency** is API Gateway's own time, including authorizers, which makes it the first number to check when an API is slow. **Access logs** record each request in a format you define. REST APIs add **execution logs**, which trace API Gateway's own processing and which AWS recommends keeping at `ERROR` or `INFO` level in production. Their separate **data tracing** option logs full request and response bodies, and it should stay off in production because it can record sensitive data.

---

## What API Gateway Costs

| Item | Price (US East, first tier) |
|---|---|
| HTTP API requests | $1.00 per million, each request metered in 512 KB increments |
| REST API requests | $3.50 per million for the first 333 million a month |
| WebSocket messages | $1.00 per million, metered in 32 KB increments |
| WebSocket connection time | $0.25 per million connection-minutes |
| REST API cache | Hourly, by cache size |
| Data transfer out | Standard AWS rates |

Per-request pricing makes API Gateway cheap at low volume and a noticeable line at high volume. An Application Load Balancer, billed by the hour and by capacity used rather than per request, often costs less for steady, high-volume traffic. It can sign users in with OpenID Connect and verify JWTs itself, but it has no usage plans, API keys, per-client throttling, or request validation, so those move into the application. Integrations add their own costs, such as Lambda invocations, VPC endpoints for private APIs, and logs.

API Gateway is a poor front door for work that routinely runs longer than about 30 seconds, for service-to-service traffic inside a VPC where an internal load balancer does the job, and for very high request volumes where per-request pricing dominates.

---

## Key Takeaways

1. **API Gateway handles TLS, authorization, throttling, and logging in front of a backend.** It is Regional, published through stages, and throttled per account per Region.
2. **Choose REST or HTTP API by feature.** HTTP APIs are cheaper and simpler. REST APIs add WAF, private endpoints, usage plans, caching, validation, X-Ray, and streaming.
3. **Authorize with IAM, JWT, Cognito, or a Lambda authorizer, never an API key.** Cache Lambda authorizer results with a policy that covers every method the caller may use.
4. **Throttling is a token bucket applied from the most specific limit outward.** The account limit is shared by every API in the Region, and usage plan limits are best-effort.
5. **Cache only where it replaces expensive backend work,** and never cache a response that depends on the caller without the caller in the key.
6. **Keep integrations short.** The timeout is about 30 seconds, so long work goes asynchronous behind a `202` and a job ID.
