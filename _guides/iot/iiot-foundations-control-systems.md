---
title: "IIoT Foundations and Control Systems"
layout: guide
category: IoT
subcategory: Industrial IoT
description: "How industrial IoT differs from consumer IoT, and the systems it connects to: PLCs, DCS, SCADA, and historians with swinging-door compression; OPC UA's information model, security, and PubSub; Modbus, PROFINET, EtherNet/IP, DNP3, and BACnet; and the Purdue model with its industrial DMZ and data diodes."
tags: [fundamentals, opc-ua, scada, plc, modbus, purdue-model, industrial-protocols]
---

## How Industrial IoT Differs

A failed smart speaker is an inconvenience. A failed sensor on a production line can stop output worth a great deal per hour, a bad change to a grid controller can cut power to a region, and a breach of a water treatment system can put a municipal supply at risk. Those stakes shape every decision in industrial IoT (IIoT).

Industrial equipment also lives far longer than anything in consumer or enterprise IT. Controllers installed decades ago run alongside new sensors, speak protocols designed before anyone expected them to reach a network, and cannot be taken offline for an integration project. Safety is formalized through functional safety standards like IEC 61508, so a safety-rated controller cannot simply receive an over-the-air update. Every change goes through formal change management, and some need recertification. Maintenance windows may come only at scheduled shutdowns, sometimes a year or more apart.

| Dimension | Consumer IoT | Industrial IoT |
|-----------|-------------|----------------|
| Failure consequence | Inconvenience | Safety incidents, lost production, regulatory exposure |
| Availability | Best effort | Continuous operation between planned shutdowns |
| Update model | Frequent, automatic | Controlled, validated, scheduled into maintenance windows |
| Security model | Cloud-managed, patched automatically | Segmented networks, change control, patching constrained by availability |
| Protocols | Wi-Fi, Bluetooth, Zigbee, Thread | Modbus, PROFINET, EtherNet/IP, DNP3, OPC UA, BACnet |
| Equipment lifespan | Often a few years | Often 15 to 30 years |
| Environment | Homes and offices | Heat, vibration, electrical noise, corrosive atmospheres |
| Timing | Seconds are usually fine | Some control loops need deterministic millisecond or sub-millisecond timing |

The practical consequence for anyone arriving from cloud or consumer IoT is that IIoT connects to existing control systems rather than replacing them. The rest of this guide describes those systems.

---

## Controllers: PLCs and DCS

### Programmable Logic Controllers

A programmable logic controller (PLC) is a hardened computer that runs control logic. It works in a repeating **scan cycle**, reading all inputs, executing the control program, and writing all outputs. Cycle times typically run from a few milliseconds to around a hundred, and the design guarantees the cycle completes on time under all conditions.

That determinism is a safety property, not a performance feature. A press controller must see a guard door open within its scan, and a batch controller must time valve openings precisely. The control logic was validated against those timing assumptions, so anything that disturbs them creates risk. Integration traffic therefore goes to interfaces the PLC provides for it, at rates it was designed for, and never at the expense of the scan.

The protocols a PLC speaks are fixed by its hardware and firmware. Older units speak Modbus. Newer ones speak EtherNet/IP or PROFINET, and many now include an OPC UA server. A plant of any age runs several protocol families at once.

### Distributed Control Systems

A distributed control system (DCS) does the same job for continuous processes like refining, chemicals, and power generation, where hundreds of interacting loops run constantly rather than in discrete sequences. Control logic is spread across many controllers under one engineering and operator environment from a single vendor. Most current DCS platforms offer OPC UA interfaces for integration, subject to the same availability and security constraints as any control system.

---

## SCADA and Historians

### SCADA

Supervisory control and data acquisition (SCADA) systems are what operators use to watch and steer a process. A SCADA system gathers data from PLCs, remote terminal units (RTUs), and other field devices, shows it on operator displays (HMIs), raises alarms, and lets operators issue commands. In utilities it often spans huge areas, collecting from substations or pumping stations over radio and leased lines.

SCADA is a real-time monitoring and control platform, not an analytics one. Its screens are built for operator awareness and its alarms for conditions that need action now. The trend analysis, cross-site comparison, and machine learning that organizations want from their process data happen elsewhere, which is the gap IIoT integration fills.

Replacing a SCADA system is one of the riskiest projects a plant can take on. It holds years of accumulated logic, alarm configuration, and operator familiarity, and a failed cutover can leave a plant without its main operating interface. IIoT integration reads from SCADA and its historian and leaves them in place.

Traditional SCADA relied on isolation. It ran on dedicated hardware and private networks with no connection to corporate IT, a model often called air-gapping. Connecting it for IIoT removes that isolation, which is why segmentation (covered below) matters so much.

### Historians

A **historian** is a time-series database built for process data, holding thousands of tags, each sampled anywhere from once a minute to many times a second, for years. Products like the [AVEVA PI System](https://www.aveva.com/en/products/aveva-pi-system/){:target="_blank" rel="noopener noreferrer"} (formerly OSIsoft PI) have run in refineries, power plants, and utilities for decades, and a plant's historian often holds its authoritative operating record. IIoT architectures usually bridge historian data to the cloud rather than replacing the historian, because operators depend on it daily and its history cannot be recreated.

Historians are optimized for time-range retrieval of many tags, such as "every value of these fifty tags from midnight to six," which they store in time-ordered blocks per tag.

They also compress aggressively, because most process variables change slowly relative to how often they are sampled. **Swinging-door trending**, published by E. H. Bristol of Foxboro in 1990 and used in variants by several historians, keeps only the points needed to reconstruct the signal within a set error band. It pivots two lines ("doors") from the last stored point, one at the upper tolerance and one at the lower, and narrows them as each new sample arrives. When the doors would cross, no straight line from the last stored point can represent every sample within tolerance, so the previous sample is stored and the process restarts from it. A tank level that rises steadily for ten minutes might be stored as two points instead of six hundred, while a sudden step is kept exactly. The tolerance is a per-tag setting that decides the tradeoff, and a band set too wide silently discards detail that later analysis might need.

---

## OPC UA

[OPC Unified Architecture](https://opcfoundation.org/about/opc-technologies/opc-ua/){:target="_blank" rel="noopener noreferrer"} is the main cross-vendor standard for industrial data exchange and modeling. The original OPC standards of the 1990s gave SCADA and HMI software one interface to read from any vendor's PLC, but they depended on Microsoft's COM/DCOM, which tied them to Windows and was hard to secure across networks. OPC UA replaced that with a platform-independent design that runs on everything from embedded devices to cloud services, and added information modeling and built-in security.

### Information Modeling

An OPC UA server exposes an **address space** of nodes (objects, variables, methods, and types) connected by references. A client does not just see numbered values. It sees equipment, with a temperature variable belonging to a pump, the pump to a production line, and the line to a site, and each variable carries its engineering units, range, and other metadata. A consumer can tell what a value means, not just what it is.

**Companion specifications** standardize models for whole industries, such as the [CNC systems specification](https://opcfoundation.org/markets-collaboration/cnc/){:target="_blank" rel="noopener noreferrer"} for machine tools and [PackML](https://opcfoundation.org/markets-collaboration/packml/){:target="_blank" rel="noopener noreferrer"} for packaging machinery. When two vendors implement the same companion specification, their equipment presents the same structure and meaning, not just the same transport.

### Security

OPC UA builds security into the protocol, which sets it apart from most older industrial protocols. It works at two levels, described in [Part 2 of the specification](https://reference.opcfoundation.org/Core/Part2/v105/docs/){:target="_blank" rel="noopener noreferrer"}.

- **Application authentication and channel security.** Every client and server application has its own X.509 application instance certificate. They exchange certificates when opening a secure channel, and each decides whether to trust the other. On the native binary protocol (`opc.tcp`), the channel is secured by OPC UA's own secure conversation layer, not by TLS. The security mode is None, Sign, or SignAndEncrypt, and a security policy names the algorithms. The HTTPS and WebSocket transports use TLS instead.
- **User authentication.** Inside a session, the user is identified separately, anonymously, by username and password, by user certificate, or by a token from an identity provider. The server authorizes actions based on that identity.

The "None" security mode disables channel protection, and older equipment often ships with it enabled. It should be turned off on anything reachable over a network. Certificate management is where deployments usually struggle. Without a plan, teams end up with self-signed certificates that someone trusts by hand for each new connection, and nobody tracks their expiry. OPC UA defines a Global Discovery Server that can act as a certificate manager, pushing certificates and trust lists to servers.

### Client-Server and PubSub

OPC UA's original model is client-server. A client opens a session to a server, browses its address space, and subscribes to value changes. That suits HMIs and local applications, but collecting from hundreds of servers means hundreds of sessions, each with state and overhead.

[OPC UA PubSub (Part 14)](https://reference.opcfoundation.org/Core/Part14/v105/docs/){:target="_blank" rel="noopener noreferrer"} adds a publish-subscribe model. Publishers send datasets either through a broker over MQTT or AMQP, or brokerless over UDP multicast for low-latency traffic on a local network. Messages use a compact binary encoding (UADP) or JSON, and publishers can send dataset metadata describing the fields, so subscribers can decode the data without opening a session to each source. Broker-based PubSub over MQTT is the usual integration point when many machines need to feed the same edge or cloud platform.

---

## Industrial Protocols

The protocols below evolved separately, each tuned for the determinism, reliability, and simplicity its industry needed. Integration work usually means bridging them to something modern.

### Modbus

Modicon published Modbus in 1979, and its simplicity has kept it everywhere since. A client polls a server (the specification's older terms were master and slave) using a handful of function codes to read and write four tables: coils, discrete inputs, input registers, and holding registers. **Modbus RTU** runs over serial links like RS-485, and **Modbus TCP** carries the same model over Ethernet.

The data model is just numbered addresses. There are no names, no types, no units, and no meaning in the protocol. Whether holding register 40012 is a temperature in tenths of a degree or a fault code lives in documentation or in someone's memory. A bridge to the cloud has to supply all of it, including the tag name, data type, scaling to engineering units, and valid range for every register, and building that mapping for a plant with hundreds of devices is a large part of any brownfield project. Classic Modbus has no authentication or encryption. Modbus.org's [Modbus/TCP Security](https://modbus.org/specs.php){:target="_blank" rel="noopener noreferrer"} adds TLS, but little installed equipment supports it.

### PROFINET

PROFINET, maintained by PROFIBUS & PROFINET International (PI), is industrial Ethernet widely used with Siemens and many other vendors' equipment. Configuration and diagnostics use ordinary TCP/IP. Cyclic process data uses **real-time (RT)** frames that bypass the IP stack, for cycle times in the low milliseconds, and **isochronous real-time (IRT)** reserves bandwidth in hardware-scheduled time slots for sub-millisecond motion control. Integration usually reads through the controller or a gateway rather than joining the real-time traffic.

### EtherNet/IP

EtherNet/IP, from ODVA and most associated with Rockwell Automation, carries the Common Industrial Protocol (CIP) over standard TCP and UDP, so it runs on ordinary switched Ethernet. Configuration uses TCP, and cyclic I/O uses UDP. CIP's object model carries more structure than Modbus's registers but far less than an OPC UA information model. ODVA's CIP Security extension adds TLS and DTLS, and newer controllers increasingly support it.

### DNP3

DNP3 was designed for electric utility SCADA and spread to water and oil and gas. It was built for slow, unreliable links like radio and leased lines, so it includes link-layer confirmation, retries, and time-stamped events. Its **unsolicited reporting** lets an outstation report changes as they happen instead of waiting to be polled, which suits event-driven integration better than polling protocols. [IEEE 1815](https://standards.ieee.org/ieee/1815/5414/){:target="_blank" rel="noopener noreferrer"} defines Secure Authentication, which adds challenge-response authentication of critical messages. Adoption is uneven because retrofitting it to older RTUs is hard.

### BACnet

BACnet (ASHRAE Standard 135) is the building-automation protocol for HVAC, lighting, access control, and fire systems. It models devices as objects with standard properties, closer in spirit to OPC UA than to Modbus. Classic BACnet over IP has no security. [BACnet Secure Connect (BACnet/SC)](https://bacnetinternational.org/bacnetsc/){:target="_blank" rel="noopener noreferrer"} adds a datalink where each device authenticates with an X.509 certificate and connects outbound over TLS-protected WebSockets to a hub.

| Protocol | Transport | Security | Data model | Where it dominates |
|----------|-----------|----------|------------|-----------------|
| Modbus | Serial or TCP | None in classic form; TLS variant rarely deployed | Numbered registers and coils | General manufacturing, utilities, instruments |
| PROFINET | Ethernet (RT/IRT frames plus TCP/IP) | Security classes defined recently; limited in installed base | Device and module model | Factory automation, Siemens ecosystems |
| EtherNet/IP | TCP and UDP | CIP Security (optional) | CIP objects | Factory automation, Rockwell ecosystems |
| DNP3 | Serial or TCP/UDP | Secure Authentication (optional) | Points and time-stamped events | Electric, water, oil and gas SCADA |
| OPC UA | `opc.tcp`, HTTPS, WebSockets, or PubSub over MQTT, AMQP, or UDP | Built in: application certificates, signing, encryption, user tokens | Full information model | Cross-industry integration |
| BACnet | IP, MS/TP serial, or BACnet/SC | None classic; TLS with BACnet/SC | Objects and properties | Building automation |

---

## The Purdue Model

The [Purdue Enterprise Reference Architecture](https://www.pera.net/Pera/Wha_PERA_Ref_Model.html){:target="_blank" rel="noopener noreferrer"} (PERA) was developed by Theodore J. Williams and an industry consortium at Purdue University in the early 1990s to describe how data flows through a computer-integrated manufacturing enterprise. It was not a security model. Its levels later became the standard reference for segmenting industrial networks, adopted by ISA-95 for enterprise-control integration and referenced throughout IEC 62443 and other industrial security guidance.

### The Levels

The security form of the model has six levels, 0 through 5, plus an industrial DMZ inserted between levels 3 and 4 and numbered 3.5.

| Level | Name | Systems |
|-------|------|---------|
| 0 | Physical process | Sensors, actuators, motors, the process itself |
| 1 | Basic control | PLCs, DCS controllers, safety controllers |
| 2 | Supervisory control | SCADA servers, HMIs, engineering workstations |
| 3 | Site operations | Plant historian, manufacturing execution systems (MES), site operations servers |
| 3.5 | Industrial DMZ | Historian replicas, patch and antivirus staging, remote access jump hosts, edge gateways |
| 4 | Site business | Site ERP, email, corporate IT services |
| 5 | Enterprise | Corporate network, internet access, and in practice the cloud |

Levels 0 to 3 are operational technology (OT), and levels 4 and 5 are IT. The model's segmentation rule is that traffic crosses one boundary at a time through controlled points, and nothing connects directly from IT to the control levels. Each boundary is a place to filter, inspect, and log.

### The Industrial DMZ and Data Diodes

The DMZ is where IT and OT meet without touching. Systems in it accept data from OT and serve it to IT, so no connection ever runs straight through. A historian replica in the DMZ receives data from the plant historian, and enterprise users query the replica, never the plant historian. Remote vendor access terminates on a jump host in the DMZ, not on a controller.

A **data diode** enforces one-way flow in hardware, typically with a transmit-only fiber link and no return path. Data can leave OT, and nothing can come back, whatever software on either side is compromised. Because the protocols crossing it cannot rely on acknowledgments, diodes are paired with proxies on each side that replicate historians or forward files and messages one way. Where the risk of any inbound path is unacceptable, such as at nuclear plants or other critical infrastructure, diodes replace firewalls at the OT boundary.

{% include figure.html id="iot-purdue-dmz" %}

### Where the Model Strains

Purdue assumed data moves up level by level and control moves down. IIoT adds devices that want to publish straight to the cloud and cloud services that want to reach the plant. The common adaptation keeps the model's intent. Edge gateways sit in the DMZ or at level 3, collect from OT, and make outbound-only connections to the cloud, so nothing on the internet initiates a connection into the plant. A sensor that connects to the cloud directly from level 1 bypasses every boundary the model depends on.

Real networks also drift from the model. Laptops end up with one adapter on the OT network and one on IT, vendors get remote access paths that skip the DMZ, and cellular modems appear inside control cabinets. Passive OT network discovery tools find these paths before attackers do, but only if someone runs them regularly.

Some organizations layer zero-trust controls, where access depends on identity rather than network position, on top of or in place of strict Purdue segmentation. That can be stronger, but it needs every participant to hold and present an identity, and much installed control equipment never will. The Purdue levels also remain the shared vocabulary between IT and OT security teams, and an imperfect segmentation that everyone understands is safer than a newer one that nobody can fully describe.
