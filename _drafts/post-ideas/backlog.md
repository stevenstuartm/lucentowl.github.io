<!-- Maintained by /post-ideas. Scoring rules: .claude/content/post-idea-rubric.md -->

# Post Ideas: Backlog

Every idea considered and not currently in review or approved, sorted by total score. Rows are compact, but every row states its hypothesis, the claim the post would argue, in a sentence. An idea gets a full entry when it's promoted to review. Ideas demoted from review keep their full entry under **Detail**.

Scores are U (usefulness), D (depth), S (supportability), E (engagement). Origin: R research, X experience, RX both.

## Ranked

| ID | Working title | Research question | Hypothesis | Origin | U | D | S | E | Total | Added | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

## Detail

Full entries for ideas demoted from review.

## Declined

Ideas the author rejected. Research never proposes these again, or close variants, unless asked.

| ID | Working title | Declined | Reason |
| --- | --- | --- | --- |
| `certificate-expiry-scheduled` | Certificate Expiry Is an Outage You Scheduled | 2026-09-29 | Uncontested: nobody argues that expiring certificates are fine, and the fix fits in a paragraph |
| `estimates-inside-view` | Estimates Fail Because We Estimate From the Inside | 2026-09-29 | Derivative: restates Kahneman and Flyvbjerg on the planning fallacy without a new argument |
| `bug-fixes-took-months` | Bug Fixes Took Months Because of the Calendar | 2026-09-29 | Already done: the Shaped Kanban post covers organizing work around completion instead of the calendar |
| `software-cant-redeploy-teaches` | Software You Can't Redeploy Teaches What the Cloud Skips | 2026-09-29 | Already done: the reversal-cost argument is the Build Slow to Go Fast post |
| `tool-whose-problem` | Don't Adopt a Tool Until You Can Name Whose Problem It Solves | 2026-09-29 | Already done and uncontested: the Kubernetes-to-Fargate case study makes the point, and no one argues for adopting tools without a problem |
| `balances-derived-ledger` | Balances Should Be Derived, Not Stored | 2026-09-29 | Derivative: double-entry ledgers and derived balances are established accounting and event-sourcing practice |
| `open-source-relicensing-risk` | Open-Source Relicensing Is a Risk You Didn't Price | 2026-09-29 | Derivative: relicensing risk has been covered extensively since the HashiCorp, Redis, and Elastic changes |
| `cache-ttl-consistency` | Your Cache TTL Is a Consistency Decision Nobody Made | 2026-09-30 | Tired subject: cache staleness as a consistency trade-off is well-worn ground, with little room to add something new to the conversation |
| `flaky-tests-concurrency` | Retrying Flaky Tests Hides the Bugs Production Will Find | 2026-09-30 | Tired subject, declined after approval: a valid point, but flaky tests as hidden races was well-worn a decade ago (Luo et al. 2014, Google 2016) |
| `firebase-security-rules-backend` | Firebase Security Rules Are Your Backend Now | 2026-09-30 | Low interest: the author has little interest in the subject |
| `agent-needs-definition-done` | Your Agent Needs a Definition of Done | 2026-09-30 | Out of scope: AI is not a post subject (2026-09-30 calibration); the study guides cover it |
| `prompt-injection-confused-deputy` | Prompt Injection Is a Confused Deputy Problem | 2026-09-30 | Out of scope: AI is not a post subject (2026-09-30 calibration); the study guides cover it |
| `llm-evals-before-prompts` | LLM Features Need Evals Before Prompts | 2026-09-30 | Out of scope: AI is not a post subject (2026-09-30 calibration); the study guides cover it |
| `ai-rebuilds-depend-knowing` | AI Rebuilds Depend on Knowing What the Old System Did | 2026-09-30 | Out of scope: AI is not a post subject (2026-09-30 calibration); the study guides cover it |
| `rag-vs-long-context` | RAG vs Long Context Is About Where Truth Lives | 2026-09-30 | Out of scope: AI is not a post subject (2026-09-30 calibration); the study guides cover it |
| `mcp-moves-authority-tools` | MCP Moves Authority to Tools You Didn't Write | 2026-09-30 | Out of scope: AI is not a post subject (2026-09-30 calibration); the study guides cover it |
| `prompting-skill-specifying` | Prompting Isn't the Skill; Specifying Is | 2026-09-30 | Out of scope: AI is not a post subject (2026-09-30 calibration); the study guides cover it |
| `vector-database-need` | Do You Need a Vector Database? | 2026-09-30 | Out of scope: AI is not a post subject (2026-09-30 calibration); the study guides cover it |
| `ai-code-review-catches` | AI Code Review Catches Style, Not Assumptions | 2026-09-30 | Out of scope: AI is not a post subject (2026-09-30 calibration); the study guides cover it |
| `juniors-arent-obsolete-unmentored` | Juniors Aren't Obsolete; Unmentored Juniors Are | 2026-09-30 | Out of scope: AI is not a post subject (2026-09-30 calibration); the study guides cover it |
| `ai-productivity-studies-disagree` | Why the AI Productivity Studies Disagree | 2026-09-30 | Out of scope: AI is not a post subject (2026-09-30 calibration); the study guides cover it |
| `codebase-now-prompt` | Your Codebase Is Now a Prompt | 2026-09-30 | Out of scope: AI is not a post subject (2026-09-30 calibration); the study guides cover it |
| `timeouts-nobody-chooses` | Timeouts Are the Config Nobody Chooses | 2026-09-30 | Tired subject: deadline propagation is standard Builders' Library and gRPC guidance |
| `idempotency-is-a-contract` | Idempotency Is a Contract, Not a Retry Setting | 2026-09-30 | Tired subject: idempotency keys are thoroughly covered by Stripe, AWS, and the IETF draft |
| `health-checks-cascade` | Health Checks That Check Dependencies Cause Cascades | 2026-09-30 | Tired subject: "liveness probes shouldn't check dependencies" is standard Kubernetes and Builders' Library advice |
| `control-plane-outages` | Cloud Outages Are Control-Plane Outages | 2026-09-30 | Tired subject: static stability is AWS's own published guidance, and post-outage commentary repeats it |
| `migration-locks-production` | Your Migration Tool Doesn't Know It's Locking Production | 2026-09-30 | Tired subject: lock-safe migrations are documented by strong_migrations, GitLab, and the Postgres docs |
| `time-ordered-keys` | Random Primary Keys Cost More Than You Think | 2026-09-30 | Tired subject: UUIDv7 vs random UUIDs has been argued to exhaustion |
| `restores-not-backups` | You Have Backups. Do You Have Restores? | 2026-09-30 | Tired subject: "test your restores" is decades-old operations advice |
| `e2e-tests-release-coupling` | Shared End-to-End Tests Rebuild the Monolith's Release Train | 2026-09-30 | Tired subject: "fewer E2E tests, more contract tests" is the standard microservices testing advice |
| `head-sampling-drops-errors` | Head Sampling Throws Away the Traces You Need | 2026-09-30 | Tired subject: head vs tail sampling is in the OpenTelemetry docs |
| `graceful-shutdown-drops` | Every Deploy Drops Requests Unless You Wrote Shutdown | 2026-09-30 | Tired subject: graceful shutdown and preStop hooks are well documented |
| `config-fail-at-startup` | Configuration Should Fail at Startup | 2026-09-30 | Tired subject: fail-fast config validation fits in a paragraph and is in the .NET docs |
| `multi-region-insurance` | Multi-Region Is Insurance You Often Can't Collect On | 2026-09-30 | Tired subject: "multi-region is overrated" is routine post-outage commentary; overlaps `control-plane-outages` |
| `code-review-knowledge-transfer` | Code Review's Real Job Is Knowledge Transfer | 2026-09-30 | Tired subject: Bacchelli and Bird's finding is widely retold |
| `frontend-state-cache` | Your Frontend State Is a Cache | 2026-09-30 | Tired subject: "server state is a cache" is TanStack Query's pitch; duplicates `vue-global-store` |
| `most-api-latency-data` | Most API Latency Is a Data Model Decision | 2026-09-30 | Tired subject: "it's the database, not the compute" is standard performance advice |
| `generic-repositories` | Generic Repositories Are an Abstraction Over Nothing | 2026-09-30 | Tired subject: a long-settled .NET debate |
| `observability-bills-telling-something` | Observability Bills Are Telling You Something | 2026-09-30 | Tired subject: observability cost is a crowded topic, and the authored-observability post covers the site's angle |
| `cloud-cost-ownership` | Cloud Cost Is an Ownership Problem First | 2026-09-30 | Tired subject: ownership is FinOps's founding principle |
| `interface-for-everything` | An Interface for Everything Isn't Abstraction | 2026-09-30 | Tired subject: a long-settled .NET debate |
| `hiring-judgment-ask-instead` | Hiring for Judgment: What to Ask Instead of LeetCode | 2026-09-30 | Tired subject: interview-validity research is widely retold, and the LeetCode post covers the site's angle |
| `analytics-needs-contract-copy` | Analytics Needs a Contract, Not a Copy | 2026-09-30 | Tired subject: data contracts are a crowded topic; overlaps the reporting post |
| `vue-global-store` | Most Vue Apps Don't Need a Global Store | 2026-09-30 | Tired subject: same server-state argument as `frontend-state-cache` |
| `measure-instead-velocity` | What to Measure Instead of Velocity | 2026-09-30 | Tired subject: summarizes SPACE and DevEx |
| `queues-why-work-slow` | Queues Are Why Work Is Slow | 2026-09-30 | Tired subject: Reinertsen's flow argument, widely retold |
| `schemaless-databases-still-have` | Schemaless Databases Still Have Schemas | 2026-09-30 | Tired subject: schema-on-read is textbook DDIA |
| `zero-trust-starts-with` | Zero Trust Starts With the IAM Policies Nobody Writes | 2026-09-30 | Tired subject: least-privilege drift is standard security writing |
| `approval-gates-admit-missing` | Approval Gates Admit Missing Trust | 2026-09-30 | Tired subject: restates *Accelerate*'s change-approval finding |
| `deploy-frequency-reversibility` | Deployment Frequency Is a Result of Reversibility | 2026-09-30 | Tired subject: restates DORA's capability model |
| `webhooks-someone-elses-outage` | Webhooks Are Someone Else's Outage | 2026-09-30 | Tired subject: queue-then-process for inbound webhooks is standard advice |
| `clean-architecture-templates-cargo` | Clean Architecture Templates Are Cargo | 2026-09-30 | Tired subject: a long-running .NET debate |
| `orchestration-coupling-hidden-choreography` | Orchestration Isn't Coupling; Hidden Choreography Is | 2026-09-30 | Tired subject: Newman already argues choreography hides coupling |
| `stored-procedures-arent-evil` | Stored Procedures Aren't Evil; Unowned Ones Are | 2026-09-30 | Tired subject: a decades-old debate |
| `sqlite-server-side` | SQLite's Server-Side Moment, and Who It's For | 2026-09-30 | Tired subject: the SQLite-in-production wave is heavily covered |
| `mediator-libraries-indirection-pay` | Mediator Libraries Are Indirection You Pay Interest On | 2026-09-30 | Tired subject: the MediatR debate is well worn |
| `oncall-design-review-held` | On-Call Is a Design Review Held at 3 AM | 2026-09-30 | Tired subject: "you build it, you run it" |
| `big-bang-rewrites-evidence` | What the Evidence Says About Big-Bang Rewrites | 2026-09-30 | Tired subject: Spolsky's argument, and the rebuild-or-realign post covers the site's angle |
| `pair-programming-studies-found` | What Pair Programming Studies Found | 2026-09-30 | Tired subject: the meta-analyses are widely summarized |
| `event-sourcing-audit-log` | Event Sourcing Isn't an Audit Log Upgrade | 2026-09-30 | Tired subject: standard event-sourcing advice |
| `dynamodb-punishes-unknown-access` | DynamoDB Punishes Unknown Access Patterns | 2026-09-30 | Tired subject: "access patterns first" is DeBrie's and Houlihan's core teaching |
| `sboms-trust-gap` | SBOMs Don't Tell You Who You Trust | 2026-09-30 | Tired subject: SBOM limits are widely discussed |
| `ssr-vs-spa-decides` | SSR vs SPA Decides Where Truth Is Rendered | 2026-09-30 | Tired subject: one of the most argued frontend debates |
| `psychological-safety-niceness` | Psychological Safety Isn't Niceness | 2026-09-30 | Tired subject: Edmondson's own clarification, widely retold |
| `cellbased-architecture-makes-blast` | Cell-Based Architecture Makes Blast Radius a Boundary | 2026-09-30 | Tired subject: restates AWS's cell-based architecture guidance |
| `prime-video-monolith-story` | What the Prime Video Monolith Story Actually Said | 2026-09-30 | Tired subject: covered exhaustively in 2023 |
| `ten-x-engineer-study` | The 10x Engineer Study Was Never About Engineers | 2026-09-30 | Tired subject: Bossavit's *Leprechauns* made this case |
| `microfrontends-split-teams-problems` | Microfrontends Split Teams, Not Problems | 2026-09-30 | Tired subject: even proponents pitch microfrontends as an org solution |
| `mentoring-teaching-people-question` | Mentoring Is Teaching People to Question Your Decisions | 2026-09-30 | Tired subject: common leadership advice |
| `hypermedia-revival-server-authority` | The Hypermedia Revival Is Server Authority Returning | 2026-09-30 | Tired subject: *Hypermedia Systems* makes this argument itself |
| `cloud-repatriation-maturity-signal` | Cloud Repatriation Is a Maturity Signal, Not a Retreat | 2026-09-30 | Tired subject: 37signals' exit has been covered exhaustively |
| `architects-stop-coding-lose` | Architects Who Stop Coding Lose Authority | 2026-09-30 | Tired subject: the ivory-tower-architect debate |
| `platform-engineering-devops-with` | Platform Engineering Is DevOps With an Owner | 2026-09-30 | Tired subject: well-worn industry commentary |
| `signals-frameworks-agreeing-where` | Signals Are Frameworks Agreeing on Where State Lives | 2026-09-30 | Tired subject: Carniato and others have covered the convergence; weak-fit frameworks |
| `seniority-knowing-which-decisions` | Seniority Is Knowing Which Decisions Are Expensive | 2026-09-30 | Tired subject: duplicates the Build Slow to Go Fast post's thesis |
| `multicloud-usually-negotiating-position` | Multi-Cloud Is Usually a Negotiating Position | 2026-09-30 | Tired subject: well-worn industry commentary |
| `content-is-code` | Content Is Code: Why Global Config Pushes Keep Breaking the Internet | 2026-09-30 | Tired subject: the CrowdStrike, Google Cloud, and Cloudflare config-push outages have been analyzed to death |
| `thread-pool-starvation` | Thread Pool Starvation Looks Like a Slow Database | 2026-09-30 | Author's call: declined without a specific reason |
| `connection-pool-sizing` | Your Connection Pool Is Sized for the Wrong Machine | 2026-09-30 | Author's call: declined without a specific reason |
| `configurability-second-language` | Configurability Is a Second Programming Language | 2026-09-30 | No audience: too few readers face the question to justify a post |
| `semver-broken-promise` | Semantic Versioning Is a Promise Most Packages Break | 2026-09-30 | No audience: too few readers face the question to justify a post |
| `bearer-tokens-topology-trust` | Bearer Tokens Are Topology Trust in Disguise | 2026-09-30 | Already done: the Topology Is Not a Trust Model and JWTs-for-authentication posts cover it |
| `database-isolation-defaults` | Your Database Isn't Giving You the Isolation You Think | 2026-09-30 | Low interest: the subject doesn't interest the author |
| `dependency-passed-every-test` | Your Dependency Passed Every Test and Still Took You Down | 2026-09-30 | Already done: the AWS SDK v4 silent deadlock case study covers it |
| `adr-reversal-conditions` | ADRs Should Record the Conditions That Would Reverse Them | 2026-09-30 | Guide material: a template practice that belongs in a study guide, not a blog post |
| `terraform-state-blast-radius` | Your IaC State File Is Your Blast Radius | 2026-09-30 | Low interest: the author has no current interest in the subject |
| `iac-drift-two-owners` | Drift Means a Resource Has Two Owners | 2026-09-30 | Author's call: declined without a specific reason |
| `multi-tenancy-authority` | Multi-Tenancy Is an Authority Problem | 2026-09-30 | Author's call: declined without a specific reason |
| `shaping-architecture-at-right` | Shaping Is Architecture at the Right Size | 2026-09-30 | Author's call: declined without a specific reason |
| `trunk-based-feature-shaped` | Trunk-Based Development Needs Feature-Shaped Work | 2026-09-30 | Author's call: declined without a specific reason |
| `conways-law-has-evidence` | Conway's Law Has Evidence; the Inverse Maneuver Has Less | 2026-09-30 | Author's call: declined without a specific reason |
| `real-time-business-rule` | Real Time Is a Business Rule | 2026-09-30 | Author's call: declined without a specific reason |
| `mvvm-authority-placement-ui` | MVVM Is Authority Placement for the UI | 2026-09-30 | Author's call: declined without a specific reason |
| `passkeys-change-where-authentication` | Passkeys Change Where Authentication Lives | 2026-09-30 | Author's call: declined without a specific reason |
| `does-static-typing-reduce` | Does Static Typing Reduce Defects? | 2026-09-30 | Tired subject, declined after approval: the static typing and defects debate has been beaten to death |
| `postgres-for-everything` | "Postgres for Everything" Is an Authority Decision | 2026-09-29 | Derivative: a well-worn industry debate the site would only summarize |
| `page-on-broken-promises` | Page on Broken Promises, Not Broken Servers | 2026-09-29 | Derivative: "alert on symptoms, not causes" is the Google SRE book's established guidance |
