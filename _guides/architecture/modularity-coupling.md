---
layout: guide
title: "Modularity & Coupling"
category: Architecture
subcategory: Foundations
description: "How to measure and improve modularity: cohesion levels, afferent and efferent coupling, Robert Martin's abstractness, instability, and main sequence metrics, connascence, and the Law of Demeter."
tags: [fundamentals, cohesion, coupling, connascence, main-sequence, law-of-demeter, maintainability]
---

Modularity determines how well a system can be understood, changed, and maintained. Well-modularized systems have high cohesion within components and low coupling between them. Measuring and managing those two properties is one of the most concrete skills in architectural thinking.

<blockquote class="pull-quote">
<p>High cohesion means everything in the module belongs together because it serves a unified purpose.</p>
</blockquote>

## Cohesion: What Belongs Together

Cohesion measures how closely the elements within a module are related. In a highly cohesive module, everything serves one purpose. In a module with low cohesion, unrelated elements happen to sit together.

Larry Constantine and Edward Yourdon ranked seven levels of cohesion in *Structured Design* (1979), from best to worst:

| Level | Elements are grouped because they... | Example |
|---|---|---|
| **1. Functional** (best) | All contribute to one well-defined task | A `PaymentProcessor` that validates payment details, calls the payment gateway, and records the transaction |
| **2. Sequential** | Form a chain where one element's output is the next element's input | A data import module that reads a file, parses it, validates the records, and writes them to a database |
| **3. Communicational** | Operate on the same data without forming a strict sequence | A reporting module that renders the same customer data as PDF, CSV, and JSON |
| **4. Procedural** | Must run in a particular order, even though they work on different data for different purposes | A checkout routine that confirms the order, writes an audit entry, and then publishes a marketing event |
| **5. Temporal** | Run at the same time, with little other relationship | A startup module that initializes logging, caching, and messaging because they all happen at launch |
| **6. Logical** | Belong to the same loose category while doing unrelated things | A `Utilities` class holding string formatting, date manipulation, and file operations |
| **7. Coincidental** (worst) | Have no meaningful relationship at all | A `Helpers` class collecting functions that didn't fit anywhere else |

The lower levels are not always wrong. A startup module is temporally cohesive by nature. But a module drifting down the list is a signal that its responsibilities are no longer clear, and that changes to it will ripple into unrelated behavior.

## Coupling: Dependencies Between Components

Coupling measures how much one component depends on another. With low coupling, components can change independently. With high coupling, a change to one ripples across others.

### Afferent and Efferent Coupling

Two counts quantify coupling from a component's point of view:

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Afferent Coupling (Ca)</h4>
<p>The number of components that depend on this component. High afferent coupling means many components rely on this one, making it harder to change without breaking its dependents.</p>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Efferent Coupling (Ce)</h4>
<p>The number of components this component depends on. High efferent coupling makes a component fragile, because a change to any of its dependencies can break it.</p>
</div>
</div>

Both counts see only static dependencies, the kind visible in the code. Coupling on timing or execution order doesn't show up in them. Connascence, covered below, names that kind precisely.

### Abstractness, Instability, and the Main Sequence

*Metrics from Robert C. Martin, Agile Software Development: Principles, Patterns, and Practices (2002)*

**Abstractness (A)** is the ratio of abstract elements, such as interfaces and abstract classes, to all elements in a component:

```
A = Abstract Elements / Total Elements
```

A = 0 means the component is purely concrete. A = 1 means it is purely abstract.

**Instability (I)** measures how exposed a component is to change through its dependencies:

```
I = Ce / (Ce + Ca)
```

I = 0 means maximally stable. Other components depend on it and it depends on nothing, so it has every reason not to change. I = 1 means maximally unstable. It depends on others and nothing depends on it, so it is free to change.

**Distance from the Main Sequence (D)** combines the two:

```
D = |A + I - 1|
```

The main sequence is the line A + I = 1. Components near it balance the two properties. Stable components are abstract enough to extend without modification, and unstable components can be concrete because nothing depends on them. D near zero is healthy. Components far from the line fall into one of two zones.

```
A (abstractness)
1 ┼ ●                          Zone of uselessness
  │   ●                        (abstract, nothing depends on it)
  │     ●
  │       ●     main sequence
  │         ●   A + I = 1
  │           ●
  │ Zone of pain  ●
  │ (concrete,      ●
  │ heavily used)     ●
0 ┼─────────────────────●───── I (instability)
  0                     1
```

<div class="callout callout--warning">
<p class="callout__title">The Two Zones</p>
<p><strong>Zone of Pain (A ≈ 0, I ≈ 0):</strong> The component is concrete, and many other components depend on it. It can't be extended through abstraction, and changing it risks breaking every dependent. Some components legitimately live here, such as a database schema or a stable utility library, but new code drifting here is a warning.</p>
<p><strong>Zone of Uselessness (A ≈ 1, I ≈ 1):</strong> The component is abstract, but nothing depends on it. Its interfaces serve no one, which usually marks over-engineering or leftovers from an abandoned design.</p>
</div>

## Connascence: A More Precise View of Coupling

*Concept introduced by Meilir Page-Jones (1992), later popularized by Jim Weirich and catalogued at [connascence.io](https://connascence.io/){:target="_blank" rel="noopener noreferrer"}*

Two components are connascent if changing one requires changing the other to keep the system correct. Where coupling counts say how many dependencies exist, connascence says what kind each one is, and that tells you how dangerous it is and how to weaken it.

### Static Connascence (Visible in Source Code)

**Connascence of Name**: Components must agree on the name of an entity. Renaming a method means updating every call site. This is the weakest form, and refactoring tools manage it well.

**Connascence of Type**: Components must agree on a data type. Changing a parameter from `int` to `string` breaks every caller, but a compiler catches it.

**Connascence of Meaning** (also called Convention): Components must agree on what a value means. If one component treats `status = 1` as "active" and another treats it differently, the system breaks silently. Magic numbers and boolean flags create this form. Replacing them with enums or named types converts it into the weaker connascence of type.

**Connascence of Position**: Components must agree on the order of values. `CalculateTotal(price, tax)` and `CalculateTotal(tax, price)` compile identically and fail at runtime. C# named arguments, `CalculateTotal(price: 100m, tax: 8m)`, convert position into the weaker connascence of name.

**Connascence of Algorithm**: Components must agree on an algorithm. Encryption and decryption must use the same cipher, and hash generation must match validation. This form is often unavoidable, so isolate it to one place.

### Dynamic Connascence (Visible Only at Runtime)

**Connascence of Execution**: The order of execution matters. `Connect()` must be called before `SendData()`, and no compiler verifies it. State machines or builders that only expose valid next steps can enforce the order.

**Connascence of Timing**: The timing of execution matters. Two threads touching shared state without synchronization create a race condition. This is one of the strongest and most dangerous forms. Locks, atomic operations, or message passing remove it.

**Connascence of Values**: Several values must change together. Updating a user's email may require updating their authentication record in the same step. Transactions or aggregates keep the values consistent.

**Connascence of Identity**: Components must reference the same entity instance. Distributed systems struggle here when entities are replicated, because two copies can drift into two identities.

Connascence of execution and timing is what's often called temporal coupling. It is hard to detect because static dependency counts miss it. It tends to surface through design documents, or through the intermittent errors it causes.

## Properties of Connascence

Three properties decide how serious a given instance of connascence is:

**Strength**: How hard is it to refactor? Name connascence is weak and easy to fix. Timing connascence is strong and hard to fix.

**Locality**: How close together are the connected elements? Connascence inside a single class is manageable. The same connascence between two services is much more expensive, because distance amplifies its impact.

**Degree**: How many elements are affected? Connascence between two components is manageable. Connascence spread across dozens is a serious design problem.

## Improving Modularity

### Page-Jones's Three Guidelines

1. **Minimize overall connascence** by breaking the system into encapsulated elements
2. **Minimize the connascence that crosses encapsulation boundaries**
3. **Maximize the connascence within encapsulation boundaries**, which is another way of saying high cohesion

### Weakening and Localizing Connascence

**Convert strong forms into weaker ones.** Replace position connascence with name connascence through named arguments, and meaning connascence with type connascence through enums.

**Move strong connascence closer together.** If execution order matters, encapsulate the whole sequence inside one component so callers can't get it wrong.

**Reduce degree.** When many components share the same connascence, extract the shared knowledge into a single module that the others depend on.

**Allow strength inside a boundary, not across it.** Timing connascence within a service is acceptable. Timing connascence across services is dangerous.

### Law of Demeter

*Discovered by Ian Holland at Northeastern University in 1987, during the Demeter Project, and published by Karl Lieberherr and Ian Holland in IEEE Software (1989). Also called the Principle of Least Knowledge.*

A component should talk only to its immediate collaborators, not to the collaborators of its collaborators. A method should call methods only on:

- Its own object
- Its parameters
- Objects it creates
- Objects its own object holds directly

Consider a customer paying for an order. `customer.Wallet.Deduct(amount)` reaches through the customer into its wallet, so the calling code now depends on how customers store money. `customer.Pay(amount)` keeps the wallet encapsulated, and the customer can change how it pays without breaking callers.

The law doesn't reduce the total coupling in a system. It moves coupling to where it belongs, at the cost of extra delegating methods like `Pay`. Applied mechanically to every call chain, those wrappers become their own maintenance burden, so apply it where the reached-through structure is likely to change.
