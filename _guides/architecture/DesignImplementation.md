---
layout: guide
title: "Identifying Logical Components"
category: Architecture
subcategory: Foundations
description: "How to find a system's logical components from its journeys and actors, avoid naming components after tables, test the boundaries against requirements, and keep logical components separate from deployment decisions."
tags: [fundamentals, logical-components, logical-architecture, entity-trap, component-identification]
---

Architects think in **logical components** rather than classes. A logical component is a building block of the system's behavior with a clear responsibility, such as order placement, payment processing, or inventory tracking. In code, a component usually shows up as a namespace or directory that groups related classes. It is larger than a class, and it is not the same thing as a service. One deployable service can contain several components, and a small system can keep all its components in one deployment.

Working at this level lets an architect reason about responsibilities and dependencies without getting lost in class design, and without committing yet to how anything will be deployed.

## Finding the First Components

Start from what the system does, not from the data it stores. A veterinary clinic's practice system makes a useful example. It books appointments, sends reminders, checks animals in, records visits and prescriptions, bills owners, and files insurance claims. Two ways of looking at it turn that description into candidate components, and they work best together.

**Trace the main journeys.** Follow the paths a user or process takes through the system, happy path first, and group related steps. Booking an appointment runs through finding availability, booking the slot, reminding the owner, and checking the animal in, which suggests scheduling, reminder, and check-in components. Mark Richards and Neal Ford call this the workflow approach. It fits when the major journeys are reasonably well understood.

**List who acts and what they do.** Name the actors, such as pet owners, vets, front-desk staff, and the insurers who receive claims, and list the major actions of each. Owners book and pay, vets record visits and prescribe, and insurers receive claims, so medical records, prescriptions, and claims join the list. Richards and Ford call this the actor/action approach. It fits systems with several distinct kinds of users, because it keeps one actor's needs from shaping the whole design.

### Don't Name Components After Tables

The tempting shortcut, which Richards and Ford call the entity trap, is a component for each major entity: an Owner Manager, a Pet Manager, an Appointment Manager.

<div class="callout callout--warning">
<p class="callout__title">The Entity Trap</p>
<p>Entity-based components copy the shape of the data model instead of describing what the system does. How tables relate says nothing about how work moves through the system, so the components end up organized around storage rather than behavior.</p>
<p><strong>Symptoms:</strong> Vague names like "Manager" that attract unrelated logic, components that grow into dumping grounds, and boundaries too coarse to scale, test, or deploy independently.</p>
<p><strong>If the system really is simple CRUD:</strong> Use a CRUD framework rather than designing a custom architecture around it.</p>
</div>

## Testing the Boundaries

A first set of components is a guess, and the requirements are what test it. Walk the user stories and requirements through the components, and watch for these signs that a boundary is wrong.

**A requirement fits nowhere.** A story such as "vets can see an animal's vaccination history during a visit" that no component can own points to a missing one.

**A component collects unrelated requirements.** When scheduling starts owning waitlists, room allocation, and staff rotas as well as appointments, it is doing several jobs and should split.

**Its responsibilities don't read as one job.** List what a component does. If the list reads as unrelated items rather than facets of one responsibility, the component has low cohesion.

**Its parts need different characteristics.** Booking must stay responsive during the Monday-morning rush, while medical records must be retained for years and every change audited. Operations with such different needs rarely belong in the same component.

**Two components always change together.** If every change to reminders also changes scheduling, the boundary between them isn't doing anything, and they are probably one component.

Expect to revisit the components as requirements arrive and the team learns the domain. The boundaries that hold up are the ones the requirements keep confirming.

## Components Before Deployment

The components are a **logical architecture**. They describe what the system does and map to namespaces or directories, and nothing about them says where anything runs. The **physical architecture** decides that: which components deploy together as services, which user interfaces and databases exist, and what infrastructure hosts them.

Settle the logical architecture first. It gives teams a shared map of responsibilities and stays valid across several physical designs. The clinic's components could ship as one modular monolith or as a handful of services, and that choice is a separate step, driven by the characteristics each group of components needs.
