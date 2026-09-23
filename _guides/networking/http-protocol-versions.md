---
title: "HTTP Protocol Versions"
layout: guide
category: Networking
subcategory: Network Fundamentals
description: "HTTP/1.1, HTTP/2, and HTTP/3 compared: what each version changes about connections and head-of-line blocking, how clients and servers negotiate a version, where load balancers split the protocol, and which version to enable for internal services, public APIs, and browser traffic."
tags: [practical, http2, http3, quic, alpn, head-of-line-blocking, performance]
---

HTTP's request and response semantics (methods, headers, status codes) have stayed the same across three major versions. What changed is how those requests travel over the network: how many can share a connection, what happens when a packet is lost, and how many round trips a new connection costs. Those are the properties that decide whether a newer version helps a given workload.

## Three Versions, One Semantics

### HTTP/1.1 Sends One Request at a Time per Connection

[HTTP/1.1](https://www.rfc-editor.org/rfc/rfc9112){:target="_blank" rel="noopener noreferrer"}, first published in 1997, sends plain-text requests and responses over TCP. Connections are persistent, staying open for further requests, but each one carries one request-response exchange at a time. Pipelining, which let a client send several requests without waiting, was never reliably supported by browsers and intermediaries and is effectively unused.

So a client that needs 50 resources opens several parallel TCP connections, and browsers typically cap that at six per host. If one response is slow, every request queued behind it on that connection waits. That is HTTP-level **head-of-line blocking**. Workarounds grew up around it. Domain sharding spread resources across several hostnames to get more connections, and sprite sheets combined many images into one file. Both cost extra connections and cache efficiency.

HTTP/1.1 is still the universal baseline. Every client, proxy, and server speaks it, and for low-volume integrations its limits rarely matter.

### HTTP/2 Multiplexes Streams over One TCP Connection

[HTTP/2](https://www.rfc-editor.org/rfc/rfc9113){:target="_blank" rel="noopener noreferrer"} (2015, revised as RFC 9113 in 2022) keeps HTTP's semantics but changes the wire format to binary frames. Each request-response exchange gets a numbered **stream**, and frames from different streams interleave on a single TCP connection. A slow response on one stream no longer blocks the others at the HTTP layer, which removes the need for multiple connections and domain sharding.

**Header compression** with [HPACK](https://www.rfc-editor.org/rfc/rfc7541){:target="_blank" rel="noopener noreferrer"} keeps a table of headers already sent on the connection, so repeated headers such as cookies, user agent, and authorization cost a few bytes after the first request instead of hundreds. APIs that make many small requests with similar headers benefit the most.

**Server push**, which let a server send resources before the client asked, didn't survive practice. Servers often pushed resources the client already had cached. Chrome disabled it in 2022 (Chrome 106) and Firefox in 2024 (Firefox 132), so don't design around it. Its replacements tell the browser what to fetch instead of sending it: preload links in the page, and the 103 Early Hints status, which lets a server name those resources before its final response is ready.

**Prioritization** lets a client say which streams matter most, such as render-blocking CSS before analytics scripts. HTTP/2's original dependency-tree scheme was complex and unevenly implemented, and RFC 9113 deprecated it. The simpler [Extensible Priorities](https://www.rfc-editor.org/rfc/rfc9218){:target="_blank" rel="noopener noreferrer"} scheme (RFC 9218) replaces it for both HTTP/2 and HTTP/3.

### TCP Still Blocks Every Stream on a Lost Packet

HTTP/2 moves head-of-line blocking down a layer rather than removing it. TCP delivers one ordered byte stream, so when a single packet is lost, the receiving operating system holds back everything that arrived after it until the retransmission lands, even if the held data belongs to streams the lost packet never touched. On a clean network this rarely matters. On lossy networks such as congested mobile links, one connection carrying every stream can perform worse than HTTP/1.1's six independent connections, because one loss now stalls all of them.

### HTTP/3 Moves to QUIC over UDP

[HTTP/3](https://www.rfc-editor.org/rfc/rfc9114){:target="_blank" rel="noopener noreferrer"} (2022) replaces TCP with [QUIC](https://www.rfc-editor.org/rfc/rfc9000){:target="_blank" rel="noopener noreferrer"}, a transport protocol that runs over UDP and provides reliability, congestion control, and encryption itself. QUIC is usually implemented in user space as a library rather than in the operating system kernel, which is part of why it evolves faster than TCP.

**Streams are independent at the transport layer.** QUIC tracks ordering per stream, so a lost packet delays only the streams whose data it carried. This is the main reason HTTP/3 exists, and the difference is largest where packet loss is common.

{% include figure.html id="net-hol-blocking" %}

**Connection setup is shorter.** QUIC combines its transport handshake with the TLS 1.3 handshake, so a new connection is ready after one round trip instead of the two that TCP plus TLS 1.3 need. Resumed connections to a known server can send data in the first flight (0-RTT). Data sent that way can be replayed by an attacker, so servers should only accept requests that are safe to repeat, such as GETs, as 0-RTT. TLS 1.3 offers the same resumption over TCP, but TCP's own handshake still costs a round trip first.

**Header compression changes too.** HTTP/3 uses QPACK, a variant of HPACK adapted so that a lost packet on one stream doesn't hold up header decoding on the others.

**Connections survive address changes.** A TCP connection is identified by its addresses and ports, so it breaks when a phone moves from Wi-Fi to cellular and gets a new IP address. QUIC identifies a connection by a connection ID instead, so the connection can migrate to the new address and continue.

On a datacenter network with sub-millisecond round trips and almost no loss, none of this changes much, and HTTP/3 performs about the same as HTTP/2. Its advantages show up on the public internet, especially for mobile clients.

### Comparing the Versions

| Characteristic | HTTP/1.1 | HTTP/2 | HTTP/3 |
| --- | --- | --- | --- |
| **Transport** | TCP | TCP | QUIC over UDP |
| **Format** | Text | Binary frames | Binary frames |
| **Concurrent requests per connection** | One at a time | Many streams | Many streams |
| **Head-of-line blocking** | HTTP layer and TCP layer | TCP layer | Only within a single stream |
| **Header compression** | None | HPACK | QPACK |
| **Round trips before the first request** | 2 with TLS 1.3 (1 when resuming with 0-RTT), 3 with TLS 1.2 | 2 with TLS 1.3 (1 when resuming with 0-RTT), 3 with TLS 1.2 | 1 (0 when resuming with 0-RTT) |
| **Survives a client address change** | No | No | Yes |
| **Encryption** | Optional | Required by browsers; an unencrypted form exists for internal use | Always, TLS 1.3 built in |

Browser support for HTTP/2 is universal, and all major current browsers support HTTP/3. Actual use trails support. Cloudflare's [2025 Radar Year in Review](https://blog.cloudflare.com/radar-2025-year-in-review/){:target="_blank" rel="noopener noreferrer"} reports 21% of requests to its network over HTTP/3, 50% over HTTP/2, and 29% over HTTP/1.x.

## How a Version Gets Chosen

Upgrading HTTP versions is designed to be non-breaking. A client and server always settle on a version both support, so enabling a newer version on a server never cuts off clients that only speak an older one.

### HTTP/2 Is Negotiated Inside the TLS Handshake

For HTTPS, the client lists the protocols it supports, typically `h2` and `http/1.1`, in the TLS handshake using [ALPN](https://www.rfc-editor.org/rfc/rfc7301){:target="_blank" rel="noopener noreferrer"} (Application-Layer Protocol Negotiation). The server picks one and says so in its reply. If the server only supports HTTP/1.1, the connection proceeds as HTTP/1.1, and the only difference the client sees is performance. Negotiation costs no extra round trip because it rides on a handshake that happens anyway.

HTTP/2 without TLS, called **h2c**, has no handshake to ride on. The original HTTP/1.1 `Upgrade` mechanism for starting it was rarely deployed and RFC 9113 deprecated it. A client uses h2c only with **prior knowledge**, meaning it is configured to know the server speaks HTTP/2 and sends HTTP/2 frames from the first byte. That makes h2c an internal option, common for gRPC between services inside a trusted network and in local development.

### HTTP/3 Is Discovered, Then Tried

A client can't negotiate HTTP/3 inside a TCP connection, because HTTP/3 doesn't run over TCP. It has to learn that the server supports HTTP/3 before it tries, in one of two ways:

- **Alt-Svc.** The client connects over TCP with HTTP/2 or HTTP/1.1 as usual, and the server's response includes an `Alt-Svc` header advertising HTTP/3 on a UDP port, usually 443. The client can use QUIC for later connections.
- **DNS HTTPS records.** The server's domain publishes an HTTPS record ([RFC 9460](https://www.rfc-editor.org/rfc/rfc9460){:target="_blank" rel="noopener noreferrer"}) that lists `h3` among its supported protocols, so a client that looks it up can use QUIC on the very first connection.

If the QUIC attempt fails, often because a firewall blocks UDP on 443, the client falls back to TCP. That makes enabling HTTP/3 additive. Clients that support it discover it, and everyone else carries on over TCP.

{% include figure.html id="net-h3-discovery" %}

## Where the Protocol Splits in a Deployment

### The Load Balancer Speaks Two Protocols

A client's HTTP version only governs the hop to whatever terminates its connection. In a typical cloud deployment that's a load balancer or reverse proxy, which accepts HTTP/2 or HTTP/3 from clients and opens its own connections to the backends, often over a different version.

An AWS Application Load Balancer, for example, accepts HTTP/2 from clients on HTTPS listeners and by default forwards requests to targets over HTTP/1.1. A target group can instead be set to send HTTP/2 or gRPC to targets. Under the default, a service behind the balancer receives ordinary HTTP/1.1 requests while its clients get multiplexing and header compression on the external hop, and the application code doesn't need to know which version the client used.

Not every front end accepts HTTP/3 at all. Application Load Balancer doesn't, while Amazon CloudFront does, and AWS Network Load Balancer can pass QUIC through to targets that terminate it themselves. Offering HTTP/3 often means putting a CDN or a QUIC-capable proxy in front of the load balancer.

{% include figure.html id="net-protocol-boundary" %}

### Servers and Clients Have Different Defaults

Servers and managed load balancers mostly accept HTTP/2 without configuration. Kestrel, the ASP.NET Core server, has negotiated HTTP/2 over HTTPS by default since .NET Core 3.0, and HTTP/3 is opt-in. nginx needs a single directive, and Azure Front Door accepts HTTP/2 from clients by default.

Client libraries in application code differ more:

| Client | Default |
| --- | --- |
| Browsers | Negotiate HTTP/2 and HTTP/3 automatically |
| .NET `HttpClient` | HTTP/1.1 unless the request version and version policy are set |
| Go `net/http` | HTTP/2 over HTTPS automatically |
| Python `requests` | HTTP/1.1 only. `httpx` supports HTTP/2 when installed with its HTTP/2 extra and enabled |

For server-to-server calls, check the client library's default rather than assuming it matches the server's.

### Connection Limits and the Trust Boundary Sit Where Connections End

HTTP/2 multiplexes many requests over a few long-lived connections, so connection lifetime, idle timeouts, and the number of concurrent streams become the main levers against abuse and resource exhaustion. Whoever terminates the client connection enforces them, along with defenses such as slow-client protection. Kestrel exposes `Limits.KeepAliveTimeout` for idle connections and `Limits.Http2.MaxStreamsPerConnection` for concurrent streams (100 by default). Behind a load balancer those client-facing limits are the balancer's configuration, not the application's, and the service receives requests on connections the balancer opened from inside your network rather than from arbitrary internet clients.

Request-level concerns stay with the application: request body size limits, processing timeouts, authentication, authorization, and per-user rate limiting. Knowing where the boundary sits prevents both mistakes, rebuilding connection protection the balancer already provides and assuming the balancer covers request-level checks it can't see.

## Which Version to Enable

### Internal Service-to-Service Traffic

Between services you control inside a datacenter or VPC, HTTP/2 is a safe default. Current frameworks, service meshes, and cloud load balancers support it, and multiplexing plus header compression pays off for high-volume traffic made of many small requests.

Standard gRPC runs on HTTP/2 and doesn't work over HTTP/1.1 connections, so using gRPC settles the question. gRPC-Web exists for browsers and HTTP/1.1-only paths, but it goes through a translating proxy or server support rather than being plain gRPC.

HTTP/3 adds little internally. Datacenter networks have low latency and little loss, and connection migration doesn't matter between services with stable addresses.

### Public APIs

Enable HTTP/2 for APIs that external consumers call. ALPN negotiation makes it free for clients that support it and invisible to those that don't. HTTP/3 is safe to add for the same reason, but it needs UDP on port 443 allowed through every firewall and load balancer on the path, which isn't always the default.

Who the consumers are decides the priority. Server-side integrations and CLI tools get most of the benefit from HTTP/2. APIs called from mobile apps and browser-based single-page applications also gain from HTTP/3's shorter setup and loss tolerance.

### Web Applications Serving Browsers

Enable HTTP/2 for any site. Pages load dozens of resources, and multiplexing them over one connection is a large improvement over HTTP/1.1's six connections. CDNs, reverse proxies such as nginx and Caddy, and cloud load balancers generally enable it by default. Enable HTTP/3 as well where the CDN or load balancer supports it, particularly for mobile audiences.

### Legacy and Constrained Environments

Some environments still need HTTP/1.1: older proxies, some embedded and IoT clients, and enterprise middleboxes that inspect traffic and mishandle binary framing. Keep HTTP/1.1 enabled and let negotiation serve each client the best version it supports.

<div class="callout callout--tip">
<p class="callout__title">Practical defaults</p>
<p><strong>Internal services</strong>: HTTP/2. Use HTTP/1.1 only where a dependency requires it.<br>
<strong>Public APIs</strong>: HTTP/2 with HTTP/1.1 fallback through ALPN. Add HTTP/3 when UDP 443 is open end to end.<br>
<strong>Web frontends</strong>: HTTP/2, likely already on. HTTP/3 if the CDN or load balancer supports it.<br>
In every case, enabling a newer version doesn't require disabling an older one.</p>
</div>
