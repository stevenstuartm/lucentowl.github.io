<!-- Maintained by /post-ideas. Scoring rules: .claude/content/post-idea-rubric.md -->

# Post Ideas: In Review

The top-ranked ideas awaiting the author's decision, at most 20, in rank order. Approve an idea to move it to `approved.md`; decline it to move it to the backlog's Declined table.

Evidence lines are research leads, not verified citations.

## 1. `parser-differentials-authority`: The Component That Checks Isn't the One That Acts

- **Research question:** When a gateway, validator, cache, or auth check parses a request differently from the service that acts on it, which one holds authority, and how often does that gap become an exploit?
- **Origin:** R
- **Scores:** U 5, D 4, S 5, E 5 = **19**
- **Hypothesis:** Many request-level security bugs share one mechanism: two components read the same input differently, so the one that validates isn't the one that acts. Examples are duplicate JSON keys, ambiguous request framing, path suffixes a cache treats as static, and Unicode case mapping. Hardening one parser doesn't fix it. Either one component owns the interpretation and passes the parsed result along, or every component is made strict enough to reject what the others would read differently.
- **Evidence:**
  - Jake Miller, Bishop Fox, "An Exploration of JSON Interoperability Vulnerabilities" (2021): 49 parsers surveyed, duplicate-key precedence attacks such as `{"qty": 1, "qty": -1}` across microservices
  - James Kettle, PortSwigger, "HTTP Desync Attacks: Request Smuggling Reborn" (Black Hat USA 2019)
  - Mirheidari et al., "Web Cache Deception Escalates!" (USENIX Security 2022): 1,188 vulnerable sites in the Alexa Top 10K; and "Cached and Confused" (USENIX Security 2020)
  - John Gracey (Wisdom), "Hacking GitHub's Auth with Unicode's Turkish Dotless 'I'" (2019): reset emails sent to an address that only matched after lowercasing
  - RFC 9413, "Maintaining Robust Protocols" (Thomson and Schinazi, 2023), on how tolerance becomes de facto spec; RFC 7493 (I-JSON) and RFC 8265 (PRECIS usernames)
  - .NET 10 `JsonSerializerOptions.AllowDuplicateProperties` (defaults to true) and the `JsonSerializerOptions.Strict` preset
- **Lens and backing:** Relocate authority. The checker and the actor are different components, so the authority to interpret the input is split. Backing: Topology Is Not a Trust Model (`/blog/2026/06/19/topology-is-not-a-trust-model.html`), Architecture Is a Belief About Where Authority Belongs (`/blog/2026/06/12/architecture-is-a-belief-about-where-authority-belongs.html`), application-security and modern-attack-vectors guides, the JSON serialization guide (`/study-guides/dotnet/c-sharp/libraries/json-serialization.html`)
- **Experience:** API gateways in front of banking and financial research services, if the author has seen a gateway and a service disagree
- **Reader's check this week:** Send `{"amount": 1, "amount": -1}` through your gateway or validator to your service and see which value each one uses. In .NET, check whether `AllowDuplicateProperties` is false. Grep identity lookups for `ToLower()` or culture-sensitive comparisons on emails and usernames.
- **Hook:** Your validator approved the request. Your service executed a different one.
- **Note:** Request smuggling and cache deception are well known in security circles, so the post can't just retell them. What it adds is the unifying mechanism, and an architecture fix (one interpreter of record) rather than a per-bug patch. Pairs with the Topology post's legitimacy argument.
- **Could change if:** The cases turn out to need unrelated fixes, so that "one interpreter" doesn't help across them. Or strict parsing at every hop proves cheaper and more reliable than passing a parsed result, which would make the post a hardening checklist rather than an authority argument.

## 2. `compatibility-window-oldest-reader`: Your Compatibility Window Is Set by Your Oldest Reader

- **Research question:** How long must a change stay backward compatible, and who actually sets that window: the deploy, the client, or the data?
- **Origin:** R
- **Scores:** U 5, D 4, S 5, E 4 = **18**
- **Hypothesis:** Teams size compatibility by their deploy (minutes of rolling overlap), but the real window is set by the longest-lived reader. That might be a browser tab holding an old bundle for days, a desktop or mobile client that updates on its own schedule, or an event replayed from a topic retained for months. Most upgrade failures come from data and message format incompatibility in that window, not from the code change itself.
- **Evidence:**
  - Zhang et al., "Understanding and Detecting Software Upgrade Failures in Distributed Systems" (SOSP 2021): a study of upgrade failures in distributed systems, plus DUPTester, which found 20 new ones
  - Vercel Skew Protection (2023): old client bundles calling new server code
  - Confluent Schema Registry compatibility modes: the default `BACKWARD` checks only against the latest schema, not every retained version (`BACKWARD_TRANSITIVE`)
  - Kubernetes version skew policy, as a published example of a stated window
  - Kleppmann, *Designing Data-Intensive Applications*, chapter 4 (encoding and evolution)
- **Lens and backing:** Price the timing. The cost of a format change lasts as long as its oldest reader. Backing: Your Reads Should Not Design Your Writes (`/blog/2026/09/14/your-reads-should-not-design-your-writes.html`), the API versioning guide (`/study-guides/dotnet/asp/aspnet-versioning-openapi.html`), deployment-strategies and event-driven-architecture guides, the CQRS/event-sourcing loan servicing case study
- **Experience:** A WPF point-of-sale fleet in hundreds of stores and Vue SPAs in production, both readers that outlive a deploy
- **Reader's check this week:** Find your oldest live reader. That's the oldest client version in your request logs, the age of the oldest open SPA session, or the retention on your event topics. Then check whether your schema registry's compatibility mode is transitive.
- **Hook:** Your deploy finished in four minutes. Your compatibility window is still open from March.
- **Note:** Expand/contract migrations and tolerant readers are standard advice. The new parts are naming the window by its oldest reader, the SOSP failure data, and the non-transitive registry default. Pairs with `enums-breaking-change` in the backlog.
- **Could change if:** The SOSP data shows most upgrade failures come from code or config rather than format and state, or long-lived readers turn out to be rare in practice once versioned APIs are in place.

## 3. `load-tests-closed-loop`: Your Load Test Can't Find the Load That Breaks You

- **Research question:** Do common load-testing setups model how real traffic arrives, and what do they hide when they don't?
- **Origin:** R
- **Scores:** U 5, D 4, S 5, E 4 = **18**
- **Hypothesis:** Most load tests run a fixed pool of virtual users who wait for each response before sending the next request (a closed model). When the system slows, the test slows its own arrivals, so it can't reproduce the queueing collapse that open internet traffic causes. Teams pass load tests at a capacity they don't have. Switching to an arrival-rate (open) model changes the measured breaking point.
- **Evidence:**
  - Schroeder, Wierman, and Harchol-Balter, "Open Versus Closed: A Cautionary Tale" (NSDI 2006)
  - Grafana k6 documentation on open and closed models, including the constant-arrival-rate executors
  - Gil Tene, "How NOT to Measure Latency" (talk), on coordinated omission
  - Bronson et al., "Metastable Failures in Distributed Systems" (HotOS 2021), for what happens past the breaking point
- **Lens and backing:** Name the real thing. A "load test" in a closed model is a throughput test that politely backs off. Backing: performance-engineering and performance_scalability_patterns guides, the reliability_patterns guide, and the retry-load-amplifier and unbounded-queue drafts once published
- **Reader's check this week:** Open your load test config. Are you setting virtual users or an arrival rate? Rerun the same scenario with a constant arrival rate at your claimed capacity and compare p99 latency and error rate.
- **Hook:** Your load test slows down when your system does. Your users don't.
- **Note:** Coordinated omission is known among performance specialists, so the post should credit Tene and the NSDI paper and add the tool-level check. Pairs with `retry-load-amplifier` (drafted) and `unbounded-queue-outage` (drafted) as a resilience cluster.
- **Could change if:** Tool defaults have moved to open models and most teams already use them, or the measured difference at realistic utilization is small.

## 4. `bff-tokens-out-of-browser`: RFC 10017 Says Your SPA Shouldn't Hold Tokens

- **Research question:** Now that the IETF has published its best current practice for browser-based OAuth apps, where should a single-page app's tokens live?
- **Origin:** R
- **Scores:** U 5, D 3, S 5, E 4 = **17**
- **Hypothesis:** The tokens-in-JavaScript SPA pattern can't be made safe against an attacker who runs code in the page. Storage choice (memory, localStorage, a service worker) only changes what the attacker steals, not whether they can act as the user. A backend-for-frontend that keeps tokens server-side and gives the browser only a cookie session is the pattern that moves authority back behind the security boundary. Its cost is a stateful component the SPA was supposed to avoid.
- **Evidence:**
  - RFC 10017, "OAuth 2.0 for Browser-Based Applications" (Parecki, De Ryck, Waite; BCP, August 2026), and its threat analysis
  - RFC 9700, "Best Current Practice for OAuth 2.0 Security" (January 2025)
  - RFC 9449, DPoP, as the sender-constrained alternative
  - Philippe De Ryck's talks on why token storage choice doesn't stop a malicious script
- **Lens and backing:** Relocate authority. It extends the committed position that auth sessions end at the security boundary out to the browser. Backing: Auth Sessions Should Never Be Transient Across Boundaries (`/blog/2025/10/10/auth-sessions-should-never-cross-boundaries.html`), Why JWTs Make Terrible Authorization Tokens (`/blog/2025/10/10/jwts-are-for-authentication-not-authorization.html`), identity-access-management and aspnet-auth guides, the zero-trust auth sessions case study
- **Experience:** Vue and Nuxt apps in production, and five auth systems unified (case study)
- **Reader's check this week:** Open your SPA's dev tools. Can page JavaScript read an access or refresh token, from storage, memory, or a network response? If so, list what an injected script could do with it before it expires.
- **Hook:** The IETF just told you where your SPA's tokens belong. It isn't the browser.
- **Note:** D is capped at 3 because the RFC itself makes the argument. The site's contribution is connecting it to the sessions-at-the-boundary position and pricing the BFF's statefulness honestly. Timely: the RFC is two months old.
- **Could change if:** The RFC's analysis rates sender-constrained tokens (DPoP) in the browser as equivalent to a BFF for common threats, which would make the post about binding, not location.

## 5. `error-handlers-cause-outages`: Your Catch Blocks Cause Your Outages

- **Research question:** Where do catastrophic production failures actually start, and does error-handling code get testing in proportion to that?
- **Origin:** R
- **Scores:** U 5, D 3, S 5, E 4 = **17**
- **Hypothesis:** Most catastrophic failures in distributed systems start with a non-fatal error handled wrongly: swallowed, logged and continued, or escalated too far. A large share of those handlers are trivially wrong (empty, a TODO, or the opposite of what the error needed), so simple tests of error paths would catch them. Teams test the happy path and ship the code that decides outages without ever running it.
- **Evidence:**
  - Yuan et al., "Simple Testing Can Prevent Most Critical Failures" (OSDI 2014): catastrophic failures traced to incorrect handling of non-fatal errors, many of them trivial
  - Gunawi et al., "What Bugs Live in the Cloud?" (SoCC 2014)
  - Gunawi et al., "Why Does the Cloud Stop Computing? Lessons from Hundreds of Service Outages" (SoCC 2016)
  - The Aspirator checker from the OSDI paper, and .NET analyzers that flag empty catch blocks (CA1031 and related)
- **Lens and backing:** Name the real thing. "Error handling" is the outage-decision code, and it's the least exercised. Backing: Why I Changed My Mind About Exceptions (`/blog/2025/10/29/result-pattern-vs-exceptions-revisited.html`), Making Invalid States Unrepresentable (`/blog/2025/12/18/making-invalid-states-unrepresentable-the-billion-dollar-mistake-that-wasnt.html`), the exceptions-and-errors guide (`/study-guides/dotnet/c-sharp/fundamentals/exceptions-and-errors.html`), the silent SDK deadlock case study
- **Experience:** The silent SDK deadlock case study, if a swallowed or misrouted error played a part
- **Reader's check this week:** Grep for `catch` blocks that only log, or are empty, in the code path of your last incident. Then count how many catch blocks in one service have a test that reaches them.
- **Hook:** The code that decides whether you have an outage is the code you've never run.
- **Note:** D is capped at 3: the OSDI paper is the main argument, and the SoCC studies plus the C# application lift it. Extends the exceptions post's committed position rather than reversing it.
- **Could change if:** The later SoCC outage data shows error handling is a minor cause next to configuration and upgrades, or the OSDI finding doesn't hold outside the open-source data stores it studied.

## 6. `ownership-defects-truck-factor`: Code Ownership Lowers Defects and Raises Your Bus Factor

- **Research question:** The research says concentrated ownership reduces defects and also that concentrated knowledge is a risk. Which should a team optimize, and can it measure both?
- **Origin:** R
- **Scores:** U 4, D 4, S 5, E 4 = **17**
- **Hypothesis:** The two bodies of evidence measure different failures. Ownership studies count defects from many minor contributors, and truck-factor studies count knowledge loss when one person leaves. Both can be read from version control. A component with one dominant author and no secondary reviewer is a knowledge risk, and one with many minor authors and no owner is a defect risk. The target is a primary owner plus deliberate secondary contributors, and a team can measure where each component sits this week.
- **Evidence:**
  - Bird et al., "Don't Touch My Code! Examining the Effects of Ownership on Software Quality" (FSE 2011)
  - Greiler, Herzig, and Czerwonka, "Code Ownership and Software Quality: A Replication Study" (MSR 2015), which confirmed Bird et al. on four Microsoft products
  - Thongtanunam et al., "Revisiting Code Ownership and Its Relationship with Software Quality in the Scope of Modern Code Review" (ICSE 2016)
  - Avelino et al., "A Novel Approach for Estimating Truck Factors" (ICPC 2016)
  - "Examining Ownership Models in Software Teams: A Systematic Literature Review and a Replication Study" (Empirical Software Engineering, 2024)
- **Lens and backing:** Relocate authority. Ownership is authority placed on people, and both too much and too little of it fail. Backing: How Shared Libraries Become Shared Shackles (`/blog/2026/01/06/the-false-economy-of-shared-libraries.html`), the team-organization guide (`/study-guides/sdlc/team-organization.html`), dev-team-leadership-foundations
- **Experience:** Tech lead and system architect roles, where the author decided who owned which components
- **Reader's check this week:** Run `git shortlog` per top-level directory for the last year. For each component, note the top author's share and how many contributors are under 5%. Flag the components at either extreme.
- **Hook:** Your best-owned module is your biggest bus-factor risk.
- **Note:** Not Conway's Law (declined), which is about org shape and system shape. This is about authorship within a codebase. Name the replication studies honestly if they weaken the original effect.
- **Could change if:** The 2024 review finds the ownership-defect link doesn't hold under modern code review, or the two metrics turn out not to trade off in practice.
