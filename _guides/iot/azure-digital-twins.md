---
title: "Azure Digital Twins"
layout: guide
category: IoT
subcategory: Advanced IoT
description: "Modeling real-world environments with Azure Digital Twins, covering DTDL modeling language, graph-based twin management, the .NET SDK, IoT Hub integration, and event-driven processing patterns."
tags: [iot, azure, digital-twins, architecture, dotnet, practical, modeling]
---

## What Azure Digital Twins Is

[Azure Digital Twins](https://learn.microsoft.com/en-us/azure/digital-twins/overview){:target="_blank" rel="noopener noreferrer"} is a PaaS platform for creating live, graph-based models of real-world environments. Where IoT Hub tracks the state of individual physical devices, Azure Digital Twins lets you model entire systems. That means a factory floor with machines, conveyor belts, and work cells, or a building with floors, rooms, thermostats, and HVAC units, or a smart city with roads, traffic sensors, and intersections. The platform represents each element in that environment as a digital twin, connects twins through typed relationships, and keeps the graph synchronized with live sensor data.

The core value is in the graph. Once your environment is modeled, you can query it using a SQL-like syntax, reason about how one part of the system affects another, and route property changes to downstream services for analytics, visualization, or automated response. This moves IoT beyond simple device monitoring toward environment-level intelligence.

### Problems Azure Digital Twins Solves

IoT Hub and device twins address the challenge of connecting and tracking individual devices. Azure Digital Twins addresses the challenge of understanding how those devices relate to each other and to the physical spaces they inhabit.

Consider a building management scenario. IoT Hub tells you that thermostat 14 is reporting 74°F. Azure Digital Twins tells you that thermostat 14 is in Room 302, Room 302 is on Floor 3, Floor 3 is in Building A, and Building A is in a campus that also contains Buildings B and C. When an HVAC unit downstream of Room 302 starts showing anomalous behavior, the graph lets you traverse relationships to identify all rooms that unit serves, rather than cross-referencing lookup tables.

The platform is designed for three overlapping problem domains. Simulation lets you test how changes in one part of the environment propagate to others before applying them to physical infrastructure. Monitoring lets you maintain a continuously updated representation of environmental state that aggregates across many underlying devices. Optimization lets you feed the graph into analytics pipelines that recommend or automatically trigger adjustments based on environment-wide patterns rather than per-device rules.

---

## Device Twins vs. Digital Twins

Azure has two features with similar names that serve different purposes, and the distinction matters before you start designing a solution.

| Aspect | IoT Hub Device Twins | Azure Digital Twins |
|--------|---------------------|---------------------|
| **Scope** | One twin per physical device | Models entire environments, spaces, and systems |
| **Purpose** | Synchronize desired/reported state between cloud and device | Model relationships between entities in the real world |
| **Relationships** | Flat, no connections between device twins | Graph, entities connected through typed relationships |
| **Query** | Limited twin query language per device | SQL-like graph query across the entire environment |
| **Schema** | Unstructured JSON, no enforced model | DTDL-defined models enforce structure |
| **Integration** | Native to IoT Hub | Integrates with IoT Hub, Event Grid, Azure Maps, and TSI |
| **Use case** | Configuring a device, reading its last-known state | Environment monitoring, simulation, cross-entity analytics |

In practice, these two features are complementary. IoT Hub device twins track per-device state, and an Azure Function bridges telemetry from IoT Hub into Azure Digital Twins to keep the environment model current.

---

## DTDL: Digital Twins Definition Language

[DTDL (Digital Twins Definition Language)](https://learn.microsoft.com/en-us/azure/digital-twins/concepts-models){:target="_blank" rel="noopener noreferrer"} is the schema language used to define the structure of digital twins. You write models in DTDL (JSON-LD format), upload them to your Azure Digital Twins instance, and then instantiate twins based on those models. DTDL is an open specification and is also used by IoT Plug and Play devices.

### Interfaces

Every DTDL model is an interface. An interface defines the shape of a twin: what properties it has, what telemetry it emits, what relationships it can form, and what components it contains. You give each interface a globally unique identifier in a specific DTDL ID format.

```json
{
  "@context": "dtmi:dtdl:context;3",
  "@type": "Interface",
  "@id": "dtmi:com:example:Room;1",
  "displayName": "Room",
  "contents": [
    {
      "@type": "Property",
      "name": "temperature",
      "schema": "double",
      "writable": true
    },
    {
      "@type": "Property",
      "name": "occupied",
      "schema": "boolean",
      "writable": true
    },
    {
      "@type": "Telemetry",
      "name": "motionDetected",
      "schema": "boolean"
    },
    {
      "@type": "Relationship",
      "name": "contains",
      "target": "dtmi:com:example:Thermostat;1"
    }
  ]
}
```

### Properties vs. Telemetry

Properties and telemetry look similar but behave differently within the platform.

Properties represent persisted state. When you update a property on a twin, the value is stored in the twin graph and available through queries. Properties are appropriate for values that have a current state you need to recall later, such as the set-point temperature of a thermostat, whether a room is occupied, or the current operational mode of a machine.

Telemetry represents a stream of measurements that are not stored by Azure Digital Twins itself. Telemetry events flow through the service and can be routed downstream to Event Hub or Event Grid for storage and analysis, but the Digital Twins graph does not retain individual readings. Telemetry is appropriate for high-frequency sensor data like raw temperature samples every five seconds, where you want stream processing rather than state storage.

A common pattern combines both: telemetry events from a device trigger an Azure Function that reads the telemetry value and updates the corresponding property on the twin. This way, the property always reflects the latest known state while the raw stream flows to Time Series Insights or Azure Data Explorer for historical analysis.

### Relationships

Relationships define directed edges between twins. A relationship has a name, an optional target model type, and optional properties of its own. You can attach a "strength" or "capacity" property to a relationship to carry edge-level semantics, not just node-level semantics.

```json
{
  "@type": "Relationship",
  "name": "feeds",
  "displayName": "Feeds",
  "target": "dtmi:com:example:Room;1",
  "properties": [
    {
      "@type": "Property",
      "name": "airflowRate",
      "schema": "double"
    }
  ]
}
```

### Components

Components let you compose an interface from other interfaces without using inheritance. A Room model can include a LightingPanel component without making LightingPanel a separate twin in the graph. Components exist logically within their parent twin and are not separately addressable.

```json
{
  "@type": "Component",
  "name": "lighting",
  "schema": "dtmi:com:example:LightingPanel;1"
}
```

Use components when the sub-entity is always part of its parent and has no independent lifecycle. Use relationships when the sub-entity exists independently and can be connected to multiple parents.

### Inheritance

DTDL interfaces can extend other interfaces using the `extends` keyword, which works similarly to class inheritance. A `ConferenceRoom` interface can extend `Room`, inheriting all its properties and telemetry while adding its own. This lets you build a model hierarchy that mirrors your physical environment's taxonomy.

---

## Graph-Based Modeling

An Azure Digital Twins instance is a property graph where twins are nodes and relationships are directed edges. This graph structure is what distinguishes Digital Twins from a flat device registry.

### Modeling a Building

A multi-floor office building might be modeled with the following hierarchy. The graph traversal matters: you can ask "which rooms does HVAC unit 7 serve?" by following `feeds` relationships from the HVAC twin to all Room twins, without maintaining a separate lookup table.

```
Building
  └── [contains] → Floor 1
        └── [contains] → Room 101
              └── [contains] → Thermostat-A
              └── [contains] → LightSensor-B
        └── [contains] → Room 102
  └── [contains] → Floor 2
        └── [contains] → Room 201

HVACUnit-7 → [feeds] → Room 101
HVACUnit-7 → [feeds] → Room 201
```

### Querying the Graph

The [Azure Digital Twins query language](https://learn.microsoft.com/en-us/azure/digital-twins/concepts-query-language){:target="_blank" rel="noopener noreferrer"} is a SQL-like syntax for querying twins and traversing relationships.

```sql
-- Find all rooms with temperature above 76°F
SELECT * FROM DIGITALTWINS T
WHERE IS_OF_MODEL('dtmi:com:example:Room;1')
AND T.temperature > 76.0

-- Find all twins related to a specific HVAC unit
SELECT Room FROM DIGITALTWINS HvacUnit
JOIN Room RELATED HvacUnit.feeds
WHERE HvacUnit.$dtId = 'HVACUnit-7'

-- Find all thermostats inside rooms on Floor 1
SELECT Thermostat FROM DIGITALTWINS Floor
JOIN Room RELATED Floor.contains
JOIN Thermostat RELATED Room.contains
WHERE Floor.$dtId = 'Floor-1'
AND IS_OF_MODEL(Thermostat, 'dtmi:com:example:Thermostat;1')
```

Graph queries can traverse multiple relationship hops, which enables cross-entity analysis that would require complex joins in a relational model or multiple queries against a flat device registry.

---

## Creating and Managing Twins with the .NET SDK

The [Azure.DigitalTwins.Core](https://www.nuget.org/packages/Azure.DigitalTwins.Core){:target="_blank" rel="noopener noreferrer"} NuGet package provides the .NET client for managing models, twins, and relationships.

### Setting Up the Client

```csharp
using Azure.Identity;
using Azure.DigitalTwins.Core;

var credential = new DefaultAzureCredential();
var client = new DigitalTwinsClient(
    new Uri("https://<your-instance>.api.wus2.digitaltwins.azure.net"),
    credential);
```

`DefaultAzureCredential` works across local development (via Azure CLI login) and production (via managed identity), so no connection strings or secrets need to change between environments.

### Uploading a DTDL Model

```csharp
string dtdl = await File.ReadAllTextAsync("Room.json");
await client.CreateModelsAsync(new[] { dtdl });
```

Models are uploaded once and then referenced by ID when creating twins. If you change a model, you must upload it with an incremented version number; DTDL model IDs include the version as the final segment.

### Creating a Twin

Twins are created using `BasicDigitalTwin`, a dictionary-backed class that handles serialization.

```csharp
var roomTwin = new BasicDigitalTwin
{
    Id = "Room-101",
    Metadata = { ModelId = "dtmi:com:example:Room;1" },
    Contents =
    {
        ["temperature"] = 72.5,
        ["occupied"] = false
    }
};

await client.CreateOrReplaceDigitalTwinAsync("Room-101", roomTwin);
```

For strongly typed access, you can define a C# class and use generic overloads, which provides compile-time property name safety at the cost of maintaining a separate C# class alongside your DTDL model.

### Updating Twin Properties

Property updates use JSON Patch to apply partial updates without overwriting the entire twin.

```csharp
var patch = new JsonPatchDocument();
patch.AppendReplace("/temperature", 74.1);
patch.AppendReplace("/occupied", true);

await client.UpdateDigitalTwinAsync("Room-101", patch);
```

JSON Patch operations include `add`, `replace`, and `remove`. Use `replace` when the property already exists (which it will if you set it during creation) and `add` when inserting an optional property for the first time.

### Creating a Relationship

```csharp
var relationship = new BasicRelationship
{
    Id = "Room-101-contains-Thermostat-A",
    SourceId = "Room-101",
    TargetId = "Thermostat-A",
    Name = "contains"
};

await client.CreateOrReplaceRelationshipAsync(
    "Room-101",
    "Room-101-contains-Thermostat-A",
    relationship);
```

Relationship IDs must be unique within the scope of their source twin. A common convention is to concatenate the source ID, relationship name, and target ID.

### Querying Twins from C#

```csharp
string query = "SELECT * FROM DIGITALTWINS T " +
               "WHERE IS_OF_MODEL('dtmi:com:example:Room;1') " +
               "AND T.temperature > 76.0";

AsyncPageable<BasicDigitalTwin> results =
    client.QueryAsync<BasicDigitalTwin>(query);

await foreach (BasicDigitalTwin twin in results)
{
    Console.WriteLine($"{twin.Id}: {twin.Contents["temperature"]}°F");
}
```

The query API returns paginated results. `AsyncPageable<T>` from the Azure SDK handles pagination automatically when you iterate with `await foreach`.

### Deleting Twins and Relationships

Twins cannot be deleted while they still have relationships. You must delete all relationships first, then delete the twin.

```csharp
// Delete all outgoing relationships
AsyncPageable<BasicRelationship> rels =
    client.GetRelationshipsAsync<BasicRelationship>("Room-101");

await foreach (BasicRelationship rel in rels)
{
    await client.DeleteRelationshipAsync("Room-101", rel.Id);
}

// Delete incoming relationships from other twins (if needed)
// Then delete the twin
await client.DeleteDigitalTwinAsync("Room-101");
```

---

## IoT Hub Integration: Routing Device Telemetry to Digital Twins

The most common integration pattern connects IoT Hub to Azure Digital Twins through an Azure Function. When a device sends telemetry to IoT Hub, IoT Hub routes the message to an Event Hub endpoint, and the Azure Function processes each message to update the corresponding twin.

### The Routing Architecture

```
Physical Device → IoT Hub → Event Hub (Custom Endpoint)
                                    ↓
                            Azure Function
                                    ↓
                        Azure Digital Twins (Update Twin Properties)
```

IoT Hub's message routing can filter which messages reach the Event Hub endpoint based on message body content or application properties, so only relevant telemetry triggers the function.

### Azure Function for Twin Updates

```csharp
using Azure.DigitalTwins.Core;
using Azure.Identity;
using Azure.Messaging.EventHubs;
using Microsoft.Azure.Functions.Worker;
using System.Text.Json;

public class TelemetryIngestFunction
{
    private readonly DigitalTwinsClient _twinsClient;

    public TelemetryIngestFunction()
    {
        var credential = new DefaultAzureCredential();
        _twinsClient = new DigitalTwinsClient(
            new Uri(Environment.GetEnvironmentVariable("ADT_INSTANCE_URL")!),
            credential);
    }

    [Function("IngestTelemetry")]
    public async Task Run(
        [EventHubTrigger("telemetry-hub", Connection = "EventHubConnection")]
        EventData[] events)
    {
        foreach (EventData evt in events)
        {
            string deviceId = evt.SystemProperties["iothub-connection-device-id"]
                              as string ?? string.Empty;

            using var doc = JsonDocument.Parse(evt.Data);
            JsonElement root = doc.RootElement;

            if (!root.TryGetProperty("temperature", out JsonElement tempElement))
                continue;

            double temperature = tempElement.GetDouble();

            // Map device ID to twin ID (could be a lookup, or same ID by convention)
            string twinId = $"Thermostat-{deviceId}";

            var patch = new JsonPatchDocument();
            patch.AppendReplace("/temperature", temperature);

            await _twinsClient.UpdateDigitalTwinAsync(twinId, patch);
        }
    }
}
```

The function uses a managed identity assigned to the Function App to authenticate with Azure Digital Twins, keeping credentials out of configuration files. The Function App's managed identity needs the "Azure Digital Twins Data Owner" or "Azure Digital Twins Data Contributor" role on the Digital Twins instance.

### Device ID to Twin ID Mapping

Physical device IDs in IoT Hub rarely match twin IDs directly in complex environments. A thermostat registered as "device-b47a9c" in IoT Hub might correspond to the twin "Thermostat-Floor3-Room302" in the graph. The Azure Function needs a mapping strategy, and the right approach depends on scale.

For small environments, a hardcoded dictionary or JSON configuration file works. For larger deployments, storing the mapping in Azure Table Storage or Azure Cosmos DB lets you update it without redeploying the function. Some teams tag devices in IoT Hub with twin metadata using device twin tags, then read those tags in the function to resolve the mapping dynamically.

---

## Event Routing: Propagating Twin Changes Downstream

When a twin's property changes, Azure Digital Twins can publish that change as an event to an Event Grid topic. Downstream services subscribe to those events to trigger processing, alerts, visualization updates, or further twin modifications.

### Configuring Event Routes

An event route tells Azure Digital Twins which change events to publish and where to send them. You configure routes through the portal, the SDK, or the CLI.

```csharp
string routeId = "route-all-property-changes";
string endpointName = "event-grid-endpoint"; // pre-configured in ADT

DigitalTwinsEventRoute route = new DigitalTwinsEventRoute(endpointName)
{
    Filter = "type = 'Microsoft.DigitalTwins.Twin.Update'"
};

await client.CreateOrReplaceEventRouteAsync(routeId, route);
```

Event filters use a subset of the DTDL query language and can scope routing to specific event types, specific model types, or specific twin IDs, so you aren't forced to forward every change to every downstream system.

### Event Payload Structure

When a twin property changes, the downstream system receives an event with this structure:

```json
{
  "id": "event-guid",
  "type": "Microsoft.DigitalTwins.Twin.Update",
  "source": "contoso-adt.api.wus2.digitaltwins.azure.net",
  "data": {
    "modelId": "dtmi:com:example:Room;1",
    "patch": [
      {
        "value": 78.2,
        "path": "/temperature",
        "op": "replace"
      }
    ]
  },
  "subject": "Room-101",
  "time": "2025-11-01T14:22:30.123Z"
}
```

The `subject` field identifies which twin changed, and `data.patch` contains the JSON Patch operations that describe what changed. This lets downstream consumers react to specific property changes rather than re-reading the entire twin.

### Downstream Processing Patterns

A common pattern routes twin update events to Azure Functions that apply business logic. If Room 101's temperature exceeds a threshold, the function could update the HVACUnit twin that feeds that room to increase airflow, which in turn triggers another event that updates the room's projected temperature.

This creates a reactive graph where changes propagate through the environment model without a central orchestrator polling for conditions. Each processing step subscribes to the events it cares about and updates the twins within its responsibility.

---

## Integration with Azure Services

### Azure Maps

[Azure Maps](https://learn.microsoft.com/en-us/azure/azure-maps/about-azure-maps){:target="_blank" rel="noopener noreferrer"} provides floor plan and map rendering that can be bound to Azure Digital Twins data. The [Azure Digital Twins integration with Azure Maps](https://learn.microsoft.com/en-us/azure/digital-twins/how-to-integrate-maps){:target="_blank" rel="noopener noreferrer"} lets you display live twin property values as a spatial overlay on a building floor plan, so facilities teams see a visual representation of room temperatures, occupancy states, or equipment status rather than a table of twin IDs.

The integration works through Azure Maps Creator, which imports building data as indoor maps, and a SignalR-based web application that subscribes to twin change events and updates the map markers in real time.

### Azure Data Explorer and Time Series Insights

Azure Digital Twins does not store historical property values. The graph always reflects current state. For historical analysis and trend detection, twin update events are routed to [Azure Data Explorer](https://learn.microsoft.com/en-us/azure/data-explorer/data-explorer-overview){:target="_blank" rel="noopener noreferrer"} (ADX) or, in older architectures, Time Series Insights.

ADX provides fast time-series querying with the Kusto Query Language (KQL), making it well suited for questions like "show me the temperature trend for Room 101 over the past 30 days" or "which rooms exceeded 78°F more than three times this week?" The pattern is to route twin update events through Event Hub into ADX using ADX's native Event Hub ingestion, then query ADX for historical data while querying the Digital Twins graph for current state.

### 3D Visualization

For factory floor or industrial asset modeling, the [Azure Digital Twins 3D Scenes Studio](https://learn.microsoft.com/en-us/azure/digital-twins/how-to-use-3d-scenes-studio){:target="_blank" rel="noopener noreferrer"} is a no-code tool that lets you upload a 3D model in GLB format, map parts of the model to twins, and configure visual alerts that activate when twin properties cross thresholds. An engineer looking at a 3D rendering of a factory floor can see which machines are running hot, which are idle, and which have flagged anomalies, with all data driven from live twin properties.

---

## Use Cases

### Building Management

A building modeled in Azure Digital Twins contains floor, room, thermostat, lighting, and HVAC twins connected through a hierarchy of `contains` and `feeds` relationships. Facilities managers query the graph to understand which HVAC unit serves which rooms, then set desired temperatures on thermostat twins, which propagate through IoT Hub back to physical devices. When an HVAC unit reports abnormal vibration, the graph identifies all rooms it feeds so the team can proactively notify occupants.

### Factory Floor Simulation

A manufacturing plant models machines, conveyor belts, work cells, and material buffers as twins with relationships representing physical connections and material flow. When a machine twin reports increased cycle time, the system traverses downstream relationships to identify which buffers are at risk of overflow before the problem propagates. This enables predictive intervention rather than reactive response when a buffer fills and stops the line.

### Predictive Maintenance

Equipment twins carry properties for operating hours, last maintenance date, and sensor readings like vibration and temperature. When Azure Data Explorer identifies an anomalous vibration trend for a specific asset, it triggers an Azure Function that updates the twin's `maintenanceRisk` property to `high`. Event routing then fires an alert to the facilities management system, which creates a work order. The twin serves as the coordination point between sensor data, predictive analytics, and maintenance workflows.

### Smart City Modeling

A city district is modeled with road segment twins, traffic sensor twins, parking area twins, and intersection signal controller twins. Traffic signal timing adjustments made through the twin graph propagate to physical controllers through IoT Hub. Planners query the graph to simulate how closing one road segment for construction would affect intersection load across the district before issuing permits.

---

## Common Pitfalls

**Modeling everything as a twin when a property suffices.** A building's postal address does not need to be a twin; it is a property on the Building twin. Create twins for entities that have their own lifecycle, their own sensors, or their own relationships. Over-modeling fragments a simple environment into a hard-to-query graph.

**Storing high-frequency telemetry in properties.** If a sensor emits readings every second, storing each reading as a property update will flood the event routing pipeline and generate unnecessary costs. Use the DTDL telemetry type for high-frequency streams and route them to Event Hub, updating the corresponding property only at a meaningful interval like every 30 seconds or when the value crosses a threshold.

**Ignoring the relationship deletion constraint.** Azure Digital Twins requires you to delete all relationships before deleting a twin. Teardown logic must enumerate and delete relationships before removing nodes, or bulk deletion will fail with dependency errors.

**Mismatched twin IDs between IoT Hub and Digital Twins.** When the Azure Function that bridges IoT Hub to Digital Twins uses an incorrect ID mapping, updates silently fail or update the wrong twin. Add structured logging in the bridge function to record both the source device ID and the target twin ID for each update, so mismatches surface quickly in Application Insights.

**Not versioning DTDL models.** DTDL model IDs include a version number, and once a model is in use, you cannot modify it in place. Teams that skip version planning often find themselves deleting all twins and re-creating them when a schema change is needed. Plan your model versioning strategy before creating the first production twin.

---

## Comparison to Other Modeling Approaches

| Approach | Relationship modeling | Schema enforcement | Historical data | Query capability |
|----------|----------------------|-------------------|----------------|-----------------|
| **Azure Digital Twins** | Graph with typed edges | DTDL models required | None natively (route to ADX) | SQL-like with relationship traversal |
| **IoT Hub Device Twins** | None (flat) | None (free-form JSON) | None | Limited per-device query |
| **Azure Cosmos DB (graph API)** | Graph with arbitrary properties | None by default | Full history retained | Gremlin query language |
| **Azure SQL / Relational** | Foreign keys and joins | Schema-enforced | Full history retained | SQL with joins |

Azure Digital Twins occupies a specific niche: live environment modeling with schema enforcement and graph queries, at the cost of not storing history. The combination of Digital Twins for current state and Azure Data Explorer for historical state covers both needs without forcing you to build history storage into the graph.

---

## Key Takeaways

Azure Digital Twins is the right choice when your problem requires modeling relationships between entities, not just tracking per-device state. DTDL gives the graph a schema, which makes queries predictable and models reusable across projects in the same domain. The .NET SDK's `BasicDigitalTwin` and JSON Patch patterns make programmatic management straightforward, and the integration path through IoT Hub, Event Grid, and Azure Data Explorer covers the full flow from physical sensor to historical analysis.

The graph query capability is what makes the platform genuinely useful over a flat device registry. Once your environment is modeled correctly, questions that would require multiple database joins or application-level aggregation become single graph traversal queries, and that composability is what enables environment-level intelligence rather than per-device monitoring.
