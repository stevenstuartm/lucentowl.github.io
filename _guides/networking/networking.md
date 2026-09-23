---
title: "Network Fundamentals for Developers"
layout: guide
category: Networking
subcategory: Network Fundamentals
description: "How data gets from one process to another across a network: layers and encapsulation, IP addressing and CIDR, routing, NAT, ports and sockets, TCP versus UDP, latency and bandwidth, and troubleshooting a connection layer by layer."
tags: [fundamentals, tcp, udp, cidr, nat, routing, latency]
---

When a service calls `https://api.example.com/orders`, several independent systems cooperate before a single byte of the request arrives. DNS turns the name into an IP address. The host's routing table decides which network interface and next hop the packets leave through. TCP opens a connection to a port on the destination, TLS secures it, and only then does HTTP send the request. Each of these can fail, add latency, or run out of capacity on its own, and most production networking problems are easier to diagnose once you know which one you are looking at.

This guide covers the layers underneath the application protocol: how addresses, routes, ports, and transport protocols work, and what they cost.

## Layers and Encapsulation

### Each Layer Wraps the One Above

Network protocols are stacked so that each layer solves one problem and relies on the layer below for everything else. HTTP knows about requests and responses but nothing about how bytes get delivered. TCP delivers an ordered byte stream between two ports but knows nothing about which physical route the packets take. IP moves individual packets between hosts across networks. The link layer, such as Ethernet or Wi-Fi, moves frames between two devices on the same physical network.

On the way out, each layer adds its own header in front of the data it receives from above, and the receiving host strips the headers off in reverse order.

{% include figure.html id="net-encapsulation" %}

Each header carries a different kind of address. The Ethernet header carries MAC addresses, the hardware addresses burned into each network interface, which only mean something on the local network segment. The IP header carries the source and destination host addresses, and the TCP header carries ports, which identify the process on each host.

### The TCP/IP Model Is the One in Use

Two layer models appear in documentation. The seven-layer OSI model, published by ISO as a reference framework in 1984, is where the vocabulary comes from. A "layer 4 load balancer" means one that routes on TCP or UDP information, and "layer 7" means one that reads HTTP. The internet itself runs on the TCP/IP suite, which has four layers and does not separate OSI's session and presentation layers into protocols of their own.

| TCP/IP layer | OSI layers | Unit of data | Addressing | Examples |
| --- | --- | --- | --- | --- |
| Application | 7, 6, 5 | Message | Names, URLs | HTTP, DNS, SSH, SMTP, TLS (in practice) |
| Transport | 4 | Segment (TCP), datagram (UDP) | Ports | TCP, UDP, QUIC |
| Internet | 3 | Packet | IP addresses | IPv4, IPv6, ICMP (error reports) |
| Link | 2, 1 | Frame | MAC addresses | Ethernet, Wi-Fi, ARP |

TLS doesn't fit either model cleanly. It runs on top of TCP and below HTTP, which is why it gets called layer 6 in OSI terms and "part of the application layer" in TCP/IP terms. QUIC is similar. It runs over UDP and provides transport services, including its own TLS handshake.

## IP Addresses and CIDR

### An IPv4 Address Is a 32-Bit Number

An IPv4 address such as `192.168.1.77` is a 32-bit number written as four decimal bytes. Every address splits into two parts. The **network prefix** identifies which network the host is on, and the remaining **host bits** identify the host within that network. Routers only look at the prefix, which is what lets the internet route to billions of hosts with tables that hold around a million prefixes rather than an entry per host.

### CIDR Notation Says Where the Split Falls

CIDR (Classless Inter-Domain Routing) writes the split as a suffix: `/n` means the first `n` bits are the prefix. The older class system (A, B, C) fixed the split at 8, 16, or 24 bits and has been obsolete since CIDR replaced it in 1993, though "class C" still turns up as slang for a /24.

```
Address     192.168.1.77/26
Binary      11000000.10101000.00000001.01|001101
            <------ 26 prefix bits ----->|<6 host bits>

Network     192.168.1.64     (host bits all 0)
Broadcast   192.168.1.127    (host bits all 1)
Hosts       192.168.1.65 to 192.168.1.126   (2^6 - 2 = 62)
```

Every bit moved from the prefix to the host part doubles the block. A /24 holds 256 addresses, a /16 holds 65,536, and a /8 holds about 16.7 million. In a traditional subnet two addresses are reserved. The all-zeros host address names the network itself, and the all-ones address is the broadcast address, which delivers a packet to every host on the subnet. So a /26 has 64 addresses and 62 usable hosts. Cloud providers reserve more. AWS and Azure each hold back five addresses in every subnet.

### Subnets Carve a Block into Smaller Blocks

A subnet is a smaller block cut from a larger one by extending the prefix. A cloud network given `10.20.0.0/16` might split it into /24 subnets such as `10.20.1.0/24` for public load balancers, `10.20.10.0/24` for application instances, and `10.20.20.0/24` for databases. The blocks don't have to be the same size. Variable-length subnetting fits a /26 where 62 hosts will do and a /20 where a container platform needs thousands of addresses.

Two planning decisions are hard to reverse:

- **Size for growth.** Container platforms that give each pod or task its own address in the cloud network, as Amazon EKS and Amazon ECS can, consume addresses far faster than one-per-VM planning expects. A subnet that fills up stops new workloads from launching.
- **Don't overlap with networks you might ever connect to.** Peering and VPN connections route by prefix, so two networks that both use `10.0.0.0/16` can't be joined without address translation. Default ranges collide the most, which is why picking an unusual block from the private space pays off later.

### Private Addresses Need Translation to Reach the Internet

[RFC 1918](https://www.rfc-editor.org/rfc/rfc1918){:target="_blank" rel="noopener noreferrer"} reserves three blocks for private networks: `10.0.0.0/8`, `172.16.0.0/12`, and `192.168.0.0/16`. Any organization can use them internally, and routers on the public internet drop them. A host with only a private address can reach the internet only through NAT, covered below. IPv4's 32 bits allow about 4.3 billion addresses, fewer than the devices that want one, so private addressing plus NAT is how almost every IPv4 network operates.

### IPv6 Removes the Scarcity

IPv6 addresses are 128 bits, written as eight groups of four hex digits with runs of zero groups collapsed to `::`, as in `2001:db8:85a3::8a2e:370:7334`. The address space is large enough that a single subnet is conventionally a /64, and every host can have a globally routable address without NAT. Firewalls still control what is reachable, so "no NAT" does not mean "exposed."

| Range | Role | IPv4 counterpart |
| --- | --- | --- |
| `2000::/3` | Global unicast, internet routable | Public addresses |
| `fc00::/7` | Unique local addresses | RFC 1918 private ranges |
| `fe80::/10` | Link-local, on every interface, never routed | `169.254.0.0/16` |

Most networks today are **dual-stack**, running IPv4 and IPv6 side by side. A client whose DNS lookup returns both an IPv4 and an IPv6 address for a name tries both, preferring IPv6 but falling back quickly if it stalls. That algorithm is called Happy Eyeballs ([RFC 8305](https://www.rfc-editor.org/rfc/rfc8305){:target="_blank" rel="noopener noreferrer"}), and it is why a broken IPv6 path usually shows up as a small delay rather than an outage.

## Routing

### Every Host Has a Routing Table

Before sending a packet, a host looks up the destination address in its routing table and picks the matching entry with the **longest prefix**, meaning the most specific route. A typical server has only two entries:

| Destination | Next hop | Meaning |
| --- | --- | --- |
| `10.20.10.0/24` | Directly connected | Same subnet, deliver on the local link |
| `0.0.0.0/0` | Gateway `10.20.10.1` | Everything else |

A packet to `10.20.10.31` matches both entries, and the /24 wins because it is more specific. A packet to `198.51.100.10` matches only `0.0.0.0/0`, the **default route**, and goes to the gateway. Every router along the way repeats the same lookup against its own table, which can hold many more entries, and no router knows the full path. Each one only knows the next hop.

### The IP Address Stays, the Link Address Changes

When the destination is on the same subnet, the host needs the destination's MAC address to build the Ethernet frame. IPv4 finds it with ARP, a broadcast asking "who has 10.20.10.31?", and IPv6 uses Neighbor Discovery for the same job. When the destination is off-subnet, the host frames the packet to the gateway's MAC address instead, while the IP header still names the final destination. Each router strips the incoming frame, looks up the next hop, and builds a new frame for the next link, so the MAC addresses change at every hop while the IP addresses stay the same.

{% include figure.html id="net-routing-hops" %}

## NAT

### Many Private Hosts Share One Public Address

Network Address Translation rewrites addresses in packet headers as they cross a boundary. The common form, which also rewrites ports (called PAT, NAPT, or masquerading), lets many private hosts share one public address. When a private host opens a connection outward, the NAT device replaces the private source address and port with its own public address and a port it picks, and records the mapping in a translation table. When a reply arrives at that public port, it looks up the mapping and rewrites the destination back to the private host.

{% include figure.html id="net-nat-translation" %}

### Inbound Connections Have No Mapping

The table only gains entries when an inside host starts a connection, so an unsolicited packet arriving from outside matches nothing and is dropped. NAT therefore blocks inbound connections as a side effect, which is why a private cloud subnet can reach package repositories through a NAT gateway but can't be reached from the internet. Making a private service reachable takes an explicit rule, such as a static port forward, a load balancer with a public address, or a tunnel. NAT isn't designed as a security control, though a **stateful** firewall, one that tracks each connection it has seen, applies the same allow-only-replies rule on purpose.

### Translation State Runs Out and Times Out

The translation table is state held on a device in the middle of the path, and it has limits the endpoints never see:

- **Idle timeouts.** NAT devices and load balancers drop mappings for connections that go quiet. An AWS NAT gateway times out a connection after 350 seconds of inactivity and answers later packets with a TCP reset (RST), a packet that aborts the connection. Azure Load Balancer defaults to a four-minute idle timeout. A pooled database connection that sits idle longer than that fails on its next use. Two fixes work: TCP keepalives, small probe packets the operating system sends on an idle connection, at an interval shorter than the timeout, or a pool that retires idle connections before the timeout does.
- **Port exhaustion.** Each public address has about 64,000 source ports, and each mapping to the same destination address and port needs a distinct one. An AWS NAT gateway supports up to 55,000 simultaneous connections to each unique destination per public address. A fleet that opens a new connection per request to one external API can hit that ceiling and see intermittent connection failures that look like the remote service's fault.

## Ports and Sockets

### A Connection Is Five Values

A port is a 16-bit number that identifies a process's endpoint on a host. Servers listen on a fixed, known port (443 for HTTPS, 5432 for PostgreSQL). Clients get an **ephemeral port** assigned by the operating system for each outgoing connection, from a range that Linux sets to 32768 through 60999 by default and Windows to 49152 through 65535.

A TCP connection is identified by five values together: protocol, source address, source port, destination address, and destination port. That is why a server can hold thousands of connections on port 443 at once. They all share the destination half and differ in the source half.

### Closed Connections Linger in TIME_WAIT

When a TCP connection closes, the side that closed it first keeps the five-tuple reserved in the TIME_WAIT state, so that stray delayed packets from the old connection can't be mistaken for a new one. Linux holds it for 60 seconds. A client that opens and closes a fresh connection for every request to the same destination consumes ephemeral ports faster than TIME_WAIT releases them. Under load it exhausts the range and new connections fail with "address already in use" or "cannot assign requested address." Connection pooling, where many requests reuse a few long-lived connections, avoids this and also avoids paying the setup cost described next.

## TCP and UDP

### TCP Delivers a Reliable, Ordered Byte Stream

TCP turns IP's best-effort packet delivery into a reliable stream. It numbers every byte, the receiver acknowledges what arrived, and the sender retransmits anything not acknowledged in time. The receiver reassembles segments in order before handing data to the application, so the application never sees gaps or reordering.

Two feedback loops govern how fast a TCP sender transmits:

- **Flow control** protects the receiver. The receiver advertises a window, meaning how much unacknowledged data it can buffer, and the sender never exceeds it.
- **Congestion control** protects the network. The sender starts slowly, grows its sending rate while acknowledgments keep arriving, and cuts it back when loss or rising delay signals a congested path. A new connection starts cautiously, so a short-lived connection rarely reaches the full speed the link can carry.

{% include figure.html id="net-congestion-window" %}

The ordering guarantee has a cost. When a segment is lost, everything behind it waits until the retransmission arrives, even data that has already been received. That is TCP head-of-line blocking.

### Segments Are Sized to the Path's MTU

Every link has a maximum transmission unit (MTU), the largest packet it carries, and standard Ethernet's is 1,500 bytes. TCP sizes its segments to fit, but a path can include links with a smaller MTU than either endpoint's, such as a VPN tunnel that adds its own headers. Hosts discover the path's limit through ICMP, the internet layer's error-reporting protocol. A router that can't forward an oversized packet drops it and sends back a "fragmentation needed" or "packet too big" message, and the sender shrinks its packets. When a firewall blocks those ICMP messages, the sender never learns, and the result is a connection where small packets get through and large ones vanish.

### Connection Setup Costs Round Trips

TCP opens with a three-way handshake. The client sends SYN, the server replies SYN-ACK, and the client sends ACK along with its first data. That costs one round trip before any request can go out. TLS 1.3 adds one more round trip to agree on keys and verify the server's certificate, and TLS 1.2 adds two. The request itself then takes a third round trip before the first byte of the response comes back.

{% include figure.html id="net-connection-setup" %}

On a new HTTPS connection with TLS 1.3, the first response byte arrives no sooner than three round trips after the client starts. Across an 80 ms round trip, that is 240 ms before the server's processing time is even counted, while a request on an already-open connection costs one round trip, 80 ms. This arithmetic is why connection reuse matters more than almost any other client-side networking setting, and why resumed TLS sessions and QUIC's combined handshake exist.

### UDP Leaves Reliability to the Application

UDP sends independent datagrams with no connection, no acknowledgments, no ordering, and no congestion control. A datagram may arrive once, not at all, out of order, or occasionally twice. What UDP gives up in guarantees it gains in control. There is no handshake before the first packet, and a lost packet delays nothing else.

That suits traffic where a late packet is worthless or the application wants its own recovery scheme. DNS queries fit in one datagram and are simply retried on timeout. Voice, video, and game state are better dropped than delivered late. QUIC builds its own reliability, ordering per stream, and congestion control on top of UDP, which lets it avoid TCP's cross-stream head-of-line blocking.

| | TCP | UDP |
| --- | --- | --- |
| Connection | Handshake before data | None |
| Delivery | Reliable, retransmits losses | Best effort |
| Ordering | Guaranteed within the connection | None |
| Congestion control | Built in | Left to the application |
| Unit | Byte stream, no message boundaries | Datagrams, boundaries preserved |
| Typical uses | HTTP/1.1 and HTTP/2, databases, SSH, SMTP | DNS, DHCP, media, games, QUIC (HTTP/3) |

TCP preserving no message boundaries catches people writing socket code. Two `send` calls can arrive as one `receive`, or one as two, so protocols on TCP need their own framing, such as a length prefix or a delimiter.

## Latency, Bandwidth, and Throughput

### Latency Has a Physical Floor

Latency is how long one bit takes to get from sender to receiver, and round-trip time (RTT) is there and back. Light in optical fiber travels at roughly two-thirds of its vacuum speed, about 200 km per millisecond. New York to London is about 5,600 km, so no network can deliver a round trip between them in less than about 56 ms, and real routes that don't follow the great circle take longer. Queueing in congested routers, per-hop processing, and the time to serialize a packet onto a slow link add to that floor.

Distance is the part that no amount of engineering removes, which is why latency-sensitive systems move data or computation closer to users with content delivery networks (CDNs) that cache content at locations near users, and with regional deployments, rather than tuning the path.

### Bandwidth Is Capacity, Throughput Is What You Get

Bandwidth is the maximum rate a link can carry, and throughput is the rate a transfer actually achieves. Throughput falls below bandwidth because of protocol overhead, packet loss, TCP's cautious start, and the receive window.

On long paths the window becomes the ceiling. A sender can only have one window of unacknowledged data in flight, so a connection's throughput can't exceed window size divided by RTT. Filling a 1 Gbps link over a 100 ms round trip needs about 12.5 MB in flight, the link's **bandwidth-delay product**. Modern operating systems grow their windows automatically, but a buffer capped somewhere along the path limits a single connection to a fraction of the link.

For most API traffic, latency matters more than bandwidth. A 2 KB JSON response takes well under a millisecond to transmit on a datacenter link and a full round trip to request. A page that makes ten sequential API calls pays ten round trips, and a faster link changes nothing about that. Batching calls, running them in parallel, and reusing connections are what reduce it.

## The Same Pieces in a Cloud Network

A cloud virtual network (an AWS VPC or an Azure VNet) exposes these concepts as configuration rather than hardware:

| Concept | Cloud form |
| --- | --- |
| Address block and subnets | The network's CIDR block, divided into subnets, each confined to one availability zone, an isolated datacenter location within a region, on AWS |
| Routing table | Route tables associated with subnets |
| Default route to the internet | A `0.0.0.0/0` route to an internet gateway, which makes a subnet public |
| Outbound-only NAT | A managed NAT gateway that the private subnets' default route points at. On AWS a zonal NAT gateway sits in a public subnet, and Azure NAT Gateway attaches to the subnets it serves |
| Stateful filtering | AWS security groups, attached to network interfaces, and Azure network security groups, attached to subnets or interfaces. Both allow reply traffic automatically |
| Stateless filtering | AWS network ACLs, attached to subnets, which evaluate each direction separately and need explicit rules for replies, including the ephemeral port range |

On AWS, a subnet is "public" or "private" only because of its route table. The instances in it are otherwise identical, and a public subnet's instances still need a public address to be reachable.

{% include figure.html id="net-vpc-routing" %}

## Troubleshooting a Connection Layer by Layer

A failure at one layer makes everything above it fail too, so diagnosis works upward and stops at the first layer that fails. The error a client reports usually names the layer, and each layer has a standard tool for checking it from the failing host.

1. **Name resolution.** "Name or service not known" or `NXDOMAIN` means DNS never produced an address. Query the name with `dig` or `nslookup` from the failing host, not from your laptop, because private DNS can answer differently on different networks.
2. **Route and reachability.** "No route to host" or "network unreachable" usually means the host has no route for the destination, or a router along the way reported one missing, though some firewalls send the same error when they reject a packet. `traceroute` shows how far packets get. `ping` helps less than it seems, because many networks block its ICMP packets.
3. **The port.** Two errors look alike and point in opposite directions. **Connection refused** means the host, or a firewall rule set to reject, answered with a reset. Most often nothing is listening on that port, or the service is bound only to the loopback address `127.0.0.1`, which accepts connections from the same machine alone. **Connection timed out** means nothing came back at all, which usually means a firewall, security group, or network ACL silently dropped the packets, or the route leads nowhere. `nc -zv` or PowerShell's `Test-NetConnection` tests a single port, and `ss -tlnp` on the server shows what is listening and on which address.
4. **TLS.** Certificate-name mismatches, expired certificates, and missing intermediate certificates fail here, after the TCP connection succeeded. `openssl s_client` or `curl -v` shows the certificate the server presented. A proxy that intercepts TLS shows up as an unexpected certificate issuer.
5. **The application protocol.** An HTTP status code means the whole stack below it worked. A 502 or 504 from a load balancer means the balancer's own call to the backend failed, either at one of the earlier steps or because the backend sent back an invalid response or none in time.

Intermittent failures follow patterns of their own:

| Symptom | Likely cause |
| --- | --- |
| Errors on the first use of a connection that sat idle | An idle timeout on a NAT device or load balancer dropped the connection's state |
| "Cannot assign requested address" or intermittent connect failures under load | Ephemeral port exhaustion on the client, or NAT port exhaustion toward one destination |
| Small requests succeed, large ones hang | An MTU mismatch with the ICMP "packet too big" messages blocked |
| Some clients get the old server after a change | Cached DNS answers or long-lived connections still pointing at the old address |
