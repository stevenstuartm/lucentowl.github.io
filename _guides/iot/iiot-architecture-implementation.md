---
title: "IIoT Integration Architecture"
layout: guide
category: IoT
subcategory: Industrial IoT
description: "Getting plant data out without putting operations at risk: read-only integration with SCADA and historians, protocol bridging, polling versus OPC UA subscriptions and dead-band, a reference OT-to-cloud architecture through the DMZ, industrial edge hardware, brownfield versus greenfield, contextualization with ISA-95, manufacturing digital twins, and IT-OT organization."
tags: [practical, opc-ua, protocol-gateway, brownfield, isa-95, manufacturing-digital-twin, it-ot-convergence]
---

## Integrating Without Touching Control

Industrial integration has one rule that outranks the rest. Nothing added for data collection may put control at risk. In practice that means four things.

- **Read only.** The integration reads values. It does not write setpoints, acknowledge alarms, or change configuration on controllers, SCADA, or the historian.
- **Fail silent.** If the integration path fails, control and SCADA carry on exactly as before. Nothing in the control path depends on the integration being up.
- **Bounded load.** Polling rates and connection counts stay within what each device was designed to serve alongside its control work.
- **No new inbound paths.** Data leaves the plant through the DMZ on connections the plant side initiates, and nothing outside can open a connection in.

Everything below applies those rules.

### Where to Read From

There are usually several places the same data can be read, and the choice trades richness against risk.

| Source | Pros | Cons |
|---|---|---|
| OPC UA server on a PLC or controller | Direct, with structure and metadata | Adds load on the controller; older units may not have one |
| SCADA's OPC UA server | One connection covers many controllers; SCADA already polls them | Only what SCADA already collects, at SCADA's rates |
| OPC Classic (DA) on older SCADA | Common on Windows-based systems of a certain age | Needs a wrapper or gateway to convert to OPC UA, since DCOM does not cross networks cleanly |
| The plant historian or its DMZ replica | No load on control at all; years of history | Delayed and possibly compressed data |
| A new sensor installed for monitoring | No interaction with control whatsoever | Hardware and installation cost |

The historian is often the lowest-risk source for analytics that tolerate a delay, and a replica in the DMZ is lower risk still. Direct reads from controllers suit data that needs to be fresher or finer than SCADA collects.

---

## Protocol Bridging

A **protocol bridge** reads a device in its native protocol and republishes the values in a form the rest of the architecture understands, typically OPC UA or MQTT. For a Modbus PLC, the bridge polls registers on a schedule, maps each register to a tag name, converts raw values with the right data type and scaling into engineering units, and handles communication errors without retrying so aggressively that it loads the PLC. Commercial gateways and connectivity servers such as Kepware, HMS Anybus, and Moxa MGate support dozens of protocols at once and present a single OPC UA or MQTT interface upward.

The bridge's configuration is the valuable part. A plant with two hundred controllers across six protocol families has thousands of register-to-tag mappings, each with a type, scale, unit, and poll rate. Treat that configuration as a managed artifact, kept in version control, reviewed on change, and updated when equipment changes. Teams that treat it as a one-time commissioning task tend to lose the knowledge behind it when people leave.

---

## Polling, Subscriptions, and Dead-Band

### Polling

In a polling design, the gateway asks each device for its current values on a schedule. Modbus works only this way. Polling is simple to reason about and debug, and the gateway knows immediately when a device stops answering. But a change is seen only at the next poll, so latency is up to one poll interval, and polling faster adds load on controllers whose communication capacity is limited.

### OPC UA Subscriptions

OPC UA clients usually subscribe instead of polling. A client creates a **subscription** with a publishing interval, then adds **monitored items**, one per variable, each with its own settings.

- The **sampling interval** is how often the server checks the underlying value for changes.
- The **publishing interval** is how often the subscription sends the client a notification message containing whatever changed.
- A **queue size** per item holds several changes that occur between publications, so fast changes are not collapsed into one.
- A **deadband filter** suppresses changes smaller than an absolute amount or a percentage of the range.

A monitored item sampled every 500 milliseconds on a subscription publishing every second reports changes at half-second resolution, delivered in one-second batches. The server does the change detection, so an unchanged value costs nothing on the wire. If the connection drops briefly, the session and subscription survive on the server for a configured lifetime, and the client can ask for notifications it missed to be sent again. Older or minimal server implementations handle this recovery unevenly, so gateways should detect gaps rather than assume there are none. DNP3's unsolicited reporting gives utilities similar event-driven behavior.

### Dead-Band at the Gateway

Whatever the source, most process variables do not need every sample forwarded. **Dead-band filtering** forwards a value only when it moves more than a set amount from the last forwarded value, usually with a maximum interval so a stable value still reports periodically. A temperature wandering 0.1 degrees around its setpoint produces nothing, and a drift upward produces a message at each step. Set per tag, dead-band cuts volume sharply for slow variables while keeping meaningful changes prompt.

Every forwarding path out of the plant also needs a durable local buffer that holds data through a connectivity outage and drains it when the link returns.

### Choosing Per Data Stream

A site typically mixes patterns by data type.

| Data | Pattern | Why |
|---|---|---|
| Slow process variables (temperatures, levels, flows) | Subscription or polling with dead-band | Small, changes slowly, needed within seconds |
| Alarms and state changes | Subscription or unsolicited events | Must not be missed and must be time-stamped at the source |
| High-frequency signals (vibration, current waveforms) | Processed at the edge into features or spectra | Raw volume is too large to forward |
| Historical backfill and reports | Batch transfer from the historian replica | Latency is acceptable and the history already exists |

The deciding questions for each stream are how quickly the cloud needs to know, how much bandwidth and storage it may use, how long connectivity may be lost, and what a missed event costs. Recording the choice and the reason for each stream, in an architecture decision record, stops a later engineer from reversing it without knowing why it was made.

---

## A Reference Architecture

A typical OT-to-cloud design follows the Purdue levels. Controllers with OPC UA servers are read directly, legacy controllers go through a protocol gateway, and SCADA and the historian are read through their own interfaces. All of it feeds an edge gateway in the DMZ or at the level 3 boundary. The gateway subscribes, applies dead-band, buffers to disk, adds context such as asset and line identifiers, and publishes outbound over MQTT or AMQP with TLS to a cloud broker or ingestion service. From there data fans out to a time-series store, a context model of the plant, and analytics. Safety systems are read only through their vendor's isolated monitoring interface, if at all.

{% include figure.html id="iot-opcua-cloud-architecture" %}

Cloud platforms package this pattern. [Azure IoT Operations](https://learn.microsoft.com/en-us/azure/iot-operations/overview-iot-operations){:target="_blank" rel="noopener noreferrer"} runs on an Arc-enabled Kubernetes cluster at the site, with an MQTT broker, a connector that publishes OPC UA data to it, and data flows that transform and route data to the cloud. [AWS IoT SiteWise Edge](https://docs.aws.amazon.com/iot-sitewise/latest/userguide/gateways.html){:target="_blank" rel="noopener noreferrer"} collects from OPC UA and other industrial sources into asset models. Vendor-neutral stacks built from an OPC UA client, an MQTT broker, and a time-series database follow the same shape. Whatever the product, check that it keeps connections outbound only, buffers durably, and never needs write access to control systems.

---

## Industrial Edge Hardware

The general case for edge processing, covering bandwidth, latency, and operating through a lost connection, applies with extra force in plants, where high-frequency signals are large and a site cannot stop monitoring because its internet link failed.

| Tier | Examples | Typical role |
|---|---|---|
| Protocol gateway | Moxa MGate, HMS Anybus | Protocol conversion only, often DIN-rail mounted in a control cabinet |
| Edge gateway | Fanless ARM or x86 boxes from industrial vendors | Collection, dead-band, buffering, light analytics |
| Industrial PC | Siemens IPC, Beckhoff, and similar | Local historian, ML inference, several workloads at once |
| Edge server or cluster | Rack servers in a plant data room | Site-wide platforms such as Kubernetes-based edge stacks, many lines or plants |

Plant hardware has to survive the plant. That means fanless designs rated for wide temperature ranges, resistance to vibration and electrical noise, industrial power inputs, and certifications for the location, including hazardous-area ratings where flammable gases or dust are present. Office hardware fails quickly on a factory floor.

On the edge, **data reduction** turns raw signals into what the cloud needs, such as summary statistics per window, spectra from vibration, and dead-banded process values. **Event detection** marks when a machine starts, changes over, faults, or recovers, which gives the time series its context. A temperature spike at startup is normal, and the same spike in steady state is not. Models trained in the cloud can run on the same hardware for local anomaly scoring.

---

## Brownfield and Greenfield

**Greenfield** means designing a new installation with connectivity in mind. **Brownfield** means connecting equipment that was never designed for it, and most industrial projects are brownfield. A PLC installed twenty years ago running Modbus RTU over serial will stay in service, and the architecture has to work with it as it is.

### Brownfield

Serial Modbus needs a physical RS-485 or RS-232 connection, so a gateway has to be wired into the panel. The register map is often undocumented, surviving in an integrator's memory or a binder in the control room, and rebuilding it is often the longest part of the project. Every physical change needs a scheduled window, access to panels may need booking weeks ahead, and testing has to be coordinated with operations. Projects that underestimate that coordination tend to overrun.

**Passive capture** can avoid touching controllers at all. A tap on the existing network decodes the Modbus or PROFINET traffic already flowing between PLCs and SCADA, which adds no load and needs no configuration changes. It only sees what SCADA already requests, and it depends on correctly decoding traffic nobody designed to be read by a third party.

Equipment older than networking needs hardware. Transmitters digitize 4 to 20 mA analog signals, remote I/O modules gather many analog inputs onto one network connection, and wireless retrofit sensors clamp onto machines to add vibration or temperature monitoring without new wiring.

### Greenfield

Greenfield projects can specify controllers with native OPC UA servers, build the network with Purdue segmentation and a DMZ from day one, and provision certificates before equipment ships. They still take years, and today's greenfield plant is the next generation's brownfield.

Three mistakes recur. **Over-collecting** sends every available tag at full rate to the cloud, where it costs more to store and process than it returns, so decide what to collect, how often, and for how long before sizing infrastructure. **Under-modeling** configures tags like `Motor_1_Temp_1` without recording what they mean, their units, their ranges, or how they relate, so capture that in the OPC UA information model itself where possible. **Locking in at the connectivity layer** picks a proprietary path that works with one cloud or one analytics suite, when OPC UA for device access and MQTT for transport keep options open over a plant's decades-long life.

---

## Contextualization

A temperature of 87.3 °C means different things during warm-up and at steady state, on a heavy job and at idle, on a machine serviced last week and one overdue for service. **Contextualization** attaches that meaning to the time series.

**Production context** attaches the current order, product, recipe, shift, and material lot. With it, a quality problem in one batch can be traced to the exact process conditions, operators, and materials involved, and a recall can be limited to the affected window rather than a whole day's output.

**Equipment context** attaches the asset's identity, position in the plant hierarchy, maintenance state, and running hours. A slightly high vibration reading means more on a bearing four thousand hours past replacement than on one fitted last week. Getting this requires connecting to the maintenance management system (CMMS) that holds the service history.

[ISA-95](https://www.isa.org/standards-and-publications/isa-standards/isa-standards-committees/isa95){:target="_blank" rel="noopener noreferrer"} defines the vocabulary for this, covering the equipment hierarchy (enterprise, site, area, line, cell) and how production orders, personnel, equipment, and materials relate. Naming assets and structuring topics along ISA-95 lines, as the unified namespace pattern does with MQTT topics, makes plant data easier to join with ERP and MES data that follow the same model.

Regulated industries add integrity requirements. In the US, [21 CFR Part 11](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-A/part-11){:target="_blank" rel="noopener noreferrer"} governs electronic records that FDA regulations require, in pharmaceuticals, medical devices, and parts of food production, and EU GMP Annex 11 plays the same role in Europe. Data feeding those records needs audit trails, access control, and protection from alteration built in from the start. That rules out designs that let data be edited or silently dropped, however convenient.

---

## Manufacturing Digital Twins

In manufacturing, a **digital twin** is a model of a physical line, machine, or facility kept in sync with it through live data. It is a different thing from the per-device configuration document that IoT platforms also call a twin. The term covers everything from a dashboard with a 3D picture to a validated physics simulation. What sets a useful twin apart from a dashboard is that it represents structure and relationships, not just current values.

### Modeling a Line

A line twin records which machines exist, how material flows between them, their designed rates, and their live state. That supports analysis raw telemetry cannot. When output drops, the model shows that one station is at 70% of its design rate and its upstream buffer is empty, which points to a supply problem rather than a faulty station. When a quality issue appears, the twin's record of the conditions each unit saw narrows the affected units to a specific window. Graph-based twin platforms such as Azure Digital Twins store these models, and OPC UA companion specifications are a natural source for their equipment types.

### Simulation

The highest-value use is asking what would happen if something changed, such as adding a machine at the bottleneck or lengthening a cycle time by 15%, and answering from observed performance rather than design figures. That takes more than topology. The twin needs flow, queueing, and the statistical distributions of cycle times, usually through discrete-event simulation run against the observed data. It can show whether a change actually raises output or just moves the bottleneck. Energy models built the same way identify stations that use far more energy than they contribute, and test the effect of shifting energy-heavy work to cheaper tariff periods.

### Why Twins Disappoint

Twins depend on data quality, and sensors drift, machines run in modes the model never expected, and some points were never instrumented. A twin also describes designed behavior until it is calibrated against observed behavior, and wear, installation, materials, and operating practice all pull the two apart. Calibration is an ongoing activity. A twin accurate at commissioning drifts from reality within months unless someone owns keeping it current.

---

## IT-OT Convergence

IT and OT evolved with different priorities, and IIoT puts them in the same project.

### Different Definitions of Success

IT expects continuous change. Patches, releases, and infrastructure updates happen constantly, and short degradations are the price of staying current and secure. OT treats change as risk. A controller change that behaves unexpectedly can damage equipment or hurt people, so changes go through formal engineering change management and narrow maintenance windows, and a good year is one in which nothing changed and nothing went wrong. OT engineers who push back on continuous deployment or automatic patching are applying risk management suited to their systems, not being obstructive. Convergence works when each side designs within the other's constraints, meeting OT's availability requirements without abandoning basic security.

### Governance Models

| Model | Structure | Works when | Risk |
|---|---|---|---|
| Federated | Separate IT and OT organizations, with a coordinating team that owns the DMZ, integration architecture, and shared data platform | Both organizations are mature, and integration is mostly for analytics | The coordinating team lacks authority on either side |
| Consolidated | All technology under IT, with OT expertise as a specialty | OT systems are relatively modern and IT genuinely learns OT constraints | IT practices imposed on OT create unacceptable operational risk |
| Industrial IT | A dedicated team skilled in both, reporting to operations, acting as technical authority for everything connected to OT | Large industrial organizations | Hard to staff, since people fluent in both worlds are scarce |

Aligning technical authority with operational accountability tends to produce the best results, which is why the industrial IT model has become more common in large organizations.

---

## Design Principles

**Segmentation is a hard requirement.** Ransomware that reaches level 1 means physical damage, safety incidents, and long outages, so the DMZ and outbound-only connections are not optional.

**Govern data before choosing platforms.** Decide what to collect, at what resolution, for how long, and for whom before choosing where it lives. Teams that pick a platform first may later discover they are storing vibration data at a cost nobody planned for.

**Expect protocol diversity.** A plant built over thirty years runs Modbus, PROFINET, EtherNet/IP, BACnet, DNP3, OPC UA, and bare 4 to 20 mA signals side by side, and the integration layer has to handle all of them.

**Plan security for decades.** Controllers may go years between updates, certificates must be renewed on schedule by someone, and the people who designed the security will leave. Controls that need maintenance degrade unless the maintenance is planned and funded.

**Respect operational knowledge.** Unusual configurations in a plant usually exist for reasons someone on site knows. Designs that ignore those people produce systems that work technically and go unused.

**Measure outcomes, not connections.** The goal is less downtime, better quality, or lower energy use. Programs that count connected devices or bytes collected drift toward complexity without value, so set measurable outcome targets up front and track them.

**Fit how people work.** A twin nobody consults, maintenance alerts nobody acts on, and a dashboard operators never open have failed regardless of sophistication. Route insights into existing workflows, such as work orders in the CMMS and operator rounds, so they change what happens on the floor.
