---
title: "IIoT Security and Functional Safety"
layout: guide
category: IoT
subcategory: Industrial IoT
description: "Securing industrial systems and keeping connections from undermining safety: the IEC 62443 series with its roles, zones and conduits, foundational requirements, and security levels; passive OT monitoring; OT incident response and patch policy; sector regulation; and safety instrumented systems, SIL, and the independence IIoT must preserve."
tags: [advanced, iec-62443, ot-security, zones-and-conduits, safety-instrumented-systems, sil, iec-61511]
---

## IEC 62443: Industrial Cybersecurity

The [ISA/IEC 62443 series](https://www.isa.org/standards-and-publications/isa-standards/isa-iec-62443-series-of-standards){:target="_blank" rel="noopener noreferrer"} is the international standard for securing industrial automation and control systems (IACS). It was developed by the ISA99 committee and the IEC, and it assigns responsibilities across everyone involved in a control system's life, not just the organization that runs it.

### How the Series Is Organized

| Part | Addresses | Examples |
|---|---|---|
| 62443-1 | General: concepts, models, terminology | The shared vocabulary, including zones, conduits, and security levels |
| 62443-2 | Policies and procedures for asset owners and service providers | Security program requirements (2-1), patch management (2-3), requirements for integrators and maintenance providers (2-4) |
| 62443-3 | System requirements | Risk assessment and zone and conduit design (3-2), system security requirements and security levels (3-3) |
| 62443-4 | Component requirements for product suppliers | Secure product development lifecycle (4-1), technical requirements for components (4-2) |

The split follows the roles. **Product suppliers** build components with security capabilities and develop them under a secure lifecycle (parts 4-1 and 4-2). **System integrators** design and commission systems that use those capabilities to meet a target (parts 2-4, 3-2, and 3-3). **Asset owners** run a security program and keep the system secure over its life (part 2-1 and the rest of part 2). This makes 62443 a procurement tool as much as an engineering one. An asset owner can require components certified to 4-2 at a given security level and integrators working to 2-4, and a device that was never designed for 4-2 may lack capabilities that no network control can add afterwards.

### Zones and Conduits

A **zone** groups assets that share security requirements and protections. Purdue levels are a natural starting point, but zones are usually finer. A packaging line and a chemical dosing system may both sit at level 1 and still belong in different zones because a compromise of each has very different consequences.

A **conduit** is a communication path between zones. Every conduit is defined explicitly, with what traffic it permits, how it authenticates, and how it is monitored. Requiring every conduit to be listed forces an inventory of how OT systems actually communicate, which is often the first complete picture a site has ever had. Connections nobody documented turn up during that exercise, not after an incident.

Zones and conduits come out of a risk assessment (62443-3-2). The assessment decides each zone's boundaries and its target security level, based on the consequences of compromise and the likely attackers.

### Foundational Requirements and Security Levels

Part 3-3 groups system requirements under seven **foundational requirements**: identification and authentication control, use control, system integrity, data confidentiality, restricted data flow, timely response to events, and resource availability. Each requirement has enhancements that apply at higher security levels.

Security levels describe the attacker a zone is meant to withstand.

| Level | Protects against |
|---|---|
| SL 1 | Casual or coincidental violation |
| SL 2 | Intentional violation using simple means, low resources, generic skills, and low motivation |
| SL 3 | Intentional violation using sophisticated means, moderate resources, IACS-specific skills, and moderate motivation |
| SL 4 | Intentional violation using sophisticated means, extended resources, IACS-specific skills, and high motivation |

The same scale is used three ways. The **target** level (SL-T) is what the risk assessment says a zone needs. The **capability** level (SL-C) is what a component or system can reach when properly configured. The **achieved** level (SL-A) is what the deployed zone actually delivers. Gaps between them drive the remediation plan. A zone targeting SL 3 built from components capable of SL 1 needs new components, compensating controls at the zone boundary, such as a conduit that allows only specific read traffic, or a documented exception accepted by the risk owner.

SL 2 is [argued by ISASecure](https://www.isasecure.org/hubfs/The-Case-for-ISA-IEC-62443-Security-Level-2-as-a-Minimum-FINAL.pdf){:target="_blank" rel="noopener noreferrer"} to be a sensible minimum for OT networks, since its attacker (intentional, but using generic tools and skills) covers opportunistic ransomware and insiders. Higher targets come from the risk assessment, not from habit.

---

## OT Security Operations

### Passive Monitoring

IT security tools do not transfer cleanly to OT. An intrusion detection system tuned for IT may flag a SCADA server polling sixty PLCs every second as a scan, while missing a single Modbus write that changes a setpoint. Active scanning, which IT relies on for asset discovery, can crash fragile controllers.

OT security monitoring platforms, such as those from Claroty, Dragos, Nozomi Networks, and Microsoft Defender for IoT, instead observe traffic passively from switch mirror ports or network taps, decode industrial protocols, and learn which devices exist and how they normally talk. The anomalies that matter in OT are specific:

- An engineering workstation connecting to a controller outside a change window, which is how control logic gets altered
- A firmware download or program change to a PLC
- A write to a register or tag that has only ever been read
- A device that is not in the asset inventory appearing on the network
- A new conduit, such as a direct connection between zones that should only talk through the DMZ

Because they build an asset inventory from traffic, these platforms also answer a question many sites cannot otherwise answer, namely what is actually on the network.

### Incident Response

IT incident response isolates first, which often means taking systems offline. In OT, taking a controller offline can mean an uncontrolled process, a safety shutdown, or lost product, so response has to keep the process safe while it investigates. That needs planning per critical system before any incident: which systems can be isolated and how, what manual operation looks like, which network conduits can be cut without affecting control, and who decides. Operations leadership has to approve those procedures in advance, because nobody should be negotiating them during an incident. Recovery also has to restore known-good controller logic and configuration, so current, verified backups of PLC programs are part of incident readiness.

### Patch Policy

OT change management minimizes change to protect stability. Security practice wants prompt patching. Neither can simply win, so the tension has to be settled in explicit policy per class of system (62443-2-3 covers patch management).

- **Cloud and IT-side components** of an IIoT platform, separated from control by the DMZ, can follow normal IT patch cadences.
- **Edge gateways and protocol bridges** inside the plant need patches validated against operating schedules, because a failed gateway stops data collection from every controller it serves.
- **Controllers and safety systems** are patched in planned windows after vendor qualification, and in the meantime vulnerabilities are mitigated with compensating controls at the zone boundary.

A software bill of materials for every IIoT component, including edge software and its open-source dependencies, shows which systems a newly published vulnerability affects.

### Sector Regulation

Critical-infrastructure sectors add their own requirements on top of 62443. US drinking water is a clear example. Under the Safe Drinking Water Act as amended by America's Water Infrastructure Act of 2018, community water systems serving more than 3,300 people must complete a risk and resilience assessment and an emergency response plan, both of which cover the security of their electronic and automated systems. EPA's 2023 attempt to require cybersecurity evaluation in state sanitary surveys was [withdrawn in October 2023](https://www.epa.gov/waterresilience/cybersecurity-sanitary-surveys){:target="_blank" rel="noopener noreferrer"} after litigation. Electric utilities in North America follow NERC CIP, and in the EU, operators designated under NIS2 carry cybersecurity obligations. An IIoT design in these sectors has to satisfy the regulator as well as operations.

---

## Safety Instrumented Systems

A **safety instrumented system (SIS)** is the automated layer that brings a process to a safe state when it moves beyond safe limits. The basic process control system runs normal operation. The SIS watches critical variables on its own and acts regardless of what the control system is doing.

An SIS has three parts. **Sensors** measure critical variables like pressure, temperature, and level. A **logic solver**, a controller designed and certified for safety use, runs the safety logic. **Final elements** such as shutdown valves and motor trips take the action. The SIS is kept independent of the process control system in sensors, logic, and final elements, so that a fault in control cannot also stop the protection.

### Safety Integrity Levels

[IEC 61508](https://www.iec.ch/functional-safety){:target="_blank" rel="noopener noreferrer"} is the base functional safety standard, and IEC 61511 applies it to the process industries. Each safety function is assigned a **safety integrity level (SIL)** that sets how much risk reduction it must deliver. For functions demanded rarely (low demand mode), each SIL corresponds to a range of average probability of failure on demand.

| SIL | Average probability of failure on demand | Risk reduction factor |
|---|---|---|
| SIL 1 | 0.01 to 0.1 | 10 to 100 |
| SIL 2 | 0.001 to 0.01 | 100 to 1,000 |
| SIL 3 | 0.0001 to 0.001 | 1,000 to 10,000 |
| SIL 4 | 0.00001 to 0.0001 | 10,000 to 100,000 |

Reaching a SIL needs both hardware reliability (redundancy, diagnostics, proof testing) and systematic discipline in design, verification, and change management. SIL 4 is rare in the process sector.

The required SIL comes from a hazard and risk assessment. **Layer of protection analysis (LOPA)** is a common method. It starts from how often an initiating event occurs, credits each independent protection layer (the control system, alarms with operator response, relief valves, the SIS) with the risk reduction it provides, and assigns the SIS whatever reduction is still needed to reach a tolerable frequency. Risk graphs and risk matrices are also used.

### Independence Is What IIoT Can Break

A layer earns LOPA credit only if it is independent of the initiating cause and of the other credited layers. If one transmitter feeds both the control system and the SIS, its failure can disable both, and only one layer gets credit. That logic extends to anything IIoT adds. A data collection path that shares sensors, network switches, power supplies, or writable interfaces with a safety layer can quietly invalidate the assumptions the site's safety case rests on.

The rules for IIoT connections to safety systems follow from that:

- **Read only, enforced by the system.** Any interface that exposes SIS data, such as an OPC UA server on a safety controller, must be unable to write to the safety logic or accept commands. A read-only setting in a client configuration does not count. The safety system itself must refuse writes.
- **Use the vendor's monitoring interface.** Many safety system vendors provide a separate interface for monitoring and integration, isolated from the safety logic. IIoT connects there, not to the safety network.
- **No shared paths.** Data collection should not share switches, power, or sensors with safety functions in ways the safety case did not assess.
- **Treat changes as safety changes.** Adding an IIoT connection to an SIS goes through the site's functional safety management of change, not IT change control.

These are not tradeoffs to balance against data value. They follow from the functional safety standards, and a design that cannot meet them should not connect to the safety system.
