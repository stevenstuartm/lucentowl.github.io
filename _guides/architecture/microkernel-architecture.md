---
layout: guide
title: "Microkernel Architecture"
category: Architecture
subcategory: Styles
description: "The plug-in style that separates a minimal core system from independent plug-ins: what belongs in the core, how the core finds and calls plug-ins through contracts, in-process versus remote plug-ins, when the style fits product platforms, and how it goes wrong."
tags: [practical, microkernel-architecture, plug-in-architecture, extensibility, plug-in-contracts, product-platforms]
---

Microkernel architecture, also called plug-in architecture, separates a system's core functionality from its extended or customizable features. The core system implements the minimal behavior every use of the product needs. Plug-ins add specialized capabilities, customizations, and variations without modifying the core.

<blockquote class="pull-quote">
<p>A microkernel is only as good as the stability of its core. Every change to a plug-in contract is a change to every plug-in.</p>
</blockquote>

The style shows up in products sold to many customers with different needs, in extensible tools such as IDEs and browsers, and in any system with well-defined points of variation.

## How It Works

The core runs the workflow every customer shares. Wherever behavior varies, it looks up which plug-in handles the case at hand and calls that plug-in through a contract the core defines. An invoicing product shows the shape. The core creates, numbers, stores, and sends invoices for every customer, while each country's e-invoicing rules, such as the format its tax authority requires and how an invoice must be submitted, live in a plug-in for that country.

{% include figure.html id="arch-microkernel" %}

### Deciding What the Core Owns

The core holds only what applies to every use of the product. Everything that differs between customers, markets, or regulations is a candidate for a plug-in.

The core must stay stable, because a change to how it calls plug-ins is a change to every plug-in. That justifies more upfront design than usual. Getting the core's boundaries right the first time costs less than repeatedly changing the contracts every plug-in depends on.

### Finding the Right Plug-in

The core needs a way to answer three questions at runtime: which plug-ins are installed, which one handles this case, and what happens when two of them claim the same case. The simplest answer is a configuration file listing each plug-in, its location, and what it handles. More capable systems let plug-ins register themselves as they load, so installing one requires no change to the core's configuration.

### Calling Through a Contract

The core defines a contract for each kind of plug-in, specifying the data a plug-in receives, the behavior it provides, and what it returns. Every plug-in of that kind implements the same contract, so the core calls an Italian e-invoicing plug-in exactly as it calls a German one. When a plug-in comes from a third party with its own interface, an adapter translates between that interface and the contract, and the core never needs a special case.

<div class="callout callout--warning">
<p class="callout__title">Plug-ins Don't Depend on Each Other</p>
<p>Plug-ins communicate with the core, not with each other. When plug-in A depends on plug-in B, both must be present and compatible, and the chain of dependencies defeats the independent extension the style exists to provide.</p>
</div>

Some ecosystems do support plug-in dependencies with explicit dependency management, such as the Eclipse platform and VS Code extensions. That capability adds significant complexity, and most systems are better off without it.

## In-Process and Remote Plug-ins

<div class="comparison">
<div class="content-card content-card--accent">
<h4>In-Process Plug-ins</h4>
<p>Plug-ins deploy as libraries in the same process as the core, and the core calls them directly.</p>
<p><strong>Advantages:</strong> Low latency, simple debugging, no network complexity, and easier development and testing.</p>
<p><strong>Trade-offs:</strong> Core and plug-ins deploy together, every plug-in uses the core's language and runtime, and a failing plug-in can crash the whole system.</p>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Remote Plug-ins</h4>
<p>Plug-ins run as separate processes or services, and the core calls them through APIs or messaging.</p>
<p><strong>Advantages:</strong> Plug-ins deploy independently, can use different technologies, and fail without taking the core down.</p>
<p><strong>Trade-offs:</strong> Network latency, more infrastructure, harder debugging, and a need for API versioning and compatibility management.</p>
</div>
</div>

Remote plug-ins don't turn the style into a fully distributed architecture. Every plug-in still depends on the core to do anything useful, so the system usually remains a single architecture quantum, with the core as its center.

## Real-World Examples

### Code Editors

Visual Studio Code keeps a comparatively small core for editing, file management, and the user interface, and delivers language support, debuggers, linters, and themes as extensions. Developers install only what they work with.

### E-Invoicing

Governments increasingly require invoices in a mandated electronic format submitted through a national platform, and the requirements differ by country and change on each country's schedule. An invoicing product that keeps each country's rules in a plug-in can ship a new mandate without touching the core, and a customer who trades in one country never loads the others.

### Content Management Systems

WordPress core provides content management, user authentication, and rendering. Themes customize appearance, and plug-ins add e-commerce, SEO, contact forms, and much more. Each site installs only the plug-ins it needs.

### Browser Extensions

The browser core handles rendering, security, and navigation, and extensions add capabilities such as ad blocking, password management, and developer tools. Extensions can extend the browser only through its defined APIs, not modify its core behavior.

## When Microkernel Architecture Fits

**Products sold to many customers with different needs.** Customers share core functionality but need different feature sets, and plug-ins provide those without separate codebases.

**A stable core with well-understood variation points.** The team can tell what changes often, which belongs in plug-ins, from what stays stable, which belongs in the core. That takes domain understanding.

**Customers or third parties who extend the product.** Plug-in APIs let others add functionality without modifying the base product, and each plug-in can be tested on its own against the contract.

**Geographic or regulatory variation.** Core business logic stays consistent while rules vary by location, jurisdiction, or regulation, as in tax, healthcare, and compliance software.

**Features that emerge over time.** When the core workflows are known but future features aren't, the core can ship first and features can arrive as plug-ins as requirements become clear.

## When to Avoid Microkernel Architecture

**Requirements change at the core.** If core workflows and interfaces change often, every change breaks plug-ins and the stability assumption fails.

**Extreme scalability needs.** Requests flow through the core, which tends to become the bottleneck. Distributed styles with independent services scale more naturally.

**Independent deployment matters more than extensibility.** If the main goal is letting different teams deploy different parts on their own schedules, service-based or microservices architectures fit better.

**Unclear or shifting variation points.** Without stable boundaries between core and extensions, the style works against the team rather than for it.

**No real customization needs.** A system that doesn't need plug-ins pays for the style's indirection without getting anything back.

## Common Pitfalls

**A volatile core.** The core changes often and breaks plug-ins, usually because variation points were misidentified or the core took on too much. Spend more time understanding what belongs in the core before building plug-ins against it.

**Plug-in dependency chains.** Plug-in A requires B, which requires C, and compatibility management becomes the main cost of the system. Enforce the rule that plug-ins talk only to the core.

**A core that keeps growing.** Designers afraid to break plug-in contracts cram new functionality into the core instead. Version the plug-in contracts and support more than one version during transitions, so the core can evolve without absorbing everything.

**Over-abstraction.** Making everything pluggable creates extension points no one uses. Make only real variation points pluggable, and keep everything else simple.

**Poor plug-in discoverability.** Users don't know which plug-ins exist or what they do. A registry or marketplace with descriptions and usage information solves it.

## Evolution and Alternatives

When microkernel architecture stops fitting:

**Evolve to service-based architecture.** If the core becomes a bottleneck and scalability matters, split the core into services, and let former plug-ins become services where it makes sense.

**Add an orchestration layer.** If workflows grow complex, with conditional logic across plug-ins, a workflow orchestrator can coordinate them while each capability keeps the plug-in model.

**Move plug-ins out of process.** Deploying plug-ins as independent remote services keeps the core-and-extension model while plug-ins deploy and fail independently. The core remains the center of gravity, so this is a step toward distribution rather than a full move to it.
