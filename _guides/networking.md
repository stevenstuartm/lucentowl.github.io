---
title: "System Networking Guide for Developers"
layout: guide
category: Networking
subcategory: Fundamentals
description: "Essential networking concepts for developers covering OSI model, IP addressing, DNS, load balancing, security protocols, and cloud networking fundamentals."
tags: [networking, fundamentals, protocols, tcp-ip, reference]
---

Networking fundamentals for software developers and system architects.

## OSI Model & Network Layers

*OSI Model developed by the International Organization for Standardization (ISO) in 1977-1984. Created as a universal standard for network communication protocols.*

The OSI (Open Systems Interconnection) model provides a framework for understanding network communications through seven layers:

### The 7 Layers

1. **Physical Layer**: Electrical signals, cables, wireless transmission
2. **Data Link Layer**: MAC addresses, Ethernet frames, switching
3. **Network Layer**: IP addresses, routing, ICMP
4. **Transport Layer**: TCP/UDP, port numbers, flow control
5. **Session Layer**: Session management, connections
6. **Presentation Layer**: Encryption, compression, data formatting
7. **Application Layer**: HTTP, FTP, SMTP, DNS

### Practical TCP/IP Model (4 Layers)

*TCP/IP protocol suite developed by DARPA in the 1970s (Vint Cerf and Bob Kahn). Became the foundation of the Internet. TCP/IP predates OSI but is less formal.*

Most developers work with the simplified TCP/IP model:

- **Application Layer** (7, 6, 5): HTTP, HTTPS, FTP, SSH, DNS
- **Transport Layer** (4): TCP, UDP
- **Internet Layer** (3): IP, ICMP, ARP
- **Network Access Layer** (2, 1): Ethernet, WiFi

---

## IP Addressing & CIDR

### IPv4 Addressing

IPv4 addresses are 32-bit numbers typically written in dotted decimal notation (e.g., 192.168.1.1).

#### Address Classes (Legacy)
- **Class A**: 1.0.0.0 to 126.255.255.255 (/8)
- **Class B**: 128.0.0.0 to 191.255.255.255 (/16)
- **Class C**: 192.0.0.0 to 223.255.255.255 (/24)

#### Private IP Ranges (RFC 1918)
- **10.0.0.0/8**: 10.0.0.0 to 10.255.255.255 (16.7M addresses)
- **172.16.0.0/12**: 172.16.0.0 to 172.31.255.255 (1M addresses)
- **192.168.0.0/16**: 192.168.0.0 to 192.168.255.255 (65K addresses)

### CIDR (Classless Inter-Domain Routing)

CIDR notation combines an IP address with a prefix length (e.g., 192.168.1.0/24).

#### CIDR Examples
- `/24` = 255.255.255.0 (256 addresses, 254 usable)
- `/16` = 255.255.0.0 (65,536 addresses)
- `/8` = 255.0.0.0 (16,777,216 addresses)

#### Calculating CIDR
- `/32`: Single host (255.255.255.255)
- `/31`: Point-to-point links (2 addresses, both usable)
- `/30`: Small subnets (4 addresses, 2 usable)
- `/24`: Standard small network (256 addresses, 254 usable)

### IPv6 Addressing

IPv6 uses 128-bit addresses written in hexadecimal (e.g., 2001:0db8:85a3::8a2e:0370:7334).

#### IPv6 Address Types
- **Global Unicast**: 2000::/3 (Internet routable)
- **Link-Local**: fe80::/10 (Local network segment)
- **Unique Local**: fc00::/7 (Private, similar to RFC 1918)

---

## Subnetting

Subnetting divides networks into smaller, manageable segments.

### Subnet Mask Calculation

For a /24 network (192.168.1.0/24):
- Network: 192.168.1.0
- Broadcast: 192.168.1.255
- Usable IPs: 192.168.1.1 to 192.168.1.254
- Total hosts: 254

### Variable Length Subnet Masking (VLSM)

Allows different subnet sizes within the same network:
- 192.168.1.0/26 (62 hosts)
- 192.168.1.64/27 (30 hosts)
- 192.168.1.96/28 (14 hosts)

---

## Network Protocols

<div class="comparison">
<div class="content-card content-card--accent">
<h4>TCP (Transmission Control Protocol)</h4>
<ul>
<li><strong>Connection-oriented</strong>: Establishes connection before data transfer</li>
<li><strong>Reliable</strong>: Guarantees packet delivery and order</li>
<li><strong>Flow control</strong>: Manages data transmission rate</li>
<li><strong>Use cases</strong>: HTTP, HTTPS, SSH, FTP, email</li>
</ul>
<p><strong>TCP Three-Way Handshake:</strong></p>
<ol>
<li>Client → Server: SYN</li>
<li>Server → Client: SYN-ACK</li>
<li>Client → Server: ACK</li>
</ol>
</div>
<div class="content-card content-card--accent-secondary">
<h4>UDP (User Datagram Protocol)</h4>
<ul>
<li><strong>Connectionless</strong>: No connection establishment</li>
<li><strong>Unreliable</strong>: No delivery guarantee</li>
<li><strong>Low overhead</strong>: Faster than TCP</li>
<li><strong>Use cases</strong>: DNS, DHCP, streaming media, gaming</li>
</ul>
</div>
</div>

### HTTP/HTTPS
- **HTTP** (Port 80): Hypertext Transfer Protocol
- **HTTPS** (Port 443): HTTP over TLS/SSL
- **Methods**: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS
- **Status Codes**: 2xx (Success), 3xx (Redirect), 4xx (Client Error), 5xx (Server Error)

### HTTP Protocol Versions

HTTP has evolved through three major versions: HTTP/1.1 (text-based, one request per connection), HTTP/2 (binary framing, multiplexed streams over TCP), and HTTP/3 (QUIC over UDP, independent streams with no TCP head-of-line blocking). Version negotiation is automatic and non-breaking, so enabling newer versions never disrupts older clients. For detailed coverage of each version, negotiation mechanics, deployment trust boundaries, and when to use each, see the [HTTP Protocol Versions](/study-guides/networking/http-protocol-versions.html) guide.

### Other Important Protocols
- **SSH** (Port 22): Secure Shell
- **FTP** (Port 21): File Transfer Protocol
- **SFTP** (Port 22): SSH File Transfer Protocol
- **SMTP** (Port 25/587): Simple Mail Transfer Protocol
- **POP3** (Port 110): Post Office Protocol
- **IMAP** (Port 143): Internet Message Access Protocol

---

## Ports & Port Ranges

### Port Categories
- **Well-known ports**: 0-1023 (require root/admin privileges)
- **Registered ports**: 1024-49151 (assigned by IANA)
- **Dynamic/Private ports**: 49152-65535 (temporary/ephemeral)

### Essential Well-Known Ports

| Port | Protocol | Service |
|------|----------|---------|
| 20/21 | FTP | File Transfer Protocol |
| 22 | SSH | Secure Shell |
| 23 | Telnet | Telnet |
| 25 | SMTP | Simple Mail Transfer Protocol |
| 53 | DNS | Domain Name System |
| 80 | HTTP | Hypertext Transfer Protocol |
| 110 | POP3 | Post Office Protocol |
| 143 | IMAP | Internet Message Access Protocol |
| 443 | HTTPS | HTTP over TLS/SSL |
| 993 | IMAPS | IMAP over TLS/SSL |
| 995 | POP3S | POP3 over TLS/SSL |

### Database Ports

| Port | Database |
|------|----------|
| 3306 | MySQL |
| 5432 | PostgreSQL |
| 1433 | SQL Server |
| 1521 | Oracle |
| 27017 | MongoDB |
| 6379 | Redis |

### Application Server Ports

| Port | Service |
|------|---------|
| 8080 | HTTP Alternative/Tomcat |
| 8443 | HTTPS Alternative |
| 3000 | Node.js Default |
| 5000 | Flask Default |
| 8000 | Django Default |

---

## DNS (Domain Name System)

DNS translates human-readable domain names to IP addresses.

### DNS Record Types
- **A**: Maps domain to IPv4 address
- **AAAA**: Maps domain to IPv6 address
- **CNAME**: Canonical name (alias)
- **MX**: Mail exchange
- **NS**: Name server
- **PTR**: Reverse DNS lookup
- **TXT**: Text records (SPF, DKIM, DMARC)
- **SRV**: Service records

### DNS Resolution Process
1. Browser cache
2. Operating system cache
3. Router cache
4. ISP DNS server
5. Root name servers
6. TLD name servers
7. Authoritative name servers

### DNS Tools
```bash
# Query DNS records
nslookup example.com
dig example.com
dig @8.8.8.8 example.com MX

# Reverse DNS lookup
dig -x 8.8.8.8
```

---

## Load Balancing

Load balancers distribute incoming requests across multiple servers.

<div class="callout callout--note">
<p class="callout__title">Load Balancing Algorithms</p>
<ul>
<li><strong>Round Robin</strong>: Requests distributed sequentially</li>
<li><strong>Weighted Round Robin</strong>: Servers assigned weights</li>
<li><strong>Least Connections</strong>: Route to server with fewest active connections</li>
<li><strong>IP Hash</strong>: Route based on client IP hash</li>
<li><strong>Geographic</strong>: Route based on client location</li>
</ul>
</div>

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Layer 4 (Transport) Load Balancer</h4>
<p>Routes based on IP and port</p>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Layer 7 (Application) Load Balancer</h4>
<p>Routes based on application data (HTTP headers, URLs)</p>
</div>
</div>

<div class="callout callout--tip">
<p class="callout__title">Health Checks</p>
<p>Load balancers monitor server health through:</p>
<ul>
<li><strong>Active checks</strong>: Periodic health probes</li>
<li><strong>Passive checks</strong>: Monitor response codes and timeouts</li>
</ul>
</div>

---

## Network Security

### Firewalls
Control network traffic based on predetermined rules.

#### Types
- **Packet filtering**: Inspects packets at network layer
- **Stateful**: Tracks connection state
- **Application layer**: Deep packet inspection
- **Next-generation**: Advanced threat detection

### Network Address Translation (NAT)
Translates private IP addresses to public IP addresses.

#### NAT Types
- **Static NAT**: One-to-one mapping
- **Dynamic NAT**: Pool of public IPs
- **PAT (Port Address Translation)**: Many-to-one with port mapping

### VPN (Virtual Private Network)
Creates secure connections over public networks.

#### VPN Protocols
- **IPSec**: Network layer security
- **OpenVPN**: SSL/TLS-based
- **WireGuard**: Modern, lightweight protocol

---

## Common Network Tools

### Diagnostic Tools
```bash
# Test connectivity
ping google.com
ping6 google.com

# Trace network path
traceroute google.com
tracert google.com  # Windows

# Network statistics
netstat -tuln
ss -tuln  # Modern replacement for netstat

# ARP table
arp -a

# Network interfaces
ip addr show  # Linux
ifconfig      # Unix/macOS
ipconfig      # Windows
```

### Port Scanning
```bash
# Nmap - Network exploration tool
nmap -p 80,443 example.com
nmap -p 1-1000 192.168.1.1
nmap -sS -O target  # SYN scan with OS detection

# Netcat - Network swiss army knife
nc -zv example.com 80
nc -l 8080  # Listen on port 8080
```

### Bandwidth Testing
```bash
# iperf - Network performance measurement
iperf3 -s           # Server mode
iperf3 -c server_ip # Client mode

# curl - Transfer data
curl -o /dev/null -s -w "%{time_total}\n" http://example.com
```

---

## Cloud Networking

### Virtual Private Cloud (VPC)
Logically isolated network segments in cloud environments.

#### Key Concepts
- **Subnets**: Network segments within VPC
- **Internet Gateway**: Provides internet access
- **NAT Gateway**: Outbound internet access for private subnets
- **Route Tables**: Control traffic routing
- **Security Groups**: Virtual firewalls for instances
- **Network ACLs**: Subnet-level access control

### CDN (Content Delivery Network)
Geographically distributed servers that cache content closer to users.

#### Benefits
- Reduced latency
- Improved performance
- Reduced origin server load
- DDoS protection

---

## Performance & Troubleshooting

### Network Latency
Time for data to travel from source to destination.

#### Factors Affecting Latency
- **Physical distance**
- **Network congestion**
- **Processing delays**
- **Serialization delay**

### Bandwidth vs Throughput
- **Bandwidth**: Maximum theoretical capacity
- **Throughput**: Actual data transfer rate

### Common Network Issues

#### Connectivity Problems
1. Check physical connections
2. Verify IP configuration
3. Test DNS resolution
4. Check routing tables
5. Examine firewall rules

#### Performance Issues
1. Monitor bandwidth utilization
2. Check for packet loss
3. Analyze latency
4. Review QoS settings
5. Optimize application protocols

### Network Monitoring
```bash
# Monitor network interfaces
iftop
nload
vnstat

# Packet capture
tcpdump -i eth0 port 80
wireshark  # GUI packet analyzer
```

---

## Quick Reference Tables

### Subnet Mask Quick Reference

| CIDR | Subnet Mask | Hosts | Networks |
|------|-------------|-------|-----------|
| /30 | 255.255.255.252 | 2 | 64 |
| /29 | 255.255.255.248 | 6 | 32 |
| /28 | 255.255.255.240 | 14 | 16 |
| /27 | 255.255.255.224 | 30 | 8 |
| /26 | 255.255.255.192 | 62 | 4 |
| /25 | 255.255.255.128 | 126 | 2 |
| /24 | 255.255.255.0 | 254 | 1 |

### HTTP Status Codes

| Code | Category | Meaning |
|------|----------|---------|
| 200 | Success | OK |
| 201 | Success | Created |
| 301 | Redirect | Moved Permanently |
| 302 | Redirect | Found (Temporary Redirect) |
| 400 | Client Error | Bad Request |
| 401 | Client Error | Unauthorized |
| 403 | Client Error | Forbidden |
| 404 | Client Error | Not Found |
| 500 | Server Error | Internal Server Error |
| 502 | Server Error | Bad Gateway |
| 503 | Server Error | Service Unavailable |

### RFC 1918 Private Address Ranges

| Network | Range | Addresses | Typical Use |
|---------|-------|-----------|-------------|
| 10.0.0.0/8 | 10.0.0.0 to 10.255.255.255 | 16,777,216 | Large organizations |
| 172.16.0.0/12 | 172.16.0.0 to 172.31.255.255 | 1,048,576 | Medium organizations |
| 192.168.0.0/16 | 192.168.0.0 to 192.168.255.255 | 65,536 | Home/small office |

### Common TCP/UDP Ports Quick Reference
```
SSH: 22          HTTPS: 443       MySQL: 3306
DNS: 53          SMTP: 25/587     PostgreSQL: 5432
HTTP: 80         POP3: 110        MongoDB: 27017
FTP: 21          IMAP: 143        Redis: 6379
SFTP: 22         LDAP: 389        Elasticsearch: 9200
```

---