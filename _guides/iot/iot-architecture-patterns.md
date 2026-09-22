---
title: "IoT Architecture Patterns"
layout: guide
category: IoT
subcategory: Architecture & Data
description: "The recurring patterns for constrained, intermittently connected devices: edge filtering, store-and-forward, and local decisions, the fog layer, commands, device twins, and file upload, protocol translation gateways, and partitioning and multi-region patterns for large fleets."
tags: [practical, edge-computing, fog-computing, store-and-forward, device-twin, gateways, design-patterns]
---

## Why IoT Needs Its Own Patterns

IoT systems combine pressures that conventional web and enterprise software rarely face together. Devices are physically distributed, run on constrained hardware, connect over unreliable networks, and produce continuous streams of data. A factory floor might have thousands of sensors reporting every second, and a smart grid might span millions of meters across a continent. The patterns below answer four recurring questions: where computation happens, how devices and the cloud exchange information, how devices with other protocols get connected, and how the system keeps working as the fleet grows and connectivity fails. Most real systems combine several of them.

---

## Edge Computing Patterns

Edge computing is the practice of moving computation closer to where data is generated rather than sending everything to a central cloud. For IoT systems, this usually means processing data on or very near the device itself, before it travels over the network.

### Local Filtering and Aggregation

The most common edge computing pattern is filtering and aggregating raw data before transmission. A vibration sensor on a motor might sample at 10,000 readings per second. Sending all those raw readings to the cloud is rarely necessary and often impractical. What matters is whether the vibration profile indicates normal operation, developing wear, or imminent failure.

Local filtering discards readings that fall within normal bounds, keeping only anomalies or values that cross defined thresholds. Aggregation computes summaries such as averages, maximums, or standard deviations over a time window and transmits the summary rather than the individual readings. The result can cut bandwidth and cloud ingestion costs by orders of magnitude with little loss of analytical value.

This pattern works well when the raw data has high redundancy (many consecutive readings are nearly identical), when anomalies are rare and easily characterizable, and when downstream systems care about trends rather than individual samples. It works less well when the raw signal itself carries diagnostic information that summaries would destroy, such as acoustic waveforms used for fault detection.

### Store and Forward

Connectivity in real IoT deployments is rarely guaranteed. A truck passing through a tunnel, a ship at sea, a sensor in a remote location with intermittent cellular coverage, or a factory network experiencing a maintenance window are all situations where the path to the cloud is temporarily unavailable.

The store and forward pattern addresses this by buffering data locally in persistent storage when connectivity is absent and transmitting it when the connection resumes. The device or edge gateway maintains a local queue, typically written to disk or flash storage rather than volatile memory, so data survives restarts. When connectivity returns, the buffer drains in order, preserving the chronological record of what happened.

The tricky design decisions in store and forward involve what to do when the local buffer fills before connectivity returns. Options include dropping the oldest data (prioritizing recency), dropping the newest data (preserving historical continuity), compressing stored data more aggressively, or alerting that the buffer is approaching capacity. Each choice reflects a different priority about what the data is for. A billing system needs every reading; an environmental monitoring system might tolerate losing some detail in exchange for recency.

Store and forward also requires that downstream systems handle out-of-order and delayed data gracefully, since a large backlog arriving after reconnection will have timestamps significantly in the past relative to the current moment.

### Local Decision Making

Some decisions in IoT systems cannot wait for a round-trip to the cloud. A safety interlock on industrial machinery might need to cut power within milliseconds of detecting a dangerous condition. An autonomous vehicle needs to react to obstacles faster than any network can respond. A smart thermostat should still maintain temperature even when its internet connection drops.

Local decision making means embedding the logic that governs time-critical or connectivity-independent actions directly on the device or edge gateway. The device acts on its own sensor readings without consulting a remote system for each decision. The cloud might still receive telemetry and update the rules or thresholds that govern local decisions, but the execution of those decisions is entirely local.

This pattern introduces a governance challenge: how do you update the decision logic deployed across thousands of edge devices, and how do you ensure all devices are running consistent versions? Device management platforms handle firmware updates, configuration pushes, and version tracking. The operational complexity of managing distributed logic at scale should be factored into any design that relies heavily on local decision making.

---

## Fog Computing

Fog computing occupies the middle layer of the IoT topology, sitting between the constrained sensors and actuators at the edge and the full-scale compute resources in the cloud. The term describes near-edge infrastructure with meaningful compute capacity, such as industrial gateways, ruggedized on-premises servers, micro data centers at telecom base stations, or edge nodes within a campus network.

### The Fog Layer's Role

Where a typical edge device might be a microcontroller with kilobytes of RAM and a simple real-time operating system, a fog node might run Linux, have gigabytes of memory, and support containerized workloads. This gives fog nodes the ability to run more sophisticated analytics, act as local brokers or orchestrators for groups of devices, and serve as aggregation points before data travels to the cloud.

A manufacturing plant is a good illustration. Sensors on individual machines are genuine edge devices with minimal compute. A server rack in the plant's electrical room can run local analytics, store hours of historical data for immediate queries, coordinate between machines in the same production line, and batch data for cloud upload rather than streaming everything. That server rack is the fog layer.

Fog computing is appropriate when latency requirements are tighter than the cloud can meet but looser than pure on-device processing, when the volume of raw data makes cloud transmission expensive or impractical without local preprocessing, when local analytics need more compute than edge devices can provide, or when regulatory requirements mandate that certain data not leave a physical facility.

### Fog vs Edge vs Cloud

The choice between pure edge, fog, and cloud for a given function is a spectrum, not a binary decision.

| Consideration | Edge Device | Fog Node | Cloud |
|---|---|---|---|
| Compute capacity | Very limited | Moderate to substantial | Elastic |
| Latency to decision | Microseconds to milliseconds | Milliseconds | Tens to hundreds of milliseconds, plus network variability |
| Data locality | Fully local | Local to site or region | Centralized |
| Operational complexity | Simple firmware | Moderate (local infra) | Managed by provider |
| Cost of data transmission | Near zero (no network hop) | Low (local network) | Bandwidth and ingestion costs |
| Long-term data retention | Minimal | Hours to days | Years, priced by volume |

Most real systems use all three layers. Safety-critical decisions happen on the device. Local analytics and coordination happen in the fog. Historical analysis, machine learning model training, fleet management, and reporting happen in the cloud.

---

## Device-Cloud Communication Patterns

Four patterns cover how devices and cloud systems exchange information, and each suits a different kind of interaction.

### Telemetry Ingestion

Telemetry is the flow of sensor data from devices to the cloud. Devices produce readings such as temperature, pressure, location, or power consumption, and push those readings to an ingestion endpoint at some interval or whenever the value changes beyond a defined threshold.

Cloud-side, telemetry ingestion pipelines are designed to handle massive concurrency. Thousands or millions of devices all pushing data simultaneously requires horizontal scalability at the ingestion layer, typically implemented as message brokers or event streaming platforms that can accept, buffer, and route messages independently of downstream processing speed.

The main design decisions in telemetry ingestion are the protocol, the payload format, and the delivery guarantee. Most IoT telemetry uses at-least-once delivery, because a duplicate reading is easy to tolerate while a lost one could hide an anomaly.

### Command and Control

Where telemetry flows from device to cloud, command and control flows in the opposite direction. The cloud sends instructions to devices: start a motor, update a configuration value, trigger a firmware download, change a setpoint.

This pattern is more complex than telemetry because it involves a response cycle. The cloud system needs to know whether the device received the command, whether it executed successfully, and what the outcome was. Sending commands to devices that may be offline or unreachable adds further complexity.

Platforms offer two command styles. A synchronous request-response command calls into a connected device and waits for its reply within a timeout, which suits immediate actions like "reboot now" or "read this register" where the caller needs confirmation. It fails fast if the device is offline. A queued command is stored until the device connects and fetches it, which suits intermittently connected devices and commands that can wait. Azure IoT Hub calls these direct methods and cloud-to-device messages. AWS IoT Core builds both on MQTT topics, and uses its jobs feature for queued operations across many devices.

### Device Twins and Shadows

Device twins (the Azure IoT Hub term) and device shadows (the AWS IoT Core term) represent device state when the device itself may be offline. Each is a JSON document stored in the cloud with two sections. The desired state is what the cloud wants the device to be configured as, and the reported state is what the device last said its actual configuration is.

When the cloud wants to change a device's behavior, it updates the desired state. When the device reconnects, it reads the desired state (or receives only the difference, which AWS publishes as a delta), applies the changes, and updates its reported state. The cloud never needs to know whether a device is online when it makes a change, because the change waits in the document until the device processes it.

{% include figure.html id="iot-twin-reconciliation" %}

Twins also make fleet-wide queries possible. Instead of asking each device for its state, a fleet system queries the twin store, for example for every device whose reported firmware version differs from the desired one. Asking a million devices individually, many of them asleep, would not work.

The reported and desired sections can diverge for extended periods when devices are offline, during over-the-air update rollouts, or when a device fails to apply a configuration change. Monitoring the gap between desired and reported state is an important operational concern.

### File Upload

Some device data doesn't fit the message-oriented models above. A camera capturing images for defect detection, an ECU generating a full diagnostic dump, or a device producing large log archives all generate data too large to pass through a message broker efficiently.

The file upload pattern gives devices a way to upload large blobs directly to cloud object storage, typically through a pre-signed URL that grants temporary, scoped upload permission. The device receives a URL from the IoT platform, uploads the file directly to storage without routing the payload through the platform itself, and then notifies the platform that the upload is complete. This keeps large payloads out of the message bus while still giving the platform visibility into what was uploaded and when.

File uploads are appropriate for images and video, large log bundles, firmware diagnostics, and any payload measured in megabytes or gigabytes rather than bytes or kilobytes.

---

## Protocol Translation Gateways

The IoT landscape includes an enormous variety of device protocols, many of them decades old and designed for specific industrial or building automation contexts. Connecting these devices to modern cloud platforms often requires a gateway that translates between the device-native protocol and the protocol the cloud speaks.

### Common Device Protocols

Gateways most often meet industrial protocols like Modbus and OPC UA, or short-range radios like BLE, Zigbee, and Z-Wave, on the device side, and speak MQTT, AMQP, or HTTPS on the cloud side.

The device-side protocols share two traits that make a gateway necessary. Many of them cannot reach the internet directly, either because they run over serial lines or short-range radio or because they are not IP at all, and many of the industrial ones carry no security, so exposing them beyond the local network is unsafe. Modbus, for example, has no authentication and a bare register-based data model. On the cloud side, MQTT is supported by every major IoT platform, while AMQP is supported by some, such as Azure IoT Hub, and not others, such as AWS IoT Core.

### Gateway vs Transparent Proxy

A protocol translation gateway actively interprets the device-side protocol and re-encodes the data in the cloud-side protocol. It understands the semantics of Modbus registers or OPC-UA nodes and converts them into MQTT messages with appropriate topic structures and JSON payloads. The cloud never sees the original wire protocol.

A transparent gateway, by contrast, passes traffic through without interpreting it. The devices behind it already speak a protocol the cloud accepts, and the gateway handles network concerns like connection multiplexing, local buffering, or crossing a network boundary. It is simpler and adds less latency, but it only works when the devices already speak compatible protocols.

The choice also decides device identity. Behind a transparent gateway, each device keeps its own identity in the cloud and can be authenticated, managed, and revoked individually. Behind a translating gateway, the cloud may see only the gateway, which then has to map its downstream devices to logical identities itself. Per-device identity is easier to operate at scale, so translating gateways that can register each downstream device as its own cloud identity are the better choice when the platform supports them.

A translating gateway is needed when the cloud platform does not support the device protocol, when the device uses a transport like serial RS-485 that cannot reach the internet, when a protocol like Modbus needs security added around it, or when data needs normalizing before it reaches the cloud, such as mapping proprietary sensor identifiers to a standard schema.

### Gateway Architecture Considerations

A gateway's core function is protocol translation, but production gateways typically do more. They often implement local buffering for store and forward, device authentication and credential management, data filtering and aggregation before cloud transmission, and local alarming for critical conditions.

Gateways introduce a single point of dependency for all devices behind them. A gateway failure makes all connected devices unreachable from the cloud's perspective. High-availability designs use redundant gateways or failover configurations, though this adds cost and complexity. The tradeoff between gateway simplicity and resilience depends on what the devices are monitoring and what happens if the cloud loses visibility into them.

---

## Scalability Patterns for IoT Fleets

As an IoT deployment grows from hundreds of devices to tens of thousands or millions, the architecture must evolve. Patterns that work at small scale often create bottlenecks or operational nightmares at fleet scale.

### Horizontal Partitioning of Device Connections

A single hub or broker instance has limits on connections and message throughput. Scaling to millions of devices requires distributing connections across multiple instances, with devices assigned to instances based on some partitioning strategy such as device ID hash, geographic region, or organizational group.

Partitioning introduces the question of how to route messages between partitions when, for example, a command needs to reach a device on a different partition than the one the command originator is connected to. Most IoT platforms handle this internally, but custom or hybrid architectures need to account for cross-partition routing explicitly.

The partitioning strategy also affects operational behavior. Hash-based partitioning distributes load evenly but makes geographic routing harder. Geographic partitioning simplifies regional compliance and latency but can create hot partitions if device density is uneven.

### Multi-Region Deployments for Global Fleets

A fleet spanning multiple continents faces latency, data residency, and failure isolation requirements that single-region architectures cannot meet. A device in Tokyo should not need to send telemetry to US East to reach its cloud endpoint. The added latency and the extra long-haul links that can fail make this impractical at scale.

Multi-region deployments assign devices to a regional ingestion endpoint geographically close to them. Regional endpoints handle telemetry ingestion, command delivery, and device twin synchronization locally. Data is then replicated or synchronized to a global tier for fleet-wide queries, cross-region reporting, and workloads that need a unified view.

The design challenges in multi-region IoT are similar to those in any distributed system: how to handle eventual consistency between regional data stores, how to route commands when a device's regional assignment changes (a vehicle crossing a continental boundary, for example), and how to aggregate regional data for global dashboards without creating a single point of failure at the aggregation layer.

Data residency regulations complicate multi-region designs further. Some jurisdictions require that data about residents or critical infrastructure not leave specified geographic boundaries. The architecture must enforce these boundaries while still enabling necessary global coordination.

---

## Choosing and Combining Patterns

Real systems combine patterns. A typical industrial deployment might filter at the sensor to cut data volume, run a fog node in the plant that translates OPC UA to MQTT and buffers with store-and-forward, use device twins for configuration across the fleet, and feed a cloud broker whose stream fans out to several downstream consumers.

The selection of which patterns to apply, and at what layer, depends on answering a small set of questions about the system's real requirements. What latency do decisions require? What happens when connectivity is lost? How much does bandwidth cost, and how much data do devices generate? What protocols do existing devices speak? What are the data residency and compliance constraints? How large will the fleet grow, and over what timeframe?

Starting from the physical and operational realities of the devices and the network, before choosing patterns, avoids the common mistake of applying a cloud-native architecture to a problem where the network is unreliable, the devices are constrained, and the latency requirements are tight.
