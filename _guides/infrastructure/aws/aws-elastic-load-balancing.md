---
title: "AWS Elastic Load Balancing for System Architects"
layout: guide
category: AWS
subcategory: Networking & Content Delivery
description: "How AWS load balancers work and which to choose: nodes, listeners, and target groups; Application, Network, and Gateway Load Balancers; health checks, draining, cross-zone behavior, TLS, and how capacity units are billed."
tags: [load-balancing, alb, nlb, gwlb, health-checks, cross-zone, fundamentals]
---

## How an AWS Load Balancer Works

A load balancer gives clients one stable address and spreads their traffic across a changing set of servers, sending nothing to the ones that are unhealthy. Elastic Load Balancing (ELB) is AWS's managed version. It scales itself, runs across Availability Zones (AZs), and integrates with Auto Scaling, containers, and certificates.

Every ELB load balancer is built from the same parts:

- **Nodes.** Enabling an AZ for a load balancer places a node in one of that AZ's subnets. An ALB needs at least two AZs. The load balancer's DNS name resolves to the nodes' IP addresses with a 60-second TTL, and the client picks one. The nodes are what actually receive and forward traffic.
- **Listeners.** A listener checks for connections on one protocol and port, such as HTTPS on 443. A load balancer can have several.
- **Rules.** Each listener has rules that decide where a request or connection goes. An Application Load Balancer's rules can inspect the request to choose. A Network Load Balancer's listener forwards to one target group, or to several by weight.
- **Target groups.** A target group is a set of destinations, such as instances, IP addresses, or Lambda functions, with its own health check and traffic settings. Rules forward to target groups, and Auto Scaling groups and ECS services register their members into them.

A load balancer is **internet-facing** or **internal**. An internet-facing load balancer's nodes have public IP addresses and sit in public subnets. An internal one's nodes have only private addresses and are reachable only from networks connected to the VPC. Either way, nodes reach targets by private IP address, so targets never need public addresses and can live in private subnets. A common layout uses both kinds: an internet-facing load balancer in front of the web tier, and an internal one between the web tier and the services behind it.

{% include figure.html id="aws-elb-anatomy" %}

---

## Choosing a Load Balancer Type

ELB offers three current load balancer types. A fourth, the Classic Load Balancer, predates them and remains only for older workloads.

| | Application Load Balancer (ALB) | Network Load Balancer (NLB) | Gateway Load Balancer (GWLB) |
|---|---|---|---|
| **Works at** | Layer 7: HTTP requests | Layer 4: TCP and UDP connections | Layer 3: IP packets |
| **Listener protocols** | HTTP, HTTPS | TCP, UDP, TCP_UDP, TLS, QUIC, TCP_QUIC | All IP traffic, sent to appliances over GENEVE, an encapsulation protocol |
| **Chooses a target by** | Listener rules, then the target group's routing algorithm | A weighted choice of target group, then a hash of each connection's protocol, addresses, and ports | A hash of each flow's addresses, ports, and protocol |
| **Target types** | Instance, IP, Lambda | Instance, IP, ALB | Instance, IP |
| **Static IP per AZ** | No, addresses change as it scales | Yes, optionally an Elastic IP (an address you allocate and keep) | Not applicable, reached through endpoints |
| **Terminates TLS** | Yes | Yes, on TLS listeners | No |
| **Cross-zone default** | Always on at the load balancer | Off | Off |

The choice usually falls out of three questions:

```
Is the traffic HTTP or HTTPS?
├── Yes → Do clients need a fixed IP address, or will the service be
│         offered to other VPCs as a PrivateLink endpoint service?
│         ├── No  → ALB
│         └── Yes → NLB, with an ALB as its target if HTTP routing is still needed
└── No  → Is the goal to pass traffic through firewall or inspection appliances?
          ├── Yes → GWLB
          └── No  → NLB (TCP, UDP, TLS, QUIC)
```

An ALB suits almost every web application or API, because it can route on anything in the request, terminate TLS, authenticate users, and hand requests to Lambda. An NLB passes connections through rather than parsing them, which makes it the choice for non-HTTP protocols, for very large numbers of long-lived connections, and for fixed addresses that a partner's firewall can allow. AWS Global Accelerator in front of an ALB is the other way to give an HTTP service fixed addresses. A GWLB serves one purpose, which is inserting a fleet of third-party network appliances into a traffic path.

---

## Application Load Balancer

### Listener Rules

Each ALB listener evaluates its rules in priority order and applies the first one whose conditions match. Conditions can test:

- the **host** header, so `api.example.com` and `www.example.com` reach different target groups,
- the **path**, such as `/orders/*`,
- any **HTTP header**, the **method**, or a **query string** parameter,
- the client's **source IP** range.

Since October 2025, conditions can also match with regular expressions, and a rule can **rewrite** the path or host header before forwarding, for example turning `/api/v1/users` into `/users`. That removes a common reason to run a proxy behind the ALB.

A matching rule then takes an action. It can **forward** to one target group, or to several with weights from 0 to 999, which splits traffic by percentage for a canary release. It can **redirect** (for example, HTTP to HTTPS), return a **fixed response**, or **authenticate** the user first. Every listener ends with a default rule for requests nothing else matched.

Host and path rules let one ALB front many services, which is cheaper and simpler than one load balancer per service. The hourly charge applies per load balancer, and an internet-facing ALB also holds public IPv4 addresses in every AZ it serves, unless it is set to dual-stack without public IPv4 and serves clients over IPv6.

### Target Groups and Routing Algorithms

An ALB target group holds instances, IP addresses (containers, or servers reached over a VPN or Direct Connect), or a single Lambda function, which receives each request as a JSON event. Targets are reached over HTTP/1.1 by default, or HTTP/2 or gRPC when the target group's protocol version says so.

Within a target group, one of three algorithms picks the target:

| Algorithm | Picks | Suits | Can't combine with |
|---|---|---|---|
| **Round robin** (default) | Each healthy target in turn | Requests of similar cost on similar targets | Nothing |
| **Least outstanding requests** | The target with the fewest requests in progress | Requests whose cost varies, or targets of different sizes | Slow start |
| **Weighted random** | A target at random, weighted | Using automatic target weights, which shifts traffic away from a target returning more 5xx errors or connection failures than its peers | Slow start, sticky sessions |

**Slow start** ramps a newly healthy target from a trickle to its full share over a set period, which helps applications whose caches or JIT compilers need time to warm up.

**Sticky sessions** bind a client to one target with a cookie, either one the ALB generates (`AWSALB`) or one tied to the application's own session cookie. Stickiness exists for applications that keep session state in memory. It also defeats even distribution and moves the state problem rather than solving it, because a failed target still loses its sessions. Keeping session state in a shared store such as ElastiCache or DynamoDB lets any target serve any request.

Targets see the ALB's address as the source of each request. The client's address arrives in the `X-Forwarded-For` header, alongside `X-Forwarded-Proto` and `X-Forwarded-Port`.

### TLS, Certificates, and Authentication

An HTTPS listener terminates TLS using certificates from AWS Certificate Manager (ACM), which issues public certificates at no charge and renews them automatically. With **Server Name Indication (SNI)**, one listener can serve many domains, each with its own certificate, up to 25 besides the default by default.

The listener's **security policy** decides which TLS versions and ciphers it accepts, and the default depends on how the listener was created. The console defaults to `ELBSecurityPolicy-TLS13-1-2-Res-PQ-2025-09`, which allows only TLS 1.2 and 1.3 and adds post-quantum key exchange. The API, CLI, CloudFormation, and CDK still default to `ELBSecurityPolicy-2016-08`, which accepts TLS 1.0 and 1.1. Set the policy explicitly in infrastructure code.

Beyond server certificates, an ALB can take on three kinds of client authentication:

- **User sign-in.** An `authenticate-oidc` or `authenticate-cognito` action runs the OpenID Connect sign-in flow with an identity provider, sets a session cookie, and passes the user's claims to the target in `x-amzn-oidc-*` headers.
- **Token verification.** Since November 2025, a listener can verify a JSON Web Token (JWT) sent by a machine client, checking its signature, issuer, and expiry before forwarding. This suits service-to-service calls using the OAuth client credentials flow.
- **Mutual TLS.** The ALB can require client certificates and verify them against a trust store of certificate authorities you upload, or pass them through for the target to verify.

An ALB is also where AWS WAF attaches for HTTP-layer filtering, such as blocking SQL injection patterns or rate-limiting an address.

Once a client upgrades a connection to WebSockets, listener rules and WAF no longer apply to the messages on it. Each connection stays on the target that accepted the upgrade.

---

## Network Load Balancer

### Connections, Not Requests

An NLB never parses what it carries. Its listener first picks a target group, by weight if it forwards to more than one (since November 2025, which allows canary releases behind an NLB). Then, for each new TCP connection, it hashes the protocol, source and destination addresses and ports, and TCP sequence number to choose a target, and it keeps the whole connection on that target. UDP flows are tracked the same way. That makes an NLB fast and protocol-agnostic, and it holds very large numbers of concurrent connections. It also means the NLB can't balance requests within a connection, so one client holding a single long-lived connection always lands on one target.

Connections that go quiet are dropped from tracking after an **idle timeout**, 350 seconds by default for TCP and adjustable from 60 to 6,000 seconds. A client or target that sends after the timeout gets a reset, so long-lived protocols should send keepalives more often than that.

### Static Addresses

An NLB has one IP address per enabled AZ, and those addresses don't change. An internet-facing NLB can use Elastic IPs you allocate, which lets a partner allow a fixed set of addresses through their firewall. An internal NLB takes a private address in each subnet, which can also be chosen.

An NLB can have **security groups**, but only if at least one is attached when the NLB is created. An NLB created without one can never have one added, so attach one at creation even if its rules start wide open.

An ALB can also be registered as an NLB's target, which combines a fixed address with HTTP routing.

### Client IP Preservation and Proxy Protocol

Whether a target sees the client's real address depends on the target type and protocol:

| Target group | Client IP preserved by default |
|---|---|
| Instance targets | Yes |
| IP targets with UDP, TCP_UDP, QUIC, or TCP_QUIC | Yes, and it can't be turned off |
| IP targets with TCP or TLS | No, but it can be turned on |

Preservation requires the target to be in the same VPC or a peered VPC in the same Region. Traffic arriving through PrivateLink, reaching targets through a transit gateway (the hub that routes between many VPCs), or passing through a Gateway Load Balancer endpoint on the way to the target never preserves it. Where preservation isn't possible, **Proxy Protocol v2** prepends a header carrying the original addresses to each connection. The target application has to understand that header, or it will fail both requests and health checks.

For target security groups, the simplest rule is to allow the NLB's own security group, which admits traffic from the NLB whether or not client IP preservation is on. An NLB without a security group can't be referenced that way, so its targets must allow the clients' address ranges when preservation is on, or the NLB's private addresses when it is off.

### TLS and QUIC

A **TLS listener** terminates TLS at the NLB using ACM certificates and SNI, which suits non-HTTP protocols such as MQTT or custom TCP services. Its idle timeout is fixed at 350 seconds.

Since November 2025, an NLB can also pass **QUIC** through. QUIC is the UDP-based transport under HTTP/3, and it identifies each connection by a connection ID rather than by the client's address. The NLB uses that ID to keep a connection on the same target when a mobile client changes networks and its address changes. The NLB doesn't terminate QUIC; the targets do.

### PrivateLink Endpoint Services

AWS PrivateLink lets other VPCs and accounts reach a service privately. When the service is offered as a PrivateLink **endpoint service**, it must sit behind an NLB (or a GWLB, for appliances), so a service that might be shared this way is easier to front with an NLB from the start, with an ALB behind it if it needs HTTP routing.

---

## Gateway Load Balancer

A GWLB inserts a fleet of network appliances, such as firewalls or intrusion detection systems, into a traffic path without the traffic's source or destination knowing. It doesn't terminate anything. It receives whole IP packets, wraps each one in a **GENEVE** header on UDP port 6081, and sends it to an appliance chosen by hashing the flow, so every packet in a flow reaches the same appliance. The appliance inspects the packet and returns it, and the GWLB forwards it on with its original addresses intact. Appliances must support GENEVE, and the GWLB-compatible appliances sold through AWS Marketplace do.

Traffic reaches a GWLB through a **Gateway Load Balancer endpoint** placed in the VPC being protected, and route tables decide which traffic takes the detour. For inbound inspection, three routes work together. An **edge route table**, a route table associated with the internet gateway itself, applies to traffic as it enters the VPC and sends traffic for the application subnet to the endpoint. The application subnet's default route points at the endpoint, so responses take the same path back. The endpoint subnet's default route points at the internet gateway, so inspected responses can leave:

{% include figure.html id="aws-elb-gwlb-inspection" %}

The appliances usually live in a central inspection VPC owned by a security team, serving endpoints in many application VPCs. Because the path is set by routes, a missing route bypasses inspection silently, and a route that sends only one direction through the appliances breaks stateful firewalls, which must see both halves of a flow (the packets of one connection in both directions). When the inspection VPC is attached to a transit gateway, turning on the attachment's appliance mode keeps both directions of a flow in the same AZ and so on the same appliance.

For a single VPC or a few, AWS Network Firewall is a managed alternative that needs no appliance fleet. A GWLB earns its place when the organization is committed to a particular vendor's appliances, or inspects traffic for many VPCs centrally.

---

## Health Checks and Draining

### Health Checks

Each target group runs active health checks against every registered target, from every load balancer node. A target starts receiving traffic after passing its initial check, leaves service after a run of consecutive failures, and returns after a run of consecutive successes. For an ALB target group, the settings are:

| Setting | Range | Default (instance and IP targets) |
|---|---|---|
| Protocol | HTTP, HTTPS | HTTP |
| Path | Any path, or a gRPC method | `/` |
| Interval | 5-300 seconds | 30 seconds |
| Timeout | 2-120 seconds | 5 seconds |
| Healthy threshold | 2-10 checks | 5 |
| Unhealthy threshold | 2-10 checks | 2 |
| Success codes | 200-499 | 200 |

With the defaults, a failing target leaves service after about a minute (two failed checks 30 seconds apart), but a recovered one takes two and a half minutes to return (five successes). A shorter interval and a lower healthy threshold bring recovery down to seconds, at the cost of more health check traffic.

What the health check tests matters more than how often. A check that only confirms the process answers on `/` can pass while the application is broken. A check that tests every shared dependency has the opposite problem. If the database goes down, every target fails at once and there is nothing healthy to route to. ELB handles that case by **failing open**. When every target in a target group is unhealthy, the load balancer routes to all of them anyway, on the reasoning that some traffic succeeding beats none. The usual middle ground checks what the target itself controls, such as its own process, configuration, and local resources, and treats shared dependencies more carefully.

### Target Group Health Thresholds

By default, a load balancer keeps sending traffic to an AZ as long as that AZ has at least one healthy target. That can pile a whole zone's traffic onto a few survivors. **Target group health** settings set a minimum count or percentage of healthy targets per AZ, with two possible responses when an AZ falls below it:

- **DNS failover** removes that AZ's load balancer node from DNS, so new clients go to the other AZs.
- **Routing failover** makes the node send traffic to every target it can reach, including the unhealthy ones, so the few healthy targets aren't overloaded. It is the same fail-open behavior, triggered earlier.

The DNS failover threshold must be at or above the routing failover threshold, so clients are moved away from a zone before that zone starts sending traffic to unhealthy targets. With cross-zone load balancing on, the thresholds count targets across all zones rather than per zone.

For an AZ that is impaired in ways health checks don't catch, a **zonal shift** in Amazon Application Recovery Controller moves a load balancer's traffic out of that AZ with one action. Load balancers can also opt in to zonal autoshift, where AWS starts the shift itself.

### Deregistration Delay

When a target is deregistered, whether by a scale-in, a deployment, or by hand, it enters a **draining** state. The load balancer stops sending it new requests or connections but lets in-flight ones finish, for up to the deregistration delay (300 seconds by default, adjustable from 0 to 3,600, except for NLB QUIC target groups, where it is fixed at 300).

The default suits no one in particular. For a web API whose requests finish in seconds, 300 seconds only slows every deployment and scale-in. An ALB finishes early when a target has nothing in flight, but a target with a trickle of slow requests holds the full delay. For WebSockets or streaming, 300 seconds may cut connections short. Set the delay slightly above the longest request or connection the application should be allowed to finish. NLB connections can outlive the delay unless connection termination on deregistration is turned on, and AWS recommends at least 120 seconds for NLB target groups.

---

## Cross-Zone Load Balancing

Each load balancer node receives roughly an equal share of client traffic, because clients pick among the nodes' addresses. **Cross-zone load balancing** decides whether a node may then send that traffic to targets in other AZs, or only to targets in its own:

{% include figure.html id="aws-elb-cross-zone" %}

With it off, a zone with fewer targets overloads them, so capacity has to be balanced across zones by design. With it on, capacity can be uneven, but traffic crosses zones.

The defaults and costs differ by type:

- **ALB:** always on at the load balancer, with no charge for the cross-zone traffic. It can be turned off per target group, but sticky sessions and Lambda targets then stop working for that group.
- **NLB and GWLB:** off by default, and can be turned on for the load balancer or per target group. An NLB target group of ALB type always follows the load balancer's setting. Turning it on for an NLB makes the traffic between zones subject to regular data transfer charges.

Keeping it off gives each zone an independent failure domain, which some designs prefer. That choice only works when every zone has enough targets to carry its share, and every target group has targets in every enabled zone. An empty zone is treated as unhealthy.

---

## What a Load Balancer Costs

Each type charges per hour plus per **capacity unit**. A capacity unit covers a set amount of each of several traffic dimensions (four for an ALB, three for an NLB or GWLB), and you pay for whichever dimension you use most. Prices in US East (N. Virginia):

| | Per hour | Per capacity-unit hour | One capacity unit is the highest of |
|---|---|---|---|
| **ALB** (LCU) | $0.0225 | $0.008 | 25 new connections per second, 3,000 active connections per minute, 1 GB processed per hour (0.4 GB for Lambda targets), or 1,000 rule evaluations per second after the first 10 rules |
| **NLB** (NLCU) | $0.0225 | $0.006 | For TCP: 800 new connections per second, 100,000 active per minute, or 1 GB per hour. UDP and TLS have lower connection allowances |
| **GWLB** (GLCU) | $0.0125 per AZ | $0.004 | 600 new connections per second, 60,000 active per minute, or 1 GB per hour |

Processed bytes usually decide the bill. An ALB processing 10 GB an hour uses 10 LCUs, or about $58 a month, on top of about $16 a month for the hour charge. Public IPv4 addresses on internet-facing nodes, cross-zone data transfer on NLBs and GWLBs, and GWLB endpoints (billed through PrivateLink) are charged separately.

The main levers follow from that. Consolidate services behind one ALB with host and path rules, put a CDN such as CloudFront in front of an ALB so cacheable content never reaches it, and keep TLS listeners on an NLB only where TLS termination is needed, since their connection allowances are far lower than TCP's.

---

## Common Pitfalls

### Weak TLS From Infrastructure Code

Because the console's newer default applies only to listeners created there, manual testing never shows the older policy that templates get. Name the security policy in every template.

### Targets That Accept Traffic From Anywhere

A target in a private subnet can still be reached by anything else inside the VPC. Give the load balancer its own security group, and allow only that group in the targets' inbound rules. For an NLB, that pattern depends on attaching a security group when the NLB is created.

### Zones That Can't Carry Their Neighbor's Load

Spreading targets across two AZs protects nothing if the surviving zone can't absorb the traffic when the other fails. Each zone needs headroom for the load it inherits. This applies with cross-zone on or off, and it's cheaper to find in a test that deregisters a zone's targets than in an outage.

---

## Key Takeaways

1. **A load balancer is nodes in each AZ, listeners, rules, and target groups.** Targets are reached by private address, so they belong in private subnets.
2. **Use an ALB for HTTP, an NLB for everything connection-level, and a GWLB for appliances.** An NLB also gives fixed addresses and fronts PrivateLink endpoint services, with an ALB behind it if HTTP routing is needed.
3. **Health checks decide what "healthy" means.** Check what the target controls, remember that ELB fails open when every target fails, and use target group health thresholds to fail away from a degraded AZ.
4. **Cross-zone is on for ALBs and off for NLBs and GWLBs by default.** With it off, each zone needs capacity for its share, and with it on for an NLB, the traffic between zones is billed.
5. **Set the TLS policy and deregistration delay explicitly.** Templates get an old TLS policy by default, and a 300-second drain suits few applications.
6. **Processed bytes drive the bill.** One ALB with host rules and a CDN in front usually costs less than several load balancers doing the same job.
