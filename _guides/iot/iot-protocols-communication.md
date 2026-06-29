---
title: "IoT Protocols and Communication"
layout: guide
category: IoT
subcategory: IoT Foundations
description: "Application-layer protocols like MQTT, CoAP, and AMQP, network-layer technologies from WiFi to LoRaWAN, and data serialization formats for IoT systems."
tags: [iot, mqtt, protocols, networking, fundamentals, embedded, real-time]
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

QoS 2 guarantees exactly-once delivery through a four-step handshake. It is the most reliable but also the most expensive in terms of round-trips and latency. Battery-powered devices rarely use QoS 2 because the additional handshakes drain power. It is most appropriate for commands sent to actuators where duplicates could cause real-world harm, such as a valve being opened twice.

**Retained Messages**

When a publisher sends a message with the retained flag set, the broker stores that message and immediately delivers it to any new subscriber on that topic. Without this mechanism, a device that subscribes to a topic after the last message was published would receive nothing until the next publication. Retained messages are particularly useful for device state: a dashboard that connects to the broker should immediately see the last-known temperature reading rather than waiting for the next sensor publication.

**Last Will and Testament**

MQTT includes a mechanism called Last Will and Testament (LWT) that allows a device to pre-register a message the broker will publish on its behalf if it disconnects unexpectedly. When a device connects, it provides the broker with a topic, payload, and QoS level for the will message. If the device disconnects cleanly, the will is discarded. If the broker detects that the device has gone offline without sending a disconnect packet (due to a crash, power loss, or network failure), the broker publishes the will message. This lets monitoring systems detect device failures automatically without polling.

**MQTT 5.0 Improvements**

MQTT 5.0 added several capabilities that address limitations in version 3.1.1. Shared subscriptions allow a group of subscribers to divide message consumption among themselves, enabling load balancing across multiple consumer instances without sending duplicate messages to each. Message expiry lets publishers attach a time-to-live to messages; the broker discards them if they have not been delivered within that window, preventing stale data from accumulating in offline queues. User properties allow arbitrary key-value metadata to be attached to any message, supporting routing, tracing, and schema versioning without embedding metadata in the payload. Reason codes were also significantly expanded, giving clients much more specific feedback about why an operation succeeded or failed.

---

### CoAP

[CoAP](https://coap.space/){:target="_blank" rel="noopener noreferrer"}, the Constrained Application Protocol defined by [RFC 7252](https://www.rfc-editor.org/rfc/rfc7252){:target="_blank" rel="noopener noreferrer"}, is designed for devices so constrained that even MQTT's overhead is too much. Where MQTT runs over TCP, CoAP runs over UDP, which eliminates the connection establishment cost entirely. This matters on devices with kilobytes of RAM and microcontrollers running at megahertz clock speeds.

**REST-Like Request/Response**

CoAP deliberately mirrors HTTP's design so that developers familiar with web APIs can transfer their mental model. It uses the same verbs (GET, POST, PUT, DELETE) and status code ranges. A CoAP GET to a resource on a sensor returns the current value just as an HTTP GET returns a web resource. This makes CoAP straightforward to bridge to HTTP systems using a proxy or gateway, which is a common pattern in constrained network environments.

Because CoAP sits on UDP, it does not inherit TCP's built-in reliability. CoAP handles this with its own lightweight mechanism: confirmable messages require an acknowledgment, and the sender retransmits with exponential backoff until one arrives. Non-confirmable messages trade reliability for reduced overhead, suitable for the same high-frequency telemetry scenarios as MQTT QoS 0.

**The Observe Pattern**

CoAP's Observe extension ([RFC 7641](https://www.rfc-editor.org/rfc/rfc7641){:target="_blank" rel="noopener noreferrer"}) adds a subscription mechanism to the otherwise request/response model. A client registers interest in a resource with a GET request containing an Observe option; the server then sends a notification each time the resource value changes. This avoids the polling overhead that would otherwise be required and makes CoAP viable for event-driven architectures even without a broker. Observe works best when the number of subscribers per resource is small, since the server must track and notify each one individually.

**Security with DTLS**

Because CoAP uses UDP, TLS does not apply directly. CoAP secures communication using [DTLS](https://www.rfc-editor.org/rfc/rfc9147){:target="_blank" rel="noopener noreferrer"} (Datagram Transport Layer Security), which adds encryption and authentication on top of unreliable datagrams. DTLS provides comparable security guarantees to TLS but handles packet reordering and loss without relying on a reliable transport layer. The downside is that DTLS adds a handshake cost and session state that further constrains resource-limited devices.

CoAP is most commonly found in 6LoWPAN networks, which carry IPv6 over IEEE 802.15.4 radio links, and is particularly prevalent in industrial sensor deployments where MQTT's TCP dependency is impractical.

---

### AMQP

[AMQP](https://www.amqp.org/){:target="_blank" rel="noopener noreferrer"} (Advanced Message Queuing Protocol) comes from enterprise messaging rather than embedded systems. Where MQTT was designed for constrained hardware over unreliable links, AMQP was designed for reliable, high-throughput communication between services in data centers.

AMQP defines a rich set of messaging semantics including message queues, exchanges, routing keys, and acknowledgment policies. Messages can be routed based on their headers or routing keys to different queues, supporting complex fan-out and selective delivery patterns that MQTT topics approximate but cannot fully replicate. AMQP also defines a wire-level protocol with strong typing for structured messages.

In the IoT context, AMQP appears primarily at the cloud edge rather than on the device. [Azure IoT Hub](https://learn.microsoft.com/en-us/azure/iot-hub/iot-hub-amqp-support){:target="_blank" rel="noopener noreferrer"} natively supports AMQP alongside MQTT and HTTP, and it is the protocol often used between an IoT gateway and a cloud messaging service because gateways typically run on hardware capable of supporting the heavier AMQP stack. The protocol is also common in backend systems that consume IoT data after it has been ingested, passing messages between microservices through brokers like RabbitMQ or Azure Service Bus.

For direct device-to-cloud communication, AMQP is generally too heavy for microcontrollers. A device running FreeRTOS with 256 KB of flash does not have room for an AMQP client library. AMQP becomes practical on IoT gateways, single-board computers, and industrial edge nodes where the hardware can support it.

---

### HTTP and HTTPS in IoT

HTTP is not an IoT protocol by design, but it is ubiquitous, well-understood, and supported on virtually every device that has network connectivity. Understanding when HTTP fits and when it does not prevents over-engineering simple integrations and avoids under-engineering systems where HTTP's limitations cause real problems.

**Where HTTP Fits**

HTTP works well for operations that are infrequent, where connection overhead per request is acceptable, and where the device has enough power and processing capacity to handle TLS. Device provisioning is a natural fit: a device needs to register with a cloud service once during its initial boot, receive credentials, and then switch to a more efficient protocol for ongoing telemetry. Firmware over-the-air (OTA) updates are another example; downloading a firmware image happens rarely, the device typically has power connected during updates, and HTTP's range request support makes resumable downloads straightforward.

REST API calls from IoT gateways to cloud services similarly suit HTTP well. A gateway aggregating data from dozens of sensors and uploading a batch every minute has no meaningful overhead from HTTP connection setup on that timescale.

**Where HTTP Falls Short**

For real-time telemetry from battery-powered devices, HTTP's connection overhead becomes a significant problem. Every request requires a TCP handshake followed by a TLS handshake before any application data is exchanged, adding hundreds of milliseconds of latency and consuming energy that a device may not have to spare. Sending a ten-byte temperature reading with two hundred bytes of HTTP headers at a cost of several hundred milliseconds of radio time is a poor trade for applications publishing every second.

HTTP also lacks a native push mechanism, so any system where the server needs to push data to the device must resort to polling or a complementary technology. This is why HTTP is common for device-to-cloud uploads but rarely appears in cloud-to-device command scenarios.

---

### WebSocket

[WebSocket](https://websockets.spec.whatwg.org/){:target="_blank" rel="noopener noreferrer"} solves the problem HTTP cannot: full-duplex, persistent, low-latency communication between a browser or application and a server. A WebSocket connection starts as an HTTP upgrade request and then transforms into a bidirectional TCP channel that stays open.

In IoT, WebSocket appears primarily at the visualization layer rather than the device layer. Real-time dashboards displaying live sensor data use WebSocket to receive updates from a server without polling. A monitoring dashboard for a manufacturing floor might connect via WebSocket to a backend that aggregates MQTT messages from hundreds of machines and streams current state to any connected browser. The browser never needs to poll; updates arrive as the underlying MQTT messages do.

WebSocket is also common in browser-based device control interfaces where users issue commands to devices and expect immediate feedback. Because the connection is persistent and bidirectional, the server can stream acknowledgments and state changes back without the client needing to issue separate requests.

WebSocket is rarely found on the device itself because it still runs over TCP and requires a browser-compatible handshake. Embedded firmware developers building direct device connectivity prefer MQTT over WebSocket (which MQTT brokers often support as a transport variant) for browser-based clients that must connect directly to a broker.

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

Popular development platforms like the Raspberry Pi, ESP32, and many Arduino variants with WiFi shields connect over 802.11 b/g/n (2.4 GHz) or 802.11 ac (5 GHz). Range in a typical indoor environment is 30 to 100 meters, dropping with walls and interference.

### Bluetooth and BLE

Bluetooth Classic and Bluetooth Low Energy (BLE) cover two distinct use cases. Bluetooth Classic, the older standard, supports audio streaming and serial-profile connections to peripherals like keyboards and headsets; it appears in IoT primarily for audio and high-throughput legacy accessories.

[BLE](https://www.bluetooth.com/learn-about-bluetooth/tech-overview/){:target="_blank" rel="noopener noreferrer"} is the relevant standard for battery-powered IoT sensors. As the name implies, it is designed to run for months or years on small batteries by minimizing radio-on time. BLE devices advertise their presence periodically and connect briefly to exchange data before disconnecting. A heart rate monitor, a Bluetooth temperature probe, or a door sensor all exploit this pattern.

BLE works at ranges of 10 to 100 meters depending on transmission power and obstructions, which suits personal area and room-scale applications. Wearables, health monitors, beacon systems, and companion app integrations are the primary use cases. BLE's limitation is that it requires a nearby gateway (often a smartphone or a dedicated hub) to relay data to the cloud; BLE alone does not provide internet connectivity.

### Zigbee

[Zigbee](https://zigbeealliance.org/){:target="_blank" rel="noopener noreferrer"} is an open standard (IEEE 802.15.4 at the physical layer with the Zigbee networking stack above it) designed for mesh networking in home and building automation. Zigbee devices can relay messages for one another, extending network reach without requiring every device to have line-of-sight to a central hub. A network of sixty smart bulbs across a large home can form a self-healing mesh where any bulb can route messages for others.

Zigbee operates in the 2.4 GHz band (globally) and sub-gigahertz bands in some regions. Range per link is roughly 10 to 100 meters; mesh networking extends practical coverage well beyond that. Power consumption is very low, making Zigbee suitable for battery-powered sensors alongside line-powered actuators. The protocol is widely deployed in smart lighting (Philips Hue uses a Zigbee variant), smart plugs, and building management systems.

The Zigbee ecosystem requires a coordinator device (the hub) that acts as the gateway between the Zigbee network and the internet. This adds a dependency that simplifies cloud connectivity for other devices but means the hub becomes a single point of failure unless redundancy is planned.

### Z-Wave

[Z-Wave](https://z-wavealliance.org/){:target="_blank" rel="noopener noreferrer"} occupies a similar niche to Zigbee in home automation but uses a licensed sub-gigahertz frequency (868 MHz in Europe, 908 MHz in North America). Operating below 1 GHz provides better wall penetration than 2.4 GHz and avoids congestion from WiFi, Bluetooth, and microwave ovens that all share the 2.4 GHz band.

Z-Wave is a mesh protocol like Zigbee, with typical ranges of 30 to 100 meters per hop. The licensed frequency and certification requirements for Z-Wave devices create a more controlled ecosystem than Zigbee; interoperability between certified devices is generally more reliable. Z-Wave is common in security systems, door locks, window sensors, and thermostat integrations where consistent behavior across vendor hardware matters.

The trade-off compared to Zigbee is that Z-Wave has a lower maximum network size (traditionally 232 devices per network) and its closed-spectrum licensing makes chips more expensive to manufacture. Z-Wave 700 and 800 series significantly improved energy efficiency, enabling battery-powered sensors to last years between changes.

### LoRaWAN

[LoRaWAN](https://lora-alliance.org/about-lorawan/){:target="_blank" rel="noopener noreferrer"} (Long Range Wide Area Network) addresses use cases that no short-range radio can serve: sensors deployed across agricultural fields, remote infrastructure like water meters or gas pipelines, and asset tracking across city-scale geographies. LoRa (the physical layer radio modulation) achieves ranges of 2 to 15 kilometers in open terrain, and several kilometers in dense urban environments, while consuming only microamps of current in receive mode.

This combination of extreme range and very low power comes at a cost: LoRaWAN supports only very low data rates, typically from 250 bits per second to around 50 kilobits per second depending on the spreading factor chosen. This makes LoRaWAN entirely unsuitable for any application requiring continuous or high-frequency data; it is designed for small, infrequent payloads. A soil moisture sensor transmitting a 20-byte reading every fifteen minutes is an ideal LoRaWAN application; a video camera is not.

LoRaWAN networks operate in unlicensed sub-gigahertz bands (868 MHz in Europe, 915 MHz in the Americas) and require a gateway connected to the internet to relay messages from devices. Public networks like [The Things Network](https://www.thethingsnetwork.org/){:target="_blank" rel="noopener noreferrer"} provide community-operated infrastructure in many cities; private networks can be built by deploying gateways. Smart cities, precision agriculture, utility metering, and environmental monitoring are the primary deployment scenarios.

### NB-IoT

[NB-IoT](https://www.gsma.com/solutions-and-impact/technologies/internet-of-things/narrow-band-iot-nb-iot/){:target="_blank" rel="noopener noreferrer"} (Narrowband IoT) is a cellular standard defined by 3GPP that reuses existing LTE infrastructure. Where LoRaWAN requires deploying or joining a separate network, NB-IoT devices connect through the same towers that provide LTE for smartphones, with the carrier managing coverage, roaming, and connectivity.

NB-IoT occupies a narrow slice of licensed cellular spectrum (200 kHz) and is optimized for devices that need to send small amounts of data occasionally over very long distances. Building penetration is significantly better than LoRaWAN because cellular infrastructure was designed to reach indoor devices. A water meter in a basement, a parking sensor under asphalt, or a gas detector in an industrial facility can maintain connectivity where unlicensed radios cannot.

The dependency on cellular carriers means recurring subscription costs per device (typically a few dollars per year at IoT data volumes) and availability limited to carrier coverage areas. NB-IoT is strongest in densely populated regions with mature LTE infrastructure; it is impractical in areas without cellular coverage.

### 5G mMTC

5G introduces a category called [mMTC](https://www.ericsson.com/en/blog/2021/5/what-does-5g-mean-for-iot){:target="_blank" rel="noopener noreferrer"} (massive Machine Type Communication) specifically for IoT scenarios requiring enormous device density. While traditional cellular networks were designed around human users with smartphones, mMTC is architected to serve hundreds of thousands of devices per square kilometer, each sending small, infrequent messages.

The design goals for mMTC include a ten-year battery lifetime for simple sensors, the ability to operate at low signal levels inside buildings, and minimal signaling overhead per device. In practice, mMTC overlaps considerably with NB-IoT's use cases and the two technologies coexist in the 5G ecosystem; NB-IoT is specifically named in 3GPP Release 15 as a 5G technology.

Where 5G mMTC becomes genuinely new territory is in Industrial IoT (IIoT), where private 5G networks deployed on factory floors combine the ultra-low latency of 5G NR (New Radio) with the device density of mMTC. A manufacturing facility operating autonomous robots, conveyor systems, and quality inspection cameras across a shared private 5G network represents a use case that neither WiFi (limited spectrum management) nor previous cellular generations (insufficient density and latency) could serve well.

---

## Network Technology Comparison

Different environments demand different physical-layer choices. The table below covers the primary dimensions relevant to IoT deployment decisions.

| Technology | Range | Power | Data Rate | Infrastructure | Best Use Case |
|-----------|-------|-------|-----------|---------------|---------------|
| WiFi | 30-100m | High | 10-600+ Mbps | Existing routers | Home/office IoT, high-bandwidth devices |
| BLE | 10-100m | Very low | 125 Kbps-2 Mbps | Smartphone or hub | Wearables, health monitors, proximity beacons |
| Zigbee | 10-100m (mesh) | Low | 250 Kbps | Zigbee coordinator | Smart home automation, building sensors |
| Z-Wave | 30-100m (mesh) | Low | 100 Kbps | Z-Wave hub | Home security, locks, certified ecosystems |
| LoRaWAN | 2-15km | Ultra-low | 250 bps to 50 Kbps | LoRa gateways | Agriculture, utilities, city-scale monitoring |
| NB-IoT | Cellular | Low | 26-127 Kbps | Carrier LTE | Urban metering, industrial, carrier-managed |
| 5G mMTC | Cellular | Low | Varies | Private/public 5G | IIoT, high-density deployments |

---

## Data Serialization Formats

Once the application protocol and network technology are chosen, data still needs to be encoded before transmission. The format chosen determines how much bandwidth each message consumes, how easy it is for humans to inspect messages during debugging, and how well the system handles schema evolution as devices and cloud services are updated independently.

### JSON

[JSON](https://www.json.org/json-en.html){:target="_blank" rel="noopener noreferrer"} (JavaScript Object Notation) is the most widely used format in web and IoT applications. Its greatest strength is human readability: an engineer looking at a raw MQTT message payload can immediately understand what a device is reporting without any special tools. This makes development, debugging, and log inspection dramatically easier.

JSON's weakness in IoT is verbosity. A JSON object like `{"sensor_id": "room12", "temp_c": 21.4, "humidity": 58}` is 50 characters expressing three values. The field names are repeated in every message, even when every device sends the same structure. For a fleet of ten thousand devices sending ten readings per minute, field name overhead accumulates to significant bandwidth costs on metered connections.

JSON also lacks a schema mechanism; any service consuming a JSON message relies on convention to know what fields will be present. When a firmware update adds a new field, downstream consumers must be updated independently to handle both old and new message shapes.

JSON is the right choice during development, for low-frequency telemetry where verbosity is not a concern, and for any system where message inspectability is important for operations. Many IoT platforms accept JSON at ingestion and transcode to a more compact format internally.

### Protocol Buffers

[Protocol Buffers](https://protobuf.dev/){:target="_blank" rel="noopener noreferrer"} (protobuf), developed by Google, takes the opposite approach to JSON. Messages are defined in a `.proto` schema file; a compiler generates serialization and deserialization code for the target language. The wire format is binary: fields are identified by integer tags rather than names, and values are encoded in compact binary representations rather than text.

A temperature reading that requires 50 bytes as JSON might require 10 bytes as a protobuf message. For high-frequency telemetry over a metered cellular connection, this difference directly translates to cost and battery life. Protobuf also supports schema evolution through careful use of field numbers: adding new fields with new numbers is backwards compatible, and consumers that do not recognize a field number simply ignore it.

The cost is inspectability. A raw protobuf message is binary; decoding it requires the schema. Debugging requires tooling, and log inspection requires the right `.proto` files. Protobuf is the right choice for high-volume telemetry where bandwidth costs are meaningful and the team is willing to invest in schema management tooling.

### CBOR

[CBOR](https://cbor.io/){:target="_blank" rel="noopener noreferrer"} (Concise Binary Object Representation) is defined by [RFC 8949](https://www.rfc-editor.org/rfc/rfc8949){:target="_blank" rel="noopener noreferrer"} and represents a middle ground between JSON and protobuf. CBOR is a binary format that preserves JSON's data model (objects, arrays, strings, numbers, booleans, null) but encodes it compactly without field names on the wire. Unlike protobuf, CBOR does not require a pre-defined schema; the structure of the data is self-describing in the encoding.

This makes CBOR particularly useful in constrained environments where schema management is impractical. A microcontroller with a CBOR library can encode structured data more efficiently than JSON without requiring the coordination overhead of a shared `.proto` schema. CBOR is used in CoAP applications (the two technologies are often paired), and it appears in security standards like [COSE](https://www.rfc-editor.org/rfc/rfc9052){:target="_blank" rel="noopener noreferrer"} (CBOR Object Signing and Encryption) and [CDDL](https://www.rfc-editor.org/rfc/rfc8610){:target="_blank" rel="noopener noreferrer"} for schema definition.

### MessagePack

[MessagePack](https://msgpack.org/){:target="_blank" rel="noopener noreferrer"} is another binary serialization format that mirrors JSON's structure but encodes it in compact binary. It is often described as "binary JSON." Like CBOR, it preserves the JSON data model and does not require a pre-defined schema; unlike CBOR, it predates and operates independently of any specific standard body or security framework.

MessagePack has broad language support and is commonly found in systems where JSON's verbosity is a problem but protobuf's schema management overhead is too high. Redis uses MessagePack internally for some data structures. In IoT, MessagePack appears in gateways and cloud ingestion pipelines rather than on deeply embedded devices, where CBOR's standardization and CoAP integration make it a more natural fit.

### Avro

[Apache Avro](https://avro.apache.org/){:target="_blank" rel="noopener noreferrer"} is designed for the big data ecosystem. Like protobuf, Avro is schema-driven and produces compact binary output. Unlike protobuf, Avro stores the schema alongside the data (or in a schema registry) rather than encoding field tags in the wire format. This makes Avro particularly useful in streaming and batch data pipelines where data may be read by many different consumers over a long time period and schema evolution must be carefully managed.

In IoT, Avro appears at the analytics layer rather than on devices. Data ingested from devices in MQTT JSON or CBOR format is often transcoded to Avro before being written to a data lake or processed by Apache Kafka and Apache Flink pipelines. Avro's schema registry integration means that as device firmware updates change the message structure, the pipeline can correctly deserialize both old and new formats by looking up the appropriate schema version.

### Choosing a Serialization Format

The decision among these formats follows from the constraints of the deployment rather than any universal preference.

| Format | Schema | Human Readable | Compactness | Best For |
|--------|--------|---------------|-------------|---------|
| JSON | None | Yes | Low | Development, low-frequency telemetry, debugging |
| Protocol Buffers | Required (.proto) | No | Very high | High-volume telemetry, cost-sensitive bandwidth |
| CBOR | Optional | No | High | Constrained devices, CoAP integrations |
| MessagePack | None | No | High | Gateways, pipelines where JSON is too verbose |
| Avro | Required (registry) | No | High | Analytics pipelines, long-term schema evolution |

Start with JSON during development because the productivity advantage of human-readable messages during initial integration is substantial. Switch to a binary format in production if bandwidth costs, battery consumption, or throughput measurements show JSON's overhead is a real problem rather than a theoretical one. Introduce Avro when data flows into a streaming or batch analytics system where schema management over time becomes important.

---

## How These Layers Fit Together

A complete IoT system composes choices across all three layers: application protocol, network technology, and serialization format. These choices interact. MQTT over a LoRaWAN connection is unusual because LoRaWAN's data rates are too low for MQTT's connection establishment overhead; CoAP over UDP is far better suited. AMQP on a Zigbee device is impractical; AMQP on a gateway relaying aggregated Zigbee data to Azure IoT Hub is entirely normal.

A common pattern in production deployments has devices communicating locally over BLE or Zigbee to a gateway, the gateway publishing aggregated readings to a cloud broker via MQTT or AMQP, the cloud broker routing messages to a time-series database and a real-time stream processor, and a WebSocket connection delivering live data to a browser dashboard. Each layer uses the protocol best suited to its environment and constraints.

Understanding where each protocol and format fits, and what it gives up to achieve its goals, is what allows an IoT architect to compose these layers into a system that actually works at scale under real-world conditions.
