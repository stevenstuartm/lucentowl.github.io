---
title: "AWS Route 53 for System Architects"
layout: guide
category: AWS
subcategory: Networking & Content Delivery
description: "How Route 53 answers DNS queries for AWS workloads: public and private hosted zones, alias records, the eight routing policies, health checks and DNS failover, hybrid DNS through the VPC Resolver, and what drives the bill."
tags: [route53, dns, routing-policies, health-checks, private-hosted-zones, hybrid-dns, fundamentals]
---

## What Route 53 Does

Amazon Route 53 is AWS's DNS service. It does three separate jobs. It **registers domain names**, it serves as the **authoritative DNS** for domains whose records you keep in it, and it **checks the health** of endpoints so that its DNS answers can steer around failures. A domain can use any one of these without the others. A domain registered elsewhere can still host its DNS in Route 53, for example.

Two design facts shape everything else:

- **Route 53 is global.** Hosted zones and health checks aren't tied to a Region. Its DNS answers come from more than 200 points of presence (AWS edge sites around the world), and AWS offers a 100% availability SLA for its authoritative DNS in commercial Regions.
- **Its control plane lives in us-east-1.** Creating or changing records and health checks goes through APIs hosted there, while answering queries and running health checks (the data plane) is distributed worldwide. The data plane is built to keep working when the control plane can't. A failover plan that depends on editing records during a Regional outage leans on the part designed to be less available. A plan built on health checks that are already configured only needs the data plane. Two features narrow the gap. **Accelerated recovery** (since November 2025, opt-in, no charge) targets restoring the ability to change public hosted zone records within 60 minutes if us-east-1 is impaired. Amazon Application Recovery Controller offers routing controls, switches that flip health checks on its own highly available data plane, for teams that need a manual failover lever.

This guide assumes the DNS basics of record types, resolvers, and TTL caching, and covers what Route 53 adds on top.

---

## Hosted Zones and Records

A **hosted zone** holds the records for one domain and its subdomains. There are two kinds:

| | Public hosted zone | Private hosted zone |
|---|---|---|
| **Answers** | Queries from anywhere on the internet | Queries from VPCs associated with the zone |
| **Typical use** | Websites, public APIs, mail | Internal service names such as `orders.internal.example.com` |
| **Query charges** | Per million queries | None |
| **Zone charge** | $0.50 a month each for the first 25, then $0.10 | Same |

A private hosted zone can be associated with many VPCs, including VPCs in other accounts, and the VPCs need DNS resolution and DNS hostnames turned on. A private hosted zone is a global resource, so one zone can serve VPCs in any Region.

When a private and a public zone have the same name, VPCs associated with the private zone see its records and everyone else sees the public ones. This **split-horizon** arrangement lets `api.example.com` resolve to a private address inside the VPC and a public one outside. There is no fallback between the two. A query from the VPC for a name the private zone lacks gets NXDOMAIN (no such name), even if the public zone has it, so a split-horizon private zone must repeat every public record the VPC also needs.

### Alias Records

An **alias record** is Route 53's extension to DNS for pointing a name at an AWS resource. It looks like an ordinary A or AAAA record to the client, but Route 53 fills in the resource's current addresses itself. Alias records can target load balancers, CloudFront distributions, API Gateway APIs, S3 website endpoints, Global Accelerator accelerators, VPC interface endpoints, and other records in the same hosted zone.

Alias records solve three problems a CNAME can't:

- **They work at the zone apex.** DNS forbids a CNAME on `example.com` itself, but an alias record there can point at a load balancer.
- **Queries to AWS resources are free.** A CNAME query is billed, and a CNAME that points at another Route 53 record is billed as two queries.
- **They follow the resource.** When a load balancer's addresses change as it scales, the alias record's answers change with it. The TTL comes from the resource and can't be set.

An alias record can also **evaluate target health**. With that on, Route 53 treats the record as unhealthy when the target is, for example when a load balancer has no healthy targets, without a separate health check.

### TTL and Failover

Resolvers keep serving a cached answer until its TTL expires, however unhealthy the target has become, so the TTL on any record that fails over sets a floor on how fast clients move. Keep those records around 60 seconds, and let stable ones such as mail and verification entries use long TTLs, which cost fewer queries. Alias records to AWS resources take their TTL from the resource, which is short for load balancers.

---

## Routing Policies

A routing policy decides which answer Route 53 gives when a name has several records. Each record in the set carries the policy and, for most policies, an optional health check (covered below), and Route 53 leaves out records whose health check is failing.

| Policy | Chooses the answer by | Typical use |
|---|---|---|
| **Simple** | Always the same record, with all its values | One resource, no health checks |
| **Weighted** | Weights from 0 to 255, in proportion | Shifting a share of traffic to a new stack, or to a Region with more capacity |
| **Latency** | The AWS Region with the lowest measured latency from the user's network | Serving a multi-Region application from the fastest Region |
| **Failover** | The primary record while its health check passes, otherwise the secondary | Active-passive disaster recovery |
| **Geolocation** | The user's continent, country, or US state | Localized content, or keeping users in a jurisdiction |
| **Geoproximity** | Distance between the user and each resource, adjusted by a bias | Nearest-resource routing, with traffic shifted between locations |
| **IP-based** | The CIDR range the query's source falls in | Routing specific ISPs or networks, when their address ranges are known |
| **Multivalue answer** | Up to eight healthy records, chosen at random | Spreading clients across servers, with unhealthy ones dropped |

Every policy except IP-based is available in private hosted zones.

### How Route 53 Knows Where a User Is

Latency, geolocation, and geoproximity routing all need the user's location, and Route 53 never sees the user. It sees the DNS resolver that queries on the user's behalf. When that resolver supports the EDNS0 client subnet extension, it passes along a truncated form of the user's address, and Route 53 uses that. Otherwise, Route 53 uses the resolver's address. A user whose resolver is far away, such as a public resolver in another country or a corporate resolver at headquarters, can be routed for the resolver's location rather than their own.

Latency routing chooses by measured latency between networks and AWS Regions, which AWS gathers over time, not by distance. The Region closest on a map isn't always the one chosen.

### Geolocation Versus Geoproximity

Both route by location, but they answer different questions. **Geolocation** maps where the user is to a record: users in Germany get the Frankfurt endpoint, for example. It routes by borders, which suits content licensing and data residency. A query from a location with no matching record gets no answer unless there is a **default** record, so always create one.

**Geoproximity** maps where the user is relative to your resources: each user goes to the nearest one. Each resource has a **bias** from -99 to 99 that grows or shrinks the area it serves, which shifts traffic between locations without redrawing a map. Since January 2024, geoproximity is available on ordinary records in public and private hosted zones. Before that, it required Traffic Flow, Route 53's visual policy editor, which charges $50 a month per policy record.

### Combining Policies

Policies nest through alias records that point at other records in the same zone. A common layout uses latency routing at the top, with one record per Region, each an alias to a failover pair or to a weighted set inside that Region. With **evaluate target health** turned on at each alias, health passes upward. A failing endpoint drops out of its set, and a set with nothing healthy left makes the record above it unhealthy, so Route 53 answers from the next best branch.

{% include figure.html id="aws-r53-policy-tree" %}

---

## Health Checks and DNS Failover

### How a Health Check Decides

A Route 53 **endpoint health check** sends requests to an IP address or domain name every 30 seconds, or every 10 seconds for a fast check, from health checkers in locations around the world. Each checker applies its own pass rules:

| Protocol | Passes when |
|---|---|
| **HTTP or HTTPS** | A TCP connection opens within four seconds, and a 2xx or 3xx status arrives within two seconds after that. HTTPS checks don't validate the certificate |
| **HTTP or HTTPS with string matching** | As above, and the string appears in the first 5,120 bytes of the body |
| **TCP** | A TCP connection opens within ten seconds |

A checker marks the endpoint unhealthy after a number of consecutive failures (the failure threshold, 3 by default). Route 53 then combines the checkers' views. The endpoint is healthy if **more than 18%** of checkers report it healthy. The low bar is deliberate. It keeps a network problem between the endpoint and a few checker locations from failing it, so a health check detects an endpoint that is down for nearly everyone, not one that is unreachable from some places.

Two other kinds of health check watch something other than an endpoint:

- A **calculated health check** combines up to 255 child health checks and is healthy when a set number of them are, which expresses rules like "healthy if at least two of three Regions are."
- A **CloudWatch alarm health check** follows an alarm's data, which is how to health-check a resource the checkers can't reach, such as anything in a private subnet or an internal load balancer. Route 53 health checkers run on the internet, so endpoint checks need public addresses.

### Failover Timing

Failover takes longer than the health check interval alone suggests. The endpoint has to fail enough consecutive checks, then resolvers have to let the old answer expire:

| Health check | Time to mark unhealthy (threshold 3) | Plus |
|---|---|---|
| Standard (30 seconds) | About 90 seconds | The record's TTL |
| Fast (10 seconds) | About 30 seconds | The record's TTL |

With a 60-second TTL, a fast health check moves most clients within one to two minutes. Some clients and resolvers cache longer than the TTL allows, so a small share of traffic can keep arriving at the failed endpoint after that.

### Active-Passive and Active-Active

With **failover routing**, the primary record carries a health check and the secondary serves only while the primary is unhealthy. That is **active-passive**. A secondary without a health check of its own is served whenever the primary fails, even if the secondary is down too, so give it one. The secondary sits idle until needed, so it must be tested regularly, or its first failover in production is also its first test.

With **weighted**, **latency**, or **multivalue** records that each carry a health check, every healthy record serves traffic and unhealthy ones drop out. That is **active-active**. Every endpoint is exercised all the time, but each one must have the capacity to absorb traffic when the others fail.

When every record in a set is unhealthy, Route 53 answers as if all of them were healthy rather than returning nothing, on the reasoning that an answer that might work beats one that certainly won't. A failover pair with both records unhealthy returns the primary. Records with no health check always count as healthy. A health check that fails everywhere at once, for example because a firewall started blocking the checkers, therefore degrades to answering as if nothing had failed, rather than to an outage. That fallback applies to the name being queried. A set nested under an alias with evaluate target health on reports itself unhealthy instead, so the branch above it can fail over, which is what the policy tree above relies on.

---

## DNS Inside the VPC

Every VPC has a built-in DNS resolver, the **Route 53 VPC Resolver**, at the VPC's base address plus two (`10.0.0.2` in a `10.0.0.0/16` VPC). Instances use it by default. It answers from private hosted zones associated with the VPC, from AWS's own internal names, and from public DNS. Unlike Route 53's authoritative DNS, the VPC Resolver is Regional, and so are its endpoints, forwarding rules, and Profiles. A multi-Region organization builds them in each Region it uses.

### Hybrid DNS With Resolver Endpoints

A VPC connected to a data center by VPN or Direct Connect usually needs names to resolve in both directions. The VPC Resolver provides two kinds of endpoint for it, each a set of at least two network interfaces in the VPC, spread across Availability Zones (AZs) for resilience:

- An **inbound endpoint** gives on-premises DNS servers an address in the VPC to forward queries to, so data center clients can resolve the private hosted zones associated with that VPC.
- An **outbound endpoint**, with **forwarding rules** for chosen domains, sends queries for those domains from the VPC to the data center's DNS servers. A forwarding rule wins over a private hosted zone for the same domain, so a rule for `example.com` hides a private zone named `example.com` from the VPC.

{% include figure.html id="aws-r53-resolver-endpoints" %}

Endpoints are billed per network interface per hour ($0.125 in US East), so an endpoint with interfaces in two AZs runs about $180 a month before queries. In a multi-account organization, a common design places each Region's endpoints in one shared networking account and shares the forwarding rules with other accounts through AWS Resource Access Manager. The VPCs that receive the rules then send matching queries through the central outbound endpoint, so other accounts in that Region don't need endpoints of their own.

For clients that aren't in a VPC at all, such as remote laptops, **Route 53 Global Resolver** (generally available since March 2026) is an internet-reachable resolver that authorized clients can use from anywhere. It resolves public names and private hosted zones, with filtering, and needs no VPN or inbound endpoint.

### Profiles and DNS Firewall

**Route 53 Profiles** bundle a VPC's DNS configuration, including private hosted zone associations, forwarding rules, and DNS Firewall rule groups, so it can be applied to many VPCs across accounts in a Region at once instead of VPC by VPC. A VPC can have one Profile. Profiles are billed hourly, at $0.75 an hour for up to 100 VPC associations, so they pay off across many VPCs rather than a few.

**Route 53 Resolver DNS Firewall** filters the queries that VPC resources send through the VPC Resolver, blocking or allowing domains by list. Blocking lookups of known-malicious domains stops a common way compromised software reaches its command servers or sends data out, and it works even when network rules allow outbound HTTPS.

---

## Securing a Domain

- **Registrar lock and contacts.** For a domain registered through Route 53, keep transfer lock on and the registrant contact current, since losing control of a domain is harder to recover from than any outage.
- **DNSSEC signing.** Route 53 can sign a public hosted zone with DNSSEC, so resolvers that validate can detect forged answers. Signing uses a key-signing key backed by an AWS KMS key in us-east-1. It adds operational steps, because the parent zone needs a DS (delegation signer) record that vouches for your key, and a key problem can make the whole domain fail validation. Turn it on when the domain's risk justifies that care.
- **Dangling records.** A record that still points at a deleted resource, such as a released Elastic IP or a deleted S3 website bucket, lets someone who later claims that resource serve content under your domain. An alias to an S3 website endpoint is exposed the same way, since anyone can create a bucket with the deleted name. Delete the record first, wait for its TTL to pass, and only then delete the resource.

---

## What Route 53 Costs

| Item | Price |
|---|---|
| Hosted zone | $0.50 a month each for the first 25, $0.10 after |
| Standard queries | $0.40 per million for the first billion a month, $0.20 after |
| Latency, geolocation or geoproximity, and IP-based queries | $0.60, $0.70, and $0.80 per million |
| Alias queries to AWS resources, and all private hosted zone queries | No charge |
| Health check on an AWS endpoint | $0.50 a month (the first 50 are free), $0.75 for a non-AWS endpoint, plus a fee for each optional feature such as HTTPS, string matching, or the fast interval |
| Resolver endpoint | $0.125 per network interface per hour |
| Profiles | $0.75 an hour for up to 100 VPC associations |

For most workloads, the query and zone charges are small. The hourly items, Resolver endpoints and Profiles, are the ones that grow with the number of Regions and VPCs. Use alias records for anything pointing at AWS, and keep TTLs no shorter than failover requires.

---

## Common Pitfalls

### A Failover Plan That Needs the Control Plane

Scripts that swap records during an outage depend on the Route 53 API in us-east-1. Pre-configure failover with health checks, which run on the data plane, and use the API for planned changes.

### Users Who Get No Answer

Users in a place no geolocation record covers get no answer at all, and they are hard to see in monitoring because their requests never arrive. The same silence hits a VPC querying a split-horizon private zone for a name only the public zone has. Both show up only when someone reports them.

### Firewalls That Block the Checkers

A security group or firewall that blocks Route 53's health checker ranges fails a healthy public endpoint. Allow the published checker address ranges, and use CloudWatch alarm health checks for anything private.

---

## Key Takeaways

1. **Route 53 registers domains, serves DNS, and checks health, globally.** Its data plane is built to stay up when its us-east-1 control plane can't, so design failover around health checks, not API calls, and turn on accelerated recovery for public zones.
2. **Use alias records for AWS resources.** They work at the zone apex, cost nothing to query, and follow the resource's changing addresses.
3. **Pick a routing policy for the question being asked.** Latency for speed, geolocation for borders, geoproximity for nearest with a bias, weighted for proportions, failover for a standby, and multivalue for simple spreading.
4. **Health checks judge from many locations and call an endpoint healthy if more than 18% of them can reach it.** Failover time is the detection time plus the TTL, so keep TTLs short on records that fail over.
5. **Private hosted zones and the VPC Resolver handle DNS inside AWS.** Private zones have no fallback to public ones, Resolver endpoints connect the VPC Resolver to a data center in both directions, and sharing their rules from one account per Region avoids paying for endpoints in every VPC.
