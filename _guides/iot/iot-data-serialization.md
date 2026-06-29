---
title: "IoT Data Serialization"
layout: guide
category: IoT
subcategory: Advanced IoT
description: "Comparing JSON, Protocol Buffers, CBOR, MessagePack, and Avro for IoT data serialization, with bandwidth analysis, schema evolution strategies, and C# implementation examples."
tags: [iot, protocols, performance, dotnet, practical, fundamentals, telemetry]
---

## Why Serialization Matters in IoT

Every reading a sensor takes, every command a gateway relays, every status update a device publishes has to travel across a wire or through the air as bytes. The format those bytes take is serialization, and in IoT that choice has consequences that don't exist in most web application development.

A cloud-based API that sends an extra hundred bytes per response barely registers. A device running on a 2G cellular connection sending 288 telemetry readings per day notices immediately. At $0.0025 per kilobyte on some LPWAN providers, a verbose format can double your data bill. On a microcontroller with 256KB of flash and no floating-point unit, a serialization library that requires dynamic memory allocation or reflection can simply not run.

Four constraints shape serialization choices in IoT.

**Bandwidth** is the most obvious constraint. LPWAN technologies like LoRaWAN operate with maximum payload sizes between 11 and 242 bytes per message depending on data rate settings. NB-IoT and LTE-M support larger payloads but carry per-kilobyte costs. Even Wi-Fi and Ethernet devices benefit from compact formats when aggregating data from thousands of devices into a streaming pipeline.

**CPU and memory** matter especially on constrained devices. Some serialization approaches require runtime reflection, dynamic allocation, or intermediate representations that simply don't fit in the memory budgets of ARM Cortex-M0 or ESP8266 class devices. Others generate static code from schemas, producing serializers that run in a few hundred bytes of stack.

**Schema evolution** becomes critical once devices are deployed. A firmware update that changes a telemetry payload structure can break cloud-side consumers. Some formats handle field additions and removals gracefully through schema negotiation; others require careful versioning discipline to avoid silent data corruption.

**Interoperability** cuts across teams and systems. Device firmware teams, cloud backend teams, and data analytics teams all consume the same bytes. Formats that require specific toolchains or proprietary libraries create friction; formats with broad ecosystem support let each team use the tools they prefer.

---

## JSON

[JSON](https://www.json.org/json-en.html){:target="_blank" rel="noopener noreferrer"} is the default choice for most IoT projects because it is already everywhere. Every language has a JSON library, every API expects it, and any developer can read a JSON payload in a log file without special tooling. The tradeoffs are well understood: it is verbose, it encodes numbers as decimal strings, and it carries field names in every message.

A typical temperature and humidity reading in JSON might look like this:

```json
{
  "deviceId": "sensor-42",
  "timestamp": 1708790400,
  "temperature": 21.7,
  "humidity": 58.3,
  "batteryVoltage": 3.21
}
```

That message is around 95 bytes. The field names account for roughly 60% of that payload. When sending the same structure hundreds of times per day from thousands of devices, those repeated field names represent real cost.

In .NET, `System.Text.Json` handles IoT telemetry well when devices are not severely bandwidth-constrained. It supports source generation to avoid runtime reflection, which matters when deploying to Raspberry Pi or similar Linux-capable devices.

```csharp
using System.Text.Json;
using System.Text.Json.Serialization;

public class TelemetryReading
{
    [JsonPropertyName("deviceId")]
    public string DeviceId { get; set; } = "";

    [JsonPropertyName("timestamp")]
    public long Timestamp { get; set; }

    [JsonPropertyName("temperature")]
    public double Temperature { get; set; }

    [JsonPropertyName("humidity")]
    public double Humidity { get; set; }

    [JsonPropertyName("batteryVoltage")]
    public double BatteryVoltage { get; set; }
}

// Serialization
var reading = new TelemetryReading
{
    DeviceId = "sensor-42",
    Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
    Temperature = 21.7,
    Humidity = 58.3,
    BatteryVoltage = 3.21
};

string json = JsonSerializer.Serialize(reading);
byte[] jsonBytes = Encoding.UTF8.GetBytes(json);

// Deserialization
TelemetryReading? restored = JsonSerializer.Deserialize<TelemetryReading>(jsonBytes);
```

JSON is the right choice for development and debugging, for HTTP APIs between cloud services, for low-volume devices where simplicity outweighs efficiency, and for systems where humans need to read raw messages in logs or message brokers. When bandwidth or CPU becomes a constraint, consider moving to a binary format for the device-to-cloud leg while keeping JSON for cloud-to-cloud communication.

---

## Protocol Buffers

[Protocol Buffers](https://protobuf.dev/){:target="_blank" rel="noopener noreferrer"} (protobuf) is Google's binary serialization format, widely used for inter-service communication and increasingly popular for IoT pipelines. It requires defining message schemas in `.proto` files, which are then compiled into language-specific code. This compilation step is a constraint (you cannot send an ad-hoc message without a schema), but it also enforces consistency across all producers and consumers.

A protobuf schema for the same telemetry reading looks like this:

```protobuf
syntax = "proto3";

message TelemetryReading {
  string device_id = 1;
  int64 timestamp = 2;
  float temperature = 3;
  float humidity = 4;
  float battery_voltage = 5;
}
```

The numbers (1, 2, 3...) are field tags. These tags, not field names, appear in the encoded binary. When a field is absent, it takes zero bytes. When a field is present, it uses a tag-length-value encoding that is compact and fast to parse. The same telemetry message encodes to roughly 35-40 bytes, less than half the JSON representation.

In .NET, the [Google.Protobuf NuGet package](https://www.nuget.org/packages/Google.Protobuf){:target="_blank" rel="noopener noreferrer"} provides runtime support. You install the `protoc` compiler and the `Grpc.Tools` package to generate C# classes from `.proto` files during the build.

```csharp
// Generated class from TelemetryReading.proto (simplified)
// Install: dotnet add package Google.Protobuf

using Google.Protobuf;

// Serialization
var reading = new TelemetryReading
{
    DeviceId = "sensor-42",
    Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
    Temperature = 21.7f,
    Humidity = 58.3f,
    BatteryVoltage = 3.21f
};

byte[] protoBytes = reading.ToByteArray();

// Deserialization
TelemetryReading restored = TelemetryReading.Parser.ParseFrom(protoBytes);
```

Choose protobuf when bandwidth is a priority and you have control over both producer and consumer code, when you need a strongly typed contract between teams, or when you are building a gRPC-based gateway. It excels in inter-service communication within a cloud backend, where the schema compilation workflow is straightforward to manage. It is less suitable for direct use on severely constrained microcontrollers, where the generated code size and dependency on a protobuf runtime may not fit.

---

## CBOR

[CBOR (Concise Binary Object Representation)](https://cbor.io/){:target="_blank" rel="noopener noreferrer"} is defined in [RFC 7049](https://www.rfc-editor.org/rfc/rfc7049){:target="_blank" rel="noopener noreferrer"} and updated in [RFC 8949](https://www.rfc-editor.org/rfc/rfc8949){:target="_blank" rel="noopener noreferrer"}. It occupies a different position from protobuf: rather than requiring a pre-compiled schema, CBOR is self-describing like JSON but uses a compact binary encoding. If you can read JSON, you can understand CBOR; you just need a CBOR library to decode the bytes rather than reading them as text.

CBOR was designed specifically for constrained environments. It is the mandatory serialization format for [CoAP (Constrained Application Protocol)](https://coap.technology/){:target="_blank" rel="noopener noreferrer"}, the IoT equivalent of HTTP intended for devices that cannot run a full TCP/IP stack efficiently. CBOR encodes the same telemetry message in roughly 55-65 bytes, smaller than JSON but larger than protobuf, because it still carries field names (as byte strings rather than text strings, saving a few bytes).

The self-describing nature of CBOR is its main advantage over protobuf. A CBOR message can be decoded without any prior schema knowledge, which makes it useful when schema distribution is difficult, when devices may send different structures depending on their capabilities, or when you need to store messages and decode them years later without keeping the exact schema version alive.

In .NET, the built-in `System.Formats.Cbor` namespace (available since .NET 5) provides low-level CBOR reading and writing. For higher-level object mapping, [PeterO.Cbor](https://www.nuget.org/packages/PeterO.Cbor){:target="_blank" rel="noopener noreferrer"} offers a more ergonomic API.

```csharp
using System.Formats.Cbor;

// Serialization using low-level writer
var writer = new CborWriter();
writer.WriteStartMap(5);

writer.WriteTextString("deviceId");
writer.WriteTextString("sensor-42");

writer.WriteTextString("timestamp");
writer.WriteInt64(DateTimeOffset.UtcNow.ToUnixTimeSeconds());

writer.WriteTextString("temperature");
writer.WriteDouble(21.7);

writer.WriteTextString("humidity");
writer.WriteDouble(58.3);

writer.WriteTextString("batteryVoltage");
writer.WriteDouble(3.21);

writer.WriteEndMap();

byte[] cborBytes = writer.Encode();

// Deserialization
var reader = new CborReader(cborBytes);
reader.ReadStartMap();
while (reader.PeekState() != CborReaderState.EndMap)
{
    string key = reader.ReadTextString();
    // Read value based on key...
}
reader.ReadEndMap();
```

CBOR is well suited for CoAP-based devices, for gateways that aggregate data from diverse devices without a fixed schema, and for systems that need binary efficiency without the schema management overhead of protobuf.

---

## MessagePack

[MessagePack](https://msgpack.org/){:target="_blank" rel="noopener noreferrer"} takes a similar self-describing binary approach to CBOR but with a different encoding and a stronger ecosystem focus on high-performance serialization. Like CBOR, it does not require a compiled schema; you serialize C# objects directly and they map to a compact binary representation. Unlike CBOR, MessagePack is not tied to a specific IoT protocol or RFC; it emerged from the web application world as a compact alternative to JSON for REST APIs and WebSocket communication.

The same telemetry message in MessagePack encodes to roughly 55-65 bytes when using string keys, or as few as 20-25 bytes when using integer keys (an optional optimization where field names are replaced with compact integer identifiers, similar to how protobuf field tags work).

In .NET, [MessagePack-CSharp](https://github.com/MessagePack-CSharp/MessagePack-CSharp){:target="_blank" rel="noopener noreferrer"} by Yoshifumi Kawai is the standard library. It is notably fast, uses source generation to avoid reflection, and supports both attribute-based and contract-less serialization.

```csharp
// Install: dotnet add package MessagePack

using MessagePack;

[MessagePackObject]
public class TelemetryReading
{
    [Key(0)]
    public string DeviceId { get; set; } = "";

    [Key(1)]
    public long Timestamp { get; set; }

    [Key(2)]
    public double Temperature { get; set; }

    [Key(3)]
    public double Humidity { get; set; }

    [Key(4)]
    public double BatteryVoltage { get; set; }
}

// Serialization
var reading = new TelemetryReading
{
    DeviceId = "sensor-42",
    Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
    Temperature = 21.7,
    Humidity = 58.3,
    BatteryVoltage = 3.21
};

byte[] msgpackBytes = MessagePackSerializer.Serialize(reading);

// Deserialization
TelemetryReading restored = MessagePackSerializer.Deserialize<TelemetryReading>(msgpackBytes);
```

Using integer keys (as shown above with `[Key(0)]`) produces the most compact output and fastest serialization. The tradeoff is that adding fields must maintain key ordering discipline: if you remove key 2 and add a new field, you must assign it a new integer rather than reusing 2, or consumers on old schema versions will misread the data. This mirrors protobuf's field tag discipline.

MessagePack is a strong choice for .NET IoT gateways and edge services, for device-to-gateway communication where both sides run .NET or Node.js (where MessagePack libraries are also excellent), and for any scenario where you want binary compactness with a simpler workflow than protobuf's code generation step.

---

## Apache Avro

[Apache Avro](https://avro.apache.org/){:target="_blank" rel="noopener noreferrer"} takes a different approach from the other formats. Its primary strength is schema evolution support within streaming pipelines, and it was designed specifically for the Hadoop and Kafka ecosystems where billions of records flow through systems where schema changes are inevitable.

Avro schemas are defined in JSON and registered with a schema registry. When Avro serializes a message, it writes the data without field names (like protobuf), but the schema is referenced by ID from the registry rather than compiled into the binary. A consumer fetches the writer schema (the schema used when the data was written) and the reader schema (the schema the consumer expects) and applies field mapping rules to handle differences between them.

The schema evolution rules are explicit and well-defined: new fields with defaults can be added, optional fields can be removed if they have defaults, and field types can be promoted (int to long, float to double). These rules let you evolve the schema without coordinating simultaneous deployments of all producers and consumers, which is essential in IoT where devices may run old firmware for months after a cloud schema change.

In .NET, the [Apache.Avro NuGet package](https://www.nuget.org/packages/Apache.Avro){:target="_blank" rel="noopener noreferrer"} provides Avro support. When using Azure Event Hubs, the [Azure Schema Registry](https://learn.microsoft.com/en-us/azure/event-hubs/schema-registry-overview){:target="_blank" rel="noopener noreferrer"} integrates directly with Avro and handles schema versioning automatically.

```csharp
// Install: dotnet add package Apache.Avro

using Avro;
using Avro.Generic;
using Avro.IO;
using Avro.Specific;

// Avro schema definition
const string SchemaJson = @"{
  ""type"": ""record"",
  ""name"": ""TelemetryReading"",
  ""namespace"": ""iot.telemetry"",
  ""fields"": [
    { ""name"": ""deviceId"", ""type"": ""string"" },
    { ""name"": ""timestamp"", ""type"": ""long"" },
    { ""name"": ""temperature"", ""type"": ""double"" },
    { ""name"": ""humidity"", ""type"": ""double"" },
    { ""name"": ""batteryVoltage"", ""type"": [""null"", ""double""], ""default"": null }
  ]
}";

// Serialization using generic record
var schema = (RecordSchema)Schema.Parse(SchemaJson);
var record = new GenericRecord(schema);
record.Add("deviceId", "sensor-42");
record.Add("timestamp", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
record.Add("temperature", 21.7);
record.Add("humidity", 58.3);
record.Add("batteryVoltage", (object?)3.21);

using var ms = new MemoryStream();
var writer = new GenericWriter<GenericRecord>(schema);
var encoder = new BinaryEncoder(ms);
writer.Write(record, encoder);
encoder.Flush();
byte[] avroBytes = ms.ToArray();
```

Avro is the right choice when data flows into Kafka or Azure Event Hubs and downstream consumers need schema evolution flexibility, when you store IoT data in Parquet or ORC format for analytics (where Avro schemas translate directly), and when multiple teams consume the same stream and deploy on different schedules. It is rarely used for direct device communication because the schema registry dependency adds infrastructure complexity that constrained devices cannot support.

---

## Format Comparison

The table below compares each format across the dimensions that matter most in IoT system design.

| Format | Human Readable | Schema Required | Typical Message Size | CPU Overhead | .NET Support | Best Use Case |
|--------|---------------|-----------------|---------------------|--------------|--------------|---------------|
| **JSON** | Yes | No | ~95 bytes | Low-Medium | Excellent (BCL) | Development, cloud APIs, low-volume |
| **Protobuf** | No | Yes (compiled) | ~35-40 bytes | Very low | Good (Google.Protobuf) | Inter-service, gRPC, bandwidth-critical |
| **CBOR** | No | No | ~55-65 bytes | Low | Good (BCL + PeterO) | CoAP devices, schema-optional binary |
| **MessagePack** | No | Optional (int keys) | ~20-65 bytes | Very low | Excellent (MessagePack-CSharp) | .NET gateways, low-overhead binary |
| **Avro** | No | Yes (registry) | ~30-45 bytes | Medium | Good (Apache.Avro) | Kafka/Event Hubs streaming pipelines |

Size estimates assume the sample telemetry message with five fields (device ID, timestamp, temperature, humidity, battery voltage) without additional compression.

---

## Bandwidth Math: The Same Message in Each Format

To make the size differences concrete, consider a single telemetry payload from a temperature/humidity sensor sending readings every 5 minutes across a day. The payload carries these five fields: a 9-character device ID, a Unix timestamp, and three floating-point readings.

| Format | Message Size | Daily Messages | Daily Bytes per Device | Monthly Bytes per Device |
|--------|-------------|---------------|----------------------|--------------------------|
| JSON | 95 bytes | 288 | 27,360 bytes (26.7 KB) | 820,800 bytes (802 KB) |
| CBOR | 62 bytes | 288 | 17,856 bytes (17.4 KB) | 535,680 bytes (523 KB) |
| MessagePack (string keys) | 62 bytes | 288 | 17,856 bytes (17.4 KB) | 535,680 bytes (523 KB) |
| MessagePack (int keys) | 28 bytes | 288 | 8,064 bytes (7.9 KB) | 241,920 bytes (236 KB) |
| Protobuf | 38 bytes | 288 | 10,944 bytes (10.7 KB) | 328,320 bytes (321 KB) |
| Avro (binary) | 35 bytes | 288 | 10,080 bytes (9.8 KB) | 302,400 bytes (295 KB) |

Across 10,000 devices, JSON costs roughly 800 MB per month in raw telemetry data. MessagePack with integer keys costs roughly 236 MB. At scale, the format choice directly affects storage costs, transfer costs, and the capacity of your ingestion pipeline.

For LoRaWAN specifically, where individual messages are often capped at 51 bytes on low data rate settings, JSON cannot carry this payload at all without truncation, while protobuf and Avro fit comfortably.

---

## Schema Evolution: Adding and Removing Fields

Once devices are deployed in the field, schema changes become a coordination problem. Some devices will run old firmware, some will run new firmware, and the cloud backend needs to handle both simultaneously. How each format manages this differs significantly.

**JSON** has no built-in schema evolution mechanism. Adding a new field to a JSON payload breaks consumers that use strict deserialization (failing on unknown fields). Removing a field breaks consumers that expect it. Teams typically handle this with lenient deserialization settings that ignore unknown fields, and by never removing fields (only deprecating them). This works in practice but relies on discipline rather than enforcement.

**Protobuf** handles evolution through its field tag system. Adding a new field with a new tag number is always safe; old consumers that don't know the tag simply skip those bytes. Removing a field is safe as long as the tag number is reserved so it is never reused. Changing a field's type is generally not safe unless the types are wire-compatible (int32 and sint32, for example, are not). Renaming a field is always safe because only the tag number travels in the binary.

**CBOR** carries field names like JSON, so it faces the same evolution challenges unless combined with a schema registry or convention-based versioning. In CoAP environments, the [CBOR Object Signing and Encryption (COSE)](https://www.rfc-editor.org/rfc/rfc8152){:target="_blank" rel="noopener noreferrer"} standards and companion specifications like [OSCORE](https://www.rfc-editor.org/rfc/rfc8613){:target="_blank" rel="noopener noreferrer"} address security but not schema evolution directly.

**MessagePack** with string keys shares JSON's evolution challenges. With integer keys, it mirrors protobuf's approach: key numbers must be stable, new keys must use new integers, and old key integers must never be reused after removal. The discipline is identical but enforced by convention rather than a `.proto` file.

**Avro** provides the most sophisticated evolution support. It defines formal compatibility levels (backward, forward, and full compatibility) that a schema registry can enforce. When a consumer reads data with a different schema version, Avro's resolution rules govern how fields are mapped, defaulted, or ignored. Adding a field with a default value maintains backward compatibility. Removing a field with a default value maintains forward compatibility. Full compatibility requires both. The Azure Schema Registry and Confluent Schema Registry both enforce these rules automatically.

---

## Hybrid Approaches

Most IoT systems do not use a single format everywhere. Different legs of the pipeline have different constraints, and mixing formats for each leg often produces the best overall result.

**Device to gateway:** Use a compact binary format suited to the transport. On LoRaWAN, custom bit-packed binary is common because every byte counts. On MQTT over Wi-Fi or cellular, MessagePack or protobuf makes sense. The gateway has a schema definition and decodes the binary before forwarding upstream.

**Gateway to cloud:** The gateway translates to the cloud pipeline's preferred format. If the pipeline uses Kafka or Event Hubs with a schema registry, Avro is a natural choice here. If the pipeline ingests through HTTP into Azure IoT Hub or AWS IoT Core, JSON or protobuf are both well-supported.

**Inter-service communication in the cloud:** Once data is inside the cloud backend, gRPC with protobuf is a common choice for synchronous service calls. Kafka with Avro handles asynchronous streaming. Both formats support strongly typed contracts that enforce consistency across service boundaries.

**Storage:** Time-series data stored in Azure Data Explorer or InfluxDB is ingested in whatever format those systems accept (often JSON or CSV for raw ingestion, Parquet for cold storage). The serialization format used during transport does not have to match the storage format; a gateway or stream processor handles the conversion.

Format translation is cheap and happens at natural boundaries. A device does not need to speak Avro; a gateway or cloud function translates as the data crosses the constrained network boundary.

---

## Compression: When to Layer It On

Compression and serialization address overlapping problems but through different mechanisms. Serialization determines the structure; compression finds redundancy within that structure.

For a single small telemetry message like the five-field example above, compression generally does not help. gzip adds roughly 20 bytes of header overhead and needs repetitive patterns within the payload to achieve meaningful reduction. A 95-byte JSON message might compress to 90 bytes or actually grow slightly. Compression becomes beneficial when messages are batched: sending 100 readings in a single compressed payload can reduce the combined size by 60-70% compared to 100 uncompressed messages, because the repeated field names and structural patterns give the compressor strong redundancy to exploit.

The practical decision tree works as follows. If individual messages are small (under a few hundred bytes), use a compact binary format rather than JSON with compression. The binary format achieves similar size reduction without the CPU cost and latency of compression, and it works on a per-message basis without requiring batching. If you are batching messages for efficiency anyway (sending every 10 minutes rather than every minute), adding gzip or LZ4 compression on top of any format produces meaningful additional savings. If you are storing data in bulk (writing daily Parquet files to blob storage), storage-layer compression is standard and handled automatically by the storage format.

On constrained devices, compression is often impractical because it requires RAM for the decompression window. gzip requires at minimum 32KB of memory for decompression. On devices with 64-256KB total RAM, that is a significant portion of the budget. LZ4 and [Heatshrink](https://github.com/atomicobject/heatshrink){:target="_blank" rel="noopener noreferrer"} are alternatives designed for constrained environments, with memory footprints as small as a few hundred bytes, but they offer lower compression ratios.

---

## Choosing a Format

The right format depends on which constraints matter most in your specific deployment. The decision framework below helps identify where to start.

**Start with JSON if:**
- Devices have reliable broadband or Wi-Fi connectivity with no per-byte costs
- Development speed and debuggability are more important than efficiency
- The system sends low volumes (fewer than a few thousand messages per day per device)
- Cloud consumers already expect JSON and the cost of format translation exceeds the cost of the extra bytes

**Move to MessagePack if:**
- You want binary efficiency without a schema compilation step
- Both device and cloud are running .NET or a language with a good MessagePack library
- You need schema-optional flexibility but JSON is too verbose

**Choose protobuf if:**
- You have a defined schema that changes infrequently
- The system includes gRPC services between cloud components
- Multiple teams or languages consume the same message structure and you want a formal contract
- You are targeting Android or Go clients that have excellent protobuf toolchains

**Choose CBOR if:**
- Devices communicate over CoAP rather than MQTT or HTTP
- You need binary efficiency but cannot predistribute schemas to all consumers
- The device ecosystem is heterogeneous and schema-optional decoding is important

**Choose Avro if:**
- Data flows through Kafka or Azure Event Hubs
- Schema evolution across independent producer and consumer teams is a primary concern
- Downstream analytics use Spark, Databricks, or similar tools where Avro integrates naturally

**Consider custom bit-packed binary if:**
- You are on LoRaWAN or another severely constrained LPWAN with single-digit byte limits per message
- The message structure is completely fixed and will not evolve
- You need absolute minimum payload size and CPU overhead

Most production IoT systems land on a two or three format combination: a compact binary format (protobuf or MessagePack) for device-to-gateway, JSON or Avro for cloud pipeline communication, and Avro or Parquet for long-term storage. Starting simple with JSON everywhere and migrating the constrained legs to binary when measurements show actual bandwidth or cost problems is a valid and pragmatic approach.
