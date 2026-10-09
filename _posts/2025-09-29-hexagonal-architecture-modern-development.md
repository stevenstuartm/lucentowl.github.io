---
layout: post
title: "Are You Using Hexagonal Architecture, or Just Dependency Injection?"
date: 2025-09-29
tags: [architecture, design-patterns, software-design]
description: "Some teams that say they use hexagonal architecture reach part of its goal, a database they can swap in tests, through layered code and framework dependency injection, without the structure Cockburn described. The difference shows up in who owns the interfaces and whether every driver can reach the business rules without a controller, and knowing which one you built tells you which benefits you actually have."
author: steven-stuart
sources:
  - title: "Alistair Cockburn, Hexagonal Architecture"
    url: "https://alistair.cockburn.us/hexagonal-architecture/"
  - title: "Martin Fowler, Inversion of Control Containers and the Dependency Injection pattern"
    url: "https://martinfowler.com/articles/injection.html"
  - title: "Robert C. Martin, The Clean Architecture"
    url: "https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html"
  - title: "Randy Stafford, Service Layer (Patterns of Enterprise Application Architecture catalog)"
    url: "https://martinfowler.com/eaaCatalog/serviceLayer.html"
---

I've noticed something curious after having read certain posts or having talked with certain teams about their architecture. Some describe themselves as "using hexagonal architecture" because they have repository interfaces and dependency injection. But when the conversation turns to treating the UI and database alike as outside actors, or to whether a batch job could reach the business rules without a controller, the pattern doesn't quite match. Their framework makes it easy to swap the database out in tests, and that covers part of what the pattern aims for. But they got there through standard layered architecture and modern framework patterns rather than hexagonal structure.

Knowing what you're actually building matters, not as pedantry about pattern purity, but because it helps when learning patterns, discussing architecture decisions, or interviewing for roles that mention specific architectural styles.

## Frameworks Give You a Head Start on Half of Cockburn's Goal

In 2005, Alistair Cockburn described hexagonal architecture with a clear goal: "Allow an application to equally be driven by users, programs, automated test or batch scripts, and to be developed and tested in isolation from its eventual run-time devices and databases."

This sounds exactly like what modern frameworks encourage through dependency injection, interface-based design, and built-in testing support. The goals resonate because they address concrete challenges like tight coupling to infrastructure, difficulty testing business logic, and fragile dependencies on external systems.

## The Adapter Swap Was Never What Set the Pattern Apart

Swapping a real database for an in-memory one didn't need hexagonal structure, even in 2005. Cockburn's examples swap adapters between stages of development and deployment, which is the kind of swap a container configured per environment handles. His own sequence runs from a test harness driving the application against an in-memory database, to a GUI, to the live system against a real one.

Martin Fowler's 2004 article "Inversion of Control Containers and the Dependency Injection pattern" described containers doing it a year before Cockburn's article, and modern frameworks have made it the default. The container registers the in-memory implementation in tests and the real one in production, and each environment's configuration selects the adapters it needs.

What frameworks don't deliver is the driving side, the users, tests, and batch scripts that call into the application. DI containers don't move business logic out of controllers or give a batch job the same entry point as an HTTP request.

Containers also leave the shape of the injected interfaces to the team. An interface shaped like the data layer leaves the business code tied to the database it was meant to be isolated from. The driving side and the shape of the interfaces are the part of Cockburn's structure a container doesn't supply, and they're what calling a codebase "hexagonal" promises.

## Cockburn's Structure Puts Every Actor Outside the Application

Hexagonal architecture puts the UI and the database on the same footing, as actors outside the application that reach it only through ports. As Cockburn frames it, the asymmetry to exploit is between the inside and outside of the application, not its left and right sides. Cockburn still separates the actors that drive the application (users, tests, batch scripts) from the ones it drives (databases, other services). But neither side gets to be the layer the business logic sits on top of.

The pattern also treats multiple driving mechanisms (REST endpoints, CLI tools, automated tests, batch scripts) as first-class equals, not as a primary interface with secondary test harnesses. And it defines ports as boundaries the application owns, with adapters that change from one stage to the next.

<blockquote class="pull-quote">
<p>The gap emerges when developers use framework DI to achieve testability and call it "hexagonal architecture" while still organizing code in standard layers.</p>
</blockquote>

Teams in that position have the wiring for one half of Cockburn's goal, isolating the application from its databases. Whether they get the isolation itself depends on whether their interfaces are shaped by the core or by the data layer. They haven't met the other half, letting every kind of driver use the application equally.

## Two Structures and One Naming Habit Sit Behind the "Hexagonal" Label

In codebases that claim hexagonal architecture, two different structures can sit behind the label, along with a naming habit that blurs them:

**True hexagonal architecture** requires every driving mechanism to call the application through the application's own ports. In-memory or fake adapters stand in for the driven side, so the whole application runs without a web server or a database. The extra cost is maintaining interfaces the core owns, and often mapping between the core's types and persistence types. Systems with one driver and little logic beyond storing and returning records rarely repay it. It starts to pay when a second driver arrives, or when the rules are complex enough that tests need fakes they can trust.

**Layered architecture with dependency injection** is what sat behind the label in the posts and teams I described above. They use framework DI with repository interfaces and get testability and decoupling through standard framework patterns. The code is organized in traditional layers, where the controller is the entry point and the business code depends downward on the data layer's types. They might call interfaces "ports" but the mental model is still a stack with the database at the bottom, not an application with actors outside it on both sides.

**Terminological confusion** is how the second structure ends up with the first one's name. Some teams use "hexagonal" for any codebase with interfaces and dependency injection, often by way of "clean architecture." The term then loses its specific structural meaning and becomes synonymous with "well-designed."

The overlap with clean architecture has a real origin. Robert C. Martin's "The Clean Architecture" lists hexagonal architecture as one of the designs it unifies under the rule that source code dependencies point only inward. A clean architecture codebase with use cases that every driver calls is a close relative of hexagonal, and calling it hexagonal is fair. The confusion is borrowing the word for a codebase that has the interfaces but not the inward dependencies or the shared entry point.

### Interface Ownership and the Driving Side Separate the Two

Dependency injection alone doesn't separate the first two, because Cockburn's pattern uses it too. The application receives its database adapter through its constructor. The difference lies in the two things a container doesn't supply: what the interfaces belong to, and who is allowed to call the application.

On the driven side, a hexagonal core declares the interfaces it needs in its own terms, such as `IOrderHistory` with a method that returns the orders a pricing rule needs. A layered codebase often declares the data layer's shape instead, like a generic `IRepository<T>` that returns query objects from the ORM. The business code then still thinks in tables, even though it depends on an interface.

That ownership also decides whether a test fake is honest. A fake behind `IOrderHistory` is a short in-memory list, while a fake behind an `IRepository<T>` that returns ORM query objects has to imitate the ORM's query translation, or the tests drift from production.

The driving side shows the gap more plainly. Cockburn wrote the pattern because business logic seeps into user interface code, which blocks automated tests, batch runs, and calls from other applications. His answer was to expose every piece of functionality through an API the application owns. In a typical layered service, the controller is that API. Validation, orchestration, and authorization checks live in controller actions and framework filters, so the only full driver is HTTP.

Because those rules sit in model binding and filters that belong to the web framework, a batch job or queue consumer can reuse them only by becoming an HTTP client. That is the arrangement Cockburn designed against: one primary interface with every other driver bolted on behind it. The HTTP API can look like a port, since the team controls its shape, but the rules behind it belong to the web framework, not the application.

Tests are in the same position. A test server lets them drive the whole application, but only by speaking the UI's protocol. Calling a controller action directly avoids HTTP but skips the filters and model binding that hold the rules.

A layered codebase with a proper service layer, the pattern Randy Stafford contributed to Martin Fowler's *Patterns of Enterprise Application Architecture*, closes most of that gap, because every client calls the same application services. What can remain is the direction of dependencies. The service layer sits on top of the data layer and takes its types, so the database is still the floor the logic stands on rather than an actor outside it. A service layer that owns its interfaces and that every driver calls has crossed into ports and adapters, whatever the team calls it.

### A Quick Test for Which One You Built

These questions sort a codebase without any argument about labels:

1. **Does the business code depend on infrastructure?** If it calls the ORM, the HTTP framework, or a message client directly, dependencies point outward. In a solution split into projects, a reference from the core project to those libraries is the quickest signal, though a single-project codebase can still keep its ports clean.
2. **Can every driver reach a use case without a controller in the path?** If a test, a CLI command, and a queue consumer can all call the same application method and get the same validation and rules, the driving side has a port. If they'd have to go through a controller or a framework filter, it doesn't. Transport checks such as parsing a request or authenticating the caller belong in each adapter, but business validation and authorization policy, such as who may approve an order, belong behind the port.
3. **Who shaped the interfaces?** Look at what an interface exposes, not what it's called. One that takes and returns the core's own types, with the operations the core needs, belongs to the core, even if it's called `IOrderRepository`. One that hands back ORM query objects belongs to the data layer, wherever it's declared.

Question 2 tests the driving side. Questions 1 and 3 test which way dependencies point and who owns the interfaces, which matters most on the driven side. A codebase whose core has no infrastructure dependencies, whose drivers all reach use cases without a controller, and whose interfaces belong to the core passes all three. It's hexagonal, or a clean architecture close enough to share the name. One that has interfaces and DI but fails any of the three is layered with dependency injection, which is a fine thing to be.

Which question it fails tells you how far it is from the label. A codebase that passes question 2 and fails only question 1 or 3 has a working service layer, so a new driver is one adapter away. One that fails question 2 keeps its rules in controllers, and a new driver waits until they're extracted.

## Why the Label Should Match the Code

Hexagonal architecture appears in courses, certifications, and job requirements. Knowing which one you built pays off in three situations.

**Learning accurately**: If you learn the pattern only from a codebase that has the interfaces but not the ports, you learn that hexagonal means repository interfaces. The reason a second driver is hard stays invisible. Cockburn's examples put the batch script and the test harness beside the GUI because the driving side is half his intent statement, and a repository-centered reading of the pattern skips that half.

**Technical interviews**: When asked about hexagonal architecture, articulating the difference between Cockburn's structural pattern and modern framework approaches shows you know what the pattern requires. Saying "we use ports and adapters" doesn't. A follow-up such as "how would a CLI reuse your business rules?" is the driving-side question in disguise. A strong answer for an honestly layered codebase is short: "Our rules live in the controllers, so we'd extract an application service first, and then the CLI would be an adapter."

**Team alignment**: Avoiding confusion when discussing patterns prevents miscommunication. If one developer thinks "hexagonal" means symmetric actors and another thinks it means "has repository interfaces," you're not actually aligned on design decisions.

Consider a team asked to accept orders from a message queue as well as HTTP. Suppose the team's architecture diagram says "hexagonal" in the loose sense, meaning the code has repository interfaces. The lead estimating the work reads the word in Cockburn's sense, as a promise of an entry point every driver can call. So nobody checks whether an entry point outside the controllers already exists, because the word seems to answer that.

The team scopes the work as one new adapter that calls the existing entry point. If validation and authorization actually live in controller actions and filters, the consumer either duplicates those rules, where they will drift apart, or waits on a refactor that extracts them. The code set the cost of the work either way. A mislabel doesn't make the code worse, but it can make the check that would have caught the cost, finding where the rules live, look already done.

<blockquote class="pull-quote">
<p>Modern frameworks make it easy to swap out an application's database. Unless every driver reaches your use cases through the application's own ports and dependencies point inward, you're likely using layered architecture with dependency injection.</p>
</blockquote>

That's perfectly valid for most systems, and there's no need to retrofit the hexagonal label onto standard practices.
