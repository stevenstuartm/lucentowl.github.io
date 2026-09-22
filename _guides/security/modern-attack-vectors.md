---
title: "Threat Actors and Attack Techniques"
layout: guide
category: Security
subcategory: Security Fundamentals
description: "Who attacks systems and why, from opportunistic criminals to nation-state groups and insiders, and how an intrusion unfolds: the kill chain and ATT&CK tactics, the common ways attackers get in (stolen credentials, exploited edge devices, phishing and social engineering, supply chain), network attacks, and ransomware and extortion."
tags: [fundamentals, threat-actors, mitre-attack, kill-chain, social-engineering, ransomware, phishing]
---

## Who Attacks, and Why

Defenses are chosen against an adversary, whether or not anyone names one. A control that stops an opportunistic scanner may do nothing against a patient, funded group, and a control built for a nation-state may be expensive overkill for a small retailer. Threat actors are usually classified by motivation and capability, because those two things predict what they will try and how long they will keep trying.

| Actor | Motivation | Capability and persistence | What they typically do |
|---|---|---|---|
| **Opportunistic attackers** | Easy money, notoriety | Low to moderate. They use public exploits and automated scanning against whatever is exposed | Mass exploitation of unpatched internet-facing software, credential stuffing |
| **Organized cybercrime** | Financial gain | Moderate to high, and run like businesses with specialized roles | Ransomware, data theft for extortion, business email compromise, fraud |
| **Hacktivists** | Political or social causes | Varies widely | DDoS, defacement, leaking stolen data |
| **Nation-state groups** | Espionage, strategic advantage, pre-positioning for disruption | High, well funded, patient | Zero-day exploitation, supply chain compromise, long-term covert access |
| **Insiders** | Grievance, money, coercion, or no intent at all | Already hold legitimate access | Data theft, sabotage, accidental exposure |

Two points complicate the table. First, the categories blur. Some state-linked groups also run ransomware for revenue, and criminal groups buy access from specialists called initial access brokers, who break in and sell the foothold. Second, capability is for sale. Ransomware-as-a-service lets an affiliate with modest skills rent a mature toolkit in exchange for a share of the ransom, so the sophistication of an attack no longer says much about the sophistication of the attacker.

Nation-state groups are often called **advanced persistent threats (APTs)**. "Persistent" is the operative word. These groups pursue a specific target over months or years, and if one path is closed they look for another.

### Insider Threats

Insiders are hard to defend against because the access they misuse is access they were legitimately given. They fall into three groups:

- **Malicious insiders** deliberately steal or sabotage, often around a resignation or dismissal.
- **Negligent insiders** cause harm by mistake, such as by misconfiguring a storage bucket, emailing the wrong file, or falling for phishing.
- **Compromised insiders** are legitimate accounts controlled by an outside attacker, which to most monitoring look exactly like the employee.

Least privilege, separation of duties, and prompt access removal when people change roles or leave limit what any insider can do. Monitoring for unusual behavior by a known identity, such as bulk downloads or access to systems outside a person's normal work, is how the compromised and malicious cases are usually found.

---

## How an Intrusion Unfolds

A breach is rarely a single event. It is a sequence of steps, and a defender who can interrupt any step can stop the attack. Two models describe that sequence.

The **Cyber Kill Chain**, published by Lockheed Martin in 2011, describes seven stages: reconnaissance, weaponization, delivery, exploitation, installation, command and control, and actions on objectives. Its lasting contribution is the idea that defenders do not need to win at every stage, only at one. Its limitation is that it was shaped around malware delivered from outside, and it says little about what happens after an attacker is inside, or about attacks that use stolen credentials and never deliver malware at all.

[MITRE ATT&CK](https://attack.mitre.org/){:target="_blank" rel="noopener noreferrer"} fills that gap. It is a knowledge base of techniques observed in real intrusions, organized under **tactics**, which are the attacker's goals at each point. The Enterprise matrix currently lists fifteen tactics. Grouped by where they fall in an intrusion:

| Phase | ATT&CK tactics | What the attacker is doing |
|---|---|---|
| Preparing | Reconnaissance, Resource Development | Learning about the target, acquiring infrastructure, accounts, and tools |
| Getting in | Initial Access, Execution | Gaining a foothold and running code on it |
| Staying in | Persistence, Privilege Escalation, Stealth, Defense Impairment | Surviving reboots and password changes, gaining higher rights, avoiding detection, disabling security tooling |
| Expanding | Credential Access, Discovery, Lateral Movement | Harvesting credentials, mapping the environment, moving to other systems |
| Acting | Collection, Command and Control, Exfiltration, Impact | Gathering data, communicating with attacker infrastructure, stealing data, encrypting or destroying systems |

Under each tactic sit techniques, such as *Valid Accounts* or *Exploit Public-Facing Application*, each with documented examples, detections, and mitigations. The practical lesson from the model is how much of an intrusion happens after initial access. An organization that invests only in keeping attackers out has no answer for the many steps that follow a successful phishing email.

A common pattern in the later phases is **living off the land**. Attackers use tools already present on the system, such as PowerShell, remote administration tools, and cloud provider CLIs, rather than bringing their own malware. The activity looks like administration, so signature-based detection sees nothing, and defenders have to look instead for administration that is unusual for that account, host, or time.

---

## How Attackers Get In

Initial access is where most defensive investment goes. The [Verizon 2025 Data Breach Investigations Report](https://www.verizon.com/about/news/2025-data-breach-investigations-report){:target="_blank" rel="noopener noreferrer"} found credential abuse (22%) and exploitation of vulnerabilities (20%) to be the leading initial access vectors in the breaches it analyzed, with third-party involvement in 30% of breaches.

### Stolen and Weak Credentials

Logging in is easier than breaking in. Attackers obtain credentials from earlier breaches, from phishing, and from infostealer malware on personal devices, then use them against VPNs, email, cloud consoles, and SaaS applications. **Credential stuffing** replays username and password pairs leaked from one site against many others, which works because people reuse passwords. **Password spraying** tries a few common passwords against many accounts, staying under per-account lockout thresholds.

Multi-factor authentication stops most of this, but not all. **MFA fatigue** (push bombing) floods a user with approval prompts until one is accepted. **Adversary-in-the-middle phishing** proxies a real login page, capturing both the password and the resulting session cookie, which bypasses one-time codes and push approvals entirely. Phishing-resistant authenticators such as passkeys and hardware security keys defeat both, because they are bound to the legitimate site's origin and will not authenticate to a lookalike.

### Exploiting Exposed Systems

Internet-facing software with a known vulnerability is found by automated scanning within hours or days of the vulnerability becoming public. Edge devices, such as VPN concentrators, firewalls, and file transfer appliances, are frequent targets because they are exposed by design, sit in a privileged network position, and often lack endpoint monitoring. Exploitation of custom web applications through injection and access control flaws is the application-level version of the same vector.

### Phishing and Social Engineering

Social engineering manipulates people rather than systems. It relies on a small set of psychological levers: authority (a message from the CEO or IT), urgency (act before the account is closed), fear, helpfulness, and familiarity. Channel and targeting vary:

| Variant | Channel and target |
|---|---|
| **Phishing** | Mass email that lures recipients to a credential page or malicious attachment |
| **Spear phishing** | Email crafted for a specific person using research about them |
| **Whaling** | Spear phishing aimed at executives |
| **Vishing** | Voice calls, often impersonating IT support or a bank |
| **Smishing** | SMS and messaging apps |
| **Business email compromise (BEC)** | A compromised or spoofed business email account used to redirect payments or request sensitive data |
| **Help desk social engineering** | Calling the IT help desk as an employee to get a password or MFA device reset |

Business email compromise often involves no malware or link at all, only a convincing request to change a supplier's bank details, which is why it bypasses technical email filters. The defense is procedural. Payment detail changes are verified through a known channel, not the one the request arrived on. Help desk resets follow the same logic: verifying identity by something an attacker cannot look up on social media.

Generative AI has lowered the cost of well-written, personalized lures, and voice and video cloning make impersonation by phone or video call more convincing. The procedural defenses do not depend on spotting a fake, which is why they hold up where "look for spelling mistakes" training does not.

Two related techniques target where victims go rather than what they receive. **Typosquatting** registers domains that resemble legitimate ones. A **watering hole** attack compromises a website the target group is known to visit and serves malware from it.

### Supply Chain Compromise

An attacker who compromises a supplier reaches every customer of that supplier. This includes a malicious update pushed through a vendor's legitimate update mechanism, a compromised open source package, or a managed service provider whose remote access tools reach into client networks. The attack is effective because the victim's own trust relationships deliver it. The defenses are knowing what software and suppliers the organization depends on, verifying the integrity of what they deliver, and giving third parties only the access they need, with monitoring on it.

---

## Network Attacks

Network attacks target the path between systems rather than the systems themselves.

**Adversary-in-the-middle (AitM)**, historically called man-in-the-middle, places the attacker between two parties so they can read or alter traffic. Techniques include rogue Wi-Fi access points, ARP spoofing on a local network, and DNS spoofing that resolves a legitimate name to an attacker's address. TLS with proper certificate validation defeats most of them, because the attacker cannot present a valid certificate for the real domain. The residual risk is in clients that skip certificate validation, and in users who click through certificate warnings.

**Denial of service (DoS)** attacks availability. A distributed attack (DDoS) uses many sources, usually a botnet of compromised devices, so it cannot be blocked by filtering one address.

| Type | What it exhausts | Example |
|---|---|---|
| **Volumetric** | Network bandwidth | UDP floods, amplification attacks using open DNS or NTP servers |
| **Protocol** | Connection state in servers, firewalls, and load balancers | SYN floods |
| **Application layer** | Application resources, with traffic that looks legitimate | Floods of expensive search or login requests |

Application layer attacks are the hardest to distinguish from real users, and the ones an application's own design can do most about, by rate limiting and by making expensive operations cheaper or cacheable.

---

## Ransomware and Extortion

Ransomware is the most visible outcome of an intrusion rather than a way in. The Verizon 2025 report found it present in 44% of the breaches it analyzed. It arrives at the end of the progression described above. Attackers gain initial access, escalate privileges, move laterally, disable or delete backups, and then encrypt systems across the environment at once.

Modern ransomware groups usually steal data before encrypting it. This **double extortion** means that restoring from backup, which defeats encryption alone, does not end the incident, because the attacker still threatens to publish the stolen data. Some groups skip encryption entirely and extort on the stolen data alone.

Two consequences follow for defenders. Backups have to be protected from an attacker holding administrator credentials, which means copies that are offline or immutable. Detection has to happen earlier in the chain, during lateral movement and data staging, because by the time encryption starts the data has usually already left.

---

## Common Pitfalls

- **Defending against an imagined adversary.** Spending on nation-state defenses while leaving internet-facing systems unpatched, or the reverse. Match investment to the actors who realistically target the organization.
- **Treating MFA as the end of credential risk.** Push approvals and one-time codes can be phished or fatigued. Phishing-resistant authentication and help desk verification close the gaps.
- **Awareness training as the only phishing control.** Some fraction of users will always click. Technical controls that limit what a phished account can do, and procedures for payments and resets, matter more.
- **Ignoring post-access detection.** Most of the ATT&CK matrix happens after initial access. Without visibility into credential use and lateral movement, the first sign of an intrusion is the ransom note.
- **Assuming backups solve ransomware.** Backups reachable with domain administrator credentials are deleted first, and backups do nothing about stolen data.
