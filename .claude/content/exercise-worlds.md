# Exercise Worlds

The canon for the fictional companies that exercises are set in. Read the company's entry before writing an exercise set there, and add every new fact the exercise introduces after it's written. Exercises must never contradict this file.

This is a maintainer file. Nothing here renders on the site.

**Rules**

- **Build the world before its exercises.** A world records its whole operating landscape before any exercise uses it: every actor, the system each one works in, whether that system is bought or built, how the systems connect (API, database, batch, or events), and what Ridgeline or the company has layered on top. An exercise's decision is found in the world, never the other way round.
- **Capabilities are what the product category can typically do, with a source.** If an insurance CRM can usually send templated texts, the world's CRM can too, whether or not the company uses it. Never decide a capability to keep an exercise's answer alive.
- **Answer the skeptic's questions in the world.** Each world lists the questions a practicing architect would ask first, with their answers. An exercise whose premise raises a question the world can't answer isn't ready.
- **Figures are canon too.** A number drawn in a figure is a fact, and it goes in this file like any other.
- **Every fact names where it came from**, so a change can be traced to the pages that depend on it.
- **Past decisions are canon.** An architecture choice made in one exercise or worked example constrains later ones, the way it would in a real company. A later exercise can revisit a decision, but only as its subject.
- **No outcomes beyond the worked example's own story.** Exercises end at the decision. The AAA worked example is the one place where Ridgeline has a history of results, and that history stays as written.
- **Canon labels stay here.** ADR numbers and assumption ids are maintainer shorthand. Exercises state the decision itself.

---

## Ridgeline Mutual

A regional property and casualty insurer. Regulated, careful about change, and mostly a buyer and configurer of software. Its in-house engineering is one small team that has shipped one modern system, the policyholder portal.

### Business

| Fact | Source |
| --- | --- |
| Regional P&C insurer with about 120,000 policyholders | AAA worked example |
| Runs a contact center. Most calls are policyholders asking things they could look up themselves | AAA worked example |
| Q4 renewal season is the contact center's call peak | AAA worked example |
| Sponsor for customer-facing work is the VP Customer Operations. Head of IT, Contact Center Lead, and Compliance Officer sign project charters | AAA worked example |
| About 30 claims are reported on a normal day. Last June's hailstorm brought about 4,800 in 72 hours (about 1,900, 1,700, and 1,200 on June 10–12), fell to about 420 and 160 on the next two days, and was back to normal within a week. Hold times passed an hour | Superseded pilot (figure rlc-claims-storm-load), retained |
| Storm season runs April to September | Superseded pilot, retained |
| Claim records and photos must be kept for seven years | Superseded pilot, retained |

### People and Where They Work

| Actor | Works in | Source |
| --- | --- | --- |
| Policyholders | The policyholder portal (view policies and documents, update contact details, check claim status) or the phone. They can't report a claim online | AAA worked example; realism rebuild |
| Service agents (contact center) | The CRM's agent workspace, in a browser, with corporate SSO. They answer policy, billing, and claim status questions | AAA worked example (CRM, SSO); realism rebuild |
| Claims intake reps (contact center) | The claims module's intake screens. Service agents transfer claim calls to them, and they key each report into the claims module | Realism rebuild |
| Adjusters and claims supervisors | The claims module. Supervisors review new claims and assign them, helped by the module's basic assignment rules (by line of business and region) | Realism rebuild |
| Underwriters, billing staff | The core suite's policy and billing modules | Realism rebuild |

### Systems

| System | Bought or built | Facts | Source |
| --- | --- | --- | --- |
| Core suite | Bought (vendor-licensed, installed about 2010, on premises) | Policy administration, claims administration, and billing modules on one database, in the head-office data center. The vendor supports it; Ridgeline's two core-systems analysts configure it. Integrates through SOAP services and nightly batch files. It emits no events. The policy module's SOAP document API is reached over a site-to-site VPN. Billing is the legacy module the portal left out of scope | AAA worked example (Policy Admin System, document API, VPN, billing); realism rebuild (suite, claims module, integration style) |
| Claims module | Bought (part of the core suite) | The system of record for every claim: reports, reserves, payments, status (14 internal status codes), adjuster assignment | Realism rebuild; AAA worked example (the 14 codes) |
| CRM | Bought (SaaS, vendor's cloud) | Customer profiles and service cases. Holds a read copy of each claim, synced hourly from the claims module by an integration job, so service agents can answer status calls; that copy carries the claims module's 14 status codes. REST API with service-protection limits that throttle bursts (calls made by workflows inside the CRM don't count against them). Webhooks and in-platform workflows are available. Ridgeline has no access to its database | AAA worked example (SaaS, profiles, claim cases, REST, throttling at peak); realism rebuild (claim copy, sync, limits detail) |
| CRM capabilities Ridgeline doesn't use | Available from the vendor | Like other insurance CRMs: a licensable customer portal product with claim-reporting flows and photo upload, templated email and SMS through a messaging add-on, and insurance data models. Ridgeline built its own portal instead because the portal needed policy documents from the on-premises core suite | Realism rebuild, based on Salesforce Financial Services Cloud (FNOL flows, policyholder portal) and Dynamics 365 with Power Pages |
| Policyholder portal | Built by the portal team | React SPA on Static Web Apps. ASP.NET Core Portal API on App Service (3 instances, 2 zones). Azure SQL Portal DB (preferences, audit trail), zone-redundant, private endpoint. The Portal API reads the CRM's claim copy behind a 5-minute cache, maps the 14 status codes to 5 customer-facing states, and fetches documents from the policy module over the VPN. It accepts only policyholder sign-ins | AAA worked example |
| Customer identity | Bought (Entra External ID) | Policyholder accounts, kept apart from corporate SSO. The portal is its only application | AAA worked example |
| Corporate identity | Bought | Corporate SSO for all staff | AAA worked example |
| Cloud | Azure, one Ridgeline subscription | | AAA worked example |

### Teams

| Team | Facts | Source |
| --- | --- | --- |
| Portal team | Five developers, one QA engineer, and a tech lead. .NET, ASP.NET Core, React, Azure SQL, App Service. Deploys by pipeline with a rehearsed rollback, availability alerts, Application Insights logs. Ships every two weeks. Has never run a message broker or distributed tracing in production | AAA worked example (team, stack, pipeline, rollback); superseded pilot (size, cadence, experience), retained |
| Core-systems analysts | Two people who configure the core suite and run its nightly batches and the hourly CRM sync. Changes to the core go through the vendor's release cycle, a few times a year | Realism rebuild |
| CRM administrators | Two people who configure CRM workflows, queues, and forms without code | Realism rebuild |

### Decisions on Record

| Decision | Where |
| --- | --- |
| Policyholder accounts live in a separate customer identity service, kept apart from corporate SSO, and the Portal API accepts only policyholder sign-ins (ADR-001) | AAA worked example |
| The Portal API maps the claims module's 14 internal status codes to 5 customer-facing states | AAA worked example |
| Ridgeline built its own policyholder portal rather than license the CRM's portal product | Realism rebuild |

### The Skeptic's Questions

| Question | Answer |
| --- | --- |
| Where do adjusters work? | In the core suite's claims module, not the CRM |
| What's the system of record for a claim? | The claims module. The CRM holds an hourly read copy for service agents |
| Can the CRM send customer emails and texts? | Yes, through its messaging add-on, which Ridgeline doesn't license yet |
| Can the CRM take a claim report online? | Its licensable portal product can, with photos. Ridgeline doesn't license it |
| Can Ridgeline's systems read the core suite in real time? | Through SOAP services over the VPN, for the operations the vendor exposes. Everything else is nightly batch |
| Does anything built in-house talk to a database directly? | Only the Portal API, to its own Portal DB. Everything else goes through a vendor API or batch file |
| Is there a third party for online claim reporting? | Yes: the CRM's portal product, standalone claim-intake SaaS products, and the claims modules of modern core suites |

### Open Threads

Exercises can pick these up.

- **Online claim reporting.** Policyholders can't report a claim online, and last June's storm overwhelmed the phones. The realistic decision is buy, configure, or build: license the CRM's portal and claim flow, buy a claim-intake product, or add a report-a-claim flow to the team-built portal. Each needs integration with the claims module, whose only real-time door is SOAP over the VPN. A candidate for Developer to Architect stage 5 (deciding and recording, with total cost of ownership). The superseded pilot's scenario, figures, and storm chart are in `_drafts/exercises/superseded/` for reuse.

---

## Hearthline

A B2B SaaS company that builds and sells field-service software for home-service contractors. It builds the product it sells and buys nearly everything around it, so architecture style is a live question here in a way it rarely is at Ridgeline. Built realism-first on 2026-09-29, from how products in this category work (ServiceTitan, Housecall Pro, and Jobber), then revised the same day after a skeptic review: an outage ledger, a market-realistic availability target, and the category's capacity-based booking model.

### Business

| Fact | Source |
| --- | --- |
| Founded six years ago. About 4,000 contractor customers (HVAC, plumbing, electrical), mostly 5 to 50 technicians each. About 22,000 technicians use the mobile app, doing about 85,000 jobs a day | Hearthline build |
| Priced per technician per month. Competes with larger platforms on fast setup and on how many website visitors the booking widget turns into booked jobs | Hearthline build |
| Moving up-market to contractors with 100 or more technicians. Those prospects ask for a contractual 99.9% monthly availability on online booking and the dispatch board, with the market's standard exclusions: announced maintenance, third-party outages, and incidents under five minutes. The market leader offers the same. Hearthline offers no availability commitment today | Hearthline build; [ServiceTitan SLA](https://www.servicetitan.com/legal/sla) for the market norm |

### People and Where They Work

| Actor | Works in | Source |
| --- | --- | --- |
| Homeowners | The booking widget on contractors' own websites: enter an address and a service type, pick an arrival window, book. A customer portal to view and pay invoices | Hearthline build |
| Office staff and dispatchers | The web app: dispatch board, customers, estimates, invoices, reports. Dispatchers assign a technician to each booked job | Hearthline build |
| Technicians | The mobile app (React Native, iOS and Android): the day's jobs, notes, photos, signatures, taking payment on site. It works offline and syncs when it has signal | Hearthline build |
| Contractor owners | Reports in the web app, and the QuickBooks Online sync | Hearthline build |

### How Online Booking Works

| Fact | Source |
| --- | --- |
| Booking is capacity against arrival windows (such as 8–11, 11–2, 2–5), per service type and service zone. A homeowner books a window, not a technician. A dispatcher assigns the technician later | Hearthline build; category norm ([Housecall Pro online booking](https://help.housecallpro.com/en/articles/7034474-online-booking-overview), [ServiceTitan Scheduling Pro](https://community.servicetitan.com/t5/Scheduling-Pro-powered-by/Scheduling-Pro-Availability-Configuration-Options-Guide/ta-p/36021)) |
| Contractors choose instant booking (the job is confirmed on the spot) or requests (the office confirms). About 60% use instant booking. Dispatchers routinely absorb a window overbooked by one | Hearthline build |
| The widget script is static JavaScript served from CloudFront. Its API calls go to the Hearthline app's web tier | Hearthline build |
| Open windows are computed when the homeowner opens the scheduler, after entering an address (geocoded through Google Maps for the service-area check) and a service type. Nothing is cached. The computation reads the Aurora writer, not the replica, since replica lag once showed a window as open after it had filled | Hearthline build |
| A booking writes a job to the main database. The worker then sends the homeowner's confirmation text through Twilio. No payment is taken at booking | Hearthline build |
| The widget's UI and booking API belong to Customer Growth. The capacity rules belong to Scheduling and Dispatch | Hearthline build |

### Systems

| System | Bought or built | Facts | Source |
| --- | --- | --- | --- |
| The Hearthline app | Built | One C# codebase (ASP.NET Core), deployed as two process types from one container image: web (API for the web app, widget, and mobile sync) and worker (reminders, confirmation texts, QuickBooks sync, PDF generation). Runs on AWS ECS Fargate in one region, across three availability zones. Code is organized in folders by domain, but one shared Entity Framework context spans every table, and cross-domain queries are common | Hearthline build |
| Main database | Built on bought (Aurora PostgreSQL) | One cluster for everything: a writer, plus one replica in another zone that serves reports and is also the failover target. No RDS Proxy | Hearthline build |
| Payments | Bought (Stripe, including card readers for on-site payment) | | Hearthline build |
| Texts and email | Bought (Twilio for reminders, confirmations, and two-way texting; SendGrid for email) | | Hearthline build |
| Maps and routing | Bought (Google Maps Platform) | Geocoding, drive times, and the route-ordering behind the "optimize my day" button | Hearthline build |
| Sign-in | Bought (Auth0) | Contractor staff and technicians. Homeowners don't sign in to book | Hearthline build |
| Accounting | Customer's own QuickBooks Online | Synced by the worker through QuickBooks' API | Hearthline build |
| Monitoring | Bought (Datadog) | Logs, metrics, APM with distributed tracing, synthetic checks on booking every minute | Hearthline build |
| Analytics | Bought (a managed pipeline into a cloud data warehouse) | Nightly copy of the main database | Hearthline build |

### Load

| Fact | Source |
| --- | --- |
| The widget script loads about 300,000 times a day. Homeowners open the scheduler about 45,000 times a day and book about 6,500 jobs, around 8% of all jobs. Traffic peaks on weekday evenings and Monday mornings, and jumps with the weather: a heatwave multiplies AC calls in its region | Hearthline build |
| Mobile sync surges between 7:00 and 7:30 each morning, local time, as technicians start their day | Hearthline build |
| The dispatch board's traffic is steady through business hours | Hearthline build |

### Outage Ledger (Online Booking, Last 12 Months)

Measured by Datadog's synthetic checks: 99.86% raw, about 758 minutes down. Under the market's standard exclusions, about 463 counted minutes, an average of 39 a month against a 99.9% budget of about 44. Three months exceeded it.

| Cause | Incidents | Minutes | Counted under standard exclusions | Source |
| --- | --- | --- | --- | --- |
| Bad releases and rollbacks. In March a migration renamed a column. The rollback put the old code back on the new schema, and booking returned errors for 34 minutes until a forward fix shipped | 6 | 168 | Yes | Hearthline build |
| Migrations that locked busy tables (an index added to the jobs table without building it concurrently) | 2 | 95 | Yes | Hearthline build |
| Compute saturation. Last July's heatwave across three southern states sent scheduler opens in that region to six times normal (about 2.5 times nationally) for three days. Window computation pinned the shared web tasks' CPU and autoscaling lagged: 40 minutes of timeouts on booking and the dispatch board, while the writer reached 85% CPU. Four smaller evening spikes account for the rest | 5 | 100 | Yes | Hearthline build |
| Aurora failovers during patching. Each failover took about a minute, and connection-pool storms stretched each to about 10 | 3 | 30 | Yes | Hearthline build |
| An AWS regional service event | 1 | 70 | Yes (it's Hearthline's own provider) | Hearthline build |
| Announced maintenance (a major database upgrade and three smaller windows) | 4 | 200 | No | Hearthline build |
| Google Maps geocoding degradation, which blocked the service-area check | 1 | 45 | No | Hearthline build |
| Blips under five minutes | many | 50 | No | Hearthline build |

About 57% of counted downtime is releases and migrations, 22% is compute saturation, 6% is the database itself, and 15% is the AWS event.

### Teams

| Team | Size and facts | Source |
| --- | --- | --- |
| Scheduling and Dispatch | 7 engineers. Dispatch board, arrival-window capacity, route ordering | Hearthline build |
| Mobile | 6 engineers. The mobile app and its sync API. App store releases every two weeks | Hearthline build |
| Payments and Invoicing | 6 engineers | Hearthline build |
| Customer Growth | 6 engineers. Booking widget, customer portal, review requests | Hearthline build |
| Integrations | 4 engineers. QuickBooks and partner APIs | Hearthline build |
| Platform | 4 engineers. AWS, Terraform, CI, the release train, Datadog. Runs the on-call rotation with each team's lead as second line | Hearthline build |
| QA | 2 engineers. They run a manual regression pass on a staging copy every Monday before the Tuesday release, about a day of work. It's the main reason the train is weekly | Hearthline build |
| Leadership | The CTO is a founder and still reviews architecture. A VP Engineering joined three months ago. Each product team has a lead | Hearthline build |
| Experience | Runs two ECS services (web and worker) from one image, Terraform, Datadog APM with distributed tracing, and SQS and SNS for a few worker jobs. Has never split code into separately deployed services with their own release cycles | Hearthline build; corrected after the second skeptic review |

### The Skeptic's Questions

| Question | Answer |
| --- | --- |
| Why not buy a booking widget? | The widget is part of the product Hearthline sells, and its conversion rate is how Hearthline competes |
| Why not buy scheduling or routing? | Route ordering already comes from Google Maps Platform. Arrival-window capacity depends on Hearthline's own data (service zones, job lengths, technician counts), which is the product |
| What's bought already? | Payments, texting, email, maps and routing, sign-in, monitoring, analytics |
| Why 99.9% and not higher? | It's what the up-market prospects ask for and what the market leader offers, with the same exclusions |
| What causes booking's downtime? | See the outage ledger. Mostly releases and migrations, then compute saturation |
| Does booking book a technician? | No. It books capacity in an arrival window. Dispatchers assign technicians and absorb a window overbooked by one |
| Does booking depend on third parties at request time? | Google Maps geocoding for the service-area check. Twilio only afterward, from the worker |
| Where is the widget served from? | The script from CloudFront, its API calls from the web tier |
| Can the widget scale on its own today? | Only by scaling the whole web tier. Separate ECS services could run the same image, even at different versions, but none do today |
| Are open windows cached? | No. They're computed from the writer on every scheduler open |
| What else reads the main database? | The worker, reports (through the replica), and the nightly analytics copy |
| Does the team have distributed-systems experience? | Some: Datadog tracing, SQS and SNS for a few jobs, Terraform. No separately deployed service yet |
| Has the release process been tried as a fix? | Not yet. The Platform team has proposed one, with estimates, waiting on the architecture question |
| Where do the waits come from? | Mostly the weekly batch: about 2 working days waiting for the Friday cut and 2 for the QA day and deploy. Holds add about a third of a day on average |
| What are the holds, really? | Of 11 in a year: 5 flaky tests, 4 cross-team breaks through shared tables, 2 failed migration rehearsals |
| What does coupling cost beyond holds? | One feature in four needs two or more teams and takes about twice as long. About 10% of each team's time goes to coordination |
| Who owns the shared tables? | Nobody owns Jobs, which four teams write. Customer Growth informally owns Customers |
| Are there feature flags? | A homegrown on/off table, without targeting or gradual rollout |
| Why is the train weekly? | The two QA engineers' Monday regression pass on staging. Automated tests cover the API well but not the dispatch board's UI |

### How Code Ships Today

| Fact | Source |
| --- | --- |
| One repository, one pipeline. Each pull request runs unit tests (about 8 minutes) before merge. The shared end-to-end suite (about 45 minutes, owned by no team) runs only on the release branch, cut every Friday | Hearthline build |
| QA runs a manual regression pass on staging every Monday, about a day of work, because automated tests cover the API well but not the dispatch board's UI. The release goes out Tuesday | Hearthline build |
| If the release branch fails, the train is held until the fault is fixed. Only severity-1 bugs get a hotfix path. Nobody reverts a teammate's change to let the rest ship | Hearthline build |
| Feature flags are a homegrown on/off table: no per-customer targeting and no gradual rollout | Hearthline build |
| Migrations run during the Tuesday deploy. There is no expand-then-contract practice, which is how the March rename broke the rollback | Hearthline build |
| Mobile ships app store releases every two weeks and pushes JavaScript-only fixes over the air in between. The sync API keeps old app versions working, since old versions stay in the field for weeks | Hearthline build |

### Release History (Last 12 Months, 52 Trains)

| Fact | Source |
| --- | --- |
| 11 trains were held, for 1.5 days on average. 5 holds were flaky end-to-end tests that passed on rerun. 4 were one team's change breaking another team's tests through shared tables (3 through the Jobs table, 1 through Customers). 2 were migrations that failed their staging rehearsal | Hearthline build |
| Merge to production averages about 4.3 working days (about 6 calendar days): about 2 waiting for the Friday cut, 2 for the Monday QA day and the Tuesday deploy, and about a third of a day from holds (11 holds of 1.5 days each, spread over 52 trains) | Hearthline build; arithmetic corrected after the final review |
| Two up-market features slipped a release this quarter, one from a hold and one from waiting on another team's change | Hearthline build |

### Coupling

| Fact | Source |
| --- | --- |
| The Jobs table is written by four teams: booking (Customer Growth), dispatch (Scheduling and Dispatch), mobile sync (Mobile), and invoicing (Payments and Invoicing). Nobody owns it. Customer Growth informally owns Customers, which Payments and Integrations also write | Hearthline build |
| Over the last two quarters, about one feature in four needed code changes from two or more teams. Those features took about twice as long from start to production as single-team features | Hearthline build |
| The team leads estimate that coordinating cross-team changes costs each team about 10% of its time | Hearthline build |
| About two thirds of the multi-team features touched the Jobs table | Hearthline build |
| The team leads can't yet separate how much of the extra time on multi-team features is waiting for each other's weekly releases and how much is agreeing on the change itself | Hearthline build |
| The team leads estimate that giving Jobs a single owner, with every other team going through that owner's interface instead of the table, would take about a quarter of Scheduling and Dispatch's capacity for three months, plus two to three engineer-weeks from each of the other three teams that write it, and a migration moving Jobs, the busiest table, into its own schema | Hearthline build |
| Partner APIs hand each incoming service request to the booking module. Integrations doesn't write Jobs itself | Hearthline build |

### The Question on the Table

| Fact | Source |
| --- | --- |
| After the two slipped features, the CTO asked for a recommendation: should Hearthline split the product into separately deployed services, so teams stop blocking each other? | Hearthline build |
| The Platform team has already proposed process changes, with estimates: automate the dispatch board's regression tests (about 6 weeks, two QA engineers and one platform engineer); run the full suite before every merge through a merge queue (about 2 weeks); revert a breaking change instead of holding the train; quarantine flaky tests; change the schema in backward-compatible steps; then deploy every day. It hasn't been approved, because the CTO wants the architecture question answered first | Hearthline build |

### Decisions on Record

None yet.

### Open Threads

- **Should the product be split?** The CTO's question, for Developer to Architect stage 3. The facts say most waiting comes from the weekly batch and the manual QA day, which no shape change removes, while a real coupling cost sits at the Jobs table. Reviewed twice by a skeptic before drafting.
- **Booking availability.** Meeting a contractual 99.9% on booking. The ledger says most counted downtime comes from releases, migrations, and compute saturation, so the realistic decision is mostly about fixing causes (release practice, migration discipline, caching, isolation, graceful degradation) and only then about shape. Its reasoning needs availability math, caching, and reliability patterns, so it belongs in a later stage, such as Developer to Architect stage 6 (proving the qualities).

---

## Planned Worlds

- **A large platform organization.** Many teams, a shared internal platform, high coordination costs. Built in full before its first exercise.
