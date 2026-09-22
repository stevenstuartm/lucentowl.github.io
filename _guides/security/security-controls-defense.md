---
title: "Security Controls and Defense"
layout: guide
category: Security
subcategory: Security Operations
description: "The controls that protect infrastructure and the stack that detects attacks against it: network segmentation, firewalls, IDS/IPS, WAF and DDoS mitigation, endpoint protection and hardening, zero trust architecture and its policy decision and enforcement points, cloud shared responsibility and posture management, container and Kubernetes controls, and the SIEM, XDR, SOAR, and threat intelligence that turn signals into response."
tags: [practical, zero-trust, network-segmentation, edr, siem, cloud-security, kubernetes]
---

## Preventive, Detective, and Responsive

Controls do three different jobs, and a program that buys only one kind has a predictable weakness. **Preventive** controls stop an action: a firewall rule, an authorization check, an encrypted disk. **Detective** controls notice that something happened: logging, intrusion detection, anomaly alerts. **Responsive** controls act on what was noticed: isolating a host, revoking a session, blocking an address.

Prevention alone fails silently. Every preventive control has a bypass, and without detection nobody learns which one was used until the damage surfaces. Detection alone produces alerts nobody acts on. The proportion that suits an organization depends on how quickly it could respond, which is why detection investment is wasted without someone, in-house or contracted, who will act on it at three in the morning.

Controls are also usefully sorted by where they sit: the network, the endpoint, the workload, the identity, and the data. The layers matter because they fail independently, which is what makes defense in depth work in practice rather than as a slogan.

---

## Network Controls

### Segmentation

Segmentation divides a network into zones and controls traffic between them, so that compromising one system does not grant reach to all the others. A flat network is what turns a single phished laptop into an enterprise-wide ransomware event, because every server is reachable from every workstation.

The classic pattern separates public-facing systems (a DMZ), application servers, databases, and management interfaces, with each zone permitting only the traffic the next tier legitimately needs. Databases accept connections from application servers and nothing else. Management interfaces accept connections only from a bastion or a privileged access workstation. Segments are also drawn around trust and regulation: card data environments, OT and industrial systems, guest wireless, and third-party access each belong in their own zone, partly to contain compromise and partly to keep audit scope small.

**Microsegmentation** takes this to the workload level, where policy is attached to the workload's identity rather than to its address, so a rule follows a service as it moves or scales. Cloud security groups, host firewalls, and service mesh policies are the common implementations.

Segmentation is only as good as the rules between zones. The usual decay is a broad "temporary" allow rule that is never removed, so periodic review of rules against what traffic actually flows is part of running it.

### Firewalls

A traditional firewall filters by address, port, and protocol, and keeps connection state. A **next-generation firewall (NGFW)** adds identification of the application inside the traffic, user identity from a directory, integrated intrusion prevention, and optional TLS inspection. That matters because port numbers stopped indicating application behavior once everything moved to HTTPS.

Firewall policy follows one rule above all: **default deny**. Traffic is blocked unless a rule permits it, in both directions. Egress filtering is the half that is usually missing, and it is what constrains malware from reaching its command and control server and data from being sent out.

TLS inspection, which decrypts traffic to examine it, is a genuine trade-off rather than an obvious win. It creates a point where all traffic is in plaintext, breaks certificate pinning, and carries privacy obligations. Most organizations that use it exclude categories such as banking and health, and protect the inspection point heavily.

### Intrusion Detection and Prevention

An **IDS** watches traffic and alerts. An **IPS** sits in line and blocks. Detection uses signatures for known attack patterns, which are precise but blind to anything new, and anomaly or behavioral analysis, which can catch novel activity and produces more false positives.

Tuning is the whole job. An IPS in blocking mode with untuned rules will eventually drop legitimate traffic, and an IDS with untuned rules produces an alert stream nobody reads. Most deployments start in detection mode, tune against the environment's real traffic, then enable blocking for the rules that have proven reliable.

### Web Application Firewalls

A WAF inspects HTTP requests, usually with a managed rule set such as the OWASP Core Rule Set plus application-specific rules. It buys time: it blocks mass exploitation of a newly published vulnerability while a patch is prepared, stops opportunistic scanning noise, and provides rate limiting and bot controls at the edge.

What it cannot do is fix an application flaw. A WAF sees requests, not intent, so it cannot know that this authenticated user should not be reading that customer's invoice. Rules that are strict enough to catch determined attackers also block legitimate traffic, so production deployments run somewhere between the two, and a bypass is usually a matter of encoding or a request shape the rules did not anticipate.

### DDoS Mitigation

Volumetric attacks exceed the capacity of any single site, so mitigation depends on capacity larger than the attack, which in practice means a cloud scrubbing service or CDN that absorbs and filters traffic upstream. Protocol attacks are handled by the same providers and by hardened network equipment. Application-layer attacks need rate limiting, caching, and the ability to distinguish a real user from an expensive automated request, which is application work.

The controls to arrange before an attack are the ones people forget: knowing which provider to call, having DNS and routing able to redirect traffic quickly, and knowing what the application's actual capacity limits are.

---

## Endpoint Controls

Endpoints are where users read email, and therefore where most intrusions begin.

**Endpoint detection and response (EDR)** replaced signature-only antivirus because malware stopped being a static file to match. EDR records process execution, file and registry changes, and network connections, detects on behavior, and gives responders the ability to isolate a host, kill a process, and retrieve forensic detail remotely. **Managed detection and response (MDR)** is the same capability with a provider's analysts watching it, which is how most organizations without a 24-hour team get useful coverage.

Around it sit the controls that reduce what an attacker can do on a compromised machine:

- **Hardening and secure configuration** against a benchmark such as the CIS Benchmarks, removing unnecessary services and default credentials.
- **Application control** (allowlisting) so that only approved executables and scripts run. It is highly effective and operationally demanding.
- **Disk encryption** with keys escrowed centrally, so a lost laptop is an inconvenience rather than a disclosure.
- **Local administrator rights removed** from everyday accounts, which blocks a large share of the techniques that follow initial execution.
- **Mobile device management** to enforce encryption, screen lock, patch level, and remote wipe, and to separate work data on personal devices.

Patching belongs here too, and it is covered as part of vulnerability management, where prioritization decides what gets patched first.

---

## Zero Trust Architecture

Perimeter security assumed that location implied trust: inside the network was safe, outside was not. Remote work, cloud services, and lateral movement after a single phished credential each broke that assumption independently.

Zero trust replaces location with a per-request decision. [NIST SP 800-207](https://csrc.nist.gov/pubs/sp/800/207/final){:target="_blank" rel="noopener noreferrer"} describes the model in terms of three logical components. The **policy engine** decides whether to grant access, using identity, device posture, the resource's sensitivity, and signals such as behavior and threat intelligence. The **policy administrator** carries out that decision by establishing or terminating the session. The **policy enforcement point** sits in the path of the request and actually allows or refuses the traffic.

{% include figure.html id="sec-zero-trust-pdp-pep" %}

Three principles follow from the model:

- **Verify explicitly.** Authenticate and authorize every request on its own evidence, not on the basis of the network it came from or an earlier decision.
- **Least privilege access.** Grant narrow, time-bound access to the specific resource, rather than network-level access to everything that resource sits beside.
- **Assume breach.** Segment, encrypt internal traffic, and monitor as though an attacker is already inside, because eventually one is.

In practice, adoption is incremental rather than a product purchase. The common sequence is strong identity first (phishing-resistant MFA, conditional access on device posture), then replacing VPN-based network access with per-application access, then microsegmentation between workloads, with monitoring throughout. Progress is measured by how little an attacker gains from a foothold, not by which products are deployed.

---

## Cloud Controls

### Shared Responsibility

Cloud providers secure the infrastructure; customers secure what they put on it. The dividing line moves with the service model, and misreading it is a leading cause of cloud breaches.

| Layer | IaaS | PaaS | SaaS |
|---|---|---|---|
| Physical, network, hypervisor | Provider | Provider | Provider |
| Operating system, patching | Customer | Provider | Provider |
| Runtime and platform | Customer | Provider | Provider |
| Application code | Customer | Customer | Provider |
| Configuration and access control | Customer | Customer | Customer |
| Data and its classification | Customer | Customer | Customer |

The last two rows never move. Identity, permissions, configuration, and data protection remain the customer's responsibility in every model, and they are where nearly all cloud incidents occur: a storage bucket made public, an over-permissive role, a management port exposed, credentials in a repository.

### Posture and Workload Protection

Cloud environments change constantly and through many hands, so configuration drifts. Several tool categories address different parts of the problem:

| Category | What it does |
|---|---|
| **CSPM** (posture management) | Continuously checks configuration against benchmarks and flags risky settings such as public storage or unused wide-open roles |
| **CWPP** (workload protection) | Protects running workloads: vulnerability and malware detection, runtime behavior monitoring for VMs, containers, and functions |
| **CIEM** (entitlement management) | Analyzes permissions to find excessive and unused entitlements, the cloud version of least privilege |
| **CASB** (access security broker) | Governs use of SaaS applications, including shadow IT discovery and data controls |
| **CNAPP** | A combined platform covering the above plus scanning earlier in the pipeline |

Two cloud-specific controls do disproportionate work. Guardrails expressed as policy (such as service control policies or Azure Policy) prevent whole classes of misconfiguration at the account or subscription level rather than detecting them afterward. And protecting the instance metadata service matters because it issues workload credentials, which is what makes SSRF against a cloud workload so damaging.

### Containers and Kubernetes

Container security starts in the build: minimal base images, no secrets baked into layers, images scanned for vulnerabilities, and images signed so that only verified artifacts are deployed.

At runtime, the controls that matter most are the ones that limit a compromised container:

- **Run as a non-root user**, with a read-only root filesystem and all unnecessary Linux capabilities dropped.
- **Disallow privilege escalation and privileged containers**, which effectively grant host access. In Kubernetes these are enforced through Pod Security Admission, or a policy engine for finer rules.
- **Set resource limits**, so one workload cannot starve the node.
- **Default-deny network policies** between pods, since the cluster network is flat by default and any pod can otherwise reach any other.
- **Scoped service accounts**, because the default one is frequently over-permissioned and its token is inside the pod.
- **Protect the control plane**: the API server is the cluster's crown jewels, so authentication, RBAC, audit logging, and restricted network exposure apply to it above all.

---

## Detection and Response

Controls generate signals. The detection stack turns signals into action.

**SIEM** collects and correlates logs from across the environment, applies detection rules, and supports investigation and retention for compliance. Its value depends on what it ingests, which is a budget question, and on rule quality, which is an ongoing engineering job rather than a deployment task. Current platforms include Splunk, Microsoft Sentinel, Google Security Operations, IBM QRadar, and Elastic-based stacks.

**XDR** takes a narrower, deeper approach, correlating telemetry from endpoint, identity, email, and cloud within one vendor's ecosystem. It produces higher-fidelity detections with far less tuning than a SIEM, and covers only what the vendor's sensors see, which is why many organizations run both.

**SOAR** automates response: enrich an alert with threat intelligence, check the user's recent activity, disable an account, isolate a host, open a ticket. Automation is what makes alert volume survivable, and playbooks are best introduced for the repetitive, low-judgment steps first.

**Threat intelligence** supplies context: indicators, adversary techniques, and reporting on what is currently being exploited. It pays off when it changes something, by driving detection rules, prioritizing patching, or informing hunting. Feeds ingested without that connection add noise and cost.

**Threat hunting** assumes something has evaded detection and looks for it deliberately, starting from a hypothesis drawn from attacker techniques rather than from an alert. Its output is often a new detection rule, which is how hunting compounds rather than repeating.

The measures that indicate whether this works are how long it takes to detect an intrusion, how long to contain it, what share of alerts are false positives, and what coverage exists against the techniques an organization expects to face, commonly mapped against ATT&CK.

---

## Common Pitfalls

- **A flat internal network.** The most expensive control gap in most ransomware incidents.
- **No egress filtering.** Inbound rules are carefully managed while anything can connect out.
- **Blocking mode before tuning.** IPS and WAF rules that break production get disabled entirely, leaving nothing.
- **A WAF used to defer fixing the application.** It is a shield, not a patch.
- **Tools bought without operators.** EDR, SIEM, and CSPM all generate work. Without someone doing that work, they produce dashboards.
- **Assuming the cloud provider handles it.** Configuration, identity, and data remain yours in every service model.
- **Default Kubernetes settings.** No network policy, permissive service accounts, and containers running as root are the defaults, and defaults are what attackers expect.
