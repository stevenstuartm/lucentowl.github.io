---
title: "AWS PrivateLink, Transit Gateway & VPC Lattice for System Architects"
layout: guide
category: AWS
subcategory: Networking & Content Delivery
description: "How to connect VPCs and services across accounts: VPC endpoints for AWS services, PrivateLink endpoint services and resource endpoints, VPC peering, Transit Gateway routing and segmentation, VPC Lattice service networks, and how to choose between them."
tags: [privatelink, vpc-endpoints, transit-gateway, vpc-peering, vpc-lattice, multi-vpc, practical]
---

## Four Ways to Connect

Once an organization has more than one VPC, usually one per account and environment, workloads need to reach each other and reach AWS services without crossing the internet. AWS offers four mechanisms, and they answer different questions:

| Mechanism | Connects | Direction | Overlapping CIDRs |
|---|---|---|---|
| **VPC peering** | Two whole VPCs, as one network | Both ways | Not allowed |
| **Transit Gateway** | Many VPCs, VPNs, and Direct Connect through a Regional hub | Whatever the route tables allow | Not allowed between networks that route to each other |
| **PrivateLink** | A consumer to one specific service or resource | Consumer to provider only | Allowed |
| **VPC Lattice** | Services to services across VPCs and accounts, by name | Caller to service, governed by policy | Allowed |

A CIDR block is the address range a VPC uses, typically a private range such as `10.0.0.0/16`. The first two mechanisms are network-level: once connected, any address in one network can reach any address in the other, subject to security groups and routes. The last two are service-level: a caller reaches a named service and nothing else. That difference decides more designs than cost does.

A fifth option, **AWS Cloud WAN**, builds a global network of Transit Gateway-like hubs across Regions from a central policy. It suits organizations with many Regions and on-premises sites, and it is beyond the scope of this guide.

---

## VPC Endpoints for AWS Services

A workload in a private subnet reaches AWS service APIs, such as S3, SQS, or Secrets Manager, through a NAT gateway by default, over the service's public endpoint. A **VPC endpoint** gives it a private path instead. There are two kinds:

| | Gateway endpoint | Interface endpoint |
|---|---|---|
| **Services** | S3 and DynamoDB only | Most AWS services, plus services offered by other accounts |
| **How it works** | A route in chosen route tables sends the service's address ranges to the endpoint | Network interfaces with private addresses in your subnets, one per AZ you choose |
| **Price** | No charge | About $0.01 per hour per AZ, plus $0.01 per GB processed |
| **Reachable from** | Only the VPC it belongs to, in the same Region | The VPC, and networks connected to it by peering, Transit Gateway, VPN, or Direct Connect |
| **Controls** | Endpoint policy | Endpoint policy and security groups |

Gateway endpoints are free and remove NAT gateway processing charges, so a VPC that uses S3 or DynamoDB should have them. Their limitation is reach. Traffic from on-premises or from another VPC can't use a gateway endpoint, and both S3 and DynamoDB also offer interface endpoints for those cases. DynamoDB's interface endpoints have no private DNS option, so clients must use the endpoint-specific hostname.

With **private DNS** turned on, an interface endpoint makes the service's normal hostname, such as `secretsmanager.us-east-1.amazonaws.com`, resolve to the endpoint's private addresses inside the VPC, so applications need no changes. An **endpoint policy** is an IAM resource policy on the endpoint that limits which actions and resources can be reached through it, for example only the organization's own buckets.

---

## PrivateLink for Your Own Services

### Endpoint Services

**AWS PrivateLink** is the technology under interface endpoints, and it can also carry your own services. A **provider** puts a Network Load Balancer in front of the service and creates an **endpoint service** from it. (A Gateway Load Balancer can front an endpoint service too, which is how firewall appliances are offered to other VPCs.) A **consumer** in another VPC or account creates an interface endpoint to that service and reaches it at an address from its own subnet:

{% include figure.html id="aws-privatelink-service" %}

Three properties follow from that shape and make PrivateLink the usual way to offer a service across trust boundaries:

- **It is one-way.** The consumer opens connections to the service. The provider can't open connections back into the consumer's VPC.
- **It exposes one service, not a network.** The consumer reaches the load balancer's listeners and nothing else in the provider's VPC.
- **Address ranges don't matter.** Each side only addresses things in its own VPC, so the two VPCs can use identical CIDR blocks. That is often the only workable option between organizations that never coordinated their address plans.

The provider controls who may connect. An **allowed principals** list names the accounts, users, or roles that may create endpoints, and **acceptance** can be required so each connection request is approved. Since November 2024, an endpoint service can also accept consumers in other Regions, with inter-Region data transfer charges on top of PrivateLink's.

Traffic arrives at the provider from the load balancer's addresses, not the consumer's. A service that needs to know which consumer is calling can turn on Proxy Protocol v2 on the NLB, which adds a header carrying the consumer's endpoint ID to each connection.

PrivateLink has costs that make it a poor fit for some jobs. Every consumer pays per AZ per hour for its endpoint, the provider pays for the load balancer, and the consumer reaches only that load balancer's listeners. For a few VPCs owned by one team that need broad access to each other, peering or a transit gateway is simpler.

### Resource Endpoints

An endpoint service needs a load balancer in front of it. Since December 2024, a **resource endpoint** can reach a single resource, such as an RDS database or a server by IP address or DNS name, without one. The provider shares a **resource configuration** describing the resource through AWS Resource Access Manager, and a **resource gateway** in the provider's VPC carries the traffic. It suits sharing one database with another account, where standing up an NLB only to front it was the old workaround.

---

## VPC Peering

A **peering connection** joins two VPCs so that each routes to the other's CIDR block as if they were one network, across accounts and across Regions. There is no gateway in the path and no bandwidth bottleneck of its own. Data that stays within an Availability Zone costs nothing, and data crossing AZs or Regions is billed at the usual transfer rates.

Its constraints shape where it fits:

- **The CIDR blocks can't overlap.**
- **It isn't transitive.** If A peers with B and B with C, A still can't reach C through B. Full connectivity among *n* VPCs needs *n*(*n*−1)/2 connections, so ten VPCs need 45.
- **Each VPC can have 50 active peering connections** by default, raisable to 125.
- **Both sides must add routes** for the other's CIDR, in every route table that needs them.
- **Gateways aren't shared.** A VPC can't use its peer's internet gateway, NAT gateway, VPN, or gateway endpoints.

Within a Region, security groups can reference groups in the peer VPC, which keeps rules readable. Peering suits a few VPCs that need full, high-volume, low-latency connectivity, such as an application VPC and a shared data VPC. As the count grows, the mesh of connections and routes becomes the problem Transit Gateway exists to solve.

---

## Transit Gateway

### A Regional Hub

A **transit gateway** is a Regional router that VPCs and on-premises networks attach to. Each **attachment** connects one network or function. The common kinds are a VPC (through a network interface in each AZ you choose), a Site-to-Site VPN, a Direct Connect gateway, and a peering connection to another transit gateway. Others connect SD-WAN appliances, which run their own routing over the gateway, and AWS Network Firewall. A gateway supports 5,000 attachments by default, and a VPC attachment carries up to 100 Gbps in each direction per AZ. Unlike peering, it is transitive: every attachment can reach every other one that its routes allow.

A transit gateway is created in one account and shared with the rest of the organization through AWS Resource Access Manager, so a central network team owns it and workload accounts attach their VPCs.

### Route Tables Make Segments

A transit gateway has its own **route tables**, separate from the VPCs'. Two settings connect them to attachments:

- **Association.** Each attachment is associated with exactly one route table, which decides where traffic *arriving from* that attachment can go.
- **Propagation.** An attachment can propagate its routes, such as its VPC CIDR or the routes a VPN learns from the on-premises router over BGP (the routing protocol networks use to advertise address ranges), into any number of route tables, which decides who can reach *it*.

By default, every attachment associates with and propagates to one default route table, so everything can reach everything, including dev to prod. Turning off default association and propagation when the gateway is created, and designing the route tables before the first attachment, avoids that. Separate route tables turn one gateway into isolated **segments**. In the layout below, prod reaches shared services and on-premises, dev reaches only shared services, and prod and dev never reach each other:

{% include figure.html id="aws-tgw-segmentation" %}

Static routes fill in what propagation doesn't, such as a default route sending internet-bound traffic to a central egress VPC. A **blackhole** route drops traffic for a prefix outright. The VPCs' own route tables still need routes pointing at the transit gateway for the prefixes they should reach through it.

### Inspection, Peering, and Security Groups

Sending traffic between segments through a firewall is a common requirement. Since July 2025, AWS Network Firewall can attach to a transit gateway directly, as its own attachment, so route tables send traffic to it with no dedicated inspection VPC to build. Third-party firewalls still sit in an inspection VPC behind a Gateway Load Balancer. Either way, a stateful firewall tracks each connection, so it must see both directions of a flow (the packets of one connection) on the same appliance. The VPC attachment's **appliance mode** guarantees that by keeping a flow in one AZ.

Transit gateways connect to each other, in the same Region or across Regions, through **peering attachments**, which use static routes only and carry traffic over the AWS backbone. Since 2024, security groups in VPCs attached to the same transit gateway can reference each other in inbound rules, once referencing is turned on for both the gateway and the attachment. Referencing doesn't work when the traffic passes through a firewall on the way.

### What It Costs

In US East, a transit gateway charges $0.05 per attachment per hour (about $36 a month) and $0.02 per GB sent into it. The data charge usually dominates, and it applies each time traffic enters the gateway, so traffic sent from a spoke to an inspection VPC and back out to another spoke is charged twice. Estimate traffic per path before choosing. For two or three VPCs exchanging heavy traffic, peering is far cheaper. For dozens of VPCs, hybrid connectivity, or centralized inspection, the transit gateway's manageability is what you are paying for.

### Centralizing Interface Endpoints

Interface endpoints are billed per AZ, so twenty services in three AZs across fifty VPCs adds up. A common design places the endpoints once, in a shared services VPC that every spoke reaches through the transit gateway. DNS and data then take different paths. Private DNS on an endpoint only works inside its own VPC, so the central endpoints are created with private DNS turned off, and the shared account creates a Route 53 private hosted zone (a DNS zone visible only to associated VPCs) for each service name, pointing at the central endpoint. Those zones are associated with every spoke VPC, which then resolves the service's normal name to the central endpoint and sends the traffic through the transit gateway.

Without the private hosted zones, spokes keep calling the public endpoints through their NAT gateways and pay twice without any error to show for it. The design's costs are transit gateway processing charges on all AWS API traffic and one shared dependency for every VPC. It also gives up per-VPC endpoint policies. A single policy on each central endpoint governs every spoke's access, which gets harder to keep least-privilege as spokes are added, and IAM caps its size at 20,480 characters.

---

## VPC Lattice

**Amazon VPC Lattice** connects services rather than networks. It works at the application layer for HTTP, HTTPS, and gRPC, and at the connection layer for TCP through TLS listeners and resource configurations. Its pieces are:

- A **service network**, a logical group of services and the VPCs or accounts allowed to use them.
- **Services**, each with a DNS name, listeners, and routing rules that send requests to **target groups** of instances, IP addresses, Lambda functions, Kubernetes pods, or ECS tasks.
- **Auth policies**, IAM policies on the service network or a service that decide which principals may call what. Callers sign requests with their AWS credentials, so authorization happens per request without application code.
- **Associations** that connect VPCs and services to the service network. Service networks, services, and resource configurations are shared with other accounts through Resource Access Manager, and the receiving account creates its own associations.

Because callers address services by name and Lattice handles the path, VPCs with overlapping CIDRs can still call each other's services, and no route tables or peering connections are involved. Routing rules can split traffic by weight for canary releases, and Lattice publishes per-service metrics and access logs.

A few constraints shape Lattice designs. Service networks are Regional. A VPC can associate with only one service network, and reaching others takes a service network endpoint, which is also how clients arriving over peering or a transit gateway get in. A connection to a Lattice service lasts at most ten minutes, which matters for long gRPC streams and WebSockets, and each service gets 10 Gbps per AZ by default. IAM request signing works only for HTTP, HTTPS, and gRPC. TLS listeners pass encrypted TCP through untouched, so their auth policies can only allow anonymous callers, and plain TCP resources such as databases are reached through resource configurations rather than services.

Lattice charges per service per hour ($0.025 in US East), per GB processed ($0.025), and per request beyond the first 300,000 each hour. It fits HTTP and gRPC calls between services across many VPCs and accounts, especially where teams want IAM-based authorization between services. It doesn't fit bulk data movement, long-lived connections, protocols outside HTTP and TCP, or traffic that needs a network path rather than a service endpoint, all of which stay with Transit Gateway or peering.

---

## Choosing

```
Do the two sides need to reach each other's whole network?
├── Yes → How many VPCs, and is on-premises involved?
│         ├── A few VPCs, no hybrid, heavy traffic → VPC peering
│         └── Many VPCs, hybrid, or central inspection → Transit Gateway
└── No, one side calls specific services or resources. Who are the callers?
          ├── Your own services, over HTTP or gRPC, across many VPCs → VPC Lattice
          └── Other accounts or customers, or a single resource to share → PrivateLink
```

Most organizations end up with more than one. A transit gateway provides the network backbone between accounts and on-premises, gateway and interface endpoints handle AWS service traffic, PrivateLink offers specific services to partners or across trust boundaries, and Lattice may connect microservices owned by different teams.

---

## Common Pitfalls

### Address Space That Rules Out Routing

Overlapping CIDRs block both peering and Transit Gateway routing between the overlapping networks. PrivateLink and Lattice work around it, but only for service calls, so an organization that later needs network-level connectivity has to renumber. Allocate non-overlapping ranges across the organization before connectivity needs force the issue.

### Lattice for Long-Lived Connections

A gRPC stream or WebSocket through Lattice is cut after ten minutes whatever the application does. Clients must reconnect cleanly, or those connections belong on a network path instead.

---

## Key Takeaways

1. **Peering and Transit Gateway connect networks, and PrivateLink and Lattice connect services.** Decide which kind of connection is needed before comparing costs.
2. **Give every VPC gateway endpoints for S3 and DynamoDB.** They are free and take that traffic off the NAT gateway.
3. **PrivateLink is one-way, exposes one service, and tolerates overlapping CIDRs,** which makes it the default for offering services to other accounts and customers.
4. **Transit Gateway segments come from route table association and propagation.** Turn off the defaults and design segments before attaching anything.
5. **Transit Gateway's per-GB charge applies on every pass.** Peering stays cheaper for a few VPCs with heavy traffic between them.
6. **VPC Lattice gives service-to-service calls names, routing, and IAM authorization across accounts,** without any routes between the networks.
