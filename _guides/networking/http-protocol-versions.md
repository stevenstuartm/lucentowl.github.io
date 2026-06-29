---
title: "HTTP Protocol Versions"
layout: guide
category: Networking
subcategory: Network Fundamentals
description: "HTTP/1.1, HTTP/2, and HTTP/3 compared: what each version brings, how version negotiation works, when to use each, and where trust boundaries sit in modern deployments."
tags: [networking, protocols, performance, scalability, infrastructure, practical]
---

## HTTP Protocol Versions

HTTP has evolved through three major versions, each addressing limitations of its predecessor. Understanding what each version brings and when to use it matters for both performance and compatibility decisions.

### HTTP/1.1

[HTTP/1.1](https://httpwg.org/specs/rfc9112.html){:target="_blank" rel="noopener noreferrer"} has been the workhorse of the web since 1997. It uses plain text request and response headers over TCP connections.

**How it works**: Each TCP connection handles one request-response pair at a time. While HTTP/1.1 introduced persistent connections (keeping the TCP connection open for multiple sequential requests) and pipelining (sending requests without waiting for responses), pipelining was never reliably supported by browsers or intermediaries. In practice, a client that needs to fetch 50 resources opens 6 parallel TCP connections (the browser-imposed limit per domain) and sends requests sequentially on each one.

**Head-of-line blocking** is the core limitation. If one request on a connection takes 3 seconds, every request queued behind it waits. Workarounds like domain sharding (splitting resources across multiple hostnames to get more connections) and sprite sheets (combining many images into one file) became common performance optimizations, but they are hacks around a protocol limitation rather than real solutions.

**Where HTTP/1.1 still works well**: Simple API integrations with low request volume, legacy systems where upgrading infrastructure is not justified, and communication with services or proxies that do not support newer protocols. It remains the universal baseline that everything understands.

### HTTP/2

[HTTP/2](https://httpwg.org/specs/rfc9113.html){:target="_blank" rel="noopener noreferrer"} (standardized in 2015) is a binary protocol that changes how requests and responses travel over a connection. Rather than sending plain text one request at a time, HTTP/2 breaks communication into small binary frames that can be interleaved on a single connection.

**Multiplexing** is the defining feature. Multiple requests and responses share one TCP connection simultaneously. Each request-response pair gets a "stream" with a unique identifier, and frames from different streams interleave freely. A slow response on stream 5 does not block streams 1 through 4. This eliminates the need for multiple connections, domain sharding, and most HTTP/1.1 performance hacks.

**Header compression** ([HPACK](https://httpwg.org/specs/rfc7541.html){:target="_blank" rel="noopener noreferrer"}) reduces overhead significantly. HTTP headers are repetitive across requests (the same cookies, user-agent, and accept headers sent with every request), and HPACK maintains a shared table of previously sent headers on both sides of the connection. Subsequent requests only send the difference. For API-heavy applications making hundreds of requests with similar headers, this reduces bandwidth measurably.

**Server push** allowed servers to proactively send resources before the client requested them. In practice, it proved difficult to use correctly (servers often pushed resources the client already had cached) and most implementations have deprecated or removed it. Chrome removed support in 2022. Treat server push as a historical footnote rather than a feature to rely on.

**Stream prioritization** lets clients indicate which resources matter most (render-blocking CSS before analytics scripts, for example), allowing the server to allocate bandwidth accordingly. The original priority scheme was complex and inconsistently implemented, but the [Extensible Priorities](https://httpwg.org/specs/rfc9218.html){:target="_blank" rel="noopener noreferrer"} replacement (RFC 9218) provides a simpler model that sees better adoption.

**The remaining limitation**: HTTP/2 solves head-of-line blocking at the HTTP layer, but the underlying TCP connection still has its own head-of-line blocking. If a single TCP packet is lost, the operating system's TCP stack holds all data on that connection until the lost packet is retransmitted, even though the lost packet might only affect one stream. Under high packet loss conditions (mobile networks, congested links), this TCP-level blocking can negate HTTP/2's multiplexing benefits.

### HTTP/3

[HTTP/3](https://httpwg.org/specs/rfc9114.html){:target="_blank" rel="noopener noreferrer"} (standardized in 2022) replaces TCP entirely with [QUIC](https://httpwg.org/specs/rfc9000.html){:target="_blank" rel="noopener noreferrer"}, a transport protocol built on UDP. QUIC moves reliability, flow control, and congestion control into user space rather than relying on the operating system's TCP stack.

**No TCP head-of-line blocking**: QUIC handles each HTTP stream independently at the transport layer. A lost packet on one stream does not block other streams. This is the primary motivation for HTTP/3 and makes the biggest difference on unreliable networks where packet loss is common.

**Faster connection establishment**: A new QUIC connection requires one round trip (combining the transport handshake with the TLS 1.3 handshake). A new TCP+TLS 1.3 connection requires two round trips (one for TCP, one for TLS). For resumed connections to a previously visited server, QUIC supports 0-RTT, sending application data in the very first packet. On high-latency links (mobile networks, intercontinental connections), saving a round trip is noticeable.

**Connection migration**: QUIC connections are identified by a connection ID rather than the IP/port tuple that identifies TCP connections. When a mobile device switches from Wi-Fi to cellular, the IP address changes. A TCP connection breaks and must be re-established, but a QUIC connection survives the transition. This matters for mobile-first applications and scenarios where network changes are frequent.

**Where HTTP/3 matters most**: The benefits are most pronounced on lossy or high-latency networks. For server-to-server communication on reliable datacenter networks with sub-millisecond latency and near-zero packet loss, HTTP/3 provides marginal improvement over HTTP/2. Its strengths emerge on the public internet, particularly for mobile clients.

### Comparing HTTP Versions

| Characteristic | HTTP/1.1 | HTTP/2 | HTTP/3 |
|---|---|---|---|
| **Transport** | TCP | TCP | QUIC (UDP) |
| **Format** | Text | Binary frames | Binary frames |
| **Multiplexing** | No (one request per connection at a time) | Yes (many streams per connection) | Yes (independent streams) |
| **Head-of-line blocking** | HTTP layer and TCP layer | TCP layer only | Neither layer |
| **Header compression** | None | HPACK | QPACK |
| **Connection setup** | 2-3 RTT (TCP + TLS) | 2-3 RTT (TCP + TLS) | 1 RTT (0-RTT for resumption) |
| **Connection migration** | No | No | Yes |
| **Encryption** | Optional | Effectively required (TLS) | Always required (TLS 1.3) |
| **Browser support** | Universal | Universal | ~95% of browsers |
| **Server/proxy support** | Universal | Very broad | Growing rapidly |

## Version Negotiation and Compatibility

One of the most practical concerns when adopting HTTP/2 or HTTP/3 is whether doing so introduces breaking changes. The short answer is that HTTP version upgrades are designed to be non-breaking because of built-in negotiation mechanisms.

### How HTTP/2 Negotiation Works

For HTTPS connections (the common case), HTTP/2 negotiation happens during the TLS handshake through [ALPN (Application-Layer Protocol Negotiation)](https://www.rfc-editor.org/rfc/rfc7301){:target="_blank" rel="noopener noreferrer"}. The client advertises which HTTP versions it supports (typically "h2" and "http/1.1"), and the server selects the highest mutually supported version. If the server only supports HTTP/1.1, the connection proceeds with HTTP/1.1. The client never notices a difference beyond performance.

For plaintext HTTP (rare in production), HTTP/2 can be negotiated via an Upgrade header, similar to WebSocket upgrades. In practice, HTTP/2 over plaintext (called "h2c") is uncommon outside of internal service meshes and local development.

### How HTTP/3 Negotiation Works

HTTP/3 negotiation works differently because it changes the transport protocol entirely. A client first connects over TCP using HTTP/1.1 or HTTP/2. The server includes an `Alt-Svc` (Alternative Service) header in its response, advertising that HTTP/3 is available on a specific UDP port. The client can then establish a QUIC connection for subsequent requests. If the QUIC connection fails (blocked by a firewall, for example), the client falls back to the existing TCP connection transparently.

This means enabling HTTP/3 on a server is purely additive. Clients that support it will discover and use it; clients that do not will continue using HTTP/2 or HTTP/1.1 without any disruption.

### Downward Negotiation is Built In

Both HTTP/2 and HTTP/3 are designed so that clients and servers negotiate to the best mutually supported version. Enabling a newer version on your server or API never breaks older clients. A client that only speaks HTTP/1.1 will connect over HTTP/1.1 regardless of whether your server supports HTTP/2 and HTTP/3. This makes version upgrades safe to deploy incrementally.

The negotiation also handles intermediaries gracefully. If a load balancer or reverse proxy between the client and your server only supports HTTP/1.1 on the backend, it terminates the HTTP/2 connection from the client and forwards the request over HTTP/1.1 to your server. The client still benefits from HTTP/2 on the external leg, and your server does not need to change.

## HTTP/2 in Practice

A common source of confusion is thinking of HTTP/2 as something you need to decide to adopt. In most modern deployments, HTTP/2 is already active and negotiated transparently by infrastructure you did not explicitly configure for it.

### Server-Side Defaults

Web servers and frameworks enable HTTP/2 by default. ASP.NET Core's Kestrel server has supported HTTP/2 since .NET Core 3.0 (2019) with no configuration needed. Nginx enables it with a single directive. Cloud load balancers like AWS ALB and Azure Front Door accept HTTP/2 from clients by default.

### Client-Side Behavior

Browsers always negotiate HTTP/2 automatically. HTTP client libraries in application code differ: .NET's HttpClient defaults to HTTP/1.1 unless you explicitly set the version, Go's net/http defaults to HTTP/2 for HTTPS, and Python's requests library uses HTTP/1.1 unless replaced with a library like httpx. For server-to-server communication, check your HTTP library's defaults, but know that the server will accept whatever version the client negotiates.

### Infrastructure Handles the Protocol Boundaries

In a typical cloud deployment, the load balancer terminates the client's HTTP/2 connection and forwards requests to backend targets over HTTP/1.1. AWS ALB works exactly this way: clients connect over HTTP/2, but ALB forwards to targets over HTTP/1.1 regardless. Your application code does not need to be aware of HTTP/2 at all for this to work. The client gets the multiplexing and header compression benefits on the external leg, and your service receives ordinary HTTP/1.1 requests.

### Connection Lifetime Shifts to Infrastructure

With HTTP/1.1, developers sometimes worry about keeping TCP connection lifetimes short to protect against abuse or resource exhaustion. Under HTTP/2, connection management works differently because many requests multiplex over a single long-lived connection. But this is not something application code needs to manage. The web server, load balancer, or reverse proxy handles idle connection timeouts, maximum connection age, and stream limits. Kestrel enforces `KeepAliveTimeout` and `MaxConcurrentStreams`. ALB enforces idle timeouts at the load balancer level. These are infrastructure configuration concerns, not application concerns.

### Trust Boundaries in Load-Balanced Deployments

Behind a load balancer, the trust boundary is at the load balancer, not the container. Connection-level abuse protection like slowloris defense, connection exhaustion limits, and idle connection reaping are the load balancer's responsibility. The ALB only forwards well-formed HTTP/1.1 requests to your targets after it has already managed the client connection, enforced timeouts, and applied any WAF or security group rules. Your container receives requests from a trusted source within your VPC, not from arbitrary internet clients.

Application-level concerns still apply: request body size limits, request processing timeouts, authentication, and rate limiting per user. But connection-level defense is handled before traffic reaches your container. Understanding where this boundary sits prevents teams from duplicating protection that infrastructure already provides while ensuring they do not neglect the protections that remain their responsibility.

<div class="callout callout--note">
<p class="callout__title">HTTP/2 Without Knowing It</p>
<p>If your application runs behind a modern load balancer or reverse proxy, your clients are likely already using HTTP/2. The load balancer negotiates HTTP/2 with the client, translates to HTTP/1.1 for your backend, and manages connection lifetime, stream limits, and idle timeouts. Your application code sends and receives the same HTTP requests and responses regardless of which protocol version the client negotiated.</p>
</div>

## When to Use Each Version

### Internal Service-to-Service Communication

For communication between services you control within a datacenter or cloud VPC, HTTP/2 is safe to assume and should be the default. Modern application frameworks, service meshes, and cloud load balancers all support HTTP/2 natively. The multiplexing and header compression benefits are meaningful for high-throughput microservice communication, where services make many small requests to each other.

gRPC, which is common for internal service communication, requires HTTP/2 and will not work over HTTP/1.1. If you use gRPC, the decision is already made.

HTTP/3 provides less benefit internally because datacenter networks have low latency and near-zero packet loss. The connection migration feature is irrelevant when services have stable IP addresses. Unless you have a specific latency-sensitive use case on a lossy internal network, HTTP/2 is sufficient for internal traffic.

### Your Own Public APIs

For APIs you expose to external consumers, enable HTTP/2 and let clients negotiate. Since negotiation is automatic via ALPN, there is no migration cost and no breaking change. Clients that support HTTP/2 get better performance, and those that do not continue working on HTTP/1.1.

Adding HTTP/3 support is also safe for the same reason (Alt-Svc advertisement and graceful fallback), though it requires your infrastructure to handle UDP traffic on port 443, which some firewalls and cloud configurations do not allow by default.

Consider your client base when deciding priority. If your API primarily serves server-side consumers (backend integrations, CLI tools), HTTP/2 provides the most value. If your API serves mobile applications or browser-based SPAs, HTTP/3's connection migration and reduced latency on lossy networks provide additional benefits worth enabling.

### Web Applications Serving Browsers

HTTP/2 should be enabled for any web application. Browser support is universal, and the multiplexing benefit is substantial for typical web pages that load dozens of resources (stylesheets, scripts, images, fonts, API calls). Most CDNs and reverse proxies like Nginx, Caddy, and cloud load balancers enable HTTP/2 by default.

HTTP/3 is increasingly worth enabling for browser-facing applications, particularly those targeting mobile users. Approximately 30% of global web traffic now uses HTTP/3, driven by major CDNs and browsers supporting it by default. The connection migration feature improves the experience for users switching between networks.

### Legacy and Constrained Environments

Some environments require HTTP/1.1. Older proxy servers, certain IoT devices, embedded systems, and some enterprise firewalls that perform deep packet inspection may not handle HTTP/2's binary framing correctly. If you need to support these environments, keep HTTP/1.1 available and rely on negotiation to serve each client appropriately.

<div class="callout callout--tip">
<p class="callout__title">Practical Defaults</p>
<p><strong>Internal services</strong>: Configure for HTTP/2. Use HTTP/1.1 only when a specific dependency requires it.<br>
<strong>Public APIs</strong>: Enable HTTP/2 with HTTP/1.1 fallback via ALPN negotiation. Add HTTP/3 when your infrastructure supports UDP on 443.<br>
<strong>Web frontends</strong>: Enable HTTP/2 (likely already on by default). Enable HTTP/3 if your CDN or load balancer supports it.<br>
In all cases, negotiation handles backward compatibility automatically. Enabling a newer version never requires disabling an older one.</p>
</div>
