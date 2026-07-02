---
title: "HTTP/1.1 vs HTTP/2 vs HTTP/3 Comparison"
layout: resource
type: reference
category: "Networking"
description: "Protocol-level comparison of HTTP/1.1, HTTP/2, and HTTP/3, plus practical guidance on which version to enable by deployment context."
last_updated: 2026-07-02
tags: [networking, protocols, http, performance, infrastructure]
related_guides:
  - /study-guides/networking/http-protocol-versions.html
---

## Comparing HTTP Versions

| Characteristic | HTTP/1.1 | HTTP/2 | HTTP/3 |
| --- | --- | --- | --- |
| Transport | TCP | TCP | QUIC (UDP) |
| Format | Text | Binary frames | Binary frames |
| Multiplexing | No (one request per connection at a time) | Yes (many streams per connection) | Yes (independent streams) |
| Head-of-line blocking | HTTP layer and TCP layer | TCP layer only | Neither layer |
| Header compression | None | HPACK | QPACK |
| Connection setup | 2-3 RTT (TCP + TLS) | 2-3 RTT (TCP + TLS) | 1 RTT (0-RTT for resumption) |
| Connection migration | No | No | Yes |
| Encryption | Optional | Effectively required (TLS) | Always required (TLS 1.3) |
| Browser support | Universal | Universal | ~95% of browsers |
| Server/proxy support | Universal | Very broad | Growing rapidly |

## Practical Defaults by Context

| Context | Guidance |
| --- | --- |
| Internal services | Configure for HTTP/2. Use HTTP/1.1 only when a specific dependency requires it. |
| Public APIs | Enable HTTP/2 with HTTP/1.1 fallback via ALPN negotiation. Add HTTP/3 when your infrastructure supports UDP on 443. |
| Web frontends | Enable HTTP/2 (likely already on by default). Enable HTTP/3 if your CDN or load balancer supports it. |

In all cases, version negotiation handles backward compatibility automatically. Enabling a newer version never requires disabling an older one.
