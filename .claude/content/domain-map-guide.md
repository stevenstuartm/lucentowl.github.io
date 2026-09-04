# Domain Component Map Guide

A domain component map is a **resource**, not a guide. Read [resource-guide.md](resource-guide.md) for the format rules that govern all resources, and [writing-standards.md](../skills/refine-prose/writing-standards.md) for the universal ones. This document covers only what is specific to component maps.

---

## What a Component Map Is

A component map records the **edges** between the components of a domain. Not what each component is, not which one to choose, but how they wire to each other:

- What can legally sit in front of, contain, or target what
- What silently fails without its dependency
- Which pairs override, bypass, or break each other

Each component guide in a domain can only describe its own edges, and only from its own side. Assembling the full edge set means reading every guide in the domain and holding them side by side, which is exactly the work a component map does once so nobody has to repeat it.

### The Test That Matters

**Every line must be something a reader cannot get from any single guide in the domain.** If a line restates what one guide already says about itself, cut it. The value is entirely in the assembly.

### What a Component Map Is Not

- **Not a taxonomy.** Sorting components into buckets ("global entry", "regional entry", "filtering") is categorization, not relationship. Knowing which bucket a component sits in tells you nothing about how it connects to anything.
- **Not a selection guide.** "When to use X versus Y" is a different artifact. A component map says what happens when you wire X to Y, not which to pick.
- **Not narrative.** No introduction, no explanation of why the map exists, no reading order, no "this section is the important one". A reader should be able to use it within seconds of landing. Meta-prose about the document is the most common way these fail.
- **Not a feature matrix.** Feature tables belong in the component guides.

---

## The Three Edge Classes

Nearly every useful edge falls into one of three kinds. Use these as the section skeleton, and name the sections for the domain rather than using these labels literally. The plain-text examples below show what each class *means*. They are not the output format, which is always the diagram described under Form.

### 1. Wiring

What connects to what, directionally, with the hard limit stated on the edge itself. The limits are usually the most valuable part, because they are the constraints that kill a design late.

```
  Load Balancer      ->  NICs in ONE VNet. Nothing else.
  Global LB tier     ->  regional Standard Load Balancers only.
                         Never VMs. Never an internal LB.
```

Use `X` rather than `->` for a connection that is not permitted, and say why in the same breath.

### 2. Requires

X fails without Y, especially where the failure is silent or the error message points somewhere else. These are the highest-value lines in most maps, because a silent dependency failure is what costs someone an afternoon.

```
  Private Endpoint          ->  Private DNS Zone using the exact documented
                                name, linked to every querying VNet
```

### 3. Overrides and Conflicts

One component defeats, bypasses, or breaks another. Include the consequence, since the consequence is the reason anyone needs the line.

```
  Service endpoint routes    BEAT     your UDRs
      PaaS traffic silently bypasses the firewall. Use Private Endpoints
      when traffic has to be inspected.
```

A domain may add a fourth section when it has a class of lookup that is genuinely its own (required subnet names, port numbers, rule evaluation order). Keep those to tables.

---

## Form

**Inline SVG, not ASCII.** A component map is a picture. Text in a code block encodes relationships as statements, which reads as a wall of monospace and carries no meaning in its layout. In an SVG, position and connection carry the meaning, which is the entire point of a map.

Kramdown passes raw HTML through, so an inline `<svg>` in the markdown works with no site changes. Wrap it in `<div style="overflow-x:auto">` and give the SVG `style="width:100%; min-width:680px; height:auto"` so it scrolls on a narrow screen instead of shrinking to nothing.

**What the layout has to do:**

- **Bands for layers.** Horizontal regions, labeled at the left, so vertical position means something (global, then VNet, then workloads, then what they reach).
- **A grid for boxes.** Consistent widths and shared baselines. Symmetry is what makes a diagram scannable.
- **Lines drawn between boxes**, never implied by text position.
- **Line style encodes edge class**, with a legend on the canvas:
  - solid, primary color: data path
  - dotted, grey: control plane only, not in the data path
  - dashed, purple: requires, fails silently without
  - dashed, accent color: bypass or conflict
- **Constraints ride on the box or the edge** (`NICs in ONE VNet`, `HTTP/1.1 out`, `/27+`), so the picture carries the facts rather than pointing at a table.

**Spatial encoding beats annotation.** Where a relationship can be shown by position, show it. Traffic Manager being *beside* the path with a dotted line, while the solid data path routes around it, teaches "never in the data path" better than any label does.

**Colours come from the site's CSS variables** with hex fallbacks (`var(--color-primary, #1A5F8A)`), so a map stays on-palette and survives a theme change.

**Accessibility**: `role="img"` plus `<title>` and `<desc>`, referenced by `aria-labeledby`. Include `xmlns` on the root.

**Validate the geometry before shipping.** Hand-authored SVG silently overflows and collides. Run `python .svgcheck.py _resources/<file>.md`, which reads each SVG's own `<style>` block for font metrics and reports text leaving the viewBox, labels overlapping each other, labels straddling a rect border, and dangling `url(#id)` references. Eyeballing the markup does not catch any of this.

**Diagrams only. No tables, no prose.** A component map is the pictures and nothing else. Reference detail that resists a diagram (per-service zone names, SNAT port counts, subnet constraints) already lives in the component guides, and duplicating it here creates a second copy that drifts. If a fact belongs in the map, draw it. Otherwise leave it to the guide.

**One diagram per structural question, and no more.** Do not pad a map to match the diagram count of another map. A domain earns a second diagram only when it has a second question that is genuinely structural, meaning position and connection carry the answer. Restating a lookup table as labelled bars is a table with extra steps, and it reads as filler next to a diagram that shows real structure.

Content that looks tabular is often drawable. A list of conflicts is a set of edges, and edges have pictures: three small vignettes beat an eight-row table.

---

## Format Requirements

Everything in [resource-guide.md](resource-guide.md) applies. Component-map specifics:

```yaml
---
title: "Azure Networking Component Map"
layout: resource
type: reference
category: "Azure"
description: "How Azure networking components wire together: what can sit in front of what, what silently fails without its dependency, and which pairs override or break each other."
last_updated: 2026-09-03
tags: [networking, azure, vnet, private-link, load-balancing]
related_guides:
  - /study-guides/...
---
```

- **Filename**: `<domain>-component-map.md`, flat in `_resources/`. Permanent, never renamed.
- **type**: always `reference`.
- **category**: a single value taken from the primary topic of the guides the map was assembled from, which is the top-level study-guide category those guides live under. Every map for that topic carries the same value, whatever domain within it the map covers, so they all filter together on the listing page. Someone looking for these already knows the topic they want, and the domain is already in the title. Flag an exception at review time rather than inventing a per-domain category.
- **related_guides**: list every guide the edges were assembled from. This is the map's source trail, and it is how someone verifies a line.
- **Register it in `assets/data/resources_config.json`** or it will not appear on the listing page.

---

## Which Domains Earn One

**Guide count predicts almost nothing.** Azure Compute has four guides and virtually no edges, because VMs, App Service, and Container Services never wire to each other. Azure Identity has two guides and dense edges. Count the edges, not the files.

Domains come in two shapes, and only one of them takes a component map.

- **Wiring domains.** Components connect to each other. Networking, observability, messaging, data pipelines, governance hierarchy. These take a component map.
- **Selection domains.** Components are alternatives to each other. Compute, databases, AI services. These do **not**. With no real edges to draw, the diagram collapses into buckets with services filed in them, which is a taxonomy wearing a map's clothes.

**Selection domains get nothing.** Not a component map, and not a positioning chart either. Plotting alternatives on two axes was tried for Azure Compute and cut: the result reads as too abstract and too narrow to stand on its own. A reader opens a resource wanting a concrete artifact, and a position on an axis is a judgement rather than a fact they can act on. Comparison between alternatives belongs in the guides, where prose can carry reasoning a chart cannot.

### The Test

**A map shows a process or a relationship.** Traffic moving through services, telemetry flowing to a sink, containment and inheritance, a dependency that fails silently, one component overriding another. Those are concrete: they are true or false, and a reader can act on them.

If what you would draw is a judgement about where things sit relative to each other, it is not a map and it does not earn a page. Abstraction is the failure mode to watch for, and it is easy to miss because an abstract diagram can look sophisticated while telling the reader nothing they can use.

### A Map's Domain Is Not a Config Subcategory

Every strong candidate crosses the subcategory boundary in `study_guides_config.json`. The networking map reaches into Security and Compliance for Azure Firewall. Observability spans Management and Governance plus Security. A governance hierarchy map would span three subcategories.

Scope the map to the real domain and let `related_guides` record which guides it was assembled from. The subcategory is a filing bucket, not a domain.

---

## Archetypes

The geometry follows the domain. Picking the wrong one is how a map turns back into a list.

| Archetype | Geometry | Fits |
| --- | --- | --- |
| **Flow / path** | Layered bands, one thing moving through in sequence | Networking |
| **Pipeline / fan-out** | Columns: sources, collection, sinks, consumers, with a hub | Observability, messaging, data and analytics |
| **Containment / inheritance** | Nested boxes, inheritance flowing downward | Governance hierarchy, RBAC and policy scope |

Two techniques carry across all of them.

**Give the exception its own track.** In the observability pipeline, metrics never touch the Log Analytics workspace, so they get a separate green track running underneath. Drawing that as a parallel path teaches the split better than a sentence saying metrics are different. This is the same move as Traffic Manager sitting beside the networking data path.

**Durations are usually not a diagram.** Retention tiers, TTLs, and lifecycle windows look like they want a time axis, but a bar per tier is a two-column table drawn wide. Put the number on the box it belongs to and leave the rest to the guide. A time axis earns its place only when the durations interact with each other, not merely when several exist.

---

## Sourcing

**Every line traces to a component guide or a linked vendor doc.** A component map is assembled from content that already exists, so a claim with no source beneath it is either unverified or invented. Read the source sections rather than writing edges from memory, since the details that make these lines valuable (a `/27` minimum, a port number, an exact zone name) are exactly the details memory gets wrong.

When a guide and the vendor documentation disagree, verify against the vendor and fix the guide.
