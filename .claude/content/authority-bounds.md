# Authority Bounds

This is a map of where Lucent Owl and its author can argue with authority. Use it when choosing blog post subjects, especially posts meant to travel on social media. It does not restrict what gets written. It shows where an argument will stand up to a hostile reply and where it will need more support.

Authority here means the site can firmly support what it argues. There are three ways to earn it:

- **Research:** primary sources, specifications, empirical studies, public incident reports, and data, investigated until a position holds.
- **Backing:** study guides, resources, and case studies that show the site has already worked through an area. They give a post a head start on research, since their external sources can be followed and cited, but a post never cites or names them. Its sources are always external.
- **Lived experience:** the author has built, run, or led the thing and can say what went wrong.

Research is the main path. Most posts on the site began as research projects: a question without a settled answer, investigated until an argument emerged. The exceptions post weighed which claims had measurable backing. The reads-and-writes post worked from RFC 5789 and real API behavior. The authority post synthesized SOLID, normalization, and least privilege. Experience sharpens a post and supplies examples, but it isn't a gate. Treating it as one would confine the blog to the author's past and stop both the audience and the author from growing.

A post is strongest when the research holds and the site's lens gives it an angle no one else has taken. It is weakest when it's a take nobody checked.

Built from: 31 posts (June 2025 to September 2026), 10 case studies, about 380 study guides in 23 categories, 56 resources, 5 learning paths, the author's resume and Philosophy page on stevenstuartm.com, and the author's own account of their range. Refresh it when a new cluster of posts or case studies lands, or the resume changes.

---

## The Author's Record

Fifteen years across five companies, mostly in financial services, with the Microsoft stack throughout and AWS in production since 2018.

| Years | Role and company | Domain | What it proves |
| --- | --- | --- | --- |
| 2026 to now | Team Lead / Senior Developer, SafetyChain | Enterprise records, desktop | WinUI 3 rebuild shipped in 4 months after 2 stalled years; a custom AI skill that enforces assumption checks before coding |
| 2023 to 2026 | System Architect, True Market Insiders | Financial research platform | Cloud costs cut 80%; API response from over 1 s to 40 ms and database CPU from 85% to 10% via Aurora, DynamoDB, and Snowflake; service boundaries redesigned for transactions; WAF and zero-trust IAM; Shape Up hybrid took bug fixes from months to days; AI-assisted development about 70% faster with near-zero new defects; deploys from 30 to 5 minutes; GraphQL (HotChocolate) on EKS |
| 2018 to 2023 | Senior Software Engineer II, Alkami Technology | Digital banking, 200+ institutions, millions of users | The company's first Lambda-based APIs, whose patterns other teams adopted; a real-time notification platform for banks; test quality across microservices |
| 2015 to 2018 | Solutions Developer III, Cottonwood Financial | Consumer finance, retail | WPF point-of-sale system in hundreds of retail locations; a monolith split into independently deployable components; automated test tooling |
| 2011 to 2015 | Tech Lead, DealerSpeedLeads | Marketing SaaS | Multi-tenant inventory platform with configurable data models across automotive, real estate, and e-commerce; distributed automation running thousands of operations a day |

**Stated range beyond the resume:** many Vue.js and Nuxt web apps; every major Windows desktop framework (WinForms, WPF, UWP, WinUI); the Microsoft stack broadly over 15 years; production database design on SQL Server, MySQL, and Snowflake; Firebase behind a production app.

**Peer testimony** (stevenstuartm.com): building configurable systems that turn a one-off requirement into an adaptable solution; SOLID, applied only where it doesn't cost performance; balancing theory with hands-on delivery.

**Leadership scope:** tech lead, team lead, and system architect directing a platform team and mentoring. Leadership posts can generalize to team and architecture-lead level. Executive or multi-org claims are outside the record.

### Proof Points for Posts

Seasoning for posts whose research lands near the author's own work. Quote them as written, and don't round them up or combine them.

- 80% reduction in monthly cloud costs
- API response time from over 1 second to 40 ms; database CPU from 85% to 10%
- Bug fix turnaround from months to days, feature delivery from weeks to days, after moving to feature-shaped work
- Production deploys from 30 minutes to 5
- About 70% faster code delivery with AI assistance, with production defects in new features nearly eliminated
- A desktop app stalled for 2 years shipped in 4 months
- A platform serving millions of users across 200+ financial institutions
- A point-of-sale system deployed to hundreds of retail locations
- Kubernetes to ECS Fargate in 3 days (case study)

---

## The Throughline

Across the 31 posts and the seven disciplines on the Philosophy page, one argument keeps coming back:

> **Most engineering failures are misplacements: a decision made at the wrong time, a responsibility put in the wrong place, or a practice followed for its own sake instead of for what it buys.**

The posts express it in three recurring moves. A post idea that uses one of them is on-voice by default.

| Move | What it does | Posts that use it |
| --- | --- | --- |
| **Relocate authority** | Shows that a problem comes from a responsibility living in the wrong component, token, layer, or team | Auth sessions across boundaries; JWTs as authorization; topology vs trust; architecture as authority placement; reads designing writes; reporting in production; shared libraries; config files with code |
| **Price the timing** | Weighs a decision by what it costs to reverse, and asks when discovery should be allowed to change the plan | Build slow to go fast; monoliths for discovery; rebuild vs realign; plan continuation bias; package updates as investments; TDD as assumption testing; Shaped Kanban |
| **Name the real thing** | Shows that a popular label hides what is actually happening, then renames it | Hexagonal vs DI; "tech debt" vs Corrections/Optimizations/Re-Alignments; empowerment as control; LeetCode as a category error; learning badges vs skills; observability is authored |

Underneath all three is **pragmatism against dogma**: every practice is judged by what it buys in context, and the author is willing to reverse a position ("Why I Changed My Mind About Exceptions") when the evidence shifts. The Philosophy page adds **values over process**, **outcomes over activity**, and **clarity that keeps the nuance**.

---

## Where the Posts Sit Today

| Domain | Posts | Share |
| --- | --- | --- |
| Architecture, boundaries, and code design | 14 | 45% |
| Career, leadership, and industry | 8 | 26% |
| Decision timing and delivery process | 7 | 23% |
| Production operations | 2 | 6% |

Six of the 31 posts carry a security angle, all through architecture: auth placement, token scope, trust models, config secrets, and invalid state. The site argues security as a structural concern, not as a checklist or tooling topic.

No post yet draws on the resume's desktop, frontend, data-warehouse, multi-tenant, or banking-scale work. The pace slowed after March 2026: two posts in June and one in September.

---

## Authority Tiers

Tiers describe where a post starts from, not where the blog may go. Tier 1 needs the least new research, because backing and experience already exist. Tiers 2 and 3 and the growth edges need more research, and that's where the audience and the author grow. A well-researched Tier 3 post outranks a thin Tier 1 post.

### Tier 1: Core (lived and backed)

Contrarian posts start from solid ground here, and they can be as sharp as the research allows.

| Domain | Lived evidence | Backing on site |
| --- | --- | --- |
| **Service boundaries and authority placement** (DDD, coupling, monolith vs microservices, shared code) | Monolith split at Cottonwood; microservices at Alkami; transaction boundaries redesigned at TMI; 8+ posts | Architecture Foundations, Styles, Patterns, DDD, modularity-coupling guides; style comparison resource |
| **API and contract design** (REST vs RPC, gRPC, GraphQL, write surfaces, versioning) | APIs for banking and financial research; GraphQL in production; REST-in-DDD and reads/writes posts | api-design-architecture, grpc-architecture-design, expressing-change-intent, ASP.NET API guides |
| **Identity, auth, and trust architecture** | Five auth systems unified (case study); zero-trust IAM at TMI; 3 posts | identity-access-management, aspnet-auth, aws-cognito, security fundamentals |
| **Data design and data-layer performance** (relational modeling, read/write separation, CQRS, warehouse offload, store selection) | SQL Server, MySQL, Snowflake, Aurora, DynamoDB, MongoDB in production; 1 s to 40 ms rework; loan servicing CQRS/ES case study; reporting post | 13 database guides, selection matrix, AWS database guides, data-architecture guide |
| **Distributed systems and serverless on AWS** | First Lambda APIs at Alkami; EKS, EventBridge, CloudFront at TMI; K8s to Fargate, SDK deadlock, metrics pipeline case studies | 56 AWS guides, 2 AWS learning paths, AWS diagrams |
| **Cloud cost and ownership** | 80% cost cut (resume and case study) | TCO, ROI, and cost management guides |
| **Multi-tenant and configurable systems** | Multi-vertical inventory platform (2011 to 2015); 200+ institutions on one banking platform; testimony on configurable design | multi-tenant-architecture guide, adaptability post |
| **Microsoft stack** (.NET and C# idioms, ASP.NET, WCF to ASP.NET Core, errors, nullability, DI, testing) | 15 years across the stack; exceptions and invalid-states posts; C# is the site's default language | 46 .NET guides, 21 ASP.NET Core guides |
| **Windows desktop architecture** (WinForms, WPF, UWP, WinUI 3, MVVM, legacy rescue) | Every major framework; WPF POS in hundreds of stores; WinUI 3 rebuild in 4 months | 34 WinUI guides, WinUI diagrams |
| **Decision-making and delivery method** (AAA cycle, Shaped Kanban, stopping work, reversibility, CI/CD) | Shape Up hybrid at TMI with measured results; deploys from 30 to 5 minutes; 7 posts | AAA Cycle guides and resources, SDLC frameworks, DevOps and CI/CD guides, methodology selection guide |
| **Production operations** (troubleshooting, observability as code design, incidents) | SDK deadlock case study; first-person incident posts | Observability guides, SLOs, incident-response, aspnet-health-checks |
| **Team-level engineering leadership** (mentoring, leading delivery, hiring) | Tech lead, team lead, and system architect roles; 3 leadership posts and the LeetCode post | Leadership guides, Leading a Development Team path |

### Tier 2: Lived, Lightly Backed

These are real production experience with little or nothing on the site. Posts here start their research from scratch, since no guide has already gathered the external sources. Each is also a candidate for new guides that would move it to Tier 1.

| Domain | Lived evidence | Site gap |
| --- | --- | --- |
| **Vue.js and Nuxt web applications** (SPA vs SSR, state, frontend architecture) | Many Vue and Nuxt apps; Vue in production at Alkami and TMI | No Vue or frontend-architecture guides |
| **Analytical warehousing** (Snowflake, offloading analytics from OLTP) | Snowflake designed into production systems | Snowflake appears only in passing; the data-architecture guides are cloud-generic |
| **GraphQL in .NET** (HotChocolate) | Production GraphQL at TMI | No GraphQL guide |
| **Legacy Microsoft modernization** (WCF, WinForms, and WPF to modern .NET) | 15 years of the stack's evolution; the WinUI rescue | Only winui-migration-wpf-uwp and legacy-modernization-strategies |
| **Real-time delivery at scale** (bank notifications, push) | Alkami notification platform; SignalR case study | aspnet-signalr guides exist but take no position on scale |
| **Distributed store-front software** (POS across hundreds of sites: offline, updates, fleet) | WPF POS rollout | Nothing outside the IoT fleet guides |
| **Firebase and backend-as-a-service** (when a managed backend beats building services) | Firebase behind a production app | No Firebase guide; only demo repos outside the site |

### Tier 3: Backed, Lightly Lived

The site teaches these in depth, but the resume doesn't show production ownership. Posts here rest on research and backing, which is how most of the site's posts were written anyway. The one limit: don't write as if from production experience of the topic. "When we ran this on Azure" is a claim, while "what Azure's governance hierarchy gets right about authority placement" is an argument.

| Domain | Backing | Calibration |
| --- | --- | --- |
| **Azure** | 67 guides, 4 component maps | Within the author's Microsoft range, but production cloud on the resume is AWS. Azure architecture and AWS-vs-Azure comparisons are fine; "when we ran this in production on Azure" stories are not |
| **Infrastructure as code** | 7 IaC guides plus CloudFormation, CDK, Bicep; Running AWS at Scale path | CI/CD is lived; IaC tooling at scale isn't on the resume |
| **Security operations and compliance** | 13 security guides | Application security is lived through architecture, but SOC work, audits, and offensive security aren't |
| **IoT and Industrial IoT** | 15 guides plus .NET IoT libraries | No production IoT work. Argue it through distributed-systems, fleet-update, or reversibility lenses the author has lived elsewhere |

### Reference Coverage

These are teaching fundamentals with no argumentative stake: data structures and algorithms, networking, GoF patterns, machine learning and MLOps, statistics, SEO. They can inform a post's background reasoning, never its citations, and they make poor post subjects on their own.

### Growth Edges

These are subjects where research through the site's lens would build new authority. Each connects to one of the three moves, and each has a public body of evidence to investigate.

| Edge | Why it fits | Evidence to work from |
| --- | --- | --- |
| **Empirical software engineering** | Tests the industry's beliefs against studies, the way the exceptions post did | Research on code review, static typing and defects, and estimation |
| **Public incident analysis** | Postmortems are decisions made visible, and they test reversibility and dependency trust | Published outage reports from cloud providers, CDNs, and security vendors |
| **Resilience science** | Retries, timeouts, and overload are authority and timing problems | Metastable-failure research; cell-based architecture writing |
| **Database correctness** | Promised vs delivered guarantees is "name the real thing" | Jepsen analyses; isolation-level test suites |
| **Open-source licensing and vendor control** | Relicensing moves authority over your stack to someone else | License changes and the forks that followed |
| **Frontend authority** | Server-driven UI, SSR, and local-first sync all decide where truth lives | Local-first software research; the server-rendering revival |
| **Developer productivity measurement** | Outcomes over activity | DORA reports, SPACE, DevEx research |
| **Protocol and standards work** | Where API and auth positions get tested by the people writing the specs | IETF drafts and RFCs for HTTP methods, OAuth, and token binding |

### Weak Fit

The site's lens adds little here, so research would produce a summary, not an argument. These aren't banned, but they rarely justify the effort.

- Frontend frameworks other than Vue and Nuxt as a primary subject
- Native iOS and Android development (the mobile post argues platform economics, not device craft)
- Cross-platform .NET UI (MAUI, Blazor): demo repos only, never shipped to production
- Languages other than C# and JavaScript as a primary subject
- Data science and ML research
- Executive strategy, multi-org leadership, fundraising, and product marketing

### Not a Post Subject: AI

AI is out of scope for posts, including AI-assisted development, LLM applications, agents, and AI's effect on the profession. The field changes every week, and taking a stance on it now is premature. The site teaches how to use AI to current standards in its study guides and learning paths, and doesn't present itself as an authority on it.

- Research never proposes an AI-centered idea, and the rank job flags any that remain for the author to decline.
- The published AI posts stand, and their positions stay on the committed list, but they get no sequels.
- AI proof points (the 70% delivery gain, the assumption-checking skill) can still season a post whose subject is something else, such as delivery method or testing.

---

## The Sweet Spot

A post idea lands in the sweet spot when it meets all four tests:

1. **It asks a real question.** The research could change the answer. A post that knows its conclusion before the investigation starts is an opinion piece, while one that could come out differently teaches the author something too.
2. **It uses one of the three moves.** It relocates authority, prices the timing, or names the real thing, and so challenges a practice readers already follow.
3. **It can be firmly supported.** Research, site backing, or experience holds the argument up. A specific study, incident report, or measured number spreads as well on social media as a personal story does.
4. **It speaks to the core audience.** Senior developers, architects, and team leads making structural or process decisions, the readers the learning paths are built for.

Ideas that meet three of the four are still good. Ideas that meet only the second (a sharp take with no support) are the ones that invite "citation needed" replies.

**The richest ground** is a question the industry actively argues about, investigated until the evidence settles it, and framed by a move the site already owns. Experience, where it exists, supplies the example that makes the research concrete.

**Industry commentary** (the SEO and mobile posts) sits at the edge: high reach, low authority. It works when the argument is economic or structural and names its sources. Keep it occasional so the blog stays an architecture voice that sometimes comments, not a commentary voice.

---

## Positions the Site Has Committed To

A new post should extend these or reverse one deliberately and say so, as the exceptions post did. Contradicting one by accident undermines the rest.

**From the posts:**

- Monoliths suit discovery; microservices are an optimization, taken on once boundaries are known.
- Domain-driven systems fit RPC better than REST's resource model.
- Auth sessions end at the security boundary; internal systems receive identity, not sessions.
- JWTs authenticate; authorization comes from grants resolved at request time.
- Legitimacy comes from verified identity, not network position.
- Configuration belongs in a versioned distributed store, not beside the code.
- Shared libraries cost more autonomy than they return; share principles, not implementation.
- Reporting and production workloads get separate models.
- Writes are small replaceable resources; reads are composed views.
- Exceptions, not Result types, for expected failures in modern distributed C# (reversed from an earlier view).
- Invalid states should be unrepresentable; null should crash loudly rather than default silently.
- Observability is authored in code, not installed as a platform.
- "Tech debt" should be replaced with Corrections, Optimizations, and Re-Alignments.
- Work should be organized around completing shaped features, not sprints.
- Spend design time in proportion to how expensive a decision is to reverse.
- Package updates are investments decided on value and risk, not hygiene.
- TDD's value is testing assumptions about the need.
- AI hollows out the middle of engineering skill; judgment becomes the bottleneck.
- Algorithm interviews and badge-driven learning measure the wrong things.
- The web platform already does what most apps need; Apple's control of the phone keeps the industry building native.

**From the Philosophy page:**

- Most project failures stem from broken values, not broken processes; added controls often signal missing trust.
- Measure outcomes, not activity; velocity and coverage metrics mislead when they become targets.
- A decision no one else can understand is one no one can challenge; record the trade-offs.
- Build for change, not perfection.
- Real capability comes from building, failing, and fixing.

---

## Original Frameworks the Site Owns

These terms originated here, so posts that apply them carry authority no other source has, and they give social posts a recognizable signature. Keep using them consistently.

| Framework | Home |
| --- | --- |
| AAA Cycle (Align, Agree, Apply) | AAA guides, resources, worked example; Philosophy page |
| Shaped Kanban | Shaped Kanban post; the Shape Up hybrid on the resume is its field record |
| Corrections, Optimizations, Re-Alignments | Tech debt post |
| Contour and bond (authority placement properties) | Architecture-as-authority post |
| Position vs identity (trust models) | Topology post |
| Skill inversion | AI in Practice post |
| Assumptions-first task planning | Planning skill resource; the SafetyChain AI skill |

---

## Gaps Worth Filling

These are the cheapest starting points, because the example already exists. Each still needs research to become an argument that holds beyond one team.

**Case studies not yet turned into posts:**

| Case study | Argument waiting in it |
| --- | --- |
| Kubernetes to ECS Fargate in three days | Adopting a tool built for someone else's scale means adopting their problems |
| Fintech: three failed event pipelines | When successive rebuilds fail the same way, the cause is organizational, not technical |
| Loan servicing on SQL Server only | A sound architecture can be defeated by one infrastructure mandate |
| SignalR push service | The best real-time system is sometimes a better cache |
| Cloud bill cut by 80% | Cost is an ownership problem before it is an optimization problem |

**Resume stories with no site presence:**

| Story | Argument waiting in it |
| --- | --- |
| First Lambda APIs at a banking platform, adopted across teams | How a pattern spreads through an organization: by being copyable, not by mandate |
| Real-time notifications for 200+ banks | Multi-tenant fan-out, and whose rules decide what "real time" means |
| 1 s to 40 ms by reworking the data layer | Most API latency is a data-model decision, not a compute one |
| WPF POS in hundreds of stores | Software you can't redeploy on demand forces the reversibility discipline the cloud lets teams skip |
| Multi-vertical configurable inventory platform | When configurability pays off, and when it becomes a second programming language |
| Monolith split at a consumer finance company | What made the split work, measured against the "monoliths for discovery" position |
| Shape Up hybrid: bug fixes from months to days | The field record behind Shaped Kanban |
| Fifteen years of Windows desktop frameworks | What each generation got wrong about the last one; why desktop keeps not dying |
| Vue and Nuxt across many apps | SSR vs SPA as an authority-placement decision; where frontend state should live |
| Firebase behind a production app | A managed backend moves authority into security rules and the client; when that trade is worth it |

**Domains with deep guides and no posts:** infrastructure as code, resilience and disaster recovery, testing strategy at the architecture level, governance in practice.

**Operations** has only 2 posts despite Tier 1 authority.
