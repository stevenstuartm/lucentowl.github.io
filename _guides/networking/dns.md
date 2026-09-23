---
title: "DNS: How Names Become Addresses"
layout: guide
category: Networking
subcategory: Network Fundamentals
description: "How DNS resolution works from the stub resolver to the authoritative server, the record types developers configure, why TTLs and caching govern how fast changes take effect, and where DNS-based failover, private zones, and client caching trip up production systems."
tags: [fundamentals, dns, ttl, caching, failover, split-horizon]
---

Almost every connection to a named host starts with a DNS lookup, and DNS is built to answer from a cache whenever it can. That caching is what lets DNS handle the whole internet's query volume. It also explains most of the DNS behavior that surprises developers: changes that take hours to reach some users, failovers that don't fail over, and a service that keeps calling an old address long after the record was updated.

## Resolution Walks a Delegation Tree

### The Namespace Is Delegated, Not Stored in One Place

DNS names form a tree read right to left. The root delegates `com` to the servers that run that top-level domain (TLD). The `com` servers delegate `example.com` to the name servers its owner chose. Those servers are **authoritative** for the `example.com` **zone**, the portion of the tree one set of servers answers for, which includes names such as `api.example.com`. No server holds the whole namespace. Each level only knows which servers are responsible for the level below it, recorded as NS records.

### Four Roles Take Part in a Lookup

A lookup involves four roles:

- **The stub resolver** is the small client built into the operating system (and sometimes the browser or language runtime). It doesn't walk the tree. It sends the whole question to one configured recursive resolver, and on many systems a local caching service keeps the answer, though a bare Linux stub without one caches nothing.
- **The recursive resolver** does the work. It's run by an ISP, a public service such as Google's `8.8.8.8` or Cloudflare's `1.1.1.1`, a corporate network, or the cloud provider inside a VPC. It follows referrals down the tree and caches every answer and referral it collects, so most queries it receives are answered from cache.
- **Root and TLD servers** answer from their own zone data with referrals ("ask these servers for `example.com`") rather than final answers.
- **Authoritative servers** hold the zone's records and give the final answer.

{% include figure.html id="net-dns-resolution" %}

On a cold cache, the recursive resolver asks a root server, then a `com` server, then an `example.com` server. On a warm cache it answers immediately, and because the referrals for `com` are cached for days, most real lookups skip straight to the authoritative server or skip the network entirely.

### Queries Travel Over UDP First

DNS queries go to port 53, normally over UDP, because a question and its answer each fit in one datagram and a lost datagram is simply retried. A response too large for UDP comes back truncated, and the client repeats the query over TCP. Encrypted variants exist for the hop between a client and its recursive resolver: DNS over TLS on port 853 and DNS over HTTPS on port 443. They hide queries from the local network but don't change how resolution works.

## Records Developers Configure

| Type | Maps a name to | Typical use |
| --- | --- | --- |
| **A** | An IPv4 address | Pointing a hostname at a server or load balancer |
| **AAAA** | An IPv6 address | The same, for IPv6 |
| **CNAME** | Another name | Aliasing `www.example.com` to a CDN or platform hostname |
| **MX** | Mail servers, with priorities | Receiving email for the domain |
| **TXT** | Arbitrary text | Domain ownership verification, SPF, DKIM, and DMARC email policies |
| **NS** | The zone's authoritative servers | Delegation from the parent zone |
| **SOA** | Zone metadata | Serial number, and the TTL used for negative caching |
| **SRV** | A host and port for a service | Service discovery in protocols built on it, such as Active Directory domain controller location, SIP, and Kubernetes named ports |
| **CAA** | Which certificate authorities may issue for the domain | Restricting certificate issuance |
| **HTTPS / SVCB** | Connection parameters for a service | Advertising HTTP/3 support and alternative endpoints before the first connection ([RFC 9460](https://www.rfc-editor.org/rfc/rfc9460){:target="_blank" rel="noopener noreferrer"}) |
| **PTR** | A name, from an address | Reverse lookups, used in logging and mail server checks |

### A CNAME Can't Share Its Name

A CNAME says "this name is an alias; ask about that other name instead," so the DNS rules forbid a CNAME from coexisting with any other record at the same name. That creates a common problem at the zone apex. The bare domain `example.com` must carry the zone's SOA and NS records, so it can't be a CNAME, even when the site it should point at is a CDN or cloud load balancer that only gives you a hostname. DNS providers solve it with a non-standard record resolved on their side: alias records in Amazon Route 53 and Azure DNS, and CNAME flattening at Cloudflare. They answer queries for the apex with the target's current addresses.

### A Dangling CNAME Is a Takeover Risk

A CNAME that points at a deprovisioned cloud resource, such as a deleted storage bucket or app service hostname, can let someone else claim that resource name and serve content on your subdomain. Removing the DNS record belongs in the same change that deletes the resource it points to.

## TTLs Govern How Fast Changes Take Effect

### Every Answer Carries a Cache Lifetime

Each record has a time to live (TTL) in seconds, set by the zone owner. A resolver that fetches the record may serve it from cache until the TTL runs out, and then it must ask again. What's often called "DNS propagation" is not a push of the change across the internet. It's thousands of independent caches each holding the old answer until their own copy expires.

Choosing a TTL is a trade-off between agility and load:

| TTL | Changes take effect | Cost |
| --- | --- | --- |
| 60 seconds | Within about a minute for well-behaved caches | More queries to the authoritative servers, a little more lookup latency for clients |
| 300 seconds to 1 hour | Within minutes to an hour | The common default for records that change occasionally |
| 1 day | Up to a day | Few queries, and a mistake takes a day to undo |

### Lower the TTL Before a Change, Not During It

Lowering a TTL only helps after the old, longer TTL has expired from every cache. For a planned migration, drop the TTL to something short at least one old-TTL period before the cutover, make the change, confirm it, and raise the TTL again afterward. Lowering it at the moment of the change does nothing for resolvers that cached the record an hour ago with a one-day TTL.

{% include figure.html id="net-ttl-cutover" %}

Not every cache honors TTLs exactly. Some resolvers enforce a minimum, and some clients hold answers longer than they should, so plan for a tail of stale lookups after any change.

### Changing DNS Providers Waits on the Parent Zone

Moving a domain to a different DNS provider changes its NS records, and the copy that matters is the delegation held by the parent zone. Those delegations carry long TTLs, two days for names under `com`, so resolvers can keep asking the old provider's servers for up to that long after the switch. Keep the old provider serving the same records until the old delegation has expired everywhere, or some users will get stale or missing answers.

### Failed Lookups Are Cached Too

A lookup for a name that doesn't exist returns `NXDOMAIN`, and resolvers cache that negative answer as well ([RFC 2308](https://www.rfc-editor.org/rfc/rfc2308){:target="_blank" rel="noopener noreferrer"}). The negative TTL comes from the zone's SOA record, using the smaller of the SOA's own TTL and its minimum field. If a client queries a new hostname before its record exists, for example a deployment script checking the name before creating it, resolvers can go on answering "doesn't exist" for the negative TTL after the record is created.

## Clients Cache Beyond the Resolver

Caching doesn't stop at the recursive resolver. The operating system's resolver service, the browser, and some language runtimes keep their own caches, and each has its own rules about how long an answer stays. The JVM, for example, keeps its own cache governed by the `networkaddress.cache.ttl` security property. Before any DNS query at all, the operating system checks the local hosts file (`/etc/hosts`, or its Windows equivalent), so a forgotten entry there overrides DNS entirely on that one machine.

The largest source of stale addresses in services is not a DNS cache at all. It's a long-lived connection. A client resolves a name once when it opens a connection, and it keeps using that connection's address for as long as the connection stays open. A connection pool with connections that live for hours will keep sending traffic to the old address after a DNS change, and will keep doing so until the connections are recycled. That's why HTTP client libraries offer a maximum connection lifetime, and why DNS-based cutovers need one set to a value shorter than the acceptable cutover window.

Kubernetes adds a cost of its own through **search domains**, suffixes the resolver appends to a name before trying it as written, so that a short name such as `orders` finds `orders.default.svc.cluster.local`. Pods get several search domains and the resolver option `ndots:5`, which means any name with fewer than five dots, including `api.example.com`, is tried with each search domain appended first. Every external lookup can cost several failed queries before the one that succeeds.

Writing external names fully qualified, with a trailing dot (`api.example.com.`), skips the search list. Lowering `ndots` in the pod's DNS configuration skips it for any name with at least that many dots, so `ndots:2` sends `api.example.com` straight out while short in-cluster names still use the search list.

## DNS as a Traffic-Steering Tool

### Multiple Records Spread Load, Roughly

Returning several A records for one name lets clients spread across them. Resolvers often rotate the order between answers, and clients differ in how they pick, with many trying the addresses in the order they sorted them and moving on when one fails. This works as coarse distribution, but DNS has no view of server load and no way to take back an answer already cached, so it can't balance precisely or react quickly.

### Managed DNS Adds Health Checks and Routing Policies

Managed DNS services add policies on top of plain records: weighted answers, the lowest-latency region, geographic location, or failover to a standby endpoint when a health check fails. These make DNS the first stage of multi-region routing, deciding which region a client connects to before any load balancer is involved.

Their limits all follow from caching:

- **Failover takes detection time plus the TTL.** The health check has to fail several times before the record changes. Amazon Route 53's defaults, a 30-second interval and three failures, take about 90 seconds. Then clients that cached the primary region's address keep using it for up to the TTL, and longer if they hold open connections. With a 60-second TTL, some clients can see failed requests for two to three minutes.
- **The resolver's location stands in for the client's.** Latency and geographic routing see the recursive resolver's address, not the user's. A user on a public resolver may be routed by where that resolver's server sits. EDNS Client Subnet, an extension that lets a resolver pass along part of the client's address, reduces this where both sides support it.
- **Health checks test what they're configured to test.** A check that confirms a load balancer answers can pass while the application behind it fails.

When failover has to happen in seconds, it belongs in a layer that holds connections, such as a global load balancer or an anycast front end, where one address is announced from many locations and the network routes each client to the nearest. DNS then points at that stable front end.

## Private DNS and Split Horizon

Cloud networks provide a resolver inside every VPC or VNet, and a private zone answers only for networks it has been explicitly associated with, in Amazon Route 53, or linked to, in Azure DNS. That lets `db.internal.example.com` resolve to a private address inside those networks and not at all from outside. The association is per network, so a new VPC or VNet that reaches the same database resolves nothing until it is added to the zone.

**Split-horizon DNS** takes this further, answering the same name differently depending on where the query comes from. `api.example.com` might resolve to a private endpoint inside the corporate network and to a public load balancer from the internet. It's a common way to keep traffic between internal services off the public internet, and a common cause of "it works from my machine" confusion, because the same lookup gives different answers from a laptop, a VPN, and a production subnet.

Hybrid networks need forwarding rules in both directions: cloud resolvers forwarding the corporate domain to on-premises DNS servers, and on-premises servers forwarding the cloud's private zones to the cloud resolver. A missing rule shows up as names that resolve in one environment and return `NXDOMAIN` in the other.

{% include figure.html id="net-dns-hybrid-forwarding" %}

## Reading DNS Failures

### The Response Code Says Which Side Failed

| Result | Meaning | Where to look |
| --- | --- | --- |
| `NXDOMAIN` | The authoritative servers say the name doesn't exist | A typo, a missing record, the wrong private zone, or a cached negative answer |
| `NOERROR` with no answer | The name exists but has no record of the requested type | An AAAA query for a name with only an A record, for example |
| `SERVFAIL` | The resolver couldn't get a trustworthy answer | Authoritative servers unreachable or misconfigured, a broken delegation, or a failed DNSSEC check, where the signatures that prove an answer came from the zone owner don't validate |
| Timeout | No response at all | The resolver itself is unreachable or overloaded, or UDP port 53 is blocked |

`NXDOMAIN` is an answer, and `SERVFAIL` is the absence of one. Treating them the same sends debugging in the wrong direction, toward records that are fine when the problem is the servers.

### Timeouts Show Up as Fixed Stalls

When a resolver doesn't answer, the client waits before retrying or moving to the next configured resolver. On Linux the glibc resolver waits five seconds by default. That makes a dropped DNS packet look like a request that is exactly five seconds slow, and periodic five-second stalls in an application's latency are a classic sign of DNS timeouts. Some resolvers can serve an expired answer from cache when the authoritative servers can't be reached ([RFC 8767](https://www.rfc-editor.org/rfc/rfc8767){:target="_blank" rel="noopener noreferrer"}), which is why a DNS provider outage doesn't always break names that were recently looked up.

### Debug from the Failing Host, Then Walk the Tree

`dig` shows the response code, the answer, and the remaining TTL on each record, which tells you how long a cached answer will persist. Querying the authoritative server directly with `dig @` and one of the zone's name servers shows what the zone says now, separate from what caches are still serving. `dig +trace` walks the delegation from the root, which exposes a broken or stale delegation. Resolve the name from the failing host, since private zones and split-horizon setups answer differently on different networks.
