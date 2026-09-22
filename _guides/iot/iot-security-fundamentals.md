---
title: "IoT Security Fundamentals"
layout: guide
category: IoT
subcategory: Security & Firmware
description: "Securing connected devices: per-device identity with X.509 certificates or symmetric keys, where keys live (flash, secure elements, TPMs), TLS, DTLS, mTLS, and pinning, constrained-device tradeoffs, network segmentation, monitoring and response, common attack vectors, and the baseline standards and regulations that now apply."
tags: [fundamentals, security, x509, mtls, dtls, network-segmentation, secure-element]
---

## Why IoT Security Is Different

Web servers have abundant compute, stable network connections, and administrators watching them. IoT devices often have none of these. They run on microcontrollers with kilobytes of RAM, connect over unreliable wireless links, and sit unattended in fields, factories, or public spaces for years, where anyone can pick them up.

These constraints make the security requirements harder to meet, not smaller. A compromised web server can be patched and restarted in minutes. A compromised fleet of ten thousand sensors spread across a facility may need firmware updates that some devices cannot receive, or site visits to devices nobody can reach. IoT security therefore puts more weight on preventing compromise in the first place and on limiting how far one compromised device can reach.

---

## Device Identity and Authentication

Every device needs its own verifiable identity. Without one, a service cannot tell a legitimate device from an impostor, revoke a single compromised device, or produce a meaningful audit trail. Shared credentials across a fleet are the most damaging mistake here, because extracting the credential from one device unlocks every device that uses it. Whatever mechanism a fleet uses, each device gets its own key material.

Two questions define a device's identity scheme. The first is what kind of credential it holds, asymmetric or symmetric. The second is where the secret part of that credential is stored. The two are independent, and conflating them is a common source of confusion.

### X.509 Certificates

An X.509 certificate binds a public key to a device identity and is signed by a certificate authority (CA) the service trusts. During the TLS handshake the device presents its certificate and proves it holds the matching private key. The server verifies the signature chain back to a trusted root and accepts the device.

The strength comes from asymmetry. The private key never has to leave the device, and the certificate holds only the public key, so a stolen certificate is useless without the key. The service stores no secret for the device at all, which means a breach of the service's device registry exposes no device credentials.

Certificate chains add structure. A root CA signs an intermediate CA, and the intermediate signs device certificates. The root stays offline, a product line or factory can have its own intermediate, and a compromised intermediate can be revoked without re-rooting the whole fleet.

The costs are operational. Certificates expire, and a device with an expired certificate cannot authenticate, so renewal has to be designed in from the start. Revocation needs the service to check a revocation list or disable the identity in its registry. Parsing certificates and running asymmetric cryptography also needs more code and compute than symmetric schemes, which matters on the smallest microcontrollers.

### Symmetric Keys and Signed Tokens

With symmetric authentication, the device and the service share a secret key. The device proves possession of it, typically by computing an HMAC over a token that names the device and an expiry time. The service recomputes the HMAC with its copy of the key and compares. Azure IoT Hub's shared access signature (SAS) tokens work this way.

Symmetric schemes are cheap. An HMAC costs almost nothing even on a small microcontroller, and there is no certificate lifecycle to run. Short token lifetimes limit how long a captured token stays useful.

The weakness is that both sides hold the same secret. A breach of the service's key store exposes every device key in it, and an attacker who reads a key from a device can impersonate it indefinitely until the key is rotated. Unique per-device keys contain the damage to one device. A common way to issue them at scale is to derive each device key from a group master key and the device ID, which keeps the master key only in the provisioning service and the factory.

### Where Keys Live: Flash, Secure Elements, and TPMs

A private key or symmetric key stored in ordinary flash can be read by anyone who can dump the flash, through an enabled debug port or by desoldering the chip. Hardware key storage prevents that.

A **secure element** is a small, dedicated chip (or an isolated block inside the main processor) that generates and stores keys and performs cryptographic operations internally. The key never appears on the bus or in main memory, so dumping the processor's flash yields nothing. Secure elements are sized for microcontroller-class devices and cost little in the bill of materials.

A **Trusted Platform Module (TPM)** is a standardized form of the same idea, defined by the [Trusted Computing Group's TPM 2.0 specification](https://trustedcomputinggroup.org/resource/tpm-library-specification/){:target="_blank" rel="noopener noreferrer"} and common on gateways, industrial PCs, and Linux-class devices. Besides key storage, a TPM records measurements of the software that booted, and can sign those measurements with a key only the genuine TPM holds. That supports **remote attestation**, where a provisioning service checks which firmware a device booted before issuing it credentials. Firmware TPMs implemented inside a processor's trusted execution environment offer the same interface with weaker resistance to physical attack than a discrete chip.

Hardware-backed keys work with either credential type. A device can hold an X.509 private key in a secure element, or a symmetric key in a TPM.

| Key storage | Resists flash dump | Resists physical probing | Firmware attestation | Typical device |
|---|---|---|---|---|
| Plain flash | No | No | No | Low-cost sensors |
| Flash with on-chip encryption | Yes, if the encryption key is protected | Partially | No | Modern microcontrollers |
| Secure element | Yes | Yes, to the level it is certified for | Some support it | Microcontroller-class devices |
| Discrete TPM | Yes | Yes, to the level it is certified for | Yes | Gateways, industrial PCs, Linux-class devices |

### Choosing a Scheme

| Factor | X.509 certificates | Symmetric keys |
|---|---|---|
| Secret held by the service | None, only trust anchors | Every device's key, or a master key |
| Device compute | Asymmetric operations and certificate parsing | An HMAC |
| Lifecycle work | Issuance, renewal, and revocation | Key rotation |
| Blast radius of a service breach | No device credentials exposed | Every device key exposed |
| Best fit | Devices that can run TLS with certificates, especially with a secure element | Very constrained devices, or fleets bootstrapping toward certificates |

---

## Communication Security

Authentication establishes who a device is. Communication security keeps what it sends from being read or altered in transit and confirms both ends are who they claim to be.

### TLS and DTLS

Transport Layer Security (TLS) gives a connection confidentiality and integrity. Every device that can run it should use it for everything it sends. TLS 1.0 and 1.1 are deprecated and should not be used. TLS 1.2 is widely supported and acceptable with modern cipher suites, and TLS 1.3 is preferred where the device's library supports it, since its full handshake takes one round trip instead of two, which saves time and radio power.

Datagram TLS (DTLS) provides the same protection over UDP, which CoAP and other lossy-network protocols use. It adds the retransmission and reordering handling UDP lacks. The current version is [DTLS 1.3 (RFC 9147)](https://www.rfc-editor.org/rfc/rfc9147){:target="_blank" rel="noopener noreferrer"}.

TLS and DTLS protect a hop. When a message passes through a gateway or proxy that terminates the connection, the proxy sees plaintext. [OSCORE (RFC 8613)](https://www.rfc-editor.org/rfc/rfc8613){:target="_blank" rel="noopener noreferrer"} protects CoAP messages themselves, end to end, so they stay protected through proxies that forward them.

### Mutual TLS

In standard TLS only the server presents a certificate. Mutual TLS (mTLS) has the device present one too, and the server verifies it during the handshake. A client without a valid device certificate cannot complete the handshake at all, so unauthenticated traffic never reaches application code. With X.509 device identities, the device certificate serves as both its identity and its TLS client credential.

### Certificate Pinning

By default a device trusts any server certificate that chains to a root in its trust store. An attacker who can obtain a certificate for the service's name from any trusted CA, or who can add a root to the trust store, can intercept traffic without the device noticing. Pinning restricts what the device accepts, to the service's own CA, its intermediate, or its public key.

Pinning has a cost. If the service changes CA or rotates the pinned key, devices that pin the old one stop connecting, and fixing them requires a firmware or configuration update that reaches them over the connection that just broke. Pinning to a CA or a public key the operator controls, and shipping a backup pin, keeps rotation possible.

### Pre-Shared Keys for the Most Constrained Devices

TLS and DTLS both support pre-shared key (PSK) modes, where the handshake authenticates both sides by proving they hold a shared symmetric key instead of exchanging certificates. PSK skips the asymmetric cryptography, which makes it feasible on devices that cannot afford a certificate handshake.

PSK does authenticate both ends, but it inherits the weaknesses of symmetric keys. The service holds every device's key, and the keys have to be provisioned and rotated. It fits the most constrained devices, with unique per-device keys, rather than serving as a default.

---

## Constrained Device Tradeoffs

### Compute, Memory, and Power

Compact TLS libraries like Mbed TLS and wolfSSL run a TLS handshake in tens of kilobytes of RAM, which fits most connected microcontrollers but not the smallest ones. The larger cost is often time and energy. An asymmetric handshake can take seconds on a slow core, and every handshake keeps the radio on.

Three techniques reduce the cost. **Session resumption** lets a reconnecting device skip the full handshake. **Elliptic-curve cryptography** gets equivalent strength from much smaller keys and faster operations than RSA. **Hardware crypto accelerators**, including secure elements, move the expensive math off the main core.

When a device cannot secure its own connection to the cloud, a gateway can terminate the device link and run full TLS upstream. That makes the device-to-gateway link the weak point, so it needs its own protection, such as link-layer encryption in the radio protocol or a PSK mode, rather than relying on the link being short-range.

### Default and Hard-Coded Credentials

Devices shipped with a known default password, such as `admin`/`admin`, give an attacker every unconfigured unit through a single lookup. Hard-coded credentials are worse, because they are embedded in firmware and the owner cannot change them. When one is found, every device running that firmware is exposed until patched.

The fix is a unique credential per device, injected during manufacturing or provisioning, and setup that forces the owner to set their own password where a human login exists at all. This is now law in some markets (see Baseline Standards and Regulation below).

### Supply Chain Risk

Device firmware combines the manufacturer's code with an RTOS, a network stack, cryptography libraries, and vendor drivers, and a vulnerability in any of them ships in the device. A **software bill of materials (SBOM)** for each firmware version lets a team identify affected devices when a component vulnerability is published. Secure boot and signed firmware updates, which make a device refuse firmware not signed by the manufacturer's key, limit what an attacker can do with a compromised distribution path.

### Physical Access

An attacker holding a device can read flash through a JTAG or SWD debug port left enabled, desolder the flash chip, or probe internal buses. Production devices should have debug ports disabled or locked, flash encryption enabled where the microcontroller supports it, and keys in a secure element. Tamper detection, which erases keys when an enclosure is opened, is standard in payment terminals and fits high-value IoT devices too.

---

## Network Security

### Network Segmentation

A compromised device on the same network as workstations and file servers becomes a pivot point for attacking them. Segmentation puts IoT devices in their own VLAN or subnet behind a firewall that allows only the flows they need. Typically that means outbound connections to specific cloud endpoints on specific ports, and nothing inbound from the IoT segment to the corporate LAN.

Device traffic is predictable, which makes allowlisting practical. A temperature sensor talks to one endpoint on one port, so the firewall can allow exactly that and deny everything else. An allowlist stops a compromised device from reaching an attacker's command server, because that server was never on the list. A blocklist cannot keep up with attackers' changing infrastructure.

{% include figure.html id="iot-network-segmentation" %}

Industrial sites apply the same idea through a layered model of network levels, where operational technology sits in lower levels separated from IT networks by a DMZ that no traffic crosses directly.

### Least Privilege for Device Identities

Each device identity should be allowed to do only what the device does. A sensor that publishes telemetry needs permission to publish to its own topic and receive its own commands, and nothing more. It should not be able to read other devices' topics, modify the device registry, or call management APIs. Platforms express this differently. AWS IoT Core uses per-device policies that can scope topic access to the device's own client ID, and Azure IoT Hub separates device permissions from service permissions. Designing permissions this way at the start is straightforward, and retrofitting them onto a fleet in production is not.

### Data at Rest

Telemetry ends up in storage, databases, and data lakes. Cloud storage services encrypt at rest by default, often with an option for customer-managed keys. The sensitivity of the data decides how much further to go. Location traces from asset trackers reveal movement patterns, and data from medical devices carries regulatory obligations.

---

## Monitoring and Response

### Behavioral Anomaly Detection

Devices behave predictably, which makes deviations visible. Useful signals include a device connecting to an endpoint outside its allowlist, a sudden change in message rate or size, connections at unusual times, repeated authentication failures, and a device going silent. Detecting them needs a baseline of normal behavior per device class, encoded as rules or learned by a model.

### Security Audit Logging

Log provisioning and deprovisioning, authentication successes and failures, credential changes, firmware updates, configuration changes, and connections and disconnections. During an incident these logs provide the timeline, and over time patterns in authentication failures surface devices under attack. Retention depends on regulatory requirements and on how long an intrusion could go unnoticed, so set it from those rather than from storage cost.

### Responding to a Compromised Device

Nobody can walk over and unplug a device in a field, so response mechanisms have to exist before the incident. **Remote quarantine** disables the device's identity in the service so it can no longer authenticate, and can add a network rule that blocks its traffic. The device may keep running locally, but it cannot send data or receive commands. A **remote disable command** goes further where the device supports it. Devices with neither need a site visit.

After containment, determine the scope. Check whether other devices share the exploited weakness, whether data left, and which vulnerability was used. Where possible, image the firmware for analysis before wiping and reprovisioning the device.

---

## Common IoT Attack Vectors

### Firmware Extraction and Modification

An attacker who dumps unencrypted flash can reverse engineer the firmware for hard-coded credentials, API keys, and protocol details. With that understanding they can build a modified firmware with a backdoor that keeps normal behavior, and push it to devices that do not verify update signatures. Encrypted flash, locked debug ports, secure boot, and signature checks on updates close this path.

### Interception on Unencrypted Protocols

Devices that send plaintext can be read and manipulated by anyone on the same network or controlling a wireless access point in range. The attacker can alter data, inject commands, or replay messages. TLS or DTLS on every link prevents it, and mTLS or pinning stops an attacker who can present a certificate the device would otherwise trust.

### Replay Attacks

A replay captures a legitimate message and resends it later, such as a "system normal" status to mask a fault or a valid command to trigger an action again. TLS rejects replayed records within a connection. It does not stop an application-level replay, where an attacker who can submit messages (a compromised gateway, or a message stored and forwarded) resends a captured payload. TLS 1.3's optional 0-RTT early data is also replayable by design, so commands should never be sent as early data.

Application-level defenses include timestamps with a short validity window, monotonic sequence numbers per device, and nonces the service tracks to reject repeats. Commands that change physical state deserve all of them.

### Side-Channel and Physical Tampering

With physical access, an attacker can recover keys by measuring power consumption, electromagnetic emissions, or timing during cryptographic operations, without reading memory directly. These attacks need equipment and expertise, but they work against software cryptography without countermeasures. Secure elements and certified TPMs include side-channel protections. Tamper-evident enclosures, potted circuit boards, and tamper switches that erase keys raise the cost further, and high-security deployments add periodic physical inspection.

### Botnet Recruitment

Mirai showed what weak device credentials cost everyone else. In 2016 it scanned the internet for devices exposing Telnet, logged in with a short list of default username-and-password pairs, and enrolled them. It peaked at roughly 600,000 infected devices and launched attacks of hundreds of gigabits per second, including one on the DNS provider Dyn that disrupted access to major websites (Source: [Antonakakis et al., "Understanding the Mirai Botnet," USENIX Security 2017](https://www.usenix.org/conference/usenixsecurity17/technical-sessions/presentation/antonakakis){:target="_blank" rel="noopener noreferrer"}).

Recruitment exploits default credentials, unpatched vulnerabilities, and management interfaces exposed to the internet. The owner usually notices nothing, because the device keeps working while it attacks third parties. Unique credentials, no internet-exposed management interfaces, egress allowlists, and timely updates remove the conditions Mirai relied on. The attack traffic is hard to filter because it comes from many legitimate addresses across many networks, which is why prevention has to happen at the device.

---

## Baseline Standards and Regulation

Several baselines now define minimum device security, and some are law.

| Baseline | What it is | Examples of what it requires |
|---|---|---|
| [ETSI EN 303 645](https://www.etsi.org/deliver/etsi_en/303600_303699/303645/){:target="_blank" rel="noopener noreferrer"} | European standard for consumer IoT security | No universal default passwords, a vulnerability disclosure policy, secure software updates, secure storage of security parameters |
| [NIST IR 8259A](https://csrc.nist.gov/pubs/ir/8259/a/final){:target="_blank" rel="noopener noreferrer"} | US core baseline of device cybersecurity capabilities | Device identification, device configuration, data protection, logical access to interfaces, software update, cybersecurity state awareness |
| [UK PSTI regime](https://www.gov.uk/government/publications/the-uk-product-security-and-telecommunications-infrastructure-product-security-regime){:target="_blank" rel="noopener noreferrer"} | UK law for consumer connectable products, in force since April 2024 | No guessable default passwords, a published way to report vulnerabilities, a stated minimum period of security updates |
| [EU Cyber Resilience Act](https://digital-strategy.ec.europa.eu/en/policies/cyber-resilience-act){:target="_blank" rel="noopener noreferrer"} | EU regulation for products with digital elements | Reporting actively exploited vulnerabilities from September 2026, then security-by-design requirements and support periods from December 2027 |

These baselines converge on the same short list: unique credentials, a way to report vulnerabilities, secure updates for a stated period, and protected storage of keys. A design that follows this guide covers most of it.

---

## Security Across the Device Lifecycle

Each stage of a device's life has a security action that later stages cannot make up for.

| Stage | Security action |
|---|---|
| Design | Threat-model the device and its deployment: what data it handles, where it sits physically, who would attack it, and what a compromise enables |
| Manufacturing | Inject a unique identity and key material in a controlled environment, ideally generated inside a secure element |
| Deployment | Disable unused interfaces and debug ports, place the device in its network segment, and confirm its firmware is current |
| Operation | Apply updates, monitor behavior, rotate credentials, and keep an inventory of devices and firmware versions |
| Decommissioning | Revoke the identity in the service and erase keys and data before disposal or reuse; destroy devices that cannot erase their keys |

A gap at any stage stays exploitable long after the stage has passed. A shared key injected at manufacturing cannot be fixed by monitoring, and a device discarded with its keys intact leaks them no matter how well it was run.
