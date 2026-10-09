---
layout: post
title: "Are You Using Hexagonal Architecture, or Just Dependency Injection?"
date: 2025-09-29
tags: [architecture, design-patterns, software-design]
description: "Some teams that say they use hexagonal architecture reach its goals of testability and decoupling through layered code and framework dependency injection, without the structure Cockburn described. The difference shows up in who owns the interfaces and whether every driver can reach the business rules without a controller, and knowing which one you built tells you which benefits you actually have."
author: steven-stuart
sources:
  - title: "Alistair Cockburn, Hexagonal Architecture"
    url: "https://alistair.cockburn.us/hexagonal-architecture/"
  - title: "Martin Fowler, Inversion of Control Containers and the Dependency Injection pattern"
    url: "https://martinfowler.com/articles/injection.html"
  - title: "Robert C. Martin, The Clean Architecture"
    url: "https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html"
  - title: "Martin Fowler, Service Layer (Patterns of Enterprise Application Architecture catalog)"
    url: "https://martinfowler.com/eaaCatalog/serviceLayer.html"
---

I've noticed something curious after having read certain posts or having talked with certain teams about their architecture. Some describe themselves as "using hexagonal architecture" because they have repository interfaces and dependency injection. But when the conversation turns to symmetric treatment of UI and database as external actors, or how they swap adapters between test and production, the pattern doesn't quite match. They've achieved testability and decoupling from the database (the half of the pattern's stated goal that frameworks make easy) but through standard layered architecture and modern framework patterns rather than hexagonal structure.

Knowing what you're actually building matters, not as pedantry about pattern purity, but because it helps when learning patterns, discussing architecture decisions, or interviewing for roles that mention specific architectural styles.

## Half of Cockburn's Goal Is Easy to Meet, and His Structure Is Specific

In 2005, Alistair Cockburn described hexagonal architecture with a clear goal: "Allow an application to equally be driven by users, programs, automated test or batch scripts, and to be developed and tested in isolation from its eventual run-time devices and databases."

This sounds exactly like what modern frameworks encourage through dependency injection, interface-based design, and built-in testing support. The goals resonate because they address concrete challenges like tight coupling to infrastructure, difficulty testing business logic, and fragile dependencies on external systems.

But Cockburn's implementation was specific. Hexagonal architecture puts the UI and the database on the same footing, as actors outside the application that reach it only through ports. That shared footing is the sense in which the pattern is symmetric. Cockburn still separates the actors that drive the application (users, tests, batch scripts) from the ones it drives (databases, other services). But neither side gets to be the layer the business logic sits on top of.

The pattern also treats multiple driving mechanisms (REST endpoints, CLI tools, automated tests, batch scripts) as first-class equals, not as a primary interface with secondary test harnesses. And it defines ports as boundaries the application owns, with adapters that change from one stage to the next. His own sequence runs from a test harness driving the application against an in-memory database, to a GUI, to the live system against a real one.

<blockquote class="pull-quote">
<p>The gap emerges when developers use framework DI to achieve testability and call it "hexagonal architecture" while still organizing code in standard layers.</p>
</blockquote>

Those developers have met the goal of isolating the application from its databases, but not the goal of letting every kind of driver use it equally, and they haven't implemented the structure that delivers both.

## The Adapter Swap Was Never What Set the Pattern Apart

Cockburn's examples swap adapters between stages of development and deployment, not inside a running process. That kind of swap didn't need hexagonal structure even in 2005. Martin Fowler's 2004 article "Inversion of Control Containers and the Dependency Injection pattern" described containers doing it a year before Cockburn's article, and modern frameworks have made it the default. A DI composition root registers the in-memory implementation in tests and the real one in production, and each environment's container image is built and configured with the adapters it needs. A layered codebase gets the mechanism for the swap Cockburn's examples describe from the framework.

What frameworks don't deliver is the driving side. DI containers don't move business logic out of controllers or give a batch job the same entry point as an HTTP request. Together with who owns the interfaces, that's the part of Cockburn's structure that layered teams tend not to have, and it's what the label claims.

## Two Structures and One Naming Habit Sit Behind the "Hexagonal" Label

In codebases that claim hexagonal architecture, two different structures tend to sit behind the label, along with a naming habit that blurs them:

**True hexagonal architecture** requires every driving mechanism to call the application through the application's own ports. In-memory or fake adapters stand in for the driven side, so the whole application runs without a web server or a database. The extra cost is mapping between the core's types and persistence types, and maintaining interfaces the core owns. Systems with one driver and little logic beyond storing and returning records rarely repay it.

**Layered architecture with dependency injection** is what sat behind the label in the posts and teams I described above. They use framework DI with repository interfaces and get testability and decoupling through standard framework patterns. The code is organized in traditional layers, where the controller is the entry point and the business code depends downward on the data layer's types. They might call interfaces "ports" but the mental model is still a stack with the database at the bottom, not an application with actors outside it on both sides.

**Terminological confusion** is how the second structure ends up with the first one's name. Teams use "hexagonal" for any codebase with interfaces and dependency injection, often by way of "clean architecture." The overlap has a real origin, since Robert C. Martin's "The Clean Architecture" lists hexagonal architecture as one of the designs it unifies under the rule that source code dependencies point only inward. A clean architecture codebase with use cases that every driver calls is a close relative of hexagonal, and calling it hexagonal is fair. The confusion is borrowing the word for a codebase that has the interfaces but not the inward dependencies or the shared entry point. The term then loses its specific structural meaning and becomes synonymous with "well-designed."

### Interface Ownership and the Driving Side Separate the Two

Dependency injection alone doesn't separate the first two, because Cockburn's pattern uses it too. The application receives its database adapter through its constructor. The difference is in what the interfaces belong to and who is allowed to call the application.

On the driven side, a hexagonal core declares the interfaces it needs in its own terms, such as `IOrderHistory` with a method that returns the orders a pricing rule needs. A layered codebase often declares the data layer's shape instead, like a generic `IRepository<T>` that returns query objects from the ORM. The business code then still thinks in tables, even though it depends on an interface.

That ownership also decides whether a test fake is honest. A fake behind `IOrderHistory` is a short in-memory list, while a fake behind an `IRepository<T>` that returns ORM query objects has to imitate the ORM's query translation, or the tests drift from production.

The driving side shows the gap more plainly. Cockburn wrote the pattern because business logic seeps into user interface code, which blocks automated tests, batch runs, and calls from other applications. His answer was to expose every piece of functionality through an API the application owns. In a typical layered service, the controller is that API. Validation, orchestration, and authorization checks live in controller actions and framework filters, so the only full driver is HTTP.

The HTTP API can look like a port, since the team controls its shape. But the rules sit in model binding and filters that belong to the web framework rather than the application. A batch job or queue consumer can reuse those rules only by becoming an HTTP client, which is the arrangement Cockburn designed against: one primary interface with every other driver bolted on behind it. Tests are in the same position. A test server lets them drive the whole application, but only by speaking the UI's protocol. That coupling of logic to one interface is the problem his intent statement was written to remove.

A layered codebase with a proper service layer, the pattern Martin Fowler describes in *Patterns of Enterprise Application Architecture*, closes most of that gap, because every client calls the same application services. What can remain is the direction of dependencies. The service layer sits on top of the data layer and takes its types, so the database is still the floor the logic stands on rather than an actor outside it. A service layer that owns its interfaces and that every driver calls has crossed into ports and adapters, whatever the team calls it.

So the driving side separates controller-centered codebases from hexagonal ones, and the driven side separates service-layered codebases from hexagonal ones.

### A Quick Test for Which One You Built

These questions sort a codebase without any argument about labels:

- **Does the business code depend on infrastructure?** If it calls the ORM, the HTTP framework, or a message client directly, dependencies point outward. So do entity classes used as its own model when they carry ORM attributes, base classes, or shapes the mapper requires. In a solution split into projects, a reference from the core project to those libraries is the quickest signal, though a single-project codebase can still keep its ports clean.
- **Can every driver reach a use case without a controller in the path?** If a test, a CLI command, and a queue consumer can all call the same application method and get the same validation and rules, the driving side has a port. If they'd have to go through a controller or a framework filter, it doesn't. Transport checks such as parsing a request or authenticating the caller belong in each adapter. Business validation and authorization policy, such as who may approve an order, belong behind the port, because a second driver would otherwise need its own copy.
- **Who shaped the interfaces?** Interfaces named for what the business needs belong to the core. Interfaces named for storage operations belong to the data layer, wherever they're declared.

The first and last questions test the driven side, and the middle one tests the driving side. A codebase that answers no, yes, and "the business" is hexagonal, or a clean architecture close enough to share the name. One that has interfaces and DI but fails any of the three is layered with dependency injection, which is a fine thing to be.

## Why the Label Should Match the Code

Hexagonal architecture appears in courses, certifications, and job requirements. Goals and structure diverge in concrete situations:

**Learning accurately**: If you're studying architectural patterns, understanding that you're implementing layered architecture with DI rather than true hexagonal structure helps you learn what the patterns actually are, not just what they aim to achieve. It explains why Cockburn's examples put the batch script and the test harness beside the GUI, which a repository-centered reading of the pattern skips.

**Technical interviews**: When asked about hexagonal architecture, articulating the difference between Cockburn's structural pattern and modern framework approaches demonstrates deeper understanding than just saying "we use ports and adapters." A follow-up such as "how would a CLI reuse your business rules?" is the driving-side question in disguise. A strong answer for an honestly layered codebase is short: "Our rules live in the controllers, so we'd extract an application service first, and then the CLI would be an adapter."

**Team alignment**: Avoiding confusion when discussing patterns prevents miscommunication. If one developer thinks "hexagonal" means symmetric actors and another thinks it means "has repository interfaces," you're not actually aligned on design decisions.

Consider a team asked to accept orders from a message queue as well as HTTP. Suppose the lead estimating from the architecture diagram believes the system has ports. Nobody then checks whether an entry point outside the controllers already exists, because the word seems to answer that. The team scopes the work as one new adapter that calls the existing entry point. If validation and authorization actually live in controller actions and filters, the consumer either duplicates those rules, where they will drift apart, or waits on a refactor that extracts them. The code set the cost of the work either way. The label is why the estimate missed it.

<blockquote class="pull-quote">
<p>Modern frameworks make it easy to isolate an application from its databases. Unless every driver reaches your use cases through the application's own ports and dependencies point inward, you're likely using layered architecture with dependency injection.</p>
</blockquote>

That's perfectly valid for most systems, and there's no need to retrofit the hexagonal label onto standard practices.
