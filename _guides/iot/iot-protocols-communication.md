---
title: "IoT Protocols and Communication"
layout: guide
category: IoT
subcategory: Foundations
description: "How IoT devices talk: application protocols like MQTT, CoAP, AMQP, HTTP, and WebSocket, and the radios and networks beneath them, from Wi-Fi, BLE, Zigbee, Thread, and Z-Wave to LoRaWAN, LTE-M, NB-IoT, and 5G, with how the two layers constrain each other."
tags: [fundamentals, mqtt, coap, lorawan, bluetooth-le, cellular-iot, protocols]
---

## Why Protocol Choice Matters in IoT

IoT systems face constraints that typical web applications never encounter: devices may run on coin-cell batteries expected to last years, radios may have a usable range of only a few hundred meters, and network links may be shared among thousands of devices competing for bandwidth. A protocol designed for high-throughput desktop computing will exhaust a sensor's battery in hours instead of months and consume more bandwidth than a shared cellular plan can sustain.

Protocol selection in IoT is therefore a design decision with direct consequences for cost, reliability, and operational lifetime. The wrong choice at the application layer can doom a product before it ships. The wrong choice at the network layer can make a deployment geographically impossible. Understanding what each protocol was designed for, and what it sacrifices to achieve that goal, is the foundation for building IoT systems that actually work in the field.

---

## Application-Layer Protocols

Application-layer protocols define how devices exchange data: who initiates communication, how reliability is guaranteed, and what overhead is added per message. IoT has produced several competing protocols because no single design optimizes well for every combination of power budget, latency requirement, and network reliability.

### MQTT

[MQTT](https://mqtt.org/){:target="_blank" rel="noopener noreferrer"} (Message Queuing Telemetry Transport) is the dominant protocol in IoT and the one you are most likely to encounter on any serious IoT platform. Originally designed by IBM for monitoring oil pipelines over satellite links in the 1990s, it was engineered from the start for unreliable networks and constrained devices. The protocol was standardized by OASIS as [MQTT 3.1.1](https://docs.oasis-open.org/mqtt/mqtt/v3.1.1/mqtt-v3.1.1.html){:target="_blank" rel="noopener noreferrer"} and later as [MQTT 5.0](https://docs.oasis-open.org/mqtt/mqtt/v5.0/mqtt-v5.0.html){:target="_blank" rel="noopener noreferrer"}.

**The Publish/Subscribe Model**

MQTT separates message producers from message consumers through a central server called a broker. A device that has data to share publishes a message to the broker on a named channel called a topic. Any device that has registered interest in that topic receives the message without needing to know where it came from or even whether the publisher is currently online. This decoupling is why MQTT scales so naturally: a fleet of ten thousand temperature sensors can publish to their respective topics without any of them needing to maintain a list of who cares about their readings.

Popular MQTT brokers include [Eclipse Mosquitto](https://mosquitto.org/){:target="_blank" rel="noopener noreferrer"} for self-hosted deployments and fully managed offerings like AWS IoT Core, Azure IoT Hub, and HiveMQ Cloud.

**Topics and Hierarchical Addressing**

Topics in MQTT are hierarchical strings separated by forward slashes, similar to filesystem paths. A temperature sensor in building A, floor 3, room 12 might publish to `buildings/a/floor3/room12/temperature`. This hierarchy enables powerful subscription patterns through wildcard characters. A single-level wildcard (`+`) matches exactly one segment, so `buildings/+/floor3/+/temperature` matches any building's third-floor temperature sensors. A multi-level wildcard (`#`) matches everything that follows, so `buildings/a/#` receives all data from building A regardless of depth.

Topic design is an architectural decision in its own right. Well-structured topics make routing, filtering, and access control straightforward; poorly structured topics create operational headaches as a deployment grows.

**Quality of Service Levels**

MQTT offers three levels of delivery assurance, and choosing the right level requires balancing reliability against overhead.

QoS 0 is fire-and-forget. The publisher sends the message once and does not track whether the broker received it. This produces the lowest overhead and lowest latency, and it is appropriate for high-frequency telemetry where occasional lost readings are acceptable. A sensor sending temperature every five seconds can tolerate losing one reading without consequence.

QoS 1 guarantees at-least-once delivery. The broker sends an acknowledgment to the publisher, and the publisher retransmits until it receives that acknowledgment. The trade-off is that the broker may deliver the message more than once if the acknowledgment is lost in transit. Subscribers must be prepared to handle duplicate messages. This level suits alerts and events where missing a message is unacceptable but idempotent processing handles duplicates cleanly.

QoS 2 guarantees exactly-once delivery through a four-step handshake. It is the most reliable but also the most expensive in terms of round-trips and latency. Battery-powered devices rarely use QoS 2 because the additional handshakes drain power. It fits commands where a duplicate could cause physical harm, such as a dosing pump running twice. MQTT QoS applies to each hop separately (publisher to broker, then broker to subscriber), so end-to-end exactly-once behavior also depends on the subscriber's QoS and on the application handling commands idempotently.

**Retained Messages**

When a publisher sends a message with the retained flag set, the broker stores that message and immediately delivers it to any new subscriber on that topic. Without this mechanism, a device that subscribes to a topic after the last message was published would receive nothing until the next publication. Retained messages are particularly useful for device state: a dashboard that connects to the broker should immediately see the last-known temperature reading rather than waiting for the next sensor publication.

**Last Will and Testament**

MQTT includes a mechanism called Last Will and Testament (LWT) that allows a device to pre-register a message the broker will publish on its behalf if it disconnects unexpectedly. When a device connects, it provides the broker with a topic, payload, and QoS level for the will message. If the device disconnects cleanly, the will is discarded. If the broker detects that the device has gone offline without sending a disconnect packet (due to a crash, power loss, or network failure), the broker publishes the will message. This lets monitoring systems detect device failures automatically without polling.

**MQTT 5.0 Improvements**

MQTT 5.0 added several capabilities that address limitations in version 3.1.1. Shared subscriptions allow a group of subscribers to divide message consumption among themselves, enabling load balancing across multiple consumer instances without sending duplicate messages to each. Message expiry lets publishers attach a time-to-live to messages. The broker discards them if they have not been delivered within that window, preventing stale data from accumulating in offline queues. User properties allow arbitrary key-value metadata to be attached to any message, supporting routing, tracing, and schema versioning without embedding metadata in the payload. Reason codes were also significantly expanded, giving clients much more specific feedback about why an operation succeeded or failed.

---

### CoAP

[CoAP](https://coap.space/){:target="_blank" rel="noopener noreferrer"}, the Constrained Application Protocol defined by [RFC 7252](https://www.rfc-editor.org/rfc/rfc7252){:target="_blank" rel="noopener noreferrer"}, is designed for devices so constrained that even MQTT's overhead is too much. Where MQTT runs over TCP, CoAP runs over UDP, which eliminates the connection establishment cost entirely. This matters on devices with kilobytes of RAM and microcontrollers running at megahertz clock speeds.

**REST-Like Request/Response**

CoAP deliberately mirrors HTTP's design so that developers familiar with web APIs can transfer their mental model. It uses the same verbs (GET, POST, PUT, DELETE) and status code ranges. A CoAP GET to a resource on a sensor returns the current value just as an HTTP GET returns a web resource. This makes CoAP straightforward to bridge to HTTP systems using a proxy or gateway, which is a common pattern in constrained network environments.

Because CoAP sits on UDP, it does not inherit TCP's built-in reliability. CoAP handles this with its own lightweight mechanism: confirmable messages require an acknowledgment, and the sender retransmits with exponential backoff until one arrives. Non-confirmable messages trade reliability for reduced overhead, suitable for the same high-frequency telemetry scenarios as MQTT QoS 0.

**The Observe Pattern**

CoAP's Observe extension ([RFC 7641](https://www.rfc-editor.org/rfc/rfc7641){:target="_blank" rel="noopener noreferrer"}) adds a subscription mechanism to the otherwise request/response model. A client registers interest in a resource with a GET request containing an Observe option. The server then sends a notification each time the resource value changes. This avoids the polling overhead that would otherwise be required and makes CoAP viable for event-driven architectures even without a broker. Observe works best when the number of subscribers per resource is small, since the server must track and notify each one individually.

**Security with DTLS**

Because CoAP uses UDP, TLS does not apply directly. CoAP secures communication using [DTLS](https://www.rfc-editor.org/rfc/rfc9147){:target="_blank" rel="noopener noreferrer"} (Datagram Transport Layer Security), which adds encryption and authentication on top of unreliable datagrams. DTLS provides comparable security guarantees to TLS but handles packet reordering and loss without relying on a reliable transport layer. The downside is that DTLS adds a handshake cost and session state that further constrains resource-limited devices.

CoAP is common on IPv6 mesh networks built on IEEE 802.15.4 radios (6LoWPAN and Thread), and it is the transport underneath [OMA LwM2M](https://omaspecworks.org/what-is-oma-specworks/iot/lightweight-m2m-lwm2m/){:target="_blank" rel="noopener noreferrer"}, a device-management standard used with cellular IoT modules.

---

### AMQP

[AMQP](https://www.amqp.org/){:target="_blank" rel="noopener noreferrer"} (Advanced Message Queuing Protocol) comes from enterprise messaging rather than embedded systems. Where MQTT was designed for constrained hardware over unreliable links, AMQP was designed for reliable, high-throughput communication between services in data centers.

Two different protocols share the name. AMQP 0-9-1, the model RabbitMQ popularized, defines exchanges, routing keys, and queues inside the broker, which supports richer routing than MQTT topics. AMQP 1.0, the OASIS and ISO/IEC standard, is a different wire protocol that defines message transfer between peers and leaves broker topology to the implementation. Cloud services like Azure IoT Hub and Azure Service Bus speak AMQP 1.0, so exchanges and routing keys do not apply there.

In the IoT context, AMQP appears primarily at the cloud edge rather than on the device. [Azure IoT Hub](https://learn.microsoft.com/en-us/azure/iot-hub/iot-hub-amqp-support){:target="_blank" rel="noopener noreferrer"} supports AMQP alongside MQTT and HTTPS, and AMQP suits gateways because one connection can multiplex many devices' traffic and gateway hardware can carry the heavier stack. The protocol is also common in backend systems that consume IoT data after it has been ingested, passing messages between microservices through brokers like RabbitMQ or Azure Service Bus.

For direct device-to-cloud communication, AMQP is generally too heavy for microcontrollers. A microcontroller with a few hundred kilobytes of flash usually has no room to spare for an AMQP client. AMQP becomes practical on IoT gateways, single-board computers, and industrial edge nodes where the hardware can support it.

---

### HTTP and HTTPS in IoT

HTTP is not an IoT protocol by design, but it is ubiquitous, well-understood, and supported on virtually every device that has network connectivity. Understanding when HTTP fits and when it does not prevents both over-engineering simple integrations and forcing HTTP onto traffic it handles badly.

**Where HTTP Fits**

HTTP works well for operations that are infrequent, where connection overhead per request is acceptable, and where the device has enough power and processing capacity to handle TLS. Device provisioning is a natural fit: a device needs to register with a cloud service once during its initial boot, receive credentials, and then switch to a more efficient protocol for ongoing telemetry. Firmware over-the-air (OTA) updates are another example. Downloading a firmware image happens rarely, the device typically has power connected during updates, and HTTP's range request support makes resumable downloads straightforward.

REST API calls from IoT gateways to cloud services similarly suit HTTP well. A gateway aggregating data from dozens of sensors and uploading a batch every minute has no meaningful overhead from HTTP connection setup on that timescale.

**Where HTTP Falls Short**

For real-time telemetry from battery-powered devices, HTTP's connection overhead becomes a significant problem. Every request requires a TCP handshake followed by a TLS handshake before any application data is exchanged, adding round trips of latency and consuming energy that a device may not have to spare. Sending a ten-byte temperature reading with two hundred bytes of HTTP headers at a cost of several hundred milliseconds of radio time is a poor trade for applications publishing every second.

HTTP also lacks a native push mechanism, so any system where the server needs to push data to the device must resort to polling or a complementary technology. This is why HTTP is common for device-to-cloud uploads but rarely appears in cloud-to-device command scenarios.

---

### WebSocket

[WebSocket](https://www.rfc-editor.org/rfc/rfc6455){:target="_blank" rel="noopener noreferrer"} solves the problem HTTP cannot: full-duplex, persistent, low-latency communication between a browser or application and a server. A WebSocket connection starts as an HTTP upgrade request and then transforms into a bidirectional TCP channel that stays open.

In IoT, WebSocket appears primarily at the visualization layer rather than the device layer. Real-time dashboards displaying live sensor data use WebSocket to receive updates from a server without polling. A monitoring dashboard for a manufacturing floor might connect via WebSocket to a backend that aggregates MQTT messages from hundreds of machines and streams current state to any connected browser. The browser never needs to poll. Updates arrive as the underlying MQTT messages do.

WebSocket is also common in browser-based device control interfaces where users issue commands to devices and expect immediate feedback. Because the connection is persistent and bidirectional, the server can stream acknowledgments and state changes back without the client needing to issue separate requests.

Devices rarely use WebSocket as their application protocol. They do use it as a transport, because MQTT and AMQP can both run over WebSocket on port 443, which gets them through firewalls that only allow HTTPS. Browser clients that connect directly to a broker use MQTT over WebSocket for the same reason.

---

## Protocol Comparison

Choosing among these protocols requires weighing transport reliability, message pattern, overhead, and the target device's capabilities.

| Protocol | Transport | Pattern | Overhead | Best Use Case |
|----------|-----------|---------|----------|---------------|
| MQTT | TCP | Pub/Sub | Low | High-frequency telemetry, device fleet management |
| CoAP | UDP | Request/Response + Observe | Very low | Severely constrained devices, 6LoWPAN networks |
| AMQP | TCP | Queue/Exchange | High | Gateway-to-cloud, enterprise backend integration |
| HTTP | TCP | Request/Response | High | Provisioning, firmware updates, batch uploads |
| WebSocket | TCP | Full-duplex stream | Medium | Real-time dashboards, browser-based control |

---

## Network and Physical-Layer Technologies

Application-layer protocol selection assumes a network exists to carry the messages. The physical and network-layer technologies determine how far a signal reaches, how much power the radio consumes, how fast data can move, and what infrastructure is required. IoT deployments span environments from a smart home to a remote agricultural field, and the network technology must match the deployment context.

### WiFi

WiFi is the obvious choice when devices are in a building with existing wireless infrastructure. It provides high data rates (tens to hundreds of megabits per second on current standards), low latency, and supports TLS without meaningful constraint. Home IoT devices like smart speakers, cameras, and connected appliances almost universally use WiFi because the infrastructure already exists and users expect easy setup through a mobile app.

The trade-off is power consumption. Maintaining an active WiFi radio requires significantly more current than most low-power radio alternatives, which makes WiFi impractical for battery-powered sensors intended to last months or years without charging. Devices that sleep between measurements and wake to transmit can manage WiFi connections but must account for the time and energy cost of re-associating with an access point on each wake.

Many low-cost IoT chips support only the 2.4 GHz band, which has longer range than 5 GHz but more congestion. Indoor range is typically tens of meters, dropping with walls and interference. Wi-Fi HaLow (802.11ah) is a sub-GHz variant aimed at longer-range, lower-power IoT, though device support is still limited.

### Bluetooth and BLE

Bluetooth Classic and Bluetooth Low Energy (BLE) cover two distinct use cases. Bluetooth Classic, the older standard, supports audio streaming and serial-profile connections to peripherals. In IoT it appears mainly for audio and legacy accessories.

[BLE](https://www.bluetooth.com/learn-about-bluetooth/tech-overview/){:target="_blank" rel="noopener noreferrer"} is the relevant standard for battery-powered IoT sensors. As the name implies, it is designed to run for months or years on small batteries by minimizing radio-on time. BLE devices advertise their presence periodically and connect briefly to exchange data before disconnecting. A heart rate monitor, a Bluetooth temperature probe, or a door sensor all exploit this pattern.

BLE typically reaches tens of meters, depending on transmit power, obstructions, and PHY (Bluetooth 5's coded PHY trades data rate for longer range), which suits personal area and room-scale applications. Wearables, health monitors, beacon systems, and companion app integrations are the primary use cases. BLE does not provide internet connectivity by itself, so a nearby gateway, often a smartphone or a dedicated hub, relays data to the cloud.

### Zigbee

[Zigbee](https://csa-iot.org/all-solutions/zigbee/){:target="_blank" rel="noopener noreferrer"}, maintained by the Connectivity Standards Alliance (formerly the Zigbee Alliance), is an open standard (IEEE 802.15.4 at the physical layer with the Zigbee networking stack above it) designed for mesh networking in home and building automation. Zigbee devices can relay messages for one another, extending network reach without requiring every device to have line-of-sight to a central hub. A network of sixty smart bulbs across a large home can form a self-healing mesh where any bulb can route messages for others.

Zigbee mostly operates in the 2.4 GHz band worldwide, with sub-gigahertz options in some regions. Range per link is typically tens of meters, and mesh networking extends practical coverage well beyond that. Power consumption is very low, making Zigbee suitable for battery-powered sensors alongside line-powered actuators. The protocol is widely deployed in smart lighting (Philips Hue uses Zigbee), smart plugs, and building management systems.

The Zigbee ecosystem requires a coordinator device (the hub) that acts as the gateway between the Zigbee network and the internet. This adds a dependency that simplifies cloud connectivity for other devices but means the hub becomes a single point of failure unless redundancy is planned.

### Thread and Matter

[Thread](https://www.threadgroup.org/){:target="_blank" rel="noopener noreferrer"} uses the same IEEE 802.15.4 radio as Zigbee but carries IPv6 end to end, so every device has an IP address and there is no protocol translation at the hub. A border router, often built into a smart speaker or home hub, connects the Thread mesh to the home's Wi-Fi or Ethernet network, and a home can have several border routers so no single one is a point of failure.

[Matter](https://csa-iot.org/all-solutions/matter/){:target="_blank" rel="noopener noreferrer"} sits above the network layer. It is an application standard from the Connectivity Standards Alliance that defines device types and commands so a certified light or lock works with any certified controller, and it runs over Thread, Wi-Fi, and Ethernet. Matter addresses the smart-home interoperability problem that Zigbee and Z-Wave ecosystems split along vendor lines, and it is why new smart-home devices increasingly ship with Thread radios.

### Z-Wave

[Z-Wave](https://z-wavealliance.org/){:target="_blank" rel="noopener noreferrer"} occupies a similar niche to Zigbee in home automation but operates in unlicensed sub-gigahertz ISM bands (around 868 MHz in Europe and 908 MHz in North America). Operating below 1 GHz gives better wall penetration than 2.4 GHz and avoids congestion from Wi-Fi, Bluetooth, and microwave ovens.

Classic Z-Wave is a mesh protocol with a limit of 232 nodes per network. Z-Wave Long Range, added in the 800-series chips, uses a star topology with much longer range and supports networks of up to about 4,000 nodes. Every Z-Wave product goes through Z-Wave Alliance certification, which tends to make interoperability between vendors more dependable than in ecosystems without mandatory certification. Z-Wave is common in security systems, door locks, window sensors, and thermostats.

### LoRaWAN

[LoRaWAN](https://lora-alliance.org/about-lorawan/){:target="_blank" rel="noopener noreferrer"} (Long Range Wide Area Network) addresses use cases that no short-range radio can serve: sensors deployed across agricultural fields, remote infrastructure like water meters or gas pipelines, and asset tracking across city-scale geographies. LoRa (the physical layer radio modulation) achieves ranges of 2 to 15 kilometers in open terrain, and several kilometers in dense urban environments, while sleeping at microamps between transmissions.

This combination of extreme range and very low power comes at a cost: LoRaWAN supports only very low data rates, typically from 250 bits per second to around 50 kilobits per second depending on the spreading factor chosen. That rules it out for continuous or high-frequency data. It is designed for small, infrequent payloads, and regional duty-cycle limits on the unlicensed bands cap how often a device may transmit. A soil moisture sensor sending a 20-byte reading every fifteen minutes is an ideal LoRaWAN application, and a video camera is not.

LoRaWAN networks operate in unlicensed sub-gigahertz bands (868 MHz in Europe, 915 MHz in the Americas). LoRaWAN is not an IP network. Devices send small radio frames that gateways forward to a network server, and applications receive the decoded data from the network server over MQTT or HTTP. Public networks like [The Things Network](https://www.thethingsnetwork.org/){:target="_blank" rel="noopener noreferrer"} provide community-operated infrastructure in many cities; private networks can be built by deploying gateways. Smart cities, precision agriculture, utility metering, and environmental monitoring are the primary deployment scenarios.

### Cellular IoT: LTE-M and NB-IoT

Two 3GPP standards reuse carriers' LTE networks for IoT, so devices connect through existing towers and the carrier handles coverage and roaming instead of the deployer running gateways.

[LTE-M](https://www.gsma.com/solutions-and-impact/technologies/internet-of-things/long-term-evolution-machine-type-communication-lte-mtc-cats-m1/){:target="_blank" rel="noopener noreferrer"} (LTE Cat-M1) uses 1.4 MHz of bandwidth and supports data rates up to roughly 1 Mbps, handover between cells for moving devices, and even voice. It suits asset trackers, wearables, and anything that moves or needs firmware updates of a useful size.

[NB-IoT](https://www.gsma.com/solutions-and-impact/technologies/internet-of-things/narrow-band-iot-nb-iot/){:target="_blank" rel="noopener noreferrer"} (Narrowband IoT) uses a 200 kHz carrier and trades data rate, in the tens to low hundreds of kilobits per second, for deeper coverage and lower power. A water meter in a basement or a parking sensor under asphalt can often keep a connection where unlicensed radios cannot.

Both carry recurring per-device connectivity fees, and availability depends on the carrier and country rather than on the technology. NB-IoT support in particular is uneven: [AT&T shut down its NB-IoT network in 2025](https://www.lightreading.com/iot/at-t-to-discontinue-nb-iot-but-t-mobile-and-verizon-keep-the-faith){:target="_blank" rel="noopener noreferrer"} and moved customers to LTE-M, while other carriers kept theirs. Check the specific carriers' roadmaps for the regions a fleet will ship to, because a device lives longer than many network commitments.

### 5G for IoT

5G's IoT story has three parts. For massive machine-type communication (mMTC), 5G reuses LTE-M and NB-IoT, which were accepted as 5G technologies, and the IMT-2020 target is a density of one million devices per square kilometer. For mid-range devices like industrial sensors and cameras, 3GPP Release 17 added RedCap (reduced capability) 5G NR, which is simpler and lower-power than full 5G. And for factory automation, private 5G networks offer ultra-reliable low-latency communication (URLLC) that shared Wi-Fi spectrum cannot guarantee, which is why private 5G appears in plants running mobile robots and wireless control.

---

## Network Technology Comparison

Ranges and rates below are typical figures that vary with hardware, antennas, and environment.

| Technology | Range | Power | Data Rate | Infrastructure | Best Use Case |
|-----------|-------|-------|-----------|---------------|---------------|
| Wi-Fi | Tens of meters indoors | High | Tens to hundreds of Mbps | Existing access points | Home and office IoT, cameras, mains-powered devices |
| BLE | Tens of meters | Very low | 125 kbps to 2 Mbps | Smartphone or hub | Wearables, health monitors, proximity beacons |
| Zigbee | Tens of meters per hop (mesh) | Low | 250 kbps | Zigbee coordinator | Smart lighting, building sensors |
| Thread | Tens of meters per hop (mesh) | Low | 250 kbps | Border router | Matter smart-home devices |
| Z-Wave | Tens of meters per hop (mesh); longer with Long Range | Low | Up to 100 kbps | Z-Wave hub | Home security, locks |
| LoRaWAN | Kilometers | Ultra-low | About 250 bps to 50 kbps | Gateways and a network server | Agriculture, utilities, city-scale monitoring |
| LTE-M | Cellular | Low | Up to about 1 Mbps | Carrier LTE | Trackers, wearables, moving assets |
| NB-IoT | Cellular, deep indoor | Very low | Tens to low hundreds of kbps | Carrier LTE, where offered | Static meters and sensors |
| 5G RedCap and private 5G | Cellular | Moderate | Tens of Mbps and up | Carrier or private 5G | Industrial sensors, cameras, factory automation |

---

## How These Layers Fit Together

The application protocol and the network beneath it constrain each other. A LoRaWAN device does not run MQTT or HTTP at all, because the network is not IP and its frames hold only tens to a couple of hundred bytes, so MQTT appears one step later, between the network server and the applications. AMQP on a Zigbee sensor is impractical, while AMQP on a gateway relaying aggregated Zigbee data to a cloud hub is normal.

A common pattern in production deployments has devices communicating locally over BLE or Zigbee to a gateway, the gateway publishing aggregated readings to a cloud broker via MQTT or AMQP, the cloud broker routing messages to a time-series database and a real-time stream processor, and a WebSocket connection delivering live data to a browser dashboard. Each layer uses the protocol best suited to its environment and constraints.

