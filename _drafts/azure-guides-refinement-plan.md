# Azure Study Guides Refinement Plan

Tracks the review-and-refine pass over all guides in `_guides/infrastructure/azure/`. Guides are consumed sequentially, in the order they appear in `assets/data/study_guides_config.json` (the "Azure" category) — that order already encodes the fundamentals-to-advanced learning path, so no guide should add its own prerequisite framing or cross-links to other Azure guides; the config ordering handles that.

Standards in force for every edit: [`.claude/skills/refine-prose/writing-standards.md`](.claude/skills/refine-prose/writing-standards.md) (always) and [`.claude/content/study-guide-guide.md`](.claude/content/study-guide-guide.md) (format/tagging/content philosophy).

## Review checklist (apply to every guide)

**Order of operations:** run item 1 (correctness & completeness) **first** — it is the only pass that adds or rewrites content, and every later check has to operate on the corrected text, not the original. Items 2–7 then refine that content; the two front-matter items (8 and 9) run last so they confirm tags and description against the final content.

1. **Factual correctness & completeness (verify against authoritative sources) — do this first.** Distinct from item 3's *pedagogical* gaps: this checks whether the guide's technical claims are actually true and current, and whether a materially important part of the topic is missing — not treating the prose as given. Web-research the guide's falsifiable claims against authoritative docs (primarily [Microsoft Learn](https://learn.microsoft.com){:target="_blank" rel="noopener noreferrer"}; official Azure product docs): service limits, character/naming constraints, defaults, support matrices (e.g., "supports move" / "does not support move"), resource-type abbreviations, feature availability and GA/preview status, pricing-tier boundaries, and any hard number or absolute ("max 24 characters", "not supported", "always inherits", "only in the same region"). Prioritize claims that are (a) falsifiable, (b) consequential if a reader acts on them, or (c) prone to drift as Azure evolves — don't spend the pass rubber-stamping prose that merely reads plausibly, and don't try to re-verify inherently stable conceptual framing. Correct stale or wrong content in place. Where a claim can't be confirmed against a source, soften it to what's verifiable and record it under **Unverified, left standing** rather than leaving an unverified absolute in place. **Completeness is judged at study-guide altitude, not doc-completeness** — flag only a missing piece a practitioner would reasonably expect given the guide's stated scope/description, not every edge case. Because this pass can add or modify content, run the remaining checks over whatever it produces. The corrections themselves are in the diff, so don't write them down anywhere (see Process below).
2. **Redundancy** — same fact, table, or explanation repeated across sections; consolidate or cross-reference within the same file.
3. **Gaps** — missing explanation of a concept before it's prescribed; missing trade-offs; missing "why would I not use this." (Pedagogical completeness — whether concepts are introduced in a learnable order — as opposed to item 1's factual completeness.)
4. **Clarity** — dense prose that a comparison table or list would serve better; inconsistent structure vs. the guide's own sections.
5. **ASCII diagrams** — reserve for genuinely technical relationships and flows: network topology, request/traffic flow, data flow between components, reconciliation loops, hub-and-spoke topologies, auth/token exchange sequences. The bar is whether it depicts actual structure (branching, parallel components, directional flow between distinct systems) that prose or a table can't already convey cleanly. Do **not** use a diagram to dress up a linear conceptual hierarchy, a scope/abstraction ladder, or anything that's really just a sequential list with arrows between prose labels — that's not practical output, it's decoration. If a sentence already says it clearly, don't diagram it. Skip where a table already conveys the comparison clearly.
6. **Decision trees** — where a guide has 2+ comparison tables that all feed into "which option do I pick," consider consolidating into one ASCII decision tree.
7. **Organizational/scope tier clarity.** When a guide introduces an Azure resource or concept whose behavior or constraints depend on where it lives in Azure's scope hierarchy (tenant → management group → subscription → resource group → resource, or the networking hierarchy of region → VNet → subnet → NIC), state that scope explicitly and early rather than leaving the reader to infer it from a buried constraint bullet. Example of the gap: `azure-vnet-architecture.md`'s Application Security Groups section lists "All NICs in an ASG must be in the same VNet" as a constraint, but never states up front that ASGs are VNet-scoped — a reader can't tell at a glance whether ASGs are a subscription-wide construct or something narrower. Apply this only where scope is genuinely ambiguous or consequential for how the reader would design/deploy something — not as boilerplate on every resource mentioned (e.g., it's obviously irrelevant for a concept that's inherently global or where the guide already makes scope unambiguous in context).
8. Confirm front matter (tags, description) still matches content after edits.
9. **Front matter tag audit.** Tags are free-form (`content-filter.js` / `guides-browser.js` read them straight off front matter, no fixed enum), so there's no technical constraint keeping them generic. Across the current 61 Azure guides, `azure` appears on 100%, `practical` on ~48, `infrastructure` on ~45, `cloud-computing` on ~35 — tags that common can't help anyone find a specific guide. Policy going forward:
   - Drop `azure` — redundant with category, zero discriminating value.
   - Treat `infrastructure` / `cloud-computing` as filler for this category; replace with real content signal unless a guide has nothing more specific to offer.
   - Keep exactly one skill-level tag (`fundamentals` / `practical` / `advanced`) — that's a genuine navigation axis, not filler.
   - Fill the remaining slots with the actual services/patterns/products the guide covers — the specific nouns a reader would type if they remember *what* but not *where* (e.g., `aks`, `keda`, `gitops`, `service-mesh`, `workload-identity`, `cosmos-db`, `private-link` — not just the vocabulary-table generics). Cross-check against the guide's own description; if the description already names something specific the tags don't, that's a signal the tags are under-specified.
   - Target 5-7 tags total — replace low-value generic tags rather than appending specific ones on top.
   - Review the description too: confirm it still accurately reflects content after edits and isn't just a restatement of the title.

Explicitly **not** in scope: prerequisite callouts, "where this fits" framing, or inline links to sibling Azure guides — the config-driven reading order already serves this purpose. This applies retroactively too: if a guide already has an inline link to another guide in `_guides/infrastructure/azure/`, remove it during this pass (keep the surrounding prose, drop the link/parenthetical). This does not apply to external links (Microsoft Learn docs, third-party tools) — those stay per normal inline-linking standards.

## Process

- One guide at a time (no parallel dispatch). The status column is the single source of truth for where we are.
- Per guide: run the checklist, apply the fixes, run `/refine-prose`, set status to Complete, move to the next row. Don't stop for approval between rows. (No Jekyll build — content-only edits don't break the build.)

- **Never record what changed.** The Progress table tracks status and nothing else, because the corrections are already in the diff and a per-guide changelog here is dead weight. The only things that get written down are forward-looking: a finding that a *later, not-yet-done* row has to act on goes in **Open pre-flags**, a fact that constrains every remaining guide goes in **Cross-guide facts in force**, and a claim left unverified on a finished guide goes in **Unverified, left standing**. Nothing else. Prune each entry when the row it targets is done.

### Standing gotchas

- **Sibling links hide in two forms.** Grepping `](/study-guides/` finds only markdown links; links inside HTML callout blocks use `<a href="/study-guides/...">` and will be missed. Check both. Known remaining HTML-form instances: `azure-virtual-machines.md` (row 14) and `azure-managed-disks-files.md` (row 19). Some cross-references are also unlinked prose ("covered in the X guide") — those are "where this fits" framing and go too.
- **The factual pass leaves no trace in a diff.** A guide whose tags/links/diagrams look done has not necessarily had item 1 run on it. Status here, not the diff, is the record of whether item 1 ran.
- **Check the tier/zone pivot, not the default render.** Many Azure docs are zone-pivoted between a legacy tier and the current one, and the two zones can describe architecturally different products. Confirm which pivot a claim came from. The FAQ often states a transition the concept pages don't.
- **Run the linter even when the edit felt clean.** Heavy prose additions reliably introduce em-dashes and mis-ordered sections that are invisible while writing.
- **`azure.microsoft.com` pricing pages time out; the Retail Prices API doesn't.** Rows 8, 10, and 11 all lost the pricing page to timeouts. `https://prices.azure.com/api/retail/prices?$filter=serviceName eq '<Service>' and armRegionName eq 'eastus' and type eq 'Consumption'` is public, unauthenticated, returns JSON, and is the same official rate data. Use it before flagging any pricing claim unverifiable. It does have a failure mode: meters can be pre-registered for features that aren't shipped (row 11 found self-hosted-gateway meters on v2 tiers that three doc pages say don't exist), so it settles *prices*, not *feature availability* — cross-check the latter against docs.
- **Per-tier SLA percentages are not on MS Learn.** They live only in the SLA-for-Online-Services .docx, which WebFetch can't read, and the product docs deliberately say only "an SLA exists" and "zones/regions raise it." Don't assert 99.9x figures from memory; state has-SLA/no-SLA and link the SLA doc (row 11's pattern).
- **A pre-flag is a lead, not a finding.** Row 9 pre-flagged row 10 with "App Gateway is the gRPC answer, it supports HTTP/2 to backends." It is not and it doesn't, and row 9's own guide had already published the advice. Taking the pre-flag as established would have propagated the error into a second guide instead of catching it. Re-verify every pre-flag against a source before acting on it, and when one turns out wrong, fix the guide that raised it too.
- **A table column that merges two SKUs or two limits hides a fact.** Row 12 found both forms in one guide. `VpnGw1/1AZ` as a single row concealed that the non-AZ half is retiring in 2.5 months, and a single "P2S Connections" column concealed that SSTP and IKEv2/OpenVPN are independent ceilings with an 8x gap. When a table cell reads `X/Y` or names a category rather than a metric, check whether MS's own table splits it. The merge is usually where the stale or wrong number is hiding.
- **Verify code samples as claims, not as illustration.** Rows 1-27's item-1 pass checked prose assertions. Row 28's worst errors were in C#: a method overload that doesn't exist, three wrong entity APIs, a non-generic call assigned to a variable, and a return-type mismatch. A sample that reads plausibly can still be uncompilable, and readers copy samples more literally than they follow prose. For any guide with code, check attribute names, method names, overload signatures, and return types against the current API reference. Guides with heavy code ahead: rows 29-31 (Bicep/ARM), 45-47 (pipelines/Actions), 48 (ML), 56-57 (serverless/Functions advanced), 59 (container patterns).
- **A guide can document a feature that does not exist.** Rows 1-26 found stale numbers, wrong limits, and reversed claims, all of which start from something real. Row 27 found an entire subsection (with a config block, a characteristics list, and a row in the AWS comparison table) for Event Grid "strict ordering per subject," which the product has never had. The tell was that the docs never mention it, not that they contradict it. When verification returns *nothing* about a named feature rather than something different from what the guide says, that absence is the finding. Search for the setting name itself before assuming the docs just cover it elsewhere.
- **Item 5 is a two-way check, not a filter.** Rows 1-9 all ran it in one direction: judge the diagrams already present, drop the decorative ones, add nothing. That is half the check, and it lets a guide pass while every relationship it teaches stays in prose-and-table form. Row 7 was reopened for exactly this. Ask both questions on every guide: does each existing diagram clear the bar, **and** does the guide explain a structure with no diagram? The second finds more than the first. Structures that qualify and are easy to miss: a control that enforces at two levels, two options whose traffic paths differ in shape (not just in attributes), and a topology whose behavior comes from routing rather than from the links drawn. **Rows 1-9 have not had the second question asked** — worth a sweep once the first pass is done.

## Cross-guide facts in force

Verified during earlier rows; applies to every remaining guide that touches the topic.

- **Front Door** Standard/Premium selects POPs by unicast via an internal Traffic Manager profile (changed Mar-Apr 2026). Anycast is classic-only.
- **gRPC through a layer-7 load balancer is Application Gateway for Containers, never Application Gateway.** App Gateway does not do HTTP/2 to backends.
- **APIM** gateway-to-backend HTTP/2 and pass-through gRPC are classic-only and in preview.
- **Azure Cache for Redis** is superseded by Azure Managed Redis. Any guide recommending a Redis tier needs the AMR migration path.
- **Service Bus** SBMP and the legacy SDKs (WindowsAzure.ServiceBus, Microsoft.Azure.ServiceBus, com.microsoft.azure.servicebus) retire **30 Sept 2026**.
- **Event Grid** dead-letters to a **blob container**, never a queue.
- **Durable Functions** docs moved to `learn.microsoft.com/azure/durable-task/` and are zone-pivoted between Durable Functions and the standalone Durable Task SDKs. Check which pivot a claim came from.
- **Azure CLI:** a JSON parameter file needs `--parameters @file.json`. The `@` marks it as a file. `.bicepparam` files take no `@`.
- **ARM complete mode** is documented as "will be gradually deprecated," with deployment stacks as the replacement.
- **Microsoft Sentinel** is unsupported in the Azure portal after **31 March 2027** and runs only in the Defender portal, where Defender XDR creates incidents and Microsoft-security and Fusion rule types are unavailable.
- **Log Analytics retention:** analytics retention 4-730 days plus total retention up to 12 years. The "1 day to 2 years" figure and the "archive tier" are both retired; long-term data comes back via search job.
- **Defender for Servers** no longer uses the Log Analytics agent or AMA except for the 500 MB ingestion benefit.

## Open pre-flags

Leads for rows not yet done. **A pre-flag is a lead, not a finding** (see standing gotchas) - re-verify before acting. Delete the entry once its row is complete.

| Target row | Lead |
|---|---|
| 34 firewall-ddos | Gateway Load Balancer is the chaining-based NVA insertion product (VXLAN, flow symmetry, no UDRs). DDoS Network Protection (~$2,944/mo) rebills WAF_v2 at Standard_v2 rates. APIM v2 tiers cannot enable Azure DDoS Protection. |
| 35 key-vault | With the Key Vault firewall on, APIM must use its **system-assigned** identity (user-assigned is rejected) and needs "Allow trusted Microsoft services to bypass this firewall". Near-expiry/expiry events via an Event Grid system topic are the supported rotation trigger; Azure Monitor alerts are an Event Grid handler **only** when the source is Key Vault. |
| 36 policy-governance | Has a full **Azure Blueprints** section (~L190-247), recommends it for new subscriptions (L390), and names it in the description and Key Takeaways (L554). Blueprints starts phased retirement 2026-07-31 and is fully retired 2027-01-31; the replacements are deployment stacks plus template specs. Needs rewriting, not a deprecation note appended to advice that says "use this." Also: the `policyAssignment` scope correction from row 29 applies if it shows assignment templates; the effect list is now 11 effects; and compliance standards beyond MCSB require the paid Defender CSPM plan, so any claim of free CIS/PCI/HIPAA reporting is wrong. |
| 37-38 azure-monitor, application-insights | Check for stale "30-day retention" claims, for the retired Log Analytics agent, for diagnostic settings being credited with guest OS collection, and for missing DCR/AMA coverage. App Insights tables carry 90-day free retention. |
| 39 automation-arc | The policy effect list is now 11 effects; `denyAction` is the answer for protecting config from deletion. |
| 40 cost-management | Logic Apps Consumption bills per action *and* per managed-connector call, which is the pairing that surprises people. |
| 37-40, 45-47 | Any guide presenting ARM complete mode as the way to remove orphaned resources is stale. |
| 41, 44 data-factory, data-architecture | Event Hubs Standard retention is **7 days** (not 90) and Kafka log compaction is supported on Standard+. Cosmos DB does not publish to Event Grid; a claimed Event Grid integration for Cosmos means the change feed. |
| 42 synapse-analytics-query | Must carry the same **Fabric successor** framing as row 21. MVs are auto/synchronously maintained; 60 distributions; nodes = DWU/500. |
| 47 github-actions-azure | OIDC federated credentials over stored `AZURE_CREDENTIALS` secrets, and `azure/login@v2`. |
| 55 hybrid-cloud-architecture | ExpressRoute-to-VPN transit requires Route Server. If the guide describes hybrid transit, verify it says so. |
| 56-57 serverless-patterns, functions-advanced | **Flex Consumption** is the recommended serverless plan, and VNet integration does not require Premium/Dedicated (classic Consumption is the only plan without it). Cosmos change feed latest-version mode captures inserts/updates only; deletes need all-versions-and-deletes plus continuous backup. The integrated cache is a billed dedicated-gateway cache, not client-side. An Event Grid-subscribed Function needs the **Event Grid trigger** for endpoint validation; delivery is unordered at-least-once. Durable Functions must use `[EntityTrigger]`/`GetState`/`Return`, must race `WaitForExternalEvent` against a durable timer rather than passing one to it, and should name **Durable Task Scheduler** as the backend (Netherite retires 2028-03-31). |
| 60-61 multi-region, disaster-recovery | "Maximum resiliency" = two circuits at two peering locations is the current MS vocabulary, and no ExpressRoute SLA percentage is publishable from Learn. |

## Unverified, left standing

Claims on finished guides that could not be confirmed against a source. Each was softened rather than asserted; revisit if a source turns up.

- **Row 6** (billing-enrollment): no definitive source on whether EA is still sold to new customers or all enrollments move to MCA-E at renewal. The guide still presents EA as the enterprise endpoint.
- **Row 8** (dns-traffic-manager): the Azure DNS pricing page timed out repeatedly. The private-query billing correction rests on the DNS FAQ plus a moderator Q&A; no per-unit figures asserted.
- **Row 9** (front-door-cdn): WAF custom rule priority range is documented only as "a unique integer," so the guide's "1-100" was softened.
- **Row 10** (load-balancer-app-gateway): the Load Balancer pricing page timed out repeatedly, so no LB per-unit figures are asserted and the cost gap is called "an order of magnitude" without a sourced multiple.
- **Row 11** (api-management): the Retail Prices API lists "Standard v2 / Premium v2 Self-hosted Gateway" meters, but three doc pages say the self-hosted gateway is Developer + Premium (classic) only. Treated the meters as pre-registered and followed the docs. Re-verify if a later row needs it.

## Progress

| # | Subcategory | Guide | Status |
|---|---|---|---|
| 1 | Architecture Principles | azure-well-architected-framework.md | Complete |
| 2 | Identity & Access Management | azure-entra-id.md | Complete |
| 3 | Identity & Access Management | azure-rbac-managed-identities.md | Complete |
| 4 | Subscription & Resource Organization | azure-subscription-architecture.md | Complete |
| 5 | Subscription & Resource Organization | azure-resource-organization.md | Complete |
| 6 | Subscription & Resource Organization | azure-billing-enrollment.md | Complete |
| 7 | Networking & Content Delivery | azure-vnet-architecture.md | Complete |
| 8 | Networking & Content Delivery | azure-dns-traffic-manager.md | Complete |
| 9 | Networking & Content Delivery | azure-front-door-cdn.md | Complete |
| 10 | Networking & Content Delivery | azure-load-balancer-app-gateway.md | Complete |
| 11 | Networking & Content Delivery | azure-api-management.md | Complete |
| 12 | Networking & Content Delivery | azure-expressroute-vpn.md | Complete |
| 13 | Networking & Content Delivery | azure-private-link-virtual-wan.md | Complete |
| 14 | Compute Services | azure-virtual-machines.md | Complete |
| 15 | Compute Services | azure-functions.md | Complete |
| 16 | Compute Services | azure-container-services.md | Complete |
| 17 | Compute Services | azure-app-service.md | Complete |
| 18 | Storage Services | azure-blob-storage.md | Complete |
| 19 | Storage Services | azure-managed-disks-files.md | Complete |
| 20 | Database Services | azure-database-selection.md | Complete |
| 21 | Database Services | azure-synapse-analytics.md | Complete |
| 22 | Database Services | azure-sql-database.md | Complete |
| 23 | Database Services | azure-cache-redis.md | Complete |
| 24 | Database Services | azure-cosmos-db.md | Complete |
| 25 | Application Integration & Messaging | azure-service-bus.md | Complete |
| 26 | Application Integration & Messaging | azure-event-hubs.md | Complete |
| 27 | Application Integration & Messaging | azure-event-grid.md | Complete |
| 28 | Application Integration & Messaging | azure-logic-apps.md | Complete |
| 29 | Infrastructure as Code | azure-bicep-fundamentals.md | Complete |
| 30 | Infrastructure as Code | azure-bicep-advanced.md | Complete |
| 31 | Infrastructure as Code | azure-arm-templates.md | Complete |
| 32 | Security & Compliance | azure-defender-sentinel.md | Complete |
| 33 | Security & Compliance | azure-monitor-diagnostic-settings.md | Complete |
| 34 | Security & Compliance | azure-firewall-ddos.md | Not started |
| 35 | Security & Compliance | azure-key-vault.md | Not started |
| 36 | Security & Compliance | azure-policy-governance.md | Not started |
| 37 | Management & Governance | azure-monitor.md | Not started |
| 38 | Management & Governance | azure-application-insights.md | Not started |
| 39 | Management & Governance | azure-automation-arc.md | Not started |
| 40 | Management & Governance | azure-cost-management.md | Not started |
| 41 | Analytics & Data Processing | azure-data-factory.md | Not started |
| 42 | Analytics & Data Processing | azure-synapse-analytics-query.md | Not started |
| 43 | Analytics & Data Processing | azure-power-bi.md | Not started |
| 44 | Analytics & Data Processing | azure-data-architecture.md | Not started |
| 45 | Developer Tools & CI/CD | azure-devops-pipelines.md | Not started |
| 46 | Developer Tools & CI/CD | azure-devops-repos-artifacts.md | Not started |
| 47 | Developer Tools & CI/CD | github-actions-azure.md | Not started |
| 48 | Machine Learning & AI | azure-machine-learning.md | Not started |
| 49 | Machine Learning & AI | azure-ai-vision.md | Not started |
| 50 | Machine Learning & AI | azure-ai-language.md | Not started |
| 51 | Machine Learning & AI | azure-ai-speech.md | Not started |
| 52 | Machine Learning & AI | azure-ai-service-selection.md | Not started |
| 53 | Migration & Hybrid Cloud | azure-migration-strategy.md | Not started |
| 54 | Migration & Hybrid Cloud | azure-migrate-services.md | Not started |
| 55 | Migration & Hybrid Cloud | azure-hybrid-cloud-architecture.md | Not started |
| 56 | Serverless Architecture | serverless-architecture-patterns-azure.md | Not started |
| 57 | Serverless Architecture | azure-functions-advanced.md | Not started |
| 58 | Container Orchestration (Advanced) | azure-acr-container-security.md | Not started |
| 59 | Container Orchestration (Advanced) | advanced-container-patterns-azure.md | Not started |
| 60 | Architecture Patterns (Advanced) | multi-region-architecture-azure.md | Not started |
| 61 | Architecture Patterns (Advanced) | disaster-recovery-azure.md | Not started |
