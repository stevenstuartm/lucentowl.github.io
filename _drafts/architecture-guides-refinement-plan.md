# Architecture Study Guides Consolidation and Refinement Plan

Tracks the consolidation and review-and-refine pass over the 40 guides in the "Architecture" category of `assets/data/study_guides_config.json`, all of which live in `_guides/architecture/`. The directory also holds two guides that belong to other categories, `architecture-decision-making.md` (Leadership & Team Management) and `observability-architecture.md` (Observability). They are out of scope, so measure and grep this pass from the config list rather than the directory.

Guides are consumed sequentially in config order. That order encodes the fundamentals-to-advanced learning path, so no guide should add its own prerequisite framing or cross-links to siblings in scope.

**The checklist, the Phase 0 method, the process rules, and the cross-domain gotchas live in [`.claude/content/guide-refinement-standard.md`](../.claude/content/guide-refinement-standard.md).** Read it first. This document carries only what is specific to this pass.

**Current position: Phase 1, row 38.**

---

## Phase 0: Consolidation (complete)

### Structure and reading order

Eight subcategories. Design was split because designing boundaries and contracts is a different reader question from verifying that the architecture delivers its characteristics.

Order rationale across subcategories:
- Patterns follow Styles directly, because the distributed styles raise the problems the patterns solve.
- Design applies patterns to specific boundaries and contracts, so it follows Patterns.
- Modeling precedes Quality & Risk because risk storming is run on an architecture diagram.
- Governance and Business & Economics close the category as organizational concerns that apply to everything before them.

Order rationale inside subcategories:
- **Foundations:** component-based thinking follows modularity and characteristics, since identifying components applies both. Distributed computing closes the subcategory because it covers what changes once components are separated.
- **Patterns:** interaction styles first, then reliable messaging, which builds on async interaction. Data management precedes orchestration and choreography because database-per-service creates the distributed transaction problem that sagas solve. Coordination, reliability, and performance follow as cross-cutting concerns. Gateway and proxy patterns precede service mesh, since a mesh is sidecars and gateways at scale. Legacy modernization is last because it composes most of the above.
- **Design:** DDD first, since it sets the boundaries APIs expose. The three API guides go from general to specific. Multi-tenancy closes the subcategory because it composes partitioning, isolation, and identity decisions made earlier.

### Topic ownership map

Stays for the life of the pass. "Clause" means a non-owner defines the concept in a clause where it's used, or omits it, and doesn't link to the owner.

| Concept | Owner | Non-owners treat it as |
|---|---|---|
| Laws of architecture, architecture vs design, trade-off analysis | ArchitectureFoundations | all: clause |
| Architect role skills: breadth vs depth, hands-on coding, bottleneck trap | `leadership/architecture-leadership-foundations.md` (out of scope) | ArchitectureFoundations: moved out |
| Technical vs domain partitioning, Conway's Law, inverse Conway maneuver | ArchitectureFoundations | ArchitectureStyles, layered, modular-monolith: clause |
| Team Topologies team types | `sdlc/team-organization.md` (out of scope) | ArchitectureFoundations: moved out |
| Cohesion types, afferent/efferent coupling, instability, abstractness, connascence, temporal coupling, Law of Demeter | modularity-coupling | DesignImplementation, distributed-computing: clause |
| Characteristic taxonomy, selection, measurement, fitness functions as a concept | architecture-characteristics | `architecture-characteristics-glossary.md` holds the definitions; performance-engineering, grpc, ArchitectureStyles: clause |
| Logical vs physical architecture, component identification, entity trap | DesignImplementation | — |
| Fallacies of distributed computing, architecture quantum, static and dynamic quantum coupling, monolith vs distributed decision | distributed-computing | ArchitectureStyles: one sentence |
| Style taxonomy and style selection | ArchitectureStyles | style guides keep their own "Evolution and Alternatives"; the comparison table lives in `architecture-style-comparison.md` |
| A style's topology, data topology, and characteristic ratings | that style's guide | ArchitectureStyles: one line per style at most |
| Pipes and filters | pipeline-architecture | messaging: clause |
| Broker vs mediator topology, events vs messages, data-based vs key-based event payloads | event-driven-architecture | communication, messaging: clause |
| Service granularity | microservices-architecture | domain-driven-design keeps context-to-service mapping |
| ESB, service taxonomy | soa-architecture | ArchitectureStyles: clause |
| Data grid, processing units, replicated vs distributed caching as a style | space-based-architecture | performance_scalability: clause |
| Request-response, publish-subscribe, event streaming, scatter-gather | communication_patterns | event-driven, grpc: clause |
| Outbox, inbox, claim check, dead letter queue, priority queue, content-based router, message translator | messaging_patterns | pipeline, legacy-modernization (CDC): clause |
| Idempotency and deduplication | reliability_patterns | messaging applies it in the inbox; api-design, orchestration_choreography: clause |
| Database per service, shared database, CQRS, event sourcing, materialized view, eventual consistency | data_management_patterns | microservices, domain-driven-design, event-driven, grpc, modular-monolith: clause |
| Saga (orchestrated and choreographed, compensation), orchestration vs choreography | orchestration_choreography | microservices, data_management, grpc, domain-driven-design, event-driven, soa: clause |
| Leader election, distributed locks, fencing, consensus | coordination_patterns | — |
| CAP, ACID, BASE | `data/database-fundamentals.md` (out of scope) | architecture-characteristics, coordination_patterns: clause |
| Circuit breaker, retry and backoff, bulkhead, timeout, health checks, graceful degradation | reliability_patterns | communication, service-mesh, microservices, event-driven, testing-strategy: clause |
| Load balancing, cache-aside and read/write-through, throttling and rate limiting, sharding | performance_scalability_patterns | performance-engineering, api-design, space-based: clause; grpc keeps the HTTP/2 connection-level balancing constraint; `dotnet/c-sharp/libraries/caching-patterns.md` (out of scope) keeps .NET implementation |
| API gateway, backend for frontend, sidecar, ambassador | deployment_infrastructure_patterns | api-design, grpc, legacy-modernization, service-based, microservices: clause |
| Service mesh data and control planes, mesh mTLS and traffic management, mesh vs gateway | service-mesh-architecture | deployment_infrastructure, microservices, grpc, api-design: clause |
| Strangler fig, anti-corruption layer as a migration mechanism, branch by abstraction, parallel change, parallel run, CDC-based migration | legacy-modernization-strategies | domain-driven-design keeps the ACL as one context-map relationship |
| Blue-green, canary, rolling deployment | `infrastructure/deployment-strategies.md` (out of scope) | legacy-modernization, testing-strategy, service-mesh: clause |
| Ubiquitous language, bounded contexts, context mapping, subdomains, aggregates, entities, value objects, domain events, event storming | domain-driven-design | microservices, modular-monolith, service-based, ArchitectureStyles: clause |
| GoF factory | `oop/creational-patterns.md` (out of scope) | domain-driven-design keeps aggregate factories only |
| REST resource modeling, error responses, pagination, filtering, GraphQL schema design, API versioning, deprecation, backward compatibility | api-design-architecture | grpc keeps proto compatibility |
| HTTP method semantics and status code lookup | `http-methods-status-codes.md` resource | api-design keeps the reasoning only |
| API authentication and authorization mechanisms | security category (out of scope) | api-design, grpc: clause |
| Partial-update intent, lost updates, optimistic concurrency | expressing-change-intent-in-api-payloads | api-design: clause |
| gRPC protocol, streaming modes, proto evolution, gRPC-Web, JSON transcoding, the gRPC/REST/GraphQL/messaging comparison table | grpc-architecture-design | — |
| Tenancy isolation models, noisy neighbor, tenant-aware partitioning, tenant context | multi-tenant-architecture | performance_scalability: clause |
| Test pyramid and its alternatives, test types, contract testing, property-based testing, test doubles, mutation testing, testing in production | testing-strategy-architecture | api-design, performance-engineering: clause |
| Security testing (SAST, DAST, penetration testing) | `security/security-testing.md` (out of scope) | testing-strategy: clause |
| Performance requirements, profiling, load test methodology, capacity planning, autoscaling | performance-engineering | testing-strategy: clause |
| Risk matrix, risk assessment, risk storming | architecture-risk-analysis | governance review checklist: clause |
| C4 levels and notation, diagramming discipline, ArchiMate | c4-model | uml-diagrams: clause |
| UML diagram types | uml-diagrams | c4-model keeps "Mixing C4 and UML" |
| ADRs | `architecture/architecture-decision-making.md` (out of scope) | governance, total-cost-of-ownership, return-on-investment: clause |
| Governance principles and models, architecture review board, review process, variance management | governance | — |
| TOGAF, Zachman, framework selection | governance-frameworks | — |
| Cloud well-architected frameworks | `infrastructure/aws/aws-well-architected-framework.md`, `infrastructure/azure/azure-well-architected-framework.md` (out of scope) | governance-frameworks, governance-tools: clause |
| Architecture rules as tests, analyzers, quality gates, policy-as-code principle | governance-tools | architecture-characteristics, testing-strategy: clause |
| AWS Organizations, SCPs, Control Tower, AWS Config, Security Hub | `infrastructure/aws/aws-organizations-control-tower.md`, `infrastructure/iac-governance.md` (out of scope) | governance-tools: moved out |
| IaC policy tooling (OPA, Conftest, CloudFormation Guard, CDK Aspects) | `infrastructure/iac-testing.md` (out of scope) | governance-tools: principle only |
| Cloud budgets, anomaly detection, cost allocation tags | `infrastructure/aws/aws-cost-management.md` (out of scope) | governance-tools, total-cost-of-ownership: clause |
| Cost categories, hidden costs, time horizon, build vs buy, cloud vs on-premises | total-cost-of-ownership | return-on-investment: clause |
| Benefit quantification, simple ROI, payback, NPV, IRR, sensitivity analysis, estimation bias, post-implementation review | return-on-investment | total-cost-of-ownership keeps NPV as one clause |
| SLOs, tracing, OpenTelemetry | `observability-fundamentals.md`, `architecture/observability-architecture.md` (out of scope) | performance-engineering, return-on-investment, total-cost-of-ownership: clause |

---

## Phase 1: Refinement

Per row, run the standard's nine-item checklist, apply the fixes, run `/refine-prose`, set status to Complete, and move to the next row. Don't stop between rows. No Jekyll build. The standard's *How Phase 0 changes Phase 1* applies: New rows (30, 33) get written, not just refined, and item 2 checks each guide against the ownership map.

Rows touched by Phase 0 moves (2, 3, 4, 5, 6, 16, 17, 22, 23, 24, 27, 31, 38) contain sections pasted in wholesale from other guides. Expect seams: an intro that no longer describes the body, a quick-reference table that doesn't match the sections, repeated framing.

### Closing the pass

After the last row, re-run the sibling-link grep over the in-scope files:

```bash
grep -rnE '(\]\(|href=")/study-guides/architecture/' _guides/architecture/ | grep -vE '^_guides/architecture/(architecture-decision-making|observability-architecture)\.md'
```

Links from in-scope guides to the two out-of-scope guides in the directory are allowed, but a prerequisite callout is not, whatever it links to. Then confirm no concept is re-taught against the ownership map, and re-run the resource link audit under **Domain gotchas**.

---

## Sources

- **Architecture fundamentals and styles:** Richards & Ford, *Fundamentals of Software Architecture* (2nd edition, O'Reilly 2025). Confirm which edition a claim traces to. Ford, Richards, Sadalage & Dehghani, *Software Architecture: The Hard Parts* (2021) for quantum coupling, sagas, and data ownership.
- **Modularity:** Martin, *Agile Software Development* for instability, abstractness, and the main sequence. Page-Jones and connascence.io for connascence.
- **DDD:** Evans, *Domain-Driven Design* (2003), Vernon, *Implementing Domain-Driven Design*, and the DDD Crew's context mapping reference.
- **Patterns:** Hohpe & Woolf's *Enterprise Integration Patterns* (enterpriseintegrationpatterns.com), Nygard's *Release It!* for stability patterns, Richardson's microservices.io for outbox, saga, and database-per-service, Martin Fowler's bliki for strangler fig, branch by abstraction, parallel change, CQRS, and event sourcing. The Azure Architecture Center cloud design patterns catalog and AWS Prescriptive Guidance cloud design patterns are acceptable for pattern definitions, including multi-tenancy (Azure's multitenant architecture guidance, AWS SaaS Lens).
- **Distributed coordination:** the Raft paper (Ongaro & Ousterhout, 2014), Kleppmann's *Designing Data-Intensive Applications*, and Kleppmann's "How to do distributed locking" for Redlock's safety limits. Garcia-Molina & Salem (1987) for saga origin.
- **Legacy modernization:** Feathers, *Working Effectively with Legacy Code*. Newman, *Monolith to Microservices*.
- **APIs:** RFC 9110 (HTTP semantics), RFC 9457 (problem details), RFC 6902, RFC 7396, RFC 4511, the GraphQL specification, grpc.io and protobuf.dev, Kubernetes docs for server-side apply, OASIS OData v4.01.
- **Modeling:** c4model.com, the OMG UML 2.5.1 specification, The Open Group ArchiMate 4 (April 2026).
- **Governance:** The Open Group TOGAF Standard, zachman.com, the AWS and Azure well-architected docs, ArchUnitNET's repository and docs, Roslyn analyzer docs on Microsoft Learn, SonarQube docs, Open Policy Agent docs.
- **Service mesh:** istio.io, linkerd.io, HashiCorp Consul docs.
- **Testing:** Pact docs, Fowler's "The Practical Test Pyramid", Stryker docs for mutation testing, FsCheck or CsCheck docs for property-based testing in C#.
- **Economics:** standard corporate finance definitions for NPV, IRR, and payback.
- **Off-limits for asserted facts:** vendor TCO and ROI whitepapers and calculators, analyst figures (Gartner, Forrester, IDC) quoted secondhand, "X% of teams" statistics without a primary study, Medium and newsletter explainers, and answers generated by an LLM.

## Domain notes

**Item 1 (factual correctness)** in this domain is mostly about invention and attribution rather than decay. The concepts are stable. The errors are:
- Invented numbers presented as findings: usage percentages, service-count thresholds for adopting a mesh, per-hop latency, roadmap phase durations. Remove them or reframe them as the reasoning behind the threshold.
- Misattribution: who coined a pattern, law, or fallacy, and when. Verify against the primary source, not a secondary account.
- Stale product detail inside otherwise conceptual guides, concentrated in the service mesh, governance tools, and API guides.
- Code samples. The category has about 60 C# blocks plus JSON, YAML, GraphQL, SQL, and HTTP. Verify them as claims, per the standing gotcha.

**Item 7 (hierarchy and scope clarity)** has several scope ladders that these guides use without naming:
- **Structure:** system, architecture quantum, deployable unit, component, module or namespace, class.
- **DDD:** domain, subdomain, bounded context, aggregate, entity or value object.
- **C4:** system context, container, component, code.
- **Transaction and consistency:** local transaction, aggregate, saga, eventual consistency across contexts.
- **Governance:** enterprise, domain or portfolio, solution, team.
- **Tenancy:** deployment, tenant, user, with isolation decided separately for data, compute, and identity.

The tell is "component" and "service" used interchangeably, or "boundary" without saying which boundary. A container in C4 is a deployable unit, not a Docker container, and guides that mix both senses need to say so.

**Item 9 (tag audit)** was measured across the front matter of the 39 original in-scope guides before the pass:
- `architecture` appears on 39 of 39. Drop it, since it restates the category.
- `design-patterns` (21), `distributed-systems` (17), `scalability` (10), `microservices` (10), and `decision-making` (8) are the filler tags to replace with real content signal. Keep `microservices` only on guides that are specifically about microservices.
- `monolithic` (5) sits on the monolithic style guides and duplicates what the Styles subcategory and the guide title already say. Treat it as filler.
- Skill level: `practical` 25, `fundamentals` 5, `advanced` 1. Ten guides had no skill tag (`modularity-coupling`, `data_management_patterns`, `deployment_infrastructure_patterns`, `messaging_patterns`, `orchestration_choreography`, `performance_scalability_patterns`, `service-mesh-architecture`, `soa-architecture`, `governance`, `governance-frameworks`). Two have two (`c4-model`, `layered-architecture`). Check whether `coordination_patterns`, `space-based-architecture`, and `service-mesh-architecture` warrant `advanced`. Phase 0 gave the two New seeds `practical` as a placeholder.
- Reach for the specific nouns a reader would search: `saga`, `cqrs`, `event-sourcing`, `outbox`, `circuit-breaker`, `bulkhead`, `sharding`, `api-gateway`, `bff`, `sidecar`, `service-mesh`, `strangler-fig`, `anti-corruption-layer`, `bounded-context`, `connascence`, `fitness-functions`, `c4`, `uml`, `togaf`, `contract-testing`, `grpc`, `rest`, `graphql`, `json-patch`, `npv`, `multi-tenancy`.

**Code samples.** C# is the site default and is correct for almost everything here. HTTP, GraphQL, SQL, and protobuf samples stay in their own syntax.

## Domain gotchas

- **Measure from the config, not the directory.** `_guides/architecture/` holds two guides from other categories. A directory glob over-counts tags and pulls out-of-scope guides into greps.
- **Filenames don't match titles after Phase 0.** `DesignImplementation.md` is "Component-Based Thinking", `deployment_infrastructure_patterns.md` is "Gateway and Proxy Patterns", `governance-tools.md` is "Automating Architecture Governance". Filenames also mix PascalCase, snake_case, and kebab-case. Never rename to make them consistent.
- **Mixed line endings.** Some in-scope guides are LF and the rest CRLF, and the Phase 0 rewrites (`DesignImplementation`, `communication_patterns`, `deployment_infrastructure_patterns`, `governance-tools`, and the two New seeds) are now LF. Any script that edits by line number must preserve each file's own ending.
- **Resources carry no body links.** A resource links only through its `related_guides`, `related_case_studies`, and `related_posts` front matter, which `_includes/related-links.html` renders in both directions: forward pills on the resource and reverse pills on each linked guide. Guides never link to resources. Phase 0 moved the nine style-guide links out of the `architecture-style-comparison.md` table body into `related_guides`.
- **A resource missing from `resources_config.json` is not removed.** The config drives only the Resources listing page. The file still builds, keeps its URL, and still shows a reverse pill on every guide it names, because `related-links.html` reads `site.resources`, not the config. Removing a resource means deleting the file. Phase 0 found two such orphans (`protocol-comparison-grpc-rest-graphql-mq.md`, `security-framework-selection-guide.md`) left over from the July 2026 resource cull, and a stale `http-version-comparison.md` config entry, and removed all three.
- **Resource link audit, re-run at closing:** every `related_*` URL in `_resources/` resolves; every file in `_resources/` is in `resources_config.json` and vice versa; no `/resources/` or `/study-guides/` link site-wide points at a missing file.
- **App Mesh content remains outside the scope.** `infrastructure/aws/advanced-container-patterns.md`, `aws-container-services.md`, and `aws-vpc-architecture.md` still teach App Mesh. Not this pass's to fix; see the App Mesh fact below.
- **No Liquid hazards today.** No in-scope guide contains `{{` or `{%`. API and gRPC samples that add mustache-style templating need the whole-document `{% raw %}` wrap described in CLAUDE.md.

## Cross-guide facts in force

Verified during earlier rows; applies to every remaining guide that touches the topic.

- **Richards & Ford editions** (checked row 1): *Fundamentals of Software Architecture* first edition (2020) has two laws, trade-offs and why over how. The second edition (2025) adds a third law, that architecture decisions sit on a spectrum rather than being binary, plus a new corollary. Any guide citing three laws to the 2020 edition is wrong. O'Reilly's chapter pages return 403 to WebFetch, and the Thoughtworks free-chapter PDF is image-only, so book wording can't be quoted from a fetch.
- **Conway's Law** (checked row 1): published as "How Do Committees Invent?" in *Datamation*, April 1968, after Harvard Business Review rejected it. Fred Brooks named it Conway's Law in *The Mythical Man-Month*. A "1967" date is wrong.
- **"Programmers know the benefits of everything and the trade-offs of nothing"** (checked row 1) is a paraphrase of Rich Hickey, not a verbatim quote. The two-sentence version ending "Architects need to understand both" is Nathaniel Schutta's, in *Thinking Architecturally* (2018).
- **Three added fallacies of distributed computing** (Thoughtworks Technology Podcast, June 2025, checked row 5): Mark Richards and Neal Ford propose "versioning is easy", "compensating updates always work", and "observability is optional". The name is "compensating updates", not "compensating transactions". The original eight come from Sun Microsystems in the 1990s, commonly credited to L Peter Deutsch with James Gosling credited for the eighth.
- **Architecture quantum definition** (checked row 5): *Software Architecture: The Hard Parts* (2021) defines it as an independently deployable artifact with high functional cohesion, high static coupling, and synchronous dynamic coupling. Dynamic coupling has three dimensions: communication (sync/async), consistency (atomic/eventual), and coordination (orchestration/choreography). Guides using the older "synchronous connascence" wording should use this one.
- **Component identification** (checked row 4, developertoarchitect.com lessons 191-193): Richards' two approaches for initial core components are the workflow approach and the actor/action approach, and the entity trap is his named anti-pattern ("manager" CRUD components form a component-relational mapping, not an architecture).
- **Broker message size limits** (checked for row 17): Amazon SQS raised its maximum message payload from 256 KiB to 1 MiB for standard and FIFO queues on 4 August 2025 (AWS What's New). RabbitMQ's default `max_message_size` is 16 MiB from 4.0 onward, down from 128 MiB in 3.8 through 3.13, with a hard cap of 512 MiB. Kafka's broker default `message.max.bytes` is about 1 MB. Any guide citing SQS at 256 KB or RabbitMQ at 128 MB as current is stale.
- **Kafka no longer uses ZooKeeper** (Apache Kafka 4.0.0 release announcement, March 2025, checked row 20): 4.0 runs only in KRaft mode, its own Raft-based controller, and ZooKeeper mode is removed. KRaft was production-ready from 3.3. Any guide naming Kafka as a ZooKeeper user, or listing ZooKeeper as a Kafka dependency, is stale.
- **AWS App Mesh is discontinued on 30 September 2026** (AWS App Mesh documentation and the AWS Containers blog migration post, checked Phase 0). After that date the console and App Mesh resources are inaccessible. New customers have been unable to onboard since 24 September 2024. AWS points ECS workloads to Amazon ECS Service Connect and EKS workloads to Amazon VPC Lattice. Any guide presenting App Mesh as a current option is stale.

- **Service mesh data planes** (istio.io, linkerd.io, Consul docs, checked row 24): Istio's sidecarless ambient mode (ztunnel plus waypoint proxies) is GA since Istio 1.24, November 2024, and sidecars remain supported. Linkerd supports VM workloads since 2.15, and since February 2024 the open source project ships only edge releases, with stable builds from vendors such as Buoyant Enterprise for Linkerd. HashiCorp calls its mesh Consul service mesh, formerly Connect. A guide equating a mesh with sidecars, or calling Linkerd Kubernetes-only, is stale.

- **HTTP API standards** (rfc-editor.org, checked row 27): RFC 9457 (July 2023) obsoletes RFC 7807 for Problem Details, and RFC 9745 (March 2025) standardizes the `Deprecation` response header alongside RFC 8594's `Sunset`. GraphQL Playground is archived in favor of GraphiQL. Any guide citing RFC 7807 as current or recommending GraphQL Playground is stale.

- **Renamed or retired products** (vendor docs, checked rows 26 and 28): Azure AD is Microsoft Entra ID (2023). Google's Traffic Director and Anthos Service Mesh are now Cloud Service Mesh. Apollo Studio is GraphOS Studio. Protobuf files now declare an edition (2023, 2024) rather than `syntax`, and editions have no `required` label.

- **OData delta payloads flow both ways** (OASIS OData 4.01 Protocol, section 11.4.12, checked row 29): clients can PATCH a collection with a delta payload, applied as upserts and deletions, with an optional continue-on-error mode. Also, .NET 10 ASP.NET Core JSON Patch uses System.Text.Json via Microsoft.AspNetCore.JsonPatch.SystemTextJson, and RFC 9110 obsoletes RFC 7232 for conditional requests.

- **Diagramming standards and tools** (c4model.com, The Open Group, structurizr.com, checked row 31): C4 is notation-independent and has three supplementary diagrams (system landscape, dynamic, deployment), so a guide saying C4 can't show runtime flows or deployment is wrong. ArchiMate 4 was released in April 2026 and replaces 3.2 as current. The Structurizr cloud service shut down on 30 September 2026; the DSL and self-hosted tooling continue. Mermaid's C4 support is still experimental. "Irrational artifact attachment" is Neal Ford's term (2008), repeated in *Fundamentals of Software Architecture*.

- **Framework and standard versions** (opengroup.org, ISACA, PeopleCert, DoD CIO, AWS docs, checked row 37): TOGAF Standard 10th Edition (April 2022) is current, split into Fundamental Content and Series Guides, so TOGAF 9.2 links and references are stale. ITIL (Version 5) launched in 2026 and succeeds ITIL 4. COBIT 2019 is current. DoDAF 2.02 is current, with UAF as its positioned successor. AWS Well-Architected has six pillars including sustainability.

## Open pre-flags

Leads for rows not yet done. **A pre-flag is a lead, not a finding.** Re-verify before acting. Delete the entry once its row is complete.

| Target row | Lead |
|---|---|
| 38 governance-tools | The SonarQube quality gate shown as YAML may not be a real SonarQube configuration format. Check the ArchUnitNET API calls (`ResideInNamespace` signature) and NDepend's "< 50k LOC" threshold. The *Policy as Code for Infrastructure* and *Rolling Out Automation* sections were written in Phase 0 and need item 1 like any new prose. |
| 39 total-cost-of-ownership, 40 return-on-investment | Worked examples carry dollar figures. Confirm each is framed as illustrative, not as a benchmark. Both repeat "use ranges, not point estimates", "post-implementation reviews", and an observability-investment example; each topic needs one owner per the map. |

## Unverified, left standing

Claims on finished guides that could not be confirmed against a source. Each was softened rather than asserted; revisit if a source turns up.

- **Row 1, "Software architecture encompasses five interconnected dimensions."** The guide presented structure, characteristics, components, style, and decisions as a fixed set of five. The book's definition couldn't be read (see the Richards & Ford editions fact), so the guide now describes those elements as "several interconnected elements" without a count or attribution.
- **Row 6, partitioning type per style.** The new "How the Styles Divide" table assigns each style a top-level partitioning type. Layered (technical), service-based and microservices (domain) were confirmed; pipeline, event-driven, and SOA (technical) and modular monolith (domain) follow from how those styles are structured. Microkernel and space-based couldn't be confirmed as a single type, so the table says "Technical or domain" for both, with the reason. Revisit against the book's style characteristics tables if a readable copy turns up.

## Progress

| # | Subcategory | Guide | Status |
|---|---|---|---|
| 1 | Foundations | ArchitectureFoundations.md | Complete |
| 2 | Foundations | modularity-coupling.md | Complete |
| 3 | Foundations | architecture-characteristics.md | Complete |
| 4 | Foundations | DesignImplementation.md | Complete |
| 5 | Foundations | distributed-computing.md | Complete |
| 6 | Styles | ArchitectureStyles.md | Complete |
| 7 | Styles | layered-architecture.md | Complete |
| 8 | Styles | pipeline-architecture.md | Complete |
| 9 | Styles | microkernel-architecture.md | Complete |
| 10 | Styles | modular-monolith-architecture.md | Complete |
| 11 | Styles | service-based-architecture.md | Complete |
| 12 | Styles | event-driven-architecture.md | Complete |
| 13 | Styles | microservices-architecture.md | Complete |
| 14 | Styles | soa-architecture.md | Complete |
| 15 | Styles | space-based-architecture.md | Complete |
| 16 | Patterns | communication_patterns.md | Complete |
| 17 | Patterns | messaging_patterns.md | Complete |
| 18 | Patterns | data_management_patterns.md | Complete |
| 19 | Patterns | orchestration_choreography.md | Complete |
| 20 | Patterns | coordination_patterns.md | Complete |
| 21 | Patterns | reliability_patterns.md | Complete |
| 22 | Patterns | performance_scalability_patterns.md | Complete |
| 23 | Patterns | deployment_infrastructure_patterns.md | Complete |
| 24 | Patterns | service-mesh-architecture.md | Complete |
| 25 | Patterns | legacy-modernization-strategies.md | Complete |
| 26 | Design | domain-driven-design.md | Complete |
| 27 | Design | api-design-architecture.md | Complete |
| 28 | Design | grpc-architecture-design.md | Complete |
| 29 | Design | expressing-change-intent-in-api-payloads.md | Complete |
| 30 | Design | multi-tenant-architecture.md | Complete |
| 31 | Modeling | c4-model.md | Complete |
| 32 | Modeling | uml-diagrams.md | Complete |
| 33 | Quality & Risk | architecture-risk-analysis.md | Complete |
| 34 | Quality & Risk | testing-strategy-architecture.md | Complete |
| 35 | Quality & Risk | performance-engineering.md | Complete |
| 36 | Governance | governance.md | Complete |
| 37 | Governance | governance-frameworks.md | Complete |
| 38 | Governance | governance-tools.md | In progress |
| 39 | Business & Economics | total-cost-of-ownership.md | Not started |
| 40 | Business & Economics | return-on-investment.md | Not started |
