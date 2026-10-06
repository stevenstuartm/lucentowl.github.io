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
- **Note:** Request smuggling and cache deception are well known in security circles, so the post can't just retell them. What it adds is the unifying mechanism, and an architecture fix (one interpreter of record) rather than a per-bug patch. Pairs with the Topology post's legitimacy argument. Distinct from the API gateway post, which is about business rules in the gateway, not parsing. Standards sweep 2026-10-06: kept, but the unifying mechanism already has a name in the LangSec community ("parser differentials": Sassaman, Patterson, Bratus), so the post must credit it and stand on the architecture fix. If LangSec already prescribes one interpreter of record for gateway-and-service stacks, decline it.
- **Could change if:** The cases turn out to need unrelated fixes, so that "one interpreter" doesn't help across them. Or strict parsing at every hop proves cheaper and more reliable than passing a parsed result, which would make the post a hardening checklist rather than an authority argument.

## 2. `log-waits-slowest-reader`: Your Replica Isn't Isolated From Your Primary

- **Research question:** When a read replica, a CDC connector, or a stream consumer falls behind or holds a long read, what does the primary do on its behalf, and who decided that?
- **Origin:** R
- **Scores:** U 5, D 4, S 5, E 5 = **19**
- **Hypothesis:** Any reader whose position the primary must preserve makes the primary keep history for it, so the primary's health is bounded by its slowest reader. A long report on a Postgres standby with `hot_standby_feedback` holds back vacuum on the primary. On an Aurora MySQL replica it grows the writer's undo history. On a SQL Server readable secondary it blocks ghost cleanup on the primary. An abandoned logical replication slot keeps WAL until the disk fills. Systems that don't wait drop the reader instead: Kafka expires idle consumer-group offsets and `auto.offset.reset` silently skips or replays. Every log makes this choice between primary availability and reader completeness. The defaults make it differently per engine, and usually nobody on the team has made it on purpose.
- **Evidence:**
  - AWS, "Aurora MySQL isolation levels" and the "InnoDB history list length increased significantly" proactive insight: long-running queries on Aurora Replicas cause purge lag on the writer; `aurora_read_replica_read_committed` as the mitigation
  - Microsoft Learn, "Active Secondaries: Readable Secondary Replicas": read workloads on a secondary map to snapshot isolation, and long transactions there defer ghost and version cleanup on the primary
  - PostgreSQL docs: `hot_standby_feedback`, `max_slot_wal_keep_size` (PostgreSQL 13), and `idle_replication_slot_timeout` (PostgreSQL 18, default disabled)
  - Apache Kafka KIP-186 (Kafka 2.0): offsets retention raised from 1 day to 7 because consumers offline longer than retention lost their offsets and fell back to `auto.offset.reset`
  - Debezium documentation on WAL growth from stopped PostgreSQL connectors
- **Lens and backing:** Relocate authority. A downstream reader gains authority over the primary's availability without anyone granting it. Backing: Reporting and Production Make Terrible Roommates (`/blog/2026/03/11/reporting-and-production-make-terrible-roommates.html`), the replication-and-consistency guide (`/study-guides/data/replication-and-consistency.html`), the messaging patterns guide
- **Experience:** Aurora, SQL Server, and Snowflake offload in production, if the author has seen a reporting replica or CDC pipeline slow the writer
- **Reader's check this week:** Find the longest-running query on your read replica and check whether it holds back cleanup on the primary (`hot_standby_feedback`, `RollbackSegmentHistoryListLength`, or ghost cleanup on an AG primary). List every replication slot or CDC consumer, and check what `max_slot_wal_keep_size` or log-reuse wait says happens if it stops. For Kafka, compare `offsets.retention.minutes` with your longest planned consumer outage, and check `auto.offset.reset`.
- **Hook:** You moved reporting to a replica to protect the primary. The replica can still reach back into it.
- **Note:** Corrects a claim in the site's own reporting post, which offers a dedicated reporting replica as a way to keep analytical queries "from competing with production traffic". The committed position (separate models for reporting and production) stands, and this strengthens it, but the post should say plainly that it revises that line. Replication lag itself was declined as guide material (`replica-lag-read-your-writes`). This idea is about the opposite direction, the reader's pressure on the writer, which the lag literature doesn't cover. Each engine's behavior is documented separately. The cross-engine mechanism and the "every log must choose" framing are the contribution.
- **Could change if:** The engines' defaults turn out to already bound the damage well enough (feedback off by default, slot limits common in managed services), so that the problem is a rare misconfiguration rather than a default most teams run with.

## 3. `reclaimable-names`: Every Name You Release Can Be Claimed by Someone Else

- **Research question:** How often do systems keep trusting a name (a bucket, a domain, a package, a repository) after its owner lets it go, and what does a new owner get?
- **Origin:** R
- **Scores:** U 5, D 4, S 5, E 5 = **19**
- **Hypothesis:** Systems refer to external resources by name, not by owner. When an owner deletes a bucket, lets a domain lapse, or removes a package, the references stay, and whoever registers the name next inherits the trust. Abandoned S3 buckets still served requests for executables and CloudFormation templates from government and Fortune 100 networks. Lapsed startup domains let a buyer sign in to former employees' SaaS accounts through Google OAuth. Deleted PyPI names were re-registered and shipped malware to existing dependents. Subdomain takeover is the long-known case of the same mechanism. The fix isn't a scanner for each namespace. Deleting a name has to count as a change to every system that references it, and references should bind to an owner (account ID, stable subject, pinned hash) wherever the platform allows.
- **Evidence:**
  - watchTowr, "8 Million Requests Later" (February 2025): about 150 abandoned S3 buckets re-registered for about $420, which then received over eight million requests in two months
  - Truffle Security (Dylan Ayrey), Google OAuth and defunct startup domains (January 2025): sign-in to Slack, Notion, Zoom, and HR systems as former employees after buying the domain
  - JFrog, "Revival Hijack" (September 2024): deleted PyPI project names re-registered, with over 22,000 packages exposed
  - Aqua Security, repojacking research on renamed GitHub accounts (2023)
  - Microsoft Learn, "Prevent dangling DNS entries and avoid subdomain takeover"
- **Lens and backing:** Relocate authority. Authority over part of your system is held by whoever holds the name, and the name's registry decides who that is. Backing: Topology Is Not a Trust Model (`/blog/2026/06/19/topology-is-not-a-trust-model.html`), the S3 fundamentals guide (`/study-guides/infrastructure/aws/aws-s3-fundamentals.html`), the DNS guide, the devsecops guide
- **Reader's check this week:** Grep your IaC, scripts, installers, and docs for bucket names, domains, and package names, and confirm you still own each one. List DNS records that point at cloud resources (CNAMEs to `*.cloudapp.net`, `*.s3.amazonaws.com`, and similar) and check the target still exists. Check whether your offboarding of a domain or bucket has any step besides "delete".
- **Hook:** You deleted the bucket. Your installer still downloads from it, and someone else owns it now.
- **Note:** Subdomain takeover and dependency confusion are well covered on their own. The idea earns its place only by unifying them as one mechanism with one architectural fix. If an existing body of work (for example watchTowr's "abandoned infrastructure" framing) already does that and proposes the same fix, the post must credit it or be declined. Pairs with `identity-key-not-email`: a lapsed domain is how the Truffle case reaches login.
- **Could change if:** The platforms close the class themselves (account-scoped bucket namespaces, registries that never release names), which would shrink the post to a migration note.

## 4. `since-cursor-skips-rows`: Your "Changes Since" Query Silently Skips Rows

- **Research question:** When a sync endpoint, outbox relay, incremental ETL, or projection reads "everything after the last ID or timestamp I saw", does it see every committed row?
- **Origin:** R
- **Scores:** U 5, D 4, S 4, E 5 = **18**
- **Hypothesis:** Identity values, sequences, rowversions, and `updated_at` timestamps are assigned when a row is written, not when its transaction commits. Under concurrent writes, a reader that advances a high-water mark past a visible row can pass over a lower-numbered row whose transaction commits a moment later, and it never comes back for it. That loss is silent and permanent, and it hits outbox relays, incremental extracts, mobile sync, and event-store projections alike. The cursor has to be safe at commit time: SQL Server's `MIN_ACTIVE_ROWVERSION`, PostgreSQL's snapshot `xmin`, a CDC log position, or a deliberate lag window with gap detection.
- **Evidence:**
  - Microsoft Learn, `MIN_ACTIVE_ROWVERSION` (Transact-SQL): built for synchronization, because using `@@DBTS` "can miss changes that are active when synchronization occurs"
  - Marten documentation on the async daemon's high-water mark and sequence gaps, and Marten discussion #4953 (projection progress advancing past committed events during concurrent appends)
  - PostgreSQL `pg_current_snapshot()` and `pg_snapshot_xmin()`, and the pgsql-hackers threads on sequence order versus commit order
  - Debezium and other log-based CDC tools as the commit-ordered alternative
- **Lens and backing:** Name the real thing. A sequence number looks like commit order, but it's only allocation order. Backing: Reporting and Production Make Terrible Roommates (`/blog/2026/03/11/reporting-and-production-make-terrible-roommates.html`), the replication-and-consistency guide, the messaging patterns guide (outbox)
- **Experience:** Snowflake loads and integration pipelines at TMI, if any used an ID or timestamp watermark
- **Reader's check this week:** Grep for `WHERE Id > @last`, `RowVersion > @last`, or `UpdatedAt > @since` in sync, outbox, and ETL code. For each one, check whether the cursor comes from a commit-safe source or has a lag window and gap check. If not, two concurrent transactions committing out of order will reproduce the skip in a test.
- **Hook:** Your incremental sync reads every row. Except the ones that committed late.
- **Note:** Event-store and sync-framework authors know this mechanism well (it's why Marten tracks gaps). Application teams writing their own outbox relay or ETL watermark mostly don't. The post has to show it's common outside those libraries, not just restate their docs. Distinct from declined `replica-lag-read-your-writes`, which is about stale reads, not permanently skipped rows.
- **Could change if:** Common outbox and ETL libraries already default to commit-safe cursors, so that only hand-rolled code is exposed, which would make the post a narrower warning.

## 5. `identity-key-not-email`: The Claim You Key Users On Decides Who Can Become Them

- **Research question:** When an app signs users in through an external identity provider, which claim does it treat as the user, and who controls that claim?
- **Origin:** R
- **Scores:** U 5, D 3, S 5, E 4 = **17**
- **Hypothesis:** An external identity is the pair of issuer and subject. Email, tenant domain, and display name are attributes someone else controls: the IdP tenant's admin, the domain's next owner, or the user. Apps that key accounts or link logins on email hand account takeover to whoever can set that attribute. Apps that accept any tenant of a multi-tenant IdP let any of its users in. The nOAuth, BingBang, and lapsed-domain cases are the same failure: the app trusted an attribute as if it were an identity.
- **Evidence:**
  - OpenID Connect Core 1.0, section 5.7: only `iss` and `sub` together are a stable identifier
  - Descope, "nOAuth" (June 2023): Azure AD's mutable, unverified `email` claim used for account takeover in multi-tenant apps; Microsoft's guidance changes that followed
  - Wiz, "BingBang" (March 2023): multi-tenant Azure AD apps accepting any tenant's users, with about 25% of scanned multi-tenant apps exposed
  - Truffle Security, Google OAuth and defunct startup domains (January 2025)
- **Lens and backing:** Relocate authority. Keying on an attribute gives authority over your accounts to whoever controls the attribute. Backing: Topology Is Not a Trust Model (`/blog/2026/06/19/topology-is-not-a-trust-model.html`), Why JWTs Make Terrible Authorization Tokens (`/blog/2025/10/10/jwts-are-for-authentication-not-authorization.html`), the identity-access-management guide (`/study-guides/security/identity-access-management.html`), the auth systems case study
- **Experience:** Five auth systems unified (case study), if account linking across providers came up
- **Reader's check this week:** Find where your sign-in callback looks up the local user. Is the key `(iss, sub)`, or is it email? Check whether account linking or just-in-time provisioning matches on email, and whether a multi-tenant app registration validates the tenant or issuer.
- **Hook:** Your login trusts Microsoft. It also trusts whoever can edit an email field in any Microsoft tenant.
- **Note:** The OIDC spec already says this, so the post can't stop at "use `sub`". Its contribution is showing that three separate disclosures are one mechanism, and that account linking and provisioning, not the login itself, are where apps fall back to email. If that framing turns out to be standard identity-practitioner material, it is a tired-subject candidate. Pairs with `reclaimable-names`.
- **Could change if:** Major identity libraries (ASP.NET Core's OIDC handler, Auth0, Cognito) already key on `sub` by default and block email linking, so that the bug is limited to apps that override them.

## 6. `recovery-is-authentication`: Your Account Recovery Is Your Real Login

- **Research question:** How strong is an account's authentication once every path that issues a credential is counted, including recovery, support resets, and admin overrides?
- **Origin:** R
- **Scores:** U 5, D 3, S 5, E 4 = **17**
- **Hypothesis:** An account is only as strong as the weakest path that ends in a credential or session. Teams design login with MFA, then add recovery by email or SMS, a support desk that can reset factors, and admin impersonation, each with weaker proof and less logging. Attackers take those paths: help-desk resets in the MGM and Okta support incidents, and SMS recovery in SIM-swap takeovers. Google's own data showed security questions were weaker than passwords. NIST's 800-63B-4 (2025) now treats recovery as part of authentication assurance. Teams should inventory every credential-issuing path and hold each to the login's assurance level, or accept that the weakest path sets the real one.
- **Evidence:**
  - NIST SP 800-63B-4 (final, July 2025): new account recovery requirements by assurance level; static knowledge-based answers deprecated
  - Bonneau, Bursztein, Caron, Jackson, Williamson, "Secrets, Lies, and Account Recovery" (WWW 2015)
  - MGM Resorts (September 2023): attackers gained access through a help-desk call, per public reporting
  - Okta, October 2023 support system incident report
  - CISA and FBI advisories on Scattered Spider help-desk social engineering (2023)
- **Lens and backing:** Name the real thing. The documented login isn't the authentication. The weakest credential-issuing path is. Backing: Auth Sessions Should Never Be Transient Across Boundaries (`/blog/2025/10/10/auth-sessions-should-never-cross-boundaries.html`), the identity-access-management guide, the incident-response-recovery guide
- **Experience:** Digital banking at Alkami, if the author saw recovery or support-reset design there
- **Reader's check this week:** List every path in your product that ends with a session, password reset, or new MFA factor: self-service recovery, support tooling, admin impersonation, SSO just-in-time provisioning, API key creation. Next to each, write the weakest proof it requires and whether it alerts the account owner.
- **Hook:** You required MFA to log in. Your support desk can reset it over the phone.
- **Note:** "Recovery is the weak link" is familiar in security circles, so the novelty test applies hard. The post must add the inventory method and the assurance-level framing from 800-63B-4, not retell incidents. Distinct from `identity-key-not-email`, which is about which identifier the login trusts, not which paths issue credentials.
- **Could change if:** The evidence shows recovery paths are now commonly held to login assurance in the platforms most teams use (Entra, Okta, Cognito defaults), which would narrow the post to custom-built auth.

## 7. `ops-tooling-authority`: Your Most Dangerous Code Is the Script Nobody Reviews

- **Research question:** In public postmortems where operators deleted or removed production capacity by mistake, what did the tool allow, and what would have stopped it?
- **Origin:** R
- **Scores:** U 5, D 3, S 5, E 4 = **17**
- **Hypothesis:** Operational tooling (cleanup scripts, capacity commands, data-fix jobs, console bulk actions) has more authority than product code. It runs with broad credentials, acts in bulk, and bypasses application validation, yet gets less review and fewer safeguards. The large self-inflicted outages share that profile. Atlassian's script accepted site IDs where app IDs were meant and permanently deleted about 400 customers' sites. An S3 playbook command removed more capacity than intended in 2017. GitLab's 2017 deletion ran against the wrong database. The fixes they adopted are product guarantees given to tooling: typed inputs, dry runs, scope limits, rate limits, and soft deletion with a recovery window.
- **Evidence:**
  - Atlassian, "Post-Incident Review on the April 2022 outage": the script took both site and app IDs, and both mark-for-deletion and permanent-delete modes
  - AWS, "Summary of the Amazon S3 Service Disruption in the Northern Virginia (US-EAST-1) Region" (February 2017): the tool was changed to remove capacity more slowly and refuse to go below minimums
  - GitLab, "Postmortem of database outage of January 31" (2017)
  - Google SRE Book, discussion of automation safety and blast radius
- **Lens and backing:** Relocate authority. The most authority sits in the least-engineered code, so the fix moves product guarantees to where the authority is. Backing: Why the Fastest Incident Responders Slow Down First (`/blog/2025/11/08/troubleshooting-production.html`), the incident-response-recovery guide (`/study-guides/security/incident-response-recovery.html`), the devops guide
- **Reader's check this week:** List every script, job, or console action in your team that can delete data or remove capacity in bulk. For each one, check whether it has a dry run, rejects ambiguous identifiers, caps how much it touches per run, and leaves a recovery window.
- **Hook:** Your product has validation, tests, and code review. The script that can delete every customer has none.
- **Note:** Public incident analysis growth edge. The incidents are individually famous, so the post stands on the cross-incident pattern and a concrete guardrail checklist, not on retelling. Distinct from declined `ci-most-privileged-principal` (supply-chain hardening of CI) and `content-is-code` (global config pushes): this is about human-run operational tooling.
- **Could change if:** The postmortems show the failures came from process (missing review, fatigue) rather than tool design, so that guardrails in the tool wouldn't have stopped them.
