---
layout: post
title: "Monoliths for Discovery, Microservices for Optimization"
date: 2025-06-21
tags: [architecture, microservices, monoliths, system-design]
description: "Why monoliths are effective for discovery and microservices are optimizations: principles for choosing the right architecture for your context."
author: steven-stuart
sources:
  - title: "Martin Fowler, \"Microservice Premium\""
    url: "https://martinfowler.com/bliki/MicroservicePremium.html"
  - title: "Alexandra Noonan, \"Goodbye Microservices\" (Segment)"
    url: "https://www.twilio.com/en-us/blog/developers/best-practices/goodbye-microservices/"
  - title: "Martin Fowler, \"MonolithFirst\""
    url: "https://martinfowler.com/bliki/MonolithFirst.html"
  - title: "Stefan Tilkov, \"Don't start with a monolith\""
    url: "https://martinfowler.com/articles/dont-start-monolith.html"
  - title: "Eric Evans, Domain-Driven Design resources"
    url: "https://www.domainlanguage.com/ddd/"
  - title: "Kirsten Westeinde, \"Deconstructing the Monolith\" (Shopify Engineering)"
    url: "https://shopify.engineering/deconstructing-monolith-designing-software-maximizes-developer-productivity"
  - title: "Gannon McGibbon and Chris Salzberg, \"A Packwerk Retrospective\" (Shopify Engineering)"
    url: "https://shopify.engineering/a-packwerk-retrospective"
---

I know, I know. It is another post about microservices versus monoliths. The debate feels exhausted at this point. Yet every time I start a new project, I find myself weighing the same questions. Not because the answer is unclear, but because the answer genuinely depends on where you are and what you're trying to learn.

<blockquote class="pull-quote">
<p>The choice isn't about finding the "right" architecture in the abstract. It's about choosing what fits your context, your constraints, and most importantly, what you need to discover.</p>
</blockquote>

## Principles That Decide the Choice

### Microservices Are Optimizations, Monoliths Enable Discovery

Microservices are optimizations for specific problems: team scaling, independent deployment, technology diversity. They're solutions to constraints you've already identified. Monoliths, on the other hand, accelerate discovery. They let you learn where boundaries should be, understand domains as they reveal themselves, and validate assumptions quickly without the overhead of distributed systems.

That overhead is concrete. Once two parts of a system talk over the network, every call can time out, fail halfway, or arrive twice, and data that used to change in one transaction now needs a consistency strategy. Each service also needs its own deployment pipeline, monitoring, and on-call coverage. Martin Fowler calls this the microservice premium, and in his post of that name he advises against even considering microservices "unless you have a system that's too complex to manage as a monolith."

The premium grows with every service added. In "Goodbye Microservices," Alexandra Noonan describes how Segment split its event delivery into one service per destination, for a sound reason. A slow destination's retries had flooded a shared queue and delayed all the others. The split ended at more than 140 services. Shared libraries drifted apart, and three full-time engineers spent most of their time keeping the system alive, until the team merged the services back into one. The signal justified separating slow destinations from the rest, and it didn't justify a service for every destination.

The premium hurts most while the domain is still unclear, because early boundaries are mostly guesses. Inside one process, a wrong guess is fixed with a refactoring. You move a class or change a method signature, and the compiler finds every caller. Across services, the same correction means changing two APIs, coordinating two deployments, and migrating data between two databases. Fowler's companion post, "MonolithFirst," makes this argument. It also reports that almost all the successful microservice stories he had heard of started with a monolith that grew too big and was broken up. He offers that as an informal observation, not a study.

Start with what helps you learn fastest, then optimize when you understand what actually needs optimizing.

### Monoliths Don't Excuse Poor Code Quality

The stigma around monoliths comes from poor practices, not the architecture itself. Terrible monoliths exist, but so do terrible microservices. A monolith whose modules call each other's internals and write each other's tables is hard to change and harder to split. A set of microservices that share tables and must deploy together has the same coupling, with network calls added. What decides whether either system stays changeable is good design discipline, meaning SOLID principles applied at the module level and clear boundaries. Each module depends on the others' public interfaces and never on their internals.

The deployment model does change one thing. A process boundary makes reaching into another module's internals impossible, while inside a monolith it takes one import. That enforcement is part of what the microservice premium buys, but during discovery it isn't worth the price, because the same process boundary makes every module boundary expensive to move.

A monolith can get most of that enforcement more cheaply. It needs it, because good intentions lose to deadlines. Give each module its own database schema, and have CI load and test each module with only the modules it declares as dependencies. A shortcut then fails a build instead of slipping through review. Moving a boundary still means editing a dependency list and a schema in one repository rather than redeploying two services.

Neither the per-module schemas nor the CI checks add a runtime component, a network hop, or a second deployment. Both need upkeep, such as test setups for each module, and they are far harder to retrofit than to start with.

### Ship Before the Architecture Is Perfect

Ship and learn. Every week spent settling the architecture before launch is a week without users to show which parts of the design matter. The better approach is to make reversible decisions, establish clear boundaries, and iterate based on what you learn from real usage. Perfection is a moving target. Momentum matters more.

Shipping before the design settles works only if wrong guesses are cheap to undo, and the starting choice decides how often you pay for distribution. Extracting a module from a monolith still means moving its data and taking on partial failure for every call across the new boundary. A team that starts with a modular monolith pays that distributed cost once per boundary it has already validated. A team that starts with services pays it for every guess, and again for each guess it has to correct. Either way, a decision stays reversible when undoing it touches one module instead of every caller, which is why the next two principles are about boundaries.

### Data Boundaries Matter From Day One

Define data ownership early, even if you're starting with a monolith. Sharing one database between modules, or even between early services, isn't inherently wrong when you're just getting started. It works as long as each table has one owning module, and everything else goes through that module's code instead of querying its tables directly.

Without that rule, extraction gets expensive. When three modules write to the same orders table, pulling the order module out means finding and rewriting every one of those queries. Each cross-module join also becomes a network call or a copy of the data. Tangled data models trap teams in legacy architectures.

The ownership rule keeps the cheap in-process refactoring from the first principle. When a table changes owner in a modular monolith, the compiler and the test suite find the code to change, and there are no dual writes between two databases. The rule makes an ownership change a schema migration inside one database and one deployment, rather than a data move between two services.

### Abstract Infrastructure Early

Put one routing layer you control in front of the monolith early. An API gateway works, and so does the reverse proxy or ingress it already runs behind. Either gives you flexibility before you know what your final infrastructure will look like. When clients call that layer instead of the monolith's own address, extracting a service later can keep the address clients already use, because the route moves there. That holds when the extracted module owns its own URL paths and the new service keeps the old contract.

The routing layer doesn't help with the harder server-side work of partial failure and consistency. A dedicated gateway is also one more component to run and one more network hop. It pays off most when you have clients you can't update all at once, such as mobile apps or partner integrations. For those systems, the routing layer keeps an extraction from turning into a coordinated client release.

## The Strongest Case Against Starting With a Monolith

Stefan Tilkov answered Fowler with "Don't start with a monolith." He argues that a monolith's parts "will become extremely tightly coupled to each other" through shared libraries, in-process calls, and shared domain objects and persistence models, and that splitting one up afterward is extremely hard. He is right about what happens to a monolith built without discipline. That coupling is the reason the principles above exist.

Module boundaries, one owner per table, and a routing layer between clients and the deployment don't make a later split cheap, but they make it a matter of cutting along seams that already exist. The queries to rewrite are the ones the owning module already exposes, instead of a search through every module for whoever touches the data. Public accounts that follow one system from monolith discovery through extraction along settled seams are rare, so this rebuttal rests on the cost mechanism above more than on a body of case studies.

His argument also marks where this approach stops applying. When the boundaries are already known, as when a team rebuilds a system whose domain it has run for years, there is less left to discover. Building separately deployable parts from the start then gives up little. Discovery is the reason to start with a monolith, so the case for one weakens as the amount left to discover shrinks.

Some constraints are known on day one even when the domain is new. An organization that starts a new product with several teams already has the coordination constraint. So does a component that must sit apart for compliance or security, such as card handling kept out of the rest of the system's PCI scope. A known constraint is what the optimization exists for, so a few coarse services along those lines, each a modular monolith inside, fit that case better than one shared deployment. Discovery then happens within each service, where moving a boundary is still cheap.

## My Approach: Domain-Based Modular Monoliths

Start with **domain-based modules**: one modular monolith organized along natural business boundaries, which Eric Evans's domain-driven design calls bounded contexts. This gives you:

- Clear separation of concerns from the beginning
- Teams that own their domain's code, even while they share a deployment
- A migration path to microservices that follows existing module boundaries instead of cutting new ones
- Faster initial development than building distributed systems from day one

Shopify took this route with its main codebase. Kirsten Westeinde's account of the work describes reorganizing the code by business domain, such as orders, shipping, and billing, and building tooling to check that components talk only through their public interfaces. The goal, in her words, was more modularity "without increasing the number of deployment units."

Five years later, Gannon McGibbon and Chris Salzberg's "A Packwerk Retrospective" reported that static checks from Packwerk, the boundary-checking tool Shopify later built and open-sourced, hadn't been enough. A package with all its recorded violations resolved still failed to boot when loaded on its own, because of dependencies the static analysis couldn't see. What they found trustworthy was running code, so once they got that package to boot with only its own code loaded, they added a CI step that runs its tests in isolation. Packwerk 3.0 also dropped its privacy checks, the static rule meant to keep other packages out of a package's internals.

Boundaries hold when something executes them, and a folder structure or a lint rule alone tends to erode one convenient shortcut at a time. Where only static checks guard the boundaries, Tilkov's coupling warning holds. Shopify's answer was a stronger check inside the monolith, not a move to services.

## Split When the Evidence Shows Up

<blockquote class="pull-quote">
<p>Split into microservices when there's actual evidence it's needed: independent scaling requirements, team coordination becoming a bottleneck, or specific technology needs that justify the operational complexity.</p>
</blockquote>

Each of those signals, plus one more, can be checked instead of argued:

- **Independent scaling**: one module's load differs so much from the rest that scaling the whole deployment to meet it mostly buys capacity nothing else uses
- **Team coordination**: teams routinely wait on each other to release, or a shared test suite and deploy queue hold every change to the pace of the slowest one
- **Technology needs**: a module needs a runtime or data store the rest of the system can't host, and the gain outweighs operating a second stack
- **Fault isolation**: one part's failures or slowdowns keep spreading to unrelated parts, and timeouts, bulkheads, or separate queues inside the deployment haven't contained them

These signals arrive late, once the pain is present. The monolith also gives an earlier one. Track the share of merged changes that touch more than one module, and how often a change moves code or tables between modules. Watch them over several releases while feature work continues. The boundaries have probably settled when three things hold: the first number is falling, the second has dropped to near zero, and no duplicated logic or swelling module is absorbing the work. That says the seams are stable enough to plan an extraction around. It isn't a reason to extract, which still waits for one of the signals above.

A signal tells you that something needs to be separated, and the module boundaries tell you where the seam already runs. Until a signal shows up, the monolith is still doing the job it was chosen for, which is teaching you where the boundaries belong.
