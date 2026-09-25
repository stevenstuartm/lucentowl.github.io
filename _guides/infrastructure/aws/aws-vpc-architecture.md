---
title: "AWS VPC: Network Architecture"
layout: guide
category: AWS
subcategory: Networking & Content Delivery
description: "How a single Amazon VPC is built: CIDR planning, subnets across Availability Zones, route tables, internet and NAT gateways, security groups versus network ACLs, Block Public Access, and the cost of public IPv4 against IPv6."
tags: [vpc, route-tables, nat-gateway, security-groups, network-acls, ipv6, fundamentals]
---

## What a VPC Is

An **Amazon Virtual Private Cloud (VPC)** is a private network that you define inside an AWS Region. You choose its IP address range, divide it into subnets, decide how traffic is routed, and decide what traffic is allowed in and out. EC2 instances, containers, databases, load balancers, and Lambda functions that need network access all get their IP addresses from a VPC.

Scope shapes almost every design decision, so it helps to fix it early:

- **A VPC belongs to one account and one Region**, and spans every Availability Zone (AZ) in that Region. An AZ is one or more data centers with independent power and networking, so spreading resources across AZs protects against a single site failing.
- **A subnet lives in exactly one AZ** and can't span zones. High availability comes from placing subnets, and the resources in them, in at least two AZs.
- **Security groups attach to network interfaces**, and network ACLs attach to subnets. A network interface (ENI) is the virtual network card a resource uses to join a subnet, and each one takes an address from that subnet.
- **Quotas are per account per Region.** The default is 5 VPCs per Region, which is adjustable into the hundreds.

Every account starts with a **default VPC** in each Region, using `172.31.0.0/16` with a public subnet in every AZ. It exists so that a first instance can launch without any network design. Production workloads normally get a VPC designed for them instead.

---

## Planning the Address Space

### The VPC CIDR Block

A VPC starts with one IPv4 CIDR block between `/16` (65,536 addresses) and `/28` (16 addresses). AWS recommends the private ranges from RFC 1918: `10.0.0.0/8`, `172.16.0.0/12`, and `192.168.0.0/16`. Avoid `172.17.0.0/16`, which some AWS services use internally.

The primary block can't be resized or removed later. You can associate secondary IPv4 blocks, up to 5 per VPC by default and 50 with a quota increase. The secondary blocks are restricted, too. A VPC with a block from `10.0.0.0/8` can't add a block from the other RFC 1918 ranges.

Address planning matters beyond the single VPC. Two networks with overlapping ranges can't route to each other directly, which rules out connecting them later through peering, a transit gateway, or a VPN to the data center. Plan ranges across every VPC and on-premises network the organization might ever connect. Amazon VPC IP Address Manager (IPAM) can allocate non-overlapping ranges from a central pool across an organization.

### Subnet Sizing and Reserved Addresses

Each subnet takes a slice of the VPC's range, between `/16` and `/28`, and subnets in the same VPC can't overlap. AWS reserves five addresses in every subnet. In `10.0.1.0/24`, they are:

| Address | Reserved for |
|---|---|
| `10.0.1.0` | Network address |
| `10.0.1.1` | VPC router |
| `10.0.1.2` | Reserved by AWS. The Amazon-provided DNS server (the Route 53 Resolver) sits at this offset in the VPC's primary range, `10.0.0.2` in a `10.0.0.0/16` VPC |
| `10.0.1.3` | Future use |
| `10.0.1.255` | Broadcast address, which VPCs don't support but still reserve |

A `/24` therefore offers 251 usable addresses, and a `/28` only 11. Size subnets for their largest expected load, including services that take an address per unit of scale, such as ECS tasks in `awsvpc` mode, which each get their own network interface.

---

## Subnets and Route Tables

### Routing Decides What a Subnet Is

Every subnet is associated with exactly one **route table**, which decides where traffic leaving the subnet goes next. A new subnet uses the VPC's **main route table** until you associate it with another. Every route table contains a `local` route for the VPC's own range, so resources inside the VPC can always reach each other. When several routes match a destination, the most specific one (the longest prefix) wins.

A subnet has no type setting. Its route table makes it one of four kinds:

| Subnet type | Route table has | Reaches |
|---|---|---|
| **Public** | A route to an internet gateway | The internet directly, for resources with a public IP address |
| **Private** | No internet gateway route, usually a route to a NAT gateway | The internet outbound only, through the NAT gateway |
| **VPN-only** | A route to a virtual private gateway (the AWS end of a VPN), and no internet gateway route | The on-premises network over a VPN |
| **Isolated** | Only the `local` route | Nothing outside the VPC |

### A Typical Two-AZ Layout

Most production VPCs repeat the same set of subnets in each AZ they use. Internet-facing load balancers and NAT gateways sit in public subnets. Application servers and containers sit in private subnets, reachable only through the load balancer. Databases sit in their own subnets, often isolated, so that nothing in them can open a connection to the internet even if compromised.

{% include figure.html id="aws-vpc-subnet-routing" %}

Each private app subnet routes to the NAT gateway in its own AZ, which is why the two app subnets need separate route tables. The public subnets can share one route table, and so can the data subnets. If zone a fails, zone b's subnets keep their own path out.

The same layout scales down. A development VPC might use one AZ and skip the isolated tier, and a static site might need only public subnets. Those layouts trade away availability and isolation for lower cost, so they suit workloads where an AZ outage or an exposed server is an acceptable risk.

---

## Getting Traffic In and Out

### Internet Gateway

An **internet gateway** connects a VPC to the internet. It is horizontally scaled and redundant, with no bandwidth limit of its own, and a VPC can have only one attached. For IPv4, it performs one-to-one address translation between an instance's private address and its public IPv4 address, so an instance reaches the internet directly only if it is in a public subnet **and** has a public IPv4 address. That address comes from one of two places. A subnet's **auto-assign public IPv4** setting gives each new instance an address that is released when the instance stops. An **Elastic IP** is an address allocated to the account, which stays the same until you release it and can be moved between resources.

### NAT Gateway

A **NAT gateway** lets resources in private subnets open connections to the internet, for updates or third-party APIs, while nothing on the internet can open a connection to them. It translates many private addresses to its own address, and it keeps track of connections so responses find their way back.

NAT gateways come in two availability modes:

| Mode | How it's placed | Routing |
|---|---|---|
| **Zonal** | Created in one public subnet in one AZ, with an Elastic IP | Each AZ's private route table points at the NAT gateway in the same AZ. One gateway per AZ is needed for resilience, because a zonal NAT gateway fails with its AZ |
| **Regional** (since November 2025) | Created for the VPC with no subnet. It expands into an AZ when resources appear there, which can take up to 60 minutes, and contracts when they leave | Every private route table points at one NAT gateway ID |

Regional mode removes the public subnets and per-AZ routes that zonal NAT gateways need, but not the internet gateway. AWS gives the regional NAT gateway its own route table with a route to the VPC's internet gateway. AWS recommends regional mode for every case except **private NAT**, and it isn't available in a few constrained AZs. A private NAT gateway translates addresses for traffic to other VPCs or on-premises networks rather than to the internet, and it is available only in zonal mode.

A few characteristics shape capacity and cost:

- **Throughput.** A zonal NAT gateway starts at 5 Gbps and scales automatically to 100 Gbps, and from 1 million to 10 million packets per second.
- **Connections.** Each IP address on a NAT gateway supports 55,000 simultaneous connections to a single destination IP, port, and protocol. Heavy traffic to one API endpoint can exhaust that, which is fixed by adding addresses, up to 8 on a zonal NAT gateway and 32 per AZ on a regional one.
- **No security group.** Filtering happens on the instances behind it and on the subnet's network ACL.
- **Price.** There is an hourly charge (per AZ for regional mode) and a per-GB charge on every byte processed. The per-GB charge is the one that surprises teams, since it applies to traffic bound for AWS services such as S3 as well.

A gateway VPC endpoint gives private subnets a route to S3 and DynamoDB that bypasses the NAT gateway and has no charge, so it is usually the first fix for a large NAT bill.

Before NAT gateways existed, the same job was done by a **NAT instance**, an EC2 instance configured to forward traffic. It is cheaper for small workloads, but it's a single instance to patch, scale, and make highly available yourself. AWS's managed NAT gateway replaces it for most designs.

### Virtual Private Gateway

A **virtual private gateway** is the AWS end of a Site-to-Site VPN or a Direct Connect connection to a single VPC. Attaching one and adding routes for the on-premises ranges makes a subnet VPN-only or gives a private subnet a second path. Designs that connect many VPCs to a data center usually use a transit gateway instead.

---

## Security Groups and Network ACLs

A VPC filters traffic at two points. A **network ACL** sits at the edge of a subnet and checks packets that cross into or out of it. A **security group** sits on each network interface and checks traffic to and from that one resource. A request from the internet to an instance crosses both, and its response crosses both again on the way out:

{% include figure.html id="aws-vpc-sg-nacl" %}

The two differ in one property that explains most of their behavior. A security group is **stateful**. It tracks each connection it allowed, so the response goes back out without matching any rule. A network ACL is **stateless**. It judges every packet on its own, so it needs an inbound rule for the request and a separate outbound rule for the response.

### Security Groups

A security group holds **allow rules only**. Anything no rule allows is dropped, and all of a group's rules are evaluated together, so their order doesn't matter. A newly created security group allows no inbound traffic and all outbound traffic. A resource can have several security groups, and the rules of all of them combine.

A rule's source can be a CIDR range or **another security group**. That is the most useful feature they have, because it expresses intent without tracking IP addresses:

| Security group | Inbound rule | Source |
|---|---|---|
| Load balancer | TCP 443 | `0.0.0.0/0` |
| Application | TCP 8080 | the load balancer's security group |
| Database | TCP 5432 | the application's security group |

When the application tier scales out, new instances join the application security group and can reach the database immediately, with no rule change.

Quotas are generous but not unlimited. The default is 60 inbound and 60 outbound rules per security group, and 5 security groups per network interface, adjustable to 16. The product of the two can't exceed 1,000.

### Network ACLs

A network ACL holds numbered rules that can **allow or deny**. They are evaluated from the lowest number up, and the first match decides. The default quota is 20 rules in each direction, adjustable to 40, which suits a few broad rules rather than per-application detail. Each subnet is associated with exactly one network ACL, and one network ACL can serve many subnets. The VPC's default network ACL allows all traffic in both directions, while a newly created custom network ACL denies everything until rules are added.

Statelessness is what makes network ACLs error-prone. A response is addressed to the client's **ephemeral port**, a temporary port the client's operating system picked for the connection, so an outbound rule must allow that range. Clients use different ranges, so AWS suggests allowing 1024-65535 for responses. A network ACL that allows inbound HTTPS but not outbound ephemeral ports lets requests in and silently drops every response.

Network ACLs also can't filter everything. Traffic to the Amazon-provided DNS, the instance metadata service, and Amazon Time Sync never passes through them.

### Choosing Between Them

| | Security group | Network ACL |
|---|---|---|
| **Attaches to** | Network interface | Subnet |
| **State** | Stateful: responses allowed automatically | Stateless: each direction needs its own rule |
| **Rules** | Allow only | Allow and deny |
| **Evaluation** | All rules together | Lowest number first, first match wins |
| **Default** | New group: no inbound, all outbound | Default ACL: all traffic. New custom ACL: nothing |

Security groups are the primary control in almost every design, because they are stateful, scoped to one resource, and can reference each other. Network ACLs earn their place for a coarse subnet-wide guardrail, such as denying a known-bad address range or keeping a data tier from talking to anything but the app tier, where a single deny rule does what security groups can't express.

---

## Blocking Public Access Account-Wide

Security groups and route tables are set per resource, so one mistake can expose one resource. **VPC Block Public Access** is an account-level setting per Region that overrides them. In **bidirectional** mode, it blocks all traffic through internet gateways and egress-only internet gateways (the IPv6 outbound gateway covered below) in the Region. In **ingress-only** mode, it blocks inbound internet traffic but still allows outbound connections through NAT gateways and egress-only internet gateways.

Exclusions exempt specific VPCs or subnets that legitimately face the internet, such as the public subnets holding a load balancer. That inverts the default, so internet access becomes an exception someone had to create. In a multi-account organization, an EC2 declarative policy, an AWS Organizations policy that holds service settings in place, can enforce it across every account.

---

## Public IPv4 Costs and IPv6

### Every Public IPv4 Address Is Billed

Since February 1, 2024, AWS has charged $0.005 per hour, about $3.60 a month, for every public IPv4 address, whether it is attached to a resource or sitting idle. Addresses you bring to AWS from your own registered ranges (BYOIP) aren't charged. Public addresses hide in more places than instances. Every public NAT gateway, zonal or regional, holds at least one in each AZ it serves, an internet-facing load balancer holds addresses in each AZ it serves, and a subnet with auto-assign enabled gives one to every instance launched there.

Three habits keep the count down. Keep workloads in private subnets behind a load balancer, turn off auto-assign on subnets that don't need it, and release Elastic IPs that no longer point at anything.

### IPv6 in a VPC

A VPC can also have IPv6 blocks, usually an Amazon-provided block from which each subnet takes a `/64`. IPv6 addresses carry no hourly charge. A subnet can be **IPv4-only**, **dual-stack** (both), or **IPv6-only**.

IPv6 addresses are globally unique and publicly routable, which changes how private subnets are built. A subnet whose route table sends `::/0` to the internet gateway is reachable from the internet over IPv6, with no address translation involved. For a private subnet, the route table sends `::/0` to an **egress-only internet gateway** instead, which lets instances open IPv6 connections outward while blocking inbound ones. It has no charge of its own, though data transfer is still billed.

| Subnet | IPv4 default route | IPv6 default route |
|---|---|---|
| Public, dual-stack | `0.0.0.0/0` to the internet gateway | `::/0` to the internet gateway |
| Private, dual-stack | `0.0.0.0/0` to a NAT gateway | `::/0` to an egress-only internet gateway |

An IPv6-only subnet can still reach IPv4-only destinations through **DNS64 and NAT64**. With DNS64 enabled on the subnet, the Route 53 Resolver returns a synthesized address in `64:ff9b::/96` for an IPv4-only name. A route sending `64:ff9b::/96` to a NAT gateway then lets the NAT gateway translate the traffic to IPv4. DNS64 is off by default and is enabled per subnet. NAT64 has no setting, since every NAT gateway performs it once that route exists. That means an IPv6-only design removes NAT gateway costs only for traffic whose destinations speak IPv6. Support also varies by AWS service, so check each service a workload depends on before moving it to IPv6-only.

For most teams, dual-stack is the practical step. Serve clients over IPv6 from a dual-stack load balancer, give private subnets an egress-only internet gateway for IPv6 traffic, and keep IPv4 for the destinations that need it.

---

## Common Pitfalls

### A Gateway Without a Route

Creating an internet gateway or NAT gateway does nothing until a route table points at it, and a dual-stack subnet needs a separate `::/0` route for IPv6. When resources can't reach the internet, check the route table associated with their subnet before anything else. VPC Reachability Analyzer traces the path between two resources and names the route table, security group, or network ACL that blocks it. VPC Flow Logs record the traffic each network interface accepted and rejected, which shows whether packets arrived at all.

### Network ACLs Without Ephemeral Ports

A missing ephemeral-port rule looks like a security group problem, because requests arrive and responses vanish. Check the network ACL's outbound rules before rewriting security groups, or leave the default network ACL in place and rely on security groups.

### Overlapping or Undersized Ranges

Overlapping and undersized ranges are both expensive to fix after the fact. An overlap is usually found only when two networks need to connect, and an undersized VPC fills up as services that take one address per task grow. Allocate ranges centrally, and size the VPC for the subnets it will need across every AZ.

### One Zonal NAT Gateway for Several AZs

Pointing every private subnet at a single zonal NAT gateway saves the hourly charge, but it ties every zone's internet access to one AZ. It also adds cross-AZ data transfer charges for traffic from the other zones. Use one zonal NAT gateway per AZ, or a regional NAT gateway.

---

## Key Takeaways

1. **A VPC is Regional and a subnet is zonal.** High availability comes from repeating subnets across at least two AZs.
2. **Routing, not a setting, makes a subnet public, private, VPN-only, or isolated.** A subnet is public only because its route table points at an internet gateway.
3. **Plan address space across every network you might connect.** The primary CIDR block can't change, and overlapping ranges can't route to each other.
4. **Give each AZ its own path out, or use a regional NAT gateway.** Route S3 and DynamoDB traffic through gateway endpoints to keep it off the NAT gateway's per-GB charge.
5. **Security groups are stateful and per resource, network ACLs are stateless and per subnet.** Use security groups that reference each other as the main control, and network ACLs for coarse denies.
6. **Block Public Access makes internet exposure an exception.** Turn it on per Region and exclude only the subnets that must face the internet.
7. **Every public IPv4 address costs money.** Keep workloads private, and move client-facing traffic to dual-stack where the services support it.
