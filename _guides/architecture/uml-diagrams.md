---
title: "UML Diagrams"
layout: guide
category: Architecture
subcategory: Modeling
description: "Using UML diagrams selectively: sketch versus blueprint use, the fourteen diagram types, and the notation and uses of class, component, deployment, sequence, activity, state machine, and use case diagrams, with how to pick the diagram that answers a given question."
tags: [practical, uml, class-diagrams, sequence-diagrams, state-machines, diagrams]
---

The Unified Modeling Language (UML) is a standard graphical notation for describing software structure and behavior. It merged the object-oriented methods of Grady Booch, James Rumbaugh, and Ivar Jacobson at Rational Software in the mid-1990s and became an Object Management Group (OMG) standard in 1997. The current version, [UML 2.5.1](https://www.omg.org/spec/UML/){:target="_blank" rel="noopener noreferrer"}, was published in December 2017.

UML is large, and most teams use a small part of it. In Marian Petre's 2013 interview study of 50 professional software engineers at 50 companies, 35 didn't use UML at all, and among those who used it selectively, only one found use case diagrams useful. The practical skill is knowing which few diagrams answer which questions, and how much precision each one needs.

## Sketch, Blueprint, or Program

[Martin Fowler describes three ways](https://martinfowler.com/bliki/UmlMode.html){:target="_blank" rel="noopener noreferrer"} teams use UML, and they call for very different levels of rigor.

| Mode | What the diagram is for | Precision needed |
|---|---|---|
| **Sketch** | Communicating or exploring one aspect of a design, on a whiteboard or in a document, then often discarded | Only enough notation that readers interpret it the same way |
| **Blueprint** | A detailed design someone else implements, or documentation of a system that has to stay accurate | Complete and consistent within its scope |
| **Programming language** | A model precise enough that tools generate executable code from it | Formal, tool-checked |

Most everyday value comes from sketches. A sequence diagram drawn to settle how a retry interacts with a timeout doesn't need every arrowhead to be spec-exact, but it does need a solid line to mean a call and a dashed line to mean a return, so that readers don't argue about what it says. Blueprint use persists where contracts or regulation demand design documentation. Generating code from models, once promoted as model-driven architecture, survives mainly in specialized domains such as embedded and safety-critical systems.

## The Fourteen Diagram Types

UML 2.5.1 defines fourteen diagram types, split between structure (what the system is made of) and behavior (what it does over time).

| Group | Diagram | Shows | Everyday use |
|---|---|---|---|
| Structure | **Class** | Types, their attributes and operations, and relationships | Common |
| Structure | Object | Specific instances and their links at one moment | Occasional, to illustrate a tricky class diagram |
| Structure | Package | Grouping of model elements and dependencies between groups | Occasional |
| Structure | Composite structure | Internal parts and connectors of a class or component | Rare |
| Structure | **Component** | Replaceable parts with provided and required interfaces | Occasional |
| Structure | **Deployment** | Artifacts placed on nodes and communication paths | Occasional |
| Structure | Profile | Extensions of UML itself through stereotypes | Rare, for tool builders |
| Behavior | **Use case** | Actors and the goals the system serves for them | Occasional |
| Behavior | **Activity** | Flow of actions, decisions, and parallel work | Common |
| Behavior | **State machine** | States of one object and the events that move it between them | Common for stateful entities |
| Interaction | **Sequence** | Messages between participants in time order | Common |
| Interaction | Communication | The same messages as a sequence diagram, arranged by links instead of time | Rare |
| Interaction | Interaction overview | An activity-style flow whose nodes are interactions | Rare |
| Interaction | Timing | State changes of participants against a time axis | Rare, mostly real-time and embedded |

Interaction diagrams are a subgroup of behavior diagrams. The rest of this guide covers the seven in bold.

## Structure Diagrams

### Class Diagrams

A class diagram shows types, what each holds and can do, and how they relate. The same diagram can be drawn from three perspectives, and the perspective decides how much detail belongs on it.

{% include figure.html id="uml-class-perspectives" %}

A **conceptual** class diagram names domain concepts and their relationships, with little or no attribute detail. It suits early discussion of a domain with people who don't read code. A **specification** diagram adds types and operation signatures, describing interfaces without committing to an implementation. An **implementation** diagram mirrors the code, including defaults and every accessor. Implementation diagrams go stale fastest, and when needed they are usually better generated from the code than drawn.

Each class is a box with up to three compartments for name, attributes, and operations. Members carry a visibility marker, which is `+` for public, `-` for private, `#` for protected, and `~` for package. Operation parameters can state a direction, `in`, `out`, or `inout`, which matters when a sketch documents an API whose parameters are modified in place.

{% include figure.html id="uml-class-notation" %}

Six relationship lines carry most of a class diagram's meaning:

{% include figure.html id="uml-class-relationships" %}

| Relationship | Notation | Meaning |
|---|---|---|
| **Association** | Solid line, optionally with an open arrowhead for navigability | Instances of one type hold or reference instances of the other |
| **Generalization** (inheritance) | Solid line, hollow triangle at the parent | The child is a kind of the parent |
| **Realization** | Dashed line, hollow triangle at the interface | The class implements the interface |
| **Dependency** | Dashed line, open arrowhead | One type uses the other, for example as a parameter, without holding it |
| **Aggregation** | Solid line, hollow diamond at the whole | A whole-part association where parts can exist independently |
| **Composition** | Solid line, filled diamond at the whole | A part belongs to one whole at a time, and is deleted with it |

Associations also carry **multiplicity** at each end, such as `1`, `0..1`, `*`, or `1..*`, which states how many instances take part. The UML specification itself notes that the precise meaning of aggregation varies by application area and modeler, so teams often skip it and use a plain association, reserving the diamond for composition, where the lifetime rule is unambiguous.

A fuller diagram combines these, and can also use stereotypes such as `«entity»` and `«interface»` to mark the role each class plays, and an italic name to mark an abstract class:

{% include figure.html id="uml-class-example" %}

A class diagram earns its place for a core domain model whose relationships and multiplicities are the design, or for an unfamiliar area of code that a newcomer needs mapped. Keeping it focused on one subsystem, and showing only the members that matter to the point being made, keeps it readable.

### Component Diagrams

A component diagram shows replaceable parts of a system and the interfaces that connect them. A **provided interface** is drawn as a circle, or lollipop, and a **required interface** as a half-circle socket. Where one component's socket meets another's lollipop, the dependency is satisfied. **Ports** are small squares on a component's boundary where interfaces attach, which lets a component expose an interface that is implemented by a part inside it.

{% include figure.html id="uml-component-notation" %}

{% include figure.html id="uml-component-example" %}

Component diagrams are most useful when the interfaces between parts are the design decision, such as a plugin system, a set of modules with enforced boundaries, or a replacement plan for one part of a larger system. For showing how a system's applications, services, and data stores communicate, many teams now draw architecture-level structure views such as C4 container diagrams instead, which carry technology and protocol labels that UML component diagrams leave out.

### Deployment Diagrams

A deployment diagram shows **nodes**, drawn as three-dimensional boxes, which represent hardware devices or execution environments such as a server, a virtual machine, a container runtime, or a database server. **Artifacts**, such as an executable, a container image, or a configuration file, are deployed onto nodes. **Communication paths** between nodes show which can talk to which.

{% include figure.html id="uml-deployment-example" %}

The diagram helps when placement is what's being decided, such as which tier sits in which network zone, where a cache lives relative to the servers that read it, or which environments exist. It stops helping once it tries to capture everything a cloud infrastructure-as-code template already records. Labeling paths with protocols and marking security boundaries tends to add more than drawing every node.

## Behavior Diagrams

### Sequence Diagrams

A sequence diagram shows participants as **lifelines**, vertical dashed lines headed by a name, with messages as horizontal arrows ordered top to bottom in time. A thin bar on a lifeline, the **activation**, shows when that participant is executing.

{% include figure.html id="uml-sequence-example" %}

The arrow style carries meaning:

| Notation | Meaning |
|---|---|
| Solid line, filled arrowhead | Synchronous call, the sender waits |
| Solid line, open arrowhead | Asynchronous message, the sender continues |
| Dashed line, open arrowhead | Reply to an earlier call |
| Dashed line to the head of a new lifeline | Creation of that participant |
| An X at the bottom of a lifeline | Destruction of that participant |

**Combined fragments** are labeled frames that add control flow. `alt` shows alternatives with guards, `opt` an optional section, `loop` repetition, `par` parallel sections, and `break` an early exit. A `ref` frame points to another sequence diagram, so one large flow can be split into readable parts.

Sequence diagrams suit flows where the order of messages is the question, such as an authentication handshake, a saga's compensation path, or how retries and timeouts interact across three services. One scenario per diagram, including the error path that prompted the diagram in the first place, keeps them readable. A diagram that tries to show every branch in `alt` frames tends to become harder to follow than the code.

### Activity Diagrams

An activity diagram shows a flow of actions, closer to a flowchart than any other UML diagram but able to show parallel work. It starts at a filled **initial node** and ends at a bullseye **activity final node**. Rounded rectangles are **actions**. A diamond is a **decision** when one flow enters and guarded flows leave, and a **merge** when several alternative flows rejoin. A thick bar is a **fork** when it splits one flow into parallel flows, and a **join** when it waits for parallel flows to finish.

{% include figure.html id="uml-activity-notation" %}

The distinction between a merge and a join has consequences. A merge passes along whichever single branch arrives, while a join waits for all of its parallel inputs. Using a join where branches are alternatives describes a process that never completes.

{% include figure.html id="uml-activity-example" %}

**Partitions**, commonly called swimlanes, assign each action to the role or system that performs it. Handoffs between partitions are where delays and errors often concentrate in a business process, so swimlanes make them visible.

{% include figure.html id="uml-activity-swimlanes" %}

Activity diagrams fit business workflows, multi-step jobs with parallel branches, and approval processes, especially when non-developers need to validate the flow. Teams modeling business processes alone often use BPMN instead, which covers similar ground with notation that business analysts more commonly know.

### State Machine Diagrams

A state machine diagram shows the states one object moves through and the events that move it. Each transition is labeled `trigger [guard] / effect`, where the trigger is the event, the guard is a condition that must hold, and the effect is what happens during the transition. A filled circle marks the initial state and a bullseye a final state.

{% include figure.html id="uml-state-machine" %}

The diagram shows as much by what's missing as by what's drawn. There is no `cancel` transition from `Shipped`, so an order can't be cancelled after dispatch, and a `paymentReceived` event while stock is unavailable leaves the order in `Pending`. States can also declare `entry`, `exit`, and `do` behaviors, and a composite state can contain its own nested state machine.

State machine diagrams tend to stay accurate longer than most UML diagrams, because the states and transitions of an order, a payment, a subscription, or a workflow are business rules that change far less often than the code implementing them. They also map directly to tests, one per transition plus one per event that should be rejected in each state.

### Use Case Diagrams

A use case diagram shows **actors**, the people or external systems that interact with the system, drawn as stick figures, and **use cases**, the goals the system fulfills for them, drawn as ovals inside a **system boundary**. Lines associate actors with the use cases they take part in.

{% include figure.html id="uml-use-case-notation" %}

Three relationships connect use cases and actors. **Include** is a dashed arrow from a base use case to behavior it always performs, factored out because several use cases share it. **Extend** is a dashed arrow from an optional use case to the base use case it can add behavior to, at a named extension point, under some condition. **Generalization** makes one actor or use case a specialized kind of another. The arrows point in opposite directions for include and extend, which is the most common error on these diagrams.

{% include figure.html id="uml-use-case-relationships" %}

The diagram is a table of contents. The requirements live in the written use case behind each oval, with its main success scenario, alternatives, and failure handling. A use case diagram helps scope a system with stakeholders, and it adds little once that scope is agreed, which fits Petre's finding that practitioners rarely find it useful on its own.

## Choosing a Diagram

Starting from the question, rather than from the diagram types, avoids drawing diagrams nobody needed.

| Question | Diagram |
|---|---|
| What are the core domain concepts and how are they related? | Class, conceptual perspective |
| What does this module's public API look like? | Class, specification perspective |
| In what order do these participants call each other, and what happens on failure? | Sequence |
| Which states can this entity be in, and what moves it between them? | State machine |
| What are the steps of this process, who does each, and what runs in parallel? | Activity with partitions |
| Which parts can be replaced independently, and through which interfaces? | Component |
| What runs where, and which nodes can talk to each other? | Deployment |
| What goals does the system serve, and for whom? | Use case, backed by written use cases |

## Keeping Diagrams Useful

Text-based tools make UML diagrams reviewable alongside code. [PlantUML](https://plantuml.com/){:target="_blank" rel="noopener noreferrer"} covers most UML diagram types from a text description, and [Mermaid](https://mermaid.js.org/){:target="_blank" rel="noopener noreferrer"} renders class, sequence, and state diagrams inline in Markdown on platforms that support it. The source lives in version control, so a change to a diagram shows up in a pull request next to the code it describes. Graphical modeling tools remain useful for blueprint-mode work where a model is shared across many diagrams.

Generating diagrams from code, which many IDEs and modeling tools can do for class and dependency views, keeps implementation-level diagrams accurate at no maintenance cost. Hand-drawn diagrams are better reserved for what code can't show directly, such as intended states and transitions, a flow across services, or a conceptual model.

## Common Pitfalls

- **Modeling everything.** Diagrams of simple, well-understood code cost time to draw and maintain and tell readers nothing the code doesn't. Focus on complex, risky, or frequently misunderstood areas.
- **Implementation-level class diagrams drawn by hand.** They drift from the code within weeks. Generate them, or draw at the conceptual or specification perspective instead.
- **One sequence diagram for every path.** Nested `alt` frames covering every branch are harder to read than the code. Draw the main scenario and the one error path that matters.
- **Join bars used as merges.** An activity diagram that joins alternative branches describes a process that waits forever.
- **Reversed include and extend arrows.** Include points to the shared behavior. Extend points to the use case being extended.
- **Aggregation used without agreement on its meaning.** The specification leaves its semantics open, so readers interpret the hollow diamond differently. Use a plain association or composition.
- **Precise notation for a sketch, or loose notation for a blueprint.** A whiteboard sketch doesn't need every stereotype, and a design handed to another team can't rely on arrowheads readers have to guess at.

## Quick Reference

| Diagram | Answers | Key notation | Best for |
|---|---|---|---|
| **Class** | What types exist and how are they related? | Compartments, visibility, association, generalization, composition, multiplicity | Domain models, API shape |
| **Component** | Which parts are replaceable, and through which interfaces? | Provided and required interfaces, ports | Module boundaries, plugin architectures |
| **Deployment** | What runs where? | Nodes, artifacts, communication paths | Placement and network zone decisions |
| **Sequence** | In what order do participants interact? | Lifelines, sync and async messages, combined fragments | Cross-service flows, protocols, error paths |
| **Activity** | What are the steps and who does each? | Actions, decision and merge, fork and join, partitions | Business processes, parallel workflows |
| **State machine** | What states can an entity be in? | States, `trigger [guard] / effect` transitions | Order, payment, and workflow lifecycles |
| **Use case** | What goals does the system serve, and for whom? | Actors, use cases, include, extend, system boundary | Scoping with stakeholders |
