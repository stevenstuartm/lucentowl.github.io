---
title: "Azure IoT Central"
layout: guide
category: IoT
subcategory: Advanced IoT
description: "Azure IoT Central as a managed SaaS IoT platform, covering device templates, dashboards, rules, data export, and when to choose Central versus building on IoT Hub directly."
tags: [iot, azure, scalability, practical, deployment, telemetry, fundamentals]
---

## What Azure IoT Central Is

[Azure IoT Central](https://learn.microsoft.com/en-us/azure/iot-central/core/overview-iot-central){:target="_blank" rel="noopener noreferrer"} is a fully managed SaaS platform for building IoT applications without operating the underlying infrastructure. While IoT Hub is a PaaS message broker that you connect to other services, IoT Central bundles device connectivity, a device registry, dashboards, rules, data export, and a management API into a single hosted application, and Microsoft operates all of it.

Under the hood, IoT Central is built on IoT Hub, the Device Provisioning Service (DPS), and additional Azure services for storage and processing. That layering is intentional: you get the reliability and scale of IoT Hub without having to wire those services together yourself. The trade-off is reduced flexibility; the platform makes decisions about routing, storage, and processing that you would otherwise make yourself.

IoT Central is particularly well suited to scenarios where getting a working IoT solution deployed quickly matters more than exercising fine-grained control over every architectural decision. Independent software vendors building industry-specific applications, teams prototyping new device categories, and organizations without dedicated IoT infrastructure engineers are the audiences IoT Central targets most directly.

---

## IoT Central vs IoT Hub: Choosing the Right Starting Point

The decision between IoT Central and a custom IoT Hub solution is largely a decision about where you want to spend engineering effort and how much control you need over the data pipeline.

IoT Hub is infrastructure: it connects devices and routes messages, but everything beyond that, including storage, dashboards, alerting, device management UI, and provisioning workflows, requires additional services and engineering. IoT Central is an application: it provides those capabilities out of the box, accepting the constraints that come with a managed platform.

| Dimension | IoT Central | IoT Hub (Custom Solution) |
|-----------|-------------|---------------------------|
| **Time to value** | Hours to days. Dashboards and rules work without code | Weeks to months. Each component requires design and integration |
| **Flexibility** | Template-driven. Limited to capabilities the platform exposes | Full flexibility. Any Azure service, any data pipeline shape |
| **Pricing model** | Per-device monthly fee (first two devices free, then ~$0.10–$0.15/device/month) | Per-message volume tiers plus costs for each additional Azure service |
| **Custom processing** | Limited to webhooks, Azure Functions via rules, and data export to downstream services | Unlimited. Full access to Message Enrichments, custom endpoints, Stream Analytics, and Event Grid |
| **Device management UI** | Built-in. Device listing, filtering, commands, and properties visible without code | None built in. Must build your own or use tools like Azure Device Update |
| **Firmware updates** | Built-in OTA job management through device management features | Requires Azure Device Update or a custom solution built on direct methods |
| **Multi-tenancy** | Native organizations feature for ISV/OEM scenarios | Must design and build your own tenant isolation |
| **Management overhead** | Minimal. Microsoft manages everything | Significant. You manage every service in the pipeline |
| **Data access** | Through built-in views, dashboards, and data export to external sinks | Full access. Messages go wherever your routing rules send them |
| **Customization ceiling** | Constrained to platform capabilities | Unlimited |

A team evaluating these options should weight time-to-value heavily in early stages and customization requirements heavily once scale and complexity become known. Many successful IoT products start on IoT Central and migrate to a custom architecture when specific limitations become blockers.

---

## Device Templates

Device templates are the central abstraction in IoT Central. A template defines what a device is: what data it sends, what properties it exposes, what commands it accepts, and how those are displayed. Every device registered in IoT Central is associated with a template, and the template determines how IoT Central interprets the device's messages.

### Capabilities

A device template is composed of one or more interfaces, and each interface contains a set of capability definitions. The three capability types map to how devices communicate:

**Telemetry** represents time-series data that devices stream to the cloud. A temperature sensor sending readings every 30 seconds uses a telemetry capability. IoT Central stores telemetry for a fixed retention window and makes it available in dashboards and rules without additional configuration.

**Properties** represent state that persists between messages. Properties can be read-only values the device reports (firmware version, hardware revision) or writable values that the cloud can set and the device synchronizes (desired setpoint, reporting interval). IoT Central handles the desired/reported property synchronization pattern that IoT Hub device twins implement, presenting it through a simpler interface. Writable properties also appear in device views where operators can update them without writing code.

**Commands** represent operations the cloud sends to a device to execute. A command might trigger a device restart, initiate a calibration sequence, or request a diagnostic report. Commands are synchronous by default and expect a response from the device within a timeout window. IoT Central exposes commands through device views so operators can invoke them from the portal.

### Views

Each device template includes one or more views that define how device data appears in the portal. The default views are auto-generated from the capability definitions, showing telemetry charts and property forms. You can customize views by adding chart types, adjusting time ranges, arranging tiles, and adding computed metrics. Views are rendered entirely within IoT Central without any frontend code on your part.

### Versioning and Migration

Device templates support versioning. When you change a template's capabilities in ways that would break existing devices (removing a telemetry type or changing a property name), IoT Central requires you to publish a new version rather than modifying the existing one. You then migrate devices to the new version explicitly, which prevents breaking dashboards and rules that depend on the old schema. This version management is one of the features that distinguishes IoT Central from a raw IoT Hub integration, where schema evolution is entirely your responsibility.

### Industry Templates

[IoT Central application templates](https://learn.microsoft.com/en-us/azure/iot-central/core/concepts-app-templates){:target="_blank" rel="noopener noreferrer"} are pre-built starting points for common industry scenarios like connected logistics, retail analytics, energy management, and healthcare monitoring. These templates ship with pre-configured device templates, dashboards, and rules that you can modify rather than build from scratch. They represent a further acceleration over a blank IoT Central application, though the more opinionated templates can require more adaptation work when your actual devices differ from the template's assumptions.

---

## Dashboards and Visualization

IoT Central includes a dashboard builder that lets you assemble tile-based views without writing frontend code. Dashboards can display real-time telemetry, historical charts, KPIs computed from telemetry, device property values, maps showing device locations, and embedded web content.

### Dashboard Types

**Application dashboards** appear on the home screen when users log in. You can create multiple application dashboards and control which user roles see each one. These work well for operational overviews showing fleet-wide health, recent alerts, and aggregated metrics.

**Device dashboards** are defined within device templates as views and appear when an operator navigates to a specific device. They show data scoped to that device: its telemetry history, current properties, and available commands.

**Personal dashboards** let individual users build custom views tailored to their own needs without affecting what others see.

### Tile Types

The built-in tile catalog covers most monitoring use cases. Line charts and bar charts visualize telemetry over configurable time windows. KPI tiles show the last value or an aggregation (average, minimum, maximum, sum) over a period. Property tiles display the current value of a device property. Event tiles show discrete events alongside continuous telemetry. Map tiles show the last-known location of one or more devices using a reported location property.

Dashboards refresh automatically as new telemetry arrives. Time range controls let operators zoom into a specific incident window without leaving the portal.

### Limitations

The dashboard builder covers common visualization patterns well but cannot match a dedicated analytics platform. Complex aggregations across many device groups, custom visualization types, drill-down analytics, and cross-application comparisons generally require exporting data to a downstream tool like Power BI or Grafana. IoT Central's continuous data export feature handles that export path.

---

## Rules and Actions

Rules in IoT Central let you define conditions based on telemetry, properties, or device events and trigger automated responses when those conditions are met. Rules replace the custom alerting logic that a raw IoT Hub solution would implement using Stream Analytics queries, Azure Functions, or Logic Apps.

### Condition Types

Telemetry conditions compare a telemetry value against a threshold using operators like greater than, less than, equals, and contains. A rule might fire when temperature exceeds 80 degrees Celsius or when a vibration reading drops below a minimum baseline.

You can combine multiple conditions with AND logic, requiring all conditions to be true simultaneously before the rule fires. A rule might only trigger when temperature is high and a device status property indicates the device is in active operation, filtering out readings from devices in maintenance mode.

Time aggregation conditions evaluate a rolling window of telemetry values rather than individual readings. This allows rules that fire when the average of the last five minutes exceeds a threshold, avoiding false positives from momentary spikes.

### Action Types

When a rule fires, IoT Central can trigger one or more actions:

**Email notifications** send alerts to a configured list of recipients with the device ID, rule name, and the telemetry value that triggered the condition. These work without any external service configuration.

**Webhooks** send an HTTP POST to any publicly accessible endpoint. The payload contains the rule context and device information as JSON. Webhooks integrate IoT Central with any service that accepts HTTP callbacks, including third-party ticketing systems, monitoring platforms, and custom APIs.

**Azure Functions** actions invoke a specific function directly. This provides a clean path from an IoT Central rule to arbitrary processing logic without requiring you to expose an HTTP endpoint.

**Power Automate** integration triggers a flow in Microsoft Power Automate, connecting IoT Central conditions to the broader Microsoft 365 ecosystem and the extensive catalog of Power Automate connectors.

### Rule Management Considerations

Rules execute against all devices by default, but you can scope them to specific device groups based on property values or device template. This lets you apply different thresholds to different device categories or deployment environments within the same IoT Central application.

IoT Central evaluates rules against incoming telemetry in near real-time. Rule evaluation is managed by the platform, so there is no infrastructure to configure or scale. The limitation is that rule logic is constrained to what the portal condition builder supports; complex event processing, stateful patterns (like detecting that a condition persisted for more than N minutes), or correlations across multiple devices require exporting data to a downstream service like Azure Stream Analytics.

---

## Device Management

IoT Central provides a device management layer that goes beyond what IoT Hub exposes directly. Every device registered in IoT Central has a detail page showing its current state, telemetry history, property values, and command interface. This visibility is built in without custom tooling.

### Provisioning

IoT Central uses [Azure Device Provisioning Service (DPS)](https://learn.microsoft.com/en-us/azure/iot-central/core/concepts-device-authentication){:target="_blank" rel="noopener noreferrer"} underneath for device registration. Devices can connect using SAS tokens derived from a group enrollment key (appropriate for development) or X.509 certificates (required for production-scale deployments). The group enrollment approach means devices do not need individual credentials pre-registered; any device with the group key can provision itself and receive an assigned IoT Hub connection string automatically.

When a device connects for the first time, IoT Central needs to associate it with a device template. That association can happen through the device's self-reported model ID (using the IoT Plug and Play convention) or through manual assignment in the portal. Auto-approval mode allows devices to connect immediately without operator intervention, while manual approval holds devices in a pending state until an operator reviews and approves them.

### Device Groups

Device groups let you segment your fleet by applying filter criteria against device property values. A group might contain all devices of a specific firmware version, all devices in a particular geographic region, or all devices marked as production versus test. Groups are dynamic: when a device's properties change to match the filter criteria, it automatically joins the group.

Device groups serve two main purposes. First, they scope dashboards and rules to a subset of devices. Second, they target device management operations like commands and property updates to a specific segment rather than the entire fleet.

### Jobs

Jobs allow you to run operations against multiple devices simultaneously. A job can update a writable property (setting a new reporting interval across all devices in a group), execute a command (triggering a restart on all devices running a faulty firmware version), or install a firmware update through the [device firmware update pattern](https://learn.microsoft.com/en-us/azure/iot-central/core/howto-manage-devices-in-bulk){:target="_blank" rel="noopener noreferrer"}.

Jobs execute with configurable concurrency and failure handling. You can run a job against a percentage of the target group first and proceed to the remainder only if the initial batch succeeds, which limits blast radius when a command has unexpected side effects.

---

## Data Export

IoT Central's built-in storage retains telemetry for a limited window (30 days by default), which is sufficient for operational dashboards but not for long-term analytics, compliance archiving, or integration with external systems. Continuous data export addresses this by streaming data from IoT Central to external destinations as it arrives.

### What Gets Exported

You can configure separate export definitions for different data types:

**Telemetry** streams every incoming telemetry message, enriched with device metadata. The export payload includes the device ID, template name, and the original telemetry values.

**Property changes** export events when a reported property value changes, allowing downstream systems to track device state history.

**Device lifecycle events** notify external systems when devices are created, deleted, enabled, or disabled within IoT Central.

**Device template lifecycle events** similarly notify when templates are created or modified.

Each export definition can include filter conditions to reduce volume, exporting only telemetry from specific device groups or only messages where a particular field matches a value.

### Destinations

Supported export destinations include [Azure Event Hubs](https://learn.microsoft.com/en-us/azure/event-hubs/){:target="_blank" rel="noopener noreferrer"} for real-time stream processing, [Azure Service Bus](https://learn.microsoft.com/en-us/azure/service-bus-messaging/){:target="_blank" rel="noopener noreferrer"} for reliable message delivery to consumers, [Azure Blob Storage](https://learn.microsoft.com/en-us/azure/storage/blobs/){:target="_blank" rel="noopener noreferrer"} for long-term archival, and webhooks for any HTTP-accessible endpoint.

Event Hubs is the most common destination when IoT Central feeds a broader data platform. Data exported to Event Hubs can flow directly into Azure Stream Analytics, Azure Databricks, or custom consumers without additional infrastructure. Blob Storage works well for regulatory archiving where the data must be retained but does not need to be processed in real time.

Data export does not replace IoT Central's built-in visualization; rather, it extends IoT Central's reach into the broader data ecosystem for workloads the platform was not designed to handle internally.

---

## REST API and .NET SDK

IoT Central exposes a [REST API](https://learn.microsoft.com/en-us/rest/api/iotcentral/){:target="_blank" rel="noopener noreferrer"} that covers the full management plane: creating and updating device templates, registering devices, querying telemetry, managing users and roles, configuring data export, and running jobs. The API allows you to automate IoT Central administration tasks that would otherwise require portal interaction.

The [Azure IoT Central .NET SDK](https://learn.microsoft.com/en-us/dotnet/api/overview/azure/iot){:target="_blank" rel="noopener noreferrer"} wraps the REST API with typed client classes. Common uses include provisioning automation (registering batches of devices during manufacturing), integration testing (creating test devices, pushing synthetic telemetry, and asserting that rules fire), and building custom management tooling for operators who need workflows the built-in portal does not support.

Device-side communication uses the same device SDKs as IoT Hub directly, because IoT Central connects through DPS to an IoT Hub instance underneath. A device connecting to IoT Central uses the same MQTT or AMQP protocols and the same SDK interfaces as a device connecting to a raw IoT Hub. The difference is that the connection string and endpoint are obtained through DPS enrollment rather than copied directly from the IoT Hub portal.

This means device firmware written for IoT Central is largely portable to a custom IoT Hub solution during a migration, because the device SDK usage does not change materially.

---

## Multi-Tenancy and Organizations

[Organizations](https://learn.microsoft.com/en-us/azure/iot-central/core/howto-create-organizations){:target="_blank" rel="noopener noreferrer"} in IoT Central provide a built-in hierarchy for multi-tenant scenarios. An organization represents a tenant, customer, business unit, or deployment region within a single IoT Central application. Each organization has its own set of devices, dashboards, and users with access controlled at the organization boundary.

This feature addresses a common ISV challenge: how to serve many customers from a single application instance without leaking data or configuration between them. Without organizations, you would need to either deploy separate IoT Central applications per tenant (which multiplies management overhead) or build your own access control layer on top of the API.

Organizations support a tree structure, so you can model hierarchical relationships like a region containing multiple facilities each containing multiple device groups. User roles assigned at a higher level in the tree can be scoped to inherit down or be overridden at lower levels.

For OEM scenarios where a hardware manufacturer sells devices to end customers who each have their own operational dashboards, organizations allow the OEM to manage device templates and firmware centrally while giving each customer an isolated view of their own fleet.

The organization feature has limits in its current form. Deep customization of the experience per organization (distinct branding, custom workflows, organization-specific business logic) still requires building a layer above the IoT Central API rather than relying purely on the built-in organization feature.

---

## Pricing Model

IoT Central charges per device per month rather than per message. The first two devices are free. Beyond that, pricing scales at roughly $0.10–$0.15 per device per month at standard tiers (pricing changes; verify current rates at the [IoT Central pricing page](https://azure.microsoft.com/en-us/pricing/details/iot-central/){:target="_blank" rel="noopener noreferrer"}).

This model has important implications depending on fleet characteristics:

**High-frequency telemetry, small fleets**: IoT Central's per-device pricing is advantageous. A fleet of 1,000 devices sending telemetry every second generates roughly 2.6 billion messages per month. IoT Hub's per-message tiers would be significantly more expensive at that volume, while IoT Central charges the same per-device fee regardless of message frequency.

**Low-frequency telemetry, large fleets**: IoT Hub's per-message model can be cheaper. A fleet of 100,000 devices sending one reading per hour generates about 72 million messages per month, which falls into IoT Hub's lower tiers. At $0.10 per device, IoT Central would cost $10,000 per month for the same fleet regardless of how infrequently devices send data.

**Transition cost**: When migrating from IoT Central to a custom IoT Hub solution, the pricing model changes entirely. The architectural and engineering effort of building a custom solution must be weighed against the long-term per-device cost trajectory as the fleet grows.

Data export from IoT Central to downstream Azure services incurs standard costs for the destination service (Event Hubs ingestion, Blob Storage transactions, etc.) in addition to the IoT Central device fee.

---

## Limitations

Understanding where IoT Central constrains you matters as much as understanding what it provides. These limitations become significant at scale or when business requirements diverge from the platform's assumptions.

**Custom processing is limited.** IoT Central does not provide a way to run stateful stream processing within the platform. Rules handle simple threshold conditions well but cannot implement sliding window aggregations, multi-device correlations, or complex event processing patterns. Those requirements push data out through export and into a separate processing tier.

**The data retention window is fixed.** Built-in telemetry storage retains data for 30 days. Longer retention requires continuous data export to Blob Storage or another store, which adds operational complexity and cost.

**Dashboards cannot query arbitrary data.** Dashboard tiles are built on the device's telemetry and properties as defined in the template. You cannot write custom queries, join data from multiple devices into a single aggregate tile using complex logic, or display data from external systems within the IoT Central dashboard itself.

**Custom authentication and authorization logic is not supported.** User access is managed through IoT Central's built-in role system. If your application requires fine-grained row-level security, attribute-based access control, or integration with a proprietary identity system beyond Azure Active Directory, the built-in system may not be sufficient.

**Protocol support is bounded.** IoT Central supports the same protocols as IoT Hub: MQTT, AMQP, and HTTPS. Devices using other protocols need a protocol translation gateway that forwards to one of these, which adds a component you must build and operate.

**The template model assumes homogeneous devices.** Device templates work best when all devices of a given type behave the same way. Highly heterogeneous fleets where individual devices have unique capability sets are difficult to model cleanly with templates.

**You cannot inspect or modify the underlying infrastructure.** Because IoT Central manages IoT Hub, DPS, and related services on your behalf, you cannot access those resources directly, configure advanced IoT Hub routing rules, or apply custom policies at the infrastructure level.

---

## Migration Path to a Custom IoT Hub Solution

IoT Central works best as an accelerator rather than a permanent architecture for high-complexity or high-scale deployments. Certain signals indicate the platform is becoming a constraint rather than an enabler:

- Processing requirements exceed what rules and webhook-triggered functions can handle cleanly
- Retention requirements exceed 30 days and the data export overhead becomes significant
- Fleet size reaches a point where per-device pricing exceeds the cost of operating a custom pipeline
- Dashboard and visualization requirements diverge from what the tile builder supports
- Integration requirements with proprietary systems require custom middleware that ends up handling most of the business logic anyway
- Security or compliance requirements mandate direct control over the underlying infrastructure

When those signals appear, the migration path from IoT Central to a custom IoT Hub solution is more straightforward than it might seem. Device firmware changes are minimal because the device SDK usage is nearly identical; the main change is how devices obtain connection credentials. The DPS enrollment configuration can be updated to point to a directly managed IoT Hub instance rather than the IoT Central-managed one.

The larger migration effort is on the application side: building or integrating dashboards, replicating rule logic as Stream Analytics queries or Azure Functions, establishing a data export pipeline for long-term storage, and building device management tooling to replace the portal. Planning this migration before beginning it is worthwhile. The IoT Central REST API allows you to export device registry data, template definitions, and configuration, which can seed the custom solution's initial state.

A common pattern is to run IoT Central and the custom solution in parallel during the transition, with IoT Central handling existing devices while new device categories onboard directly to IoT Hub, until the fleet is fully migrated and IoT Central can be decommissioned.
