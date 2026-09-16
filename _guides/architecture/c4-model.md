---
title: "C4 Model"
layout: guide
category: Architecture
subcategory: Modeling
description: "Diagramming software architecture with the C4 model: its abstractions and what a container really is, the four zoom levels and the landscape, dynamic, and deployment diagrams, notation rules, how many levels to draw, pairing C4 with UML, diagrams as code, and the habits that keep any diagram useful."
tags: [practical, c4, diagrams, documentation, structurizr, archimate]
---

The [C4 model](https://c4model.com/){:target="_blank" rel="noopener noreferrer"} is a way of diagramming software architecture as a set of maps at different zoom levels, created by Simon Brown. It grew out of his software architecture training between 2006 and 2011, drawing on UML and the 4+1 architectural view model. The model separates two things that diagrams usually blur. A small set of abstractions describes what a system is made of, and a set of diagrams each shows those abstractions at one level of detail. Because every diagram shares the same abstractions, a reader can move from a whole-system view down into one part of it without the vocabulary changing underneath them.

## The Abstractions

C4 describes a system with a short hierarchy of building blocks. Each level is made of the one below it, and each diagram shows one level at a time.

| Abstraction | What it is | Example |
|---|---|---|
| **Person** | A human user of the software system, such as a role or persona | Customer, support agent |
| **Software system** | The highest level of abstraction, something that delivers value to its users, whether yours or someone else's | Online store, external payment provider |
| **Container** | An application or data store that has to be running for the software system to work | Web app, API, database, serverless function, blob store |
| **Component** | A grouping of related functionality behind a well-defined interface, inside one container | Order validation, payment gateway client |
| **Code** | The classes, interfaces, functions, or tables that implement a component | `OrderValidator`, `orders` table |

Two of these names are commonly misread. A C4 **container** is not a Docker container. The term predates containerization's popularity and means any separately running application or data store, so a React single-page app, a PostgreSQL database, and an AWS Lambda function are all containers whether or not Docker is involved. A C4 **component** is not separately deployable. Components run inside their container's process, and the container is the unit of deployment. In a microservices architecture, each service is a container, or a small group of containers such as an API plus its database, and the modules inside it are components.

## The Diagrams

### Four Zoom Levels

The four core diagrams each zoom one step further into the same system.

**System context** shows the software system as a single box, the people who use it, and the other software systems it depends on or feeds. It shows what the system is for and what it touches, with no technology detail, which makes it readable by non-technical stakeholders.

**Container** zooms into the system boundary and shows the applications and data stores inside it, the technology of each, and how they communicate. It is the diagram most useful to developers and operations staff, because it shows the major technology decisions and where the network calls are.

**Component** zooms into one container and shows the components inside it and their relationships. It helps when a container is large or complex enough that its internal structure isn't obvious from the code layout.

**Code** zooms into one component and shows its implementation, typically as a UML class diagram or an entity-relationship diagram. The C4 site recommends it only for the most important or complex components, generated from code where possible, since hand-drawn class diagrams drift from the code quickly.

A container diagram for a small online store looks like this:

```
   ┌──────────────────────┐
   │ Customer             │
   │ [Person]             │
   └──────────┬───────────┘
              │ Places orders using [HTTPS]
┌─────────────┼──── Online Store [Software System] ─────────────────────────┐
│             ▼                                                             │
│  ┌──────────────────────┐              ┌──────────────────────────┐       │
│  │ Web App              │  Calls API   │ Orders API               │       │
│  │ [Container: React]   │─────────────▶│ [Container: ASP.NET Core]│       │
│  └──────────────────────┘ [JSON/HTTPS] └────────────┬─────────────┘       │
│                                                     │ Reads and writes    │
│                                                     │ [SQL/TCP]           │
│                                                     ▼                     │
│                                        ┌──────────────────────────┐       │
│                                        │ Orders Database          │       │
│                                        │ [Container: PostgreSQL]  │       │
│                                        └──────────────────────────┘       │
└───────────────────────────────────────────────────────────────────────────┘
```

Every element names its type and technology, every arrow points one way and says what the relationship is, and the outer boundary makes clear which containers belong to this system.

### Supplementary Diagrams

The four levels show static structure. C4 adds three diagram types for views that static structure can't give.

| Diagram | What it shows | Use it when |
|---|---|---|
| **System landscape** | Many software systems and people across an organization, without zooming into any one | An organization has more systems than one context diagram can place |
| **Dynamic** | Elements from a static diagram collaborating at runtime for one use case or feature, with numbered interactions | A flow such as sign-in or checkout crosses several containers or components and the order matters |
| **Deployment** | How containers map onto infrastructure, such as nodes, clusters, regions, and environments | Where things run affects availability, latency, or security decisions |

A dynamic diagram can be drawn in collaboration style, with numbered arrows on the same boxes as the static diagram, or as a sequence diagram. A deployment diagram reuses the same containers, placed inside deployment nodes that can nest, such as a container inside a Kubernetes pod inside a cluster inside a cloud region.

## Notation

C4 is deliberately independent of notation and tooling. It doesn't mandate shapes, colors, or line styles, and relies instead on a few rules that make any notation readable:

- **Every diagram has a title** naming the diagram type and scope, such as "Container diagram for Online Store".
- **Every diagram has a key or legend** explaining shapes, colors, line styles, and any acronyms.
- **Every element states its type** (person, software system, container, component), a short description, and for containers and components, its technology.
- **Every line is unidirectional and labeled** with a description consistent with its direction, such as "Reads from and writes to" rather than "Uses". Relationships between containers also name the protocol, such as JSON/HTTPS or AMQP.

Colors and shapes are free choices, provided they stay consistent across a set of diagrams and remain readable in black and white or by someone with color blindness. Common uses include shading external systems differently from internal ones, or marking parts of the system that are being replaced.

## How Many Levels to Draw

Not every system needs every diagram. The C4 site's own guidance is that system context and container diagrams are sufficient for most software development teams. Those two diagrams change only when the system gains or loses a dependency, a deployable part, or a communication path, so they stay accurate with modest effort.

Component diagrams earn their upkeep for containers whose internal structure is complex, contested, or about to be reorganized. For most containers the component view changes as often as the code does, and a diagram that isn't generated from the code tends to fall behind it. Code diagrams rarely repay the effort of drawing them by hand at all.

A sensible default is to draw the context and container diagrams for every system, add dynamic diagrams for the handful of flows people repeatedly ask about, add a deployment diagram when infrastructure placement drives a decision, and draw component diagrams only where a specific container needs one.

## C4 and UML

C4 doesn't replace UML. The C4 FAQ says plainly that a team for whom UML, SysML, or ArchiMate is working should keep using it. C4 is aimed at teams that found those notations too heavy to use consistently, and it borrows from UML where UML does the job well.

The two fit together by concern. C4's diagrams show structure at the architecture level, and UML supplies detail C4 leaves out.

| Need | C4 diagram | Where UML or another notation adds more |
|---|---|---|
| System scope and external dependencies | System context | None needed |
| Deployable parts and technology choices | Container | None needed |
| Internal structure of one container | Component | UML component or package diagrams, if the team already uses them |
| A runtime flow across parts | Dynamic | UML sequence diagram for detailed message ordering, alternatives, and loops |
| Placement on infrastructure | Deployment | UML deployment diagram, or cloud provider icon diagrams for network detail |
| Class-level design | Code | UML class diagram |
| Lifecycle of a stateful entity | None | UML state machine diagram |
| Business process or workflow logic | None | UML activity diagram or BPMN |
| Database schema | None | Entity-relationship diagram |

Mixing works best when each diagram adds information the others don't. A container diagram that already shows the Orders API reading from PostgreSQL doesn't need a UML deployment diagram restating that dependency. A sequence diagram for the checkout flow, an entity-relationship diagram for the orders schema, and a state diagram for an order's lifecycle each add something the container diagram can't show.

## Diagrams as Code

Drawing tools produce diagrams quickly, but each diagram is a separate picture, so renaming a container means editing every diagram it appears in. Diagrams as code define elements in text and render views from it. The text lives in version control, changes go through code review, and with a model-based tool every view that includes an element updates when the element changes.

- **[Structurizr](https://structurizr.com/){:target="_blank" rel="noopener noreferrer"}**, from Simon Brown, uses a DSL that defines one model and many views of it, which matches C4's separation of abstractions from diagrams. Its hosted cloud service shut down on 30 September 2026, and the tooling continues as self-hosted and local products.
- **[C4-PlantUML](https://github.com/plantuml-stdlib/C4-PlantUML){:target="_blank" rel="noopener noreferrer"}** adds C4 element and relationship macros to PlantUML. Each diagram is its own file, so it is diagram-centric rather than model-centric.
- **[Mermaid](https://mermaid.js.org/syntax/c4.html){:target="_blank" rel="noopener noreferrer"}** renders C4 diagrams inline in Markdown on platforms that support Mermaid, though its C4 syntax is still marked experimental.

A model-based tool keeps many views consistent with each other. A diagram-based tool is lighter to adopt when a team needs only a context and a container diagram.

## Diagramming Discipline

These habits apply to any architecture diagram, C4 or not. Richards and Ford describe the first two in *Fundamentals of Software Architecture*.

**Representational consistency** means showing how a part relates to the whole before changing views, so a reader always knows where a detailed diagram sits. C4's zoom levels are one way to achieve it, and a component diagram that doesn't say which container it zooms into breaks it.

**Irrational artifact attachment** is Neal Ford's name for the tendency to defend an artifact in proportion to how long it took to make. A polished diagram built over two days is harder to throw away than a whiteboard sketch, even when the design it shows is wrong. Low-fidelity sketches while a design is still moving keep iteration cheap, and polish belongs to diagrams of decisions that have settled.

**ArchiMate** is an open standard from The Open Group for modeling across an enterprise, spanning business, application, and technology concerns in one language. It was designed around a deliberately small set of concepts, and version 4, released in April 2026, reduced that set further. It fits when diagrams have to connect business capabilities and processes to the applications and infrastructure that support them across many systems, a scope C4's system landscape diagram only touches.

## Common Pitfalls

- **Mixing abstraction levels on one diagram.** Components appearing on a container diagram, or containers on a context diagram, blur which question the diagram answers. Draw the next level as a separate diagram.
- **Reading "container" as Docker.** A container diagram that shows Docker images but leaves out the database, the single-page app, or the serverless functions misses much of what the level is meant to show.
- **Diagrams without a legend.** C4's freedom of notation depends on the key. A diagram whose colors and line styles mean something only to its author is the problem C4 set out to fix.
- **Unlabeled or bidirectional arrows.** A line between two boxes with no label says they are related and nothing about how. "Uses" is barely better.
- **Starting at the component level.** Detailed internal diagrams drawn before the context and container views are settled describe parts of a system whose boundaries nobody has agreed on.
- **Forcing runtime behavior onto static diagrams.** Numbered steps added to a container diagram turn it into a confusing dynamic diagram. Draw a dynamic or sequence diagram for the flow.
- **Hand-drawn diagrams nobody updates.** A diagram that drifts from the system misleads more than a missing one. Keep the diagrams that change rarely, generate the ones that change often, and delete the rest.

## Quick Reference

| Diagram | Scope | Primary audience | Draw it |
|---|---|---|---|
| **System context** | One system, its users, and neighboring systems | Everyone, including non-technical stakeholders | For every system |
| **Container** | Applications and data stores inside one system | Developers, architects, operations | For every system |
| **Component** | Components inside one container | Developers working in that container | Only where the container's structure is complex |
| **Code** | Implementation of one component | Developers | Rarely, and generated when possible |
| **System landscape** | Many systems across an organization | Architects, leadership | When one context diagram can't place everything |
| **Dynamic** | Runtime collaboration for one flow | Developers | For flows people repeatedly ask about |
| **Deployment** | Containers mapped onto infrastructure | Operations, architects | When placement drives a decision |
