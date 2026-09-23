---
title: "Networking Quick Reference"
layout: resource
type: cheatsheet
category: "Networking"
description: "CIDR prefix sizes, private and special-purpose address ranges, common port numbers, and the diagnostic commands for checking each network layer."
last_updated: 2026-09-23
tags: [cidr, subnetting, ports, ip-addressing, troubleshooting, dns]
related_guides:
  - /study-guides/networking/networking.html
  - /study-guides/networking/dns.html
---

## CIDR Prefix Sizes

A prefix of `/n` fixes the first `n` of 32 bits, leaving `2^(32-n)` addresses. Traditional subnets lose two of those to the network and broadcast addresses.

| Prefix | Subnet mask | Addresses | Usable hosts | Per /24 |
| --- | --- | --- | --- | --- |
| /32 | 255.255.255.255 | 1 | 1 (single host route) | 256 |
| /31 | 255.255.255.254 | 2 | 2 (point-to-point link, RFC 3021) | 128 |
| /30 | 255.255.255.252 | 4 | 2 | 64 |
| /29 | 255.255.255.248 | 8 | 6 | 32 |
| /28 | 255.255.255.240 | 16 | 14 | 16 |
| /27 | 255.255.255.224 | 32 | 30 | 8 |
| /26 | 255.255.255.192 | 64 | 62 | 4 |
| /25 | 255.255.255.128 | 128 | 126 | 2 |
| /24 | 255.255.255.0 | 256 | 254 | 1 |
| /20 | 255.255.240.0 | 4,096 | 4,094 | |
| /16 | 255.255.0.0 | 65,536 | 65,534 | |
| /8 | 255.0.0.0 | 16,777,216 | 16,777,214 | |

<div class="callout callout--note" markdown="1">
<p class="callout__title">Cloud subnets reserve more</p>

AWS VPC and Azure VNet subnets each reserve five addresses (the first four and the last), so a /28 gives 11 usable addresses there, not 14.

</div>

## Special-Purpose IPv4 Ranges

| Block | Purpose | Source |
| --- | --- | --- |
| 10.0.0.0/8 | Private network | RFC 1918 |
| 172.16.0.0/12 | Private network (172.16.0.0 to 172.31.255.255) | RFC 1918 |
| 192.168.0.0/16 | Private network | RFC 1918 |
| 100.64.0.0/10 | Carrier-grade NAT shared address space | RFC 6598 |
| 127.0.0.0/8 | Loopback | RFC 1122 |
| 169.254.0.0/16 | Link-local (also where cloud instance metadata lives, at 169.254.169.254) | RFC 3927 |
| 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 | Documentation examples, never routed | RFC 5737 |
| 224.0.0.0/4 | Multicast | RFC 5771 |
| 0.0.0.0/8 | "This network"; 0.0.0.0 as a bind address means all interfaces | RFC 1122 |

## Special-Purpose IPv6 Ranges

| Block | Purpose |
| --- | --- |
| ::1/128 | Loopback |
| fe80::/10 | Link-local, present on every IPv6 interface |
| fc00::/7 | Unique local addresses, the private-network analog (fd00::/8 in practice) |
| 2000::/3 | Global unicast |
| 2001:db8::/32 | Documentation examples |
| ff00::/8 | Multicast |

## Port Ranges

| Range | Name | Notes |
| --- | --- | --- |
| 0 to 1023 | System (well-known) | Binding one needs elevated privilege on Linux by default |
| 1024 to 49151 | User (registered) | Assigned by IANA on request |
| 49152 to 65535 | Dynamic (private) | IANA's ephemeral range, used by Windows. Linux defaults to 32768 to 60999 |

## Common Ports

| Port | Transport | Service |
| --- | --- | --- |
| 20, 21 | TCP | FTP data, FTP control |
| 22 | TCP | SSH, SFTP, SCP |
| 23 | TCP | Telnet |
| 25 | TCP | SMTP relay between mail servers |
| 53 | UDP, TCP | DNS |
| 67, 68 | UDP | DHCP server, client |
| 80 | TCP | HTTP |
| 110 | TCP | POP3 |
| 123 | UDP | NTP |
| 143 | TCP | IMAP |
| 389 | TCP | LDAP |
| 443 | TCP, UDP | HTTPS (UDP for HTTP/3 over QUIC) |
| 465 | TCP | SMTP submission over implicit TLS |
| 587 | TCP | SMTP submission with STARTTLS |
| 636 | TCP | LDAPS |
| 853 | TCP | DNS over TLS |
| 993 | TCP | IMAPS |
| 995 | TCP | POP3S |
| 3389 | TCP | Remote Desktop (RDP) |

## Default Ports of Common Servers

| Port | Server |
| --- | --- |
| 1433 | SQL Server |
| 1521 | Oracle Database |
| 2379 | etcd client |
| 3306 | MySQL, MariaDB |
| 5432 | PostgreSQL |
| 5672 | RabbitMQ (AMQP) |
| 6379 | Redis |
| 6443 | Kubernetes API server |
| 8080 | Common HTTP alternative; ASP.NET Core container images since .NET 8 |
| 9092 | Kafka |
| 9200 | Elasticsearch, OpenSearch |
| 27017 | MongoDB |

## Diagnostic Commands by Layer

Work up the stack. A failure at one layer makes every layer above it fail too, so the first layer that fails is the one to fix.

| Question | Linux / macOS | Windows (PowerShell) |
| --- | --- | --- |
| Which addresses and routes does this host have? | `ip addr`, `ip route` (macOS: `ifconfig`, `netstat -rn`) | `Get-NetIPAddress`, `Get-NetRoute` |
| Does the name resolve, and to what? | `dig example.com`, `dig +short example.com AAAA` | `Resolve-DnsName example.com` |
| What does a specific resolver return? | `dig @1.1.1.1 example.com` | `Resolve-DnsName example.com -Server 1.1.1.1` |
| Which servers answer at each step of resolution? | `dig +trace example.com` | none built in |
| Is the host reachable at all? | `ping example.com` (ICMP is often blocked, so no reply proves little) | `ping example.com` |
| Where along the path does traffic stop? | `traceroute example.com`, `mtr example.com` | `tracert example.com` |
| Is a TCP port open? | `nc -zv example.com 443` | `Test-NetConnection example.com -Port 443` |
| What is listening on this host? | `ss -tlnp` | `Get-NetTCPConnection -State Listen` |
| Does the TLS handshake succeed, with which certificate? | `openssl s_client -connect example.com:443 -servername example.com` | same, where OpenSSL is installed |
| Where does the time go in one HTTP request? | `curl -o /dev/null -s -w "dns %{time_namelookup} connect %{time_connect} tls %{time_appconnect} first-byte %{time_starttransfer} total %{time_total}\n" https://example.com` | same, with `curl.exe` |
| Which HTTP version was negotiated? | `curl -sI --http2 https://example.com -o /dev/null -w "%{http_version}\n"` | same, with `curl.exe` |
| What is on the wire? | `tcpdump -i any -n port 443` | Wireshark, or `pktmon` |
