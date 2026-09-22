---
title: "IoT Data Serialization"
layout: guide
category: IoT
subcategory: Foundations
description: "Choosing a telemetry payload format: JSON, Protocol Buffers, CBOR, MessagePack, and Avro compared on measured size, schema requirements, and schema evolution, with C# examples, bandwidth math, and when compression helps."
tags: [practical, serialization, protobuf, cbor, messagepack, avro, schema-evolution]
---

## Why Serialization Matters in IoT

Every reading a sensor takes, every command a gateway relays, every status update a device publishes has to travel across a wire or through the air as bytes. The format those bytes take is serialization, and in IoT that choice has consequences that don't exist in most web application development.

A cloud-based API that sends an extra hundred bytes per response barely registers. A device on a metered cellular plan or a low-power wide-area network notices immediately, because every byte costs airtime, battery, or money. On a microcontroller with 256KB of flash and no floating-point unit, a serialization library that requires dynamic memory allocation or reflection can simply not run.

Four constraints shape serialization choices in IoT.

**Bandwidth** is the most obvious constraint. LoRaWAN's maximum application payload depends on region and data rate, from 11 bytes at the slowest US915 rate to a couple of hundred bytes at the fastest, and 51 bytes at the slowest EU868 rates. NB-IoT and LTE-M support larger payloads but carry per-kilobyte costs. Even Wi-Fi and Ethernet devices benefit from compact formats when aggregating data from thousands of devices into a streaming pipeline.

**CPU and memory** matter especially on constrained devices. Some serialization approaches require runtime reflection, dynamic allocation, or intermediate representations that simply don't fit in the memory budgets of ARM Cortex-M0 or ESP8266 class devices. Others generate static code from schemas, producing serializers that run in a few hundred bytes of stack.

**Schema evolution** becomes critical once devices are deployed. A firmware update that changes a telemetry payload structure can break cloud-side consumers. Some formats handle field additions and removals gracefully through schema negotiation; others require careful versioning discipline to avoid silent data corruption.

**Interoperability** cuts across teams and systems. Device firmware teams, cloud backend teams, and data analytics teams all consume the same bytes. Formats that require specific toolchains or proprietary libraries create friction; formats with broad ecosystem support let each team use the tools they prefer.

---

## JSON

[JSON](https://www.json.org/json-en.html){:target="_blank" rel="noopener noreferrer"} is the default choice for most IoT projects because it is already everywhere. Every language has a JSON library, every API expects it, and any developer can read a JSON payload in a log file without special tooling. Its costs are well understood. It is verbose, it encodes numbers as decimal text, and it carries every field name in every message.

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

Serialized without whitespace, that message is 104 bytes, and the field names account for about half of it. When sending the same structure hundreds of times per day from thousands of devices, those repeated names are half of every byte sent.

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

byte[] jsonBytes = JsonSerializer.SerializeToUtf8Bytes(reading);

// Deserialization
TelemetryReading? restored = JsonSerializer.Deserialize<TelemetryReading>(jsonBytes);
```

JSON is the right choice for development and debugging, for HTTP APIs between cloud services, for low-volume devices where simplicity outweighs efficiency, and for systems where humans need to read raw messages in logs or message brokers. When bandwidth or CPU becomes a constraint, consider moving to a binary format for the device-to-cloud leg while keeping JSON for cloud-to-cloud communication.

---

## Protocol Buffers

[Protocol Buffers](https://protobuf.dev/){:target="_blank" rel="noopener noreferrer"} (protobuf) is Google's binary serialization format, widely used for inter-service communication and increasingly popular for IoT pipelines. It requires defining message schemas in `.proto` files, which are then compiled into language-specific code. The compilation step means you cannot send an ad hoc message without a schema, but it also enforces consistency across all producers and consumers.

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

The numbers (1, 2, 3...) are field tags. These tags, not field names, appear in the encoded binary. A field left at its default value takes zero bytes, and a present field costs a one-byte tag plus its value. With the three readings declared as 32-bit `float`, the sample encodes to 32 bytes, less than a third of the JSON.

In .NET, the [Google.Protobuf NuGet package](https://www.nuget.org/packages/Google.Protobuf){:target="_blank" rel="noopener noreferrer"} provides runtime support, and the [Grpc.Tools](https://www.nuget.org/packages/Grpc.Tools){:target="_blank" rel="noopener noreferrer"} package bundles the `protoc` compiler and generates C# classes from `.proto` files during the build (despite the name, it works for plain protobuf without gRPC).

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

[CBOR (Concise Binary Object Representation)](https://cbor.io/){:target="_blank" rel="noopener noreferrer"} is defined in [RFC 8949](https://www.rfc-editor.org/rfc/rfc8949){:target="_blank" rel="noopener noreferrer"}, which replaced the original RFC 7049. It occupies a different position from protobuf: rather than requiring a pre-compiled schema, CBOR is self-describing like JSON but uses a compact binary encoding. If you can read JSON, you can understand CBOR; you just need a CBOR library to decode the bytes rather than reading them as text.

CBOR was designed for constrained environments, with small encoder and decoder code size as an explicit goal. It is a natural partner for [CoAP](https://coap.space/){:target="_blank" rel="noopener noreferrer"}, though CoAP itself does not mandate any payload format, and it is the encoding used by IETF security formats for constrained devices like COSE and OSCORE. Encoded as a map with the same text keys and 64-bit floats, the sample message is 98 bytes, barely smaller than the JSON. The savings people expect from switching JSON to CBOR come from dropping the keys (using integer keys or arrays) and from encoding readings as 32-bit or 16-bit floats where the precision allows, not from the binary encoding alone.

The self-describing nature of CBOR is its main advantage over protobuf. A CBOR message can be decoded without any prior schema knowledge, which makes it useful when schema distribution is difficult, when devices may send different structures depending on their capabilities, or when you need to store messages and decode them years later without keeping the exact schema version alive.

In .NET, the [System.Formats.Cbor](https://www.nuget.org/packages/System.Formats.Cbor){:target="_blank" rel="noopener noreferrer"} package from Microsoft provides low-level CBOR reading and writing. For higher-level object mapping, [PeterO.Cbor](https://www.nuget.org/packages/PeterO.Cbor){:target="_blank" rel="noopener noreferrer"} offers a more ergonomic API.

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

With string keys and 64-bit floats, the sample message is 98 bytes, the same as CBOR. With integer keys, MessagePack-CSharp writes the object as an array in key order, which drops the names entirely and brings the message to 43 bytes, or 31 bytes if the readings are 32-bit floats.

In .NET, [MessagePack-CSharp](https://github.com/MessagePack-CSharp/MessagePack-CSharp){:target="_blank" rel="noopener noreferrer"} by Yoshifumi Kawai is the standard library. It is fast, supports source generation to avoid runtime code generation, and offers both attribute-based and contract-less serialization.

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

Using integer keys (as shown above with `[Key(0)]`) produces the most compact output and fastest serialization. The cost is key discipline. If you remove key 2 and add a new field, the new field needs a new integer rather than reusing 2, or consumers on older versions will misread the data. This mirrors protobuf's field-tag discipline, without a `.proto` file to enforce it.

MessagePack is a strong choice for .NET IoT gateways and edge services, for device-to-gateway communication where both sides run .NET or Node.js (where MessagePack libraries are also excellent), and for any scenario where you want binary compactness with a simpler workflow than protobuf's code generation step.

---

## Apache Avro

[Apache Avro](https://avro.apache.org/){:target="_blank" rel="noopener noreferrer"} takes a different approach from the other formats. Its primary strength is schema evolution support within streaming pipelines, and it was designed specifically for the Hadoop and Kafka ecosystems where billions of records flow through systems where schema changes are inevitable.

Avro schemas are defined in JSON and registered with a schema registry. Avro writes values in schema order with no field names or tags at all, so the sample message is 40 bytes. A registry-based pipeline prefixes each message with a small schema identifier, which adds a few bytes. A consumer fetches the writer schema (the schema used when the data was written) and the reader schema (the schema the consumer expects) and applies field mapping rules to handle differences between them.

The schema evolution rules are explicit and well-defined: new fields with defaults can be added, optional fields can be removed if they have defaults, and field types can be promoted (int to long, float to double). These rules let you evolve the schema without coordinating simultaneous deployments of all producers and consumers, which is essential in IoT where devices may run old firmware for months after a cloud schema change.

In .NET, the [Apache.Avro NuGet package](https://www.nuget.org/packages/Apache.Avro){:target="_blank" rel="noopener noreferrer"} provides Avro support. When using Azure Event Hubs, the [Azure Schema Registry](https://learn.microsoft.com/en-us/azure/event-hubs/schema-registry-overview){:target="_blank" rel="noopener noreferrer"} integrates directly with Avro and handles schema versioning automatically.

```csharp
// Install: dotnet add package Apache.Avro

using Avro;
using Avro.Generic;
using Avro.IO;

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
record.Add("timestamp", DateTimeOffset.UtcNow.ToUnixTimeSeconds());
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

Sizes below are measured by encoding the sample message (a 9-character device ID, a Unix timestamp in seconds, and three readings) without compression. Protobuf uses 32-bit floats as its schema declares, and the others use 64-bit floats as their C# samples do.

| Format | Human Readable | Schema Required | Sample Size | .NET Library | Best Use Case |
|--------|---------------|-----------------|-------------|--------------|---------------|
| **JSON** | Yes | No | 104 bytes | System.Text.Json (built in) | Development, cloud APIs, low volume |
| **Protobuf** | No | Yes (compiled) | 32 bytes | Google.Protobuf | Bandwidth-critical telemetry, gRPC |
| **CBOR** (text keys) | No | No | 98 bytes | System.Formats.Cbor, PeterO.Cbor | CoAP devices, schema-optional binary |
| **MessagePack** (string keys) | No | No | 98 bytes | MessagePack-CSharp | Schema-free binary between services |
| **MessagePack** (integer keys) | No | By convention | 43 bytes | MessagePack-CSharp | .NET gateways and edge services |
| **Avro** | No | Yes (registry) | 40 bytes, plus a schema ID | Apache.Avro | Kafka and Event Hubs pipelines |

The table's main lesson is that the binary formats save little until field names leave the payload. CBOR and MessagePack with string keys land within a few bytes of JSON for this message, while every format that drops the names lands between a third and a half of the JSON size.

---

## Bandwidth Math: The Same Message in Each Format

Consider the same sensor reporting every five minutes, which is 288 messages a day.

| Format | Message Size | Per Device per Day | Per Device per 30 Days | 10,000 Devices per 30 Days |
|--------|-------------|--------------------|------------------------|----------------------------|
| JSON | 104 bytes | 29.3 KB | 878 KB | About 9.0 GB |
| CBOR or MessagePack (string keys) | 98 bytes | 27.6 KB | 827 KB | About 8.5 GB |
| MessagePack (integer keys) | 43 bytes | 12.1 KB | 363 KB | About 3.7 GB |
| Avro | 40 bytes | 11.3 KB | 338 KB | About 3.5 GB |
| Protobuf | 32 bytes | 9.0 KB | 270 KB | About 2.8 GB |

Protocol framing, TLS records, and platform message metering come on top of these payload sizes and can dominate them for small messages, so compare formats on a real connection before committing. The format choice matters most on the constrained leg. At LoRaWAN's slower data rates, where a frame carries 51 bytes or fewer, the JSON message does not fit at all, while the protobuf and Avro encodings do.

---

## Schema Evolution: Adding and Removing Fields

Once devices are deployed in the field, schema changes become a coordination problem. Some devices will run old firmware, some will run new firmware, and the cloud backend needs to handle both simultaneously. How each format manages this differs significantly.

**JSON** has no built-in schema evolution mechanism. Adding a new field to a JSON payload breaks consumers that use strict deserialization (failing on unknown fields). Removing a field breaks consumers that expect it. Teams typically handle this with lenient deserialization settings that ignore unknown fields, and by never removing fields (only deprecating them). This works in practice but relies on discipline rather than enforcement.

**Protobuf** handles evolution through its field tags. Adding a field with a new tag number is safe, because old consumers skip tags they don't know. Removing a field is safe as long as its tag number is marked `reserved` so it is never reused. Changing a field's type is generally unsafe unless the types share a wire encoding (int32 and sint32, for example, do not). Renaming a field is safe for the binary format, since only the tag number travels, but it breaks consumers that use protobuf's JSON mapping.

**CBOR** carries field names like JSON, so it faces the same evolution challenges unless combined with a schema registry or convention-based versioning. CBOR's companion schema language, [CDDL](https://www.rfc-editor.org/rfc/rfc8610){:target="_blank" rel="noopener noreferrer"}, can describe the expected structure for validation, but it does not define evolution rules the way Avro does.

**MessagePack** with string keys shares JSON's evolution challenges. With integer keys, it mirrors protobuf's approach: key numbers must be stable, new keys must use new integers, and old key integers must never be reused after removal. The discipline is identical but enforced by convention rather than a `.proto` file.

**Avro** provides the most sophisticated evolution support. It defines formal compatibility levels (backward, forward, and full compatibility) that a schema registry can enforce. When a consumer reads data with a different schema version, Avro's resolution rules govern how fields are mapped, defaulted, or ignored. Adding a field with a default value maintains backward compatibility. Removing a field with a default value maintains forward compatibility. Full compatibility requires both. The Azure Schema Registry and Confluent Schema Registry both enforce these rules automatically.

---

## Hybrid Approaches

Most IoT systems do not use a single format everywhere. Different legs of the pipeline have different constraints, and mixing formats for each leg often produces the best overall result.

**Device to gateway:** Use a compact binary format suited to the transport. On LoRaWAN, custom bit-packed binary is common because every byte counts. On MQTT over Wi-Fi or cellular, MessagePack or protobuf makes sense. The gateway has a schema definition and decodes the binary before forwarding upstream.

**Gateway to cloud:** The gateway translates to the cloud pipeline's preferred format. If the pipeline uses Kafka or Event Hubs with a schema registry, Avro is a natural choice here. If the pipeline ingests through HTTP into Azure IoT Hub or AWS IoT Core, JSON or protobuf are both well-supported.

**Inter-service communication in the cloud:** Once data is inside the cloud backend, gRPC with protobuf is a common choice for synchronous service calls. Kafka with Avro handles asynchronous streaming. Both formats support strongly typed contracts that enforce consistency across service boundaries.

**Storage:** Time-series data stored in Azure Data Explorer or InfluxDB is ingested in whatever format those systems accept (often JSON or CSV for raw ingestion, Parquet for cold storage). The serialization format used during transport does not have to match the storage format; a gateway or stream processor handles the conversion.

Format translation is cheap and happens at natural boundaries. A device does not need to speak Avro. A gateway or cloud function translates as the data crosses the constrained network boundary.

---

## Compression: When to Layer It On

Compression and serialization address overlapping problems but through different mechanisms. Serialization determines the structure; compression finds redundancy within that structure.

For a single small telemetry message like the five-field example above, compression generally does not help. gzip adds roughly 20 bytes of header overhead and needs repetitive patterns within the payload to achieve meaningful reduction. Compressing the 104-byte JSON sample with gzip produces 116 bytes. Compression pays off when messages are batched, because a batch of readings repeats the same field names and structure, which gives the compressor redundancy to exploit. A batch of 100 of these JSON readings commonly compresses to a small fraction of its raw size, though the ratio depends on how much the values vary.

The practical decision tree works as follows. If individual messages are small (under a few hundred bytes), use a compact binary format rather than JSON with compression. The binary format achieves similar size reduction without the CPU cost and latency of compression, and it works on a per-message basis without requiring batching. If you are batching messages for efficiency anyway (sending every 10 minutes rather than every minute), adding gzip or LZ4 compression on top of any format produces meaningful additional savings. If you are storing data in bulk (writing daily Parquet files to blob storage), storage-layer compression is standard and handled automatically by the storage format.

On constrained devices, compression costs RAM. A standard deflate (gzip) stream can reference up to 32 KB of history, so the decompressor needs a window that size, which is a large share of a device with 64 to 256 KB of RAM. LZ4 and [Heatshrink](https://github.com/atomicobject/heatshrink){:target="_blank" rel="noopener noreferrer"} are designed for small memory footprints, with Heatshrink configurable down to a few hundred bytes, at the cost of lower compression ratios.

---

## Choosing a Format

The tree below starts from the constraint that usually decides the question.

```text
Is the device on LoRaWAN or another link with frames of tens of bytes?
├─ Yes → Fixed structure that will not change?
│        ├─ Yes → custom bit-packed binary (absolute minimum size)
│        └─ No  → protobuf, with a gateway or network server decoding upstream
└─ No  → Do per-byte cost or battery measurements show JSON is a problem?
         ├─ No  → JSON (simplest to debug; revisit when measurements change)
         └─ Yes → Can producers and consumers share a compiled schema?
                  ├─ Yes → Data lands in Kafka or Event Hubs with many consumer teams?
                  │        ├─ Yes → Avro with a schema registry
                  │        └─ No  → protobuf
                  └─ No  → Device speaks CoAP, or schemas can't be distributed?
                           ├─ Yes → CBOR (drop keys or use small floats to save bytes)
                           └─ No  → MessagePack with integer keys
```

Most production systems end up with two or three formats: a compact binary format on the constrained device leg, JSON or Avro in the cloud pipeline, and a columnar format like Parquet in long-term storage. Starting with JSON everywhere and moving only the constrained legs to binary when measurements show a bandwidth or cost problem is a sound path.
