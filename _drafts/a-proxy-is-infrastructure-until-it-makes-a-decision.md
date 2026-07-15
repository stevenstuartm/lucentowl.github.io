---
layout: post
title: "A Proxy Is Infrastructure Until It Makes a Decision"
description: "API gateways and service meshes are marketed as separate technologies solving separate problems, but they're two examples of the same pattern, a proxy absorbing a cross-cutting concern, placed at two different coordinates. One test applies to both: a proxy earns its place by handling mechanical, operationally independent concerns, and fails the moment a service starts trusting it to make a decision that was never plumbing to begin with."
tags: [architecture, api-design, distributed-systems, microservices, security, design-patterns]
author: steven-stuart
---

API gateways and service meshes are sold as separate technologies solving separate problems: rate limiting and a developer portal at the edge, certificate rotation and retries in the interior. They're not separate problems. Both are a proxy absorbing a cross-cutting concern so the service behind it doesn't have to, one example of that pattern at the edge and one in the interior. What decides whether either one belongs where a team put it is a single test, applied the same way at both addresses. Is what the proxy's doing mechanical work with its own need to scale, fail, or change on a schedule the surrounding services don't share, or has it started deciding something that required knowledge only the service behind it holds?

A proxy earns its place doing the first. It's infrastructure right up until it starts doing the second, and gateways and meshes fail at exactly that line, whichever address they're sitting at.

## The Same Concern, Two Addresses

North-south traffic arrives from outside the system, such as a browser, a partner integration, or a mobile app. East-west traffic moves between two services that are already inside. A gateway sits at the first address. A mesh sidecar sits at the second. Both are the same kind of thing at different addresses, a proxy absorbing a cross-cutting concern so the service behind it doesn't have to, and the rest of this post treats "edge" and "interior" as those two addresses rather than as two different technologies.

## What a Proxy Is Allowed to Decide

Since a gateway and a mesh sidecar are two examples of one pattern, asking whether to adopt either one as a category is the wrong question to start with. "Do we need a service mesh" bundles a dozen unrelated capabilities, such as retries, mTLS, traffic shifting, authorization policy, and telemetry, into a single yes-or-no decision, and the honest answer to a bundle is rarely a clean yes or no. The decision that actually matters happens one capability at a time, asked identically regardless of which product it ships inside.

### Mechanical Concerns Carry No Business Opinion

A capability is mechanical when it has no opinion about the business. Terminating a TLS handshake, rotating a certificate, retrying a timed-out call, and shifting five percent of traffic to a canary don't require knowing what an order is, what a customer is entitled to, or what a valid discount looks like. They operate on bytes, connections, and status codes, not business meaning, and a proxy can perform every one of them without ever deserializing the request body. If a capability needs to understand what a request means rather than just how it's shaped, it isn't mechanical anymore.

### Independent Operational Needs Earn a Dedicated Tier

Mechanical alone doesn't justify a separate piece of infrastructure. Plenty of mechanical work runs fine inside application code. What justifies pulling a mechanical concern out into a proxy is an operational need the surrounding services don't share: absorbing traffic spikes many times larger than any single service's normal load, rotating credentials on a schedule no application deploy cycle should be coupled to, or applying a policy change across hundreds of services in minutes instead of waiting on hundreds of independent releases. When a capability needs to scale, fail, or change on its own schedule, a dedicated tier is the honest answer. When it doesn't, the tier is just an extra hop that happens to be mechanical.

### Why the Tier Takes Proxy Form

A dedicated tier for a mechanical concern doesn't have to be a proxy. A shared library, linked into every service, can rotate its own certificates or apply its own retry policy just as mechanically. Netflix's early resilience stack worked exactly this way, with Hystrix handling circuit breaking and Ribbon handling client-side load balancing as libraries embedded directly in each JVM service.

A library only works if every service can embed it, which means every service has to run the same language, adopt the same version on its own schedule, and redeploy to pick up a fix. A proxy beside or in front of a service needs none of that. It enforces a retry policy or rotates a certificate for a Go service, a Python service, and a fifteen-year-old Java monolith without any of them changing a line of code or agreeing on a release cadence. That's what a polyglot fleet buys with a proxy instead of a library. The concern moves at its own pace, independent not just of any single service's deploy cycle but of what language that service happens to be written in.

### The Removal Test

A quick check for any specific feature under consideration: remove it and ask what breaks. If removing it means a service loses a convenience, it now has to retry the call itself, or terminate its own TLS, that's extra implementation work, work the service can absorb by writing a bit more code. If removing it means a service loses the ability to know who's actually calling it, or starts trusting a decision it never made, the "convenience" was quietly acting as a trust boundary the whole time. Losing convenience is an acceptable trade against operational payoff. Losing independent judgment isn't a trade at all, because the service was never really making that judgment. Something upstream was making it on the service's behalf, and the service just hadn't noticed yet.

### The Redundancy Test

The removal test asks whether a service loses convenience or loses judgment. A second test answers a narrower question that comes up wherever a proxy filters or rejects traffic before a service ever sees it. Is the proxy's check a copy of a verdict the service would reach on its own, or has it become the only place that verdict gets reached at all?

A gateway that rejects an expired token is redundant in the useful sense. The service receiving a valid token still validates it and still checks the claims inside, so the gateway's rejection only saves the round trip for a request that was always going to fail. The check passes the redundancy test because removing the gateway's copy of it doesn't remove the guarantee. It just moves the rejection one hop further downstream.

A gateway that blocks a route because a tenant's plan doesn't include it fails the same test the moment the domain service stops checking the tenant's plan on its own. At that point the gateway's table isn't a copy of a verdict the domain would reach anyway. It's the only place the verdict gets made, and removing it doesn't just cost a round trip. It removes the only enforcement that existed.

A check earns its place at the proxy layer when the service behind it would reach the identical verdict if the proxy weren't there. The moment a service stops checking because the proxy already did, the copy became the original, and the proxy has quietly taken on a decision it was never positioned to make correctly.

## What Belongs at the Edge

Applying that test to the features sold under "API gateway" splits them cleanly, with two requiring more care than a table can show.

| Feature | What it does | Belongs at the edge? |
|---|---|---|
| TLS/mTLS termination | Terminates the external handshake before traffic reaches a service | Yes. Certificate handling for public traffic scales with connection volume, not domain logic. |
| Path/host-based routing | Sends a request to the right backend service | Yes. A routing table has no opinion about the business. |
| Protocol translation | Bridges REST to gRPC, or fronts a legacy SOAP partner with a modern contract | Yes, at a genuine boundary outside your change control. Translating your own services' protocols to each other belongs to whoever owns those services. |
| Rate limiting and throttling | Enforces per-consumer request quotas | Yes. Needs elastic capacity unrelated to any single service's load profile. |
| WAF, bot detection, DDoS absorption | Filters malicious or abusive traffic before it reaches anything real | Yes, and one of the strongest cases in either technology. Attack traffic can outscale legitimate traffic by orders of magnitude. No domain service should be sized for that. |
| Token signature validation | Rejects malformed or expired credentials early | Yes, as a fail-fast optimization only. Every downstream service still validates the token and its claims itself. |
| Response caching | Serves a cached response instead of forwarding | Conditional. Fine when driven by cache-control headers the origin service sets. Risky once the gateway starts guessing TTLs for data it doesn't own. |
| Consumer/developer portal | Issues and tracks API keys for external partners | Yes. Managing external consumer relationships is a separate concern from serving any one of them. |
| Response aggregation (BFF-style) | Combines several backend calls into one shaped response | Conditional, and usually no. |
| Scope or role-based authorization | Decides whether this caller may perform this specific action | No. |

### Where Aggregation Becomes Presentation Logic

Aggregation is the feature most likely to get defended on convenience grounds and most likely to be wrong. Combining three backend calls into one response for a mobile app sounds like routing, but deciding which fields a customer needs from which services, and how to shape them together, is presentation logic. The moment one gateway aggregates for a mobile team, a partner integration, and an internal dashboard, each with different needs, it holds three different opinions about what a response should look like, and none of those opinions belong to a component whose actual job is moving bytes.

This isn't a hypothetical failure. Netflix's early GraphQL layer worked exactly this way, one unified gateway aggregating across dozens of downstream services for every consumer. As the organization grew, that single graph became the bottleneck the pattern predicts. Every team's schema changes had to deploy together, and a bug from any one of them blocked releases for the rest. The fix was federation, splitting the one graph into subgraphs owned and deployed independently by the team responsible for each slice of the schema, with a gateway that composes them instead of holding their logic itself. The fix didn't remove the gateway. It removed the opinions the gateway had accumulated that were never its own to hold.

A single frontend with a genuine deploy cadence that justifies its own shaped API is a legitimate backend-for-frontend, and it should be evaluated, staffed, and owned as its own service rather than folded into "the gateway" as one more route.

### Where Validation Becomes Authorization

Authorization decisions are worse. A gateway can and should verify that a caller's token is authentic. Deciding whether that specific caller may cancel that specific order requires knowing something about the order, the caller's relationship to it, and the business rule governing cancellation, and none of that lives at the edge. A gateway that starts making that call has quietly become the authority the order service should have been, and every request that reaches the order service afterward is trusted because it came through the gateway, not because of anything the order service actually checked.

### Where Plan Tiers Become Route Tables

One version of the authorization mistake is common enough in B2B software to deserve its own name, tenant and feature gating. A gateway holds a table mapping each customer's plan to the routes or features they're allowed to reach and blocks or forwards each request against that table before it ever reaches a domain service.

The defense for this pattern usually arrives as a governance argument rather than a technical one. Centralizing entitlement in the gateway means no team can forget to check it, and one table is easier to keep correct than every domain service rolling its own version of the same check. It's the same reasoning that makes a single source of truth better than duplicated logic, aimed at governance instead of code.

It fails for the same reason gateway-level authorization always fails. Deciding what a tenant is allowed to do requires the tenant's plan, their usage this billing cycle, which objects they own, and which sub-permissions their users hold, all of it domain data the gateway was never meant to carry. But it fails a second way the governance argument tends to skip. Centralizing the check doesn't shrink the audit surface, it doubles it. A route table now claims to represent what each tenant can reach, and a domain service still has to be checked to confirm that no other path, such as an internal call, a batch job, a webhook, or an admin tool, reaches the same capability by a route the table doesn't cover. Proving a route is gated is easy. Proving a capability is unreachable by every other path is the harder audit, and the gateway didn't remove that audit. It added a second table that also has to stay correct.

Whether the gateway forwards or blocks a route is a routing fact, not a security fact, unless the domain enforces the same boundary on its own. If the domain still performs the gated action when called by anything other than the gateway, hiding the route bought the appearance of control and nothing else. The guarantee has to live where the action actually happens, because that's the only place capable of proving it happened correctly.

None of this rules out a coarse check at the gateway. Rejecting a request from a tenant with no active subscription, or blocking writes from a sandbox key, is the same fail-fast optimization as validating a token's signature before it reaches a service. It stops being an optimization the moment a domain service skips its own entitlement check because the gateway already filtered the obvious cases. That's the same mistake as trusting a certificate for permission it never granted, relocated from a single caller to an entire tenant.

### Why the Table Runs Out of Room

Tenant gating also tends to work well enough, for long enough, to convince a team it was the right call. Early entitlement is often genuinely simple. A plan tier maps to a fixed set of endpoints, coarse and static enough that a route table represents it faithfully, and that simplicity is exactly why the pattern looks successful right up until it doesn't.

Entitlement in practice rarely stays that flat. It drifts toward questions a route table can't answer: whether this specific record belongs to this tenant, whether this tenant has crossed a usage threshold this billing cycle, whether the particular user inside the tenant holds the sub-permission the action requires, whether a trial has expired, or whether support granted a manual override. Every one of those is an attribute, not a role, and every one of them lives in data the domain owns, not in a table the gateway maintains.

A gateway trying to answer those questions has two options. It can start reading every domain's data directly, which erases the entire reason to keep business data out of the proxy in the first place. Or it can keep answering with the coarse approximation it already has, which starts locking out customers who should have access, or letting through requests that shouldn't clear.

Either way, the pattern was never a stable answer. It was a temporary one with a bill due later, and the bill includes both the migration back to the domain and every year spent paying the audit tax while the table pretended to be a source of truth.

The choice was never between governance and no governance. It was between governance enforced at a route table that can't see the data the decision requires, and governance enforced at the place already holding that data, with the route table doing nothing more than turning away traffic that was never going to be allowed in regardless.

## What Belongs in the Interior

The same test, applied to what a service mesh actually ships, produces a strikingly similar split, with two features worth more care than a table can show. The features that pass and fail are the same shapes of feature, just facing a different direction.

| Feature | What it does | Belongs in the interior? |
|---|---|---|
| Sidecar injection and traffic interception | Transparently routes a service's traffic through its local proxy | Yes. The enabling mechanism, not a decision in itself. |
| mTLS issuance and rotation | Gives every workload a cryptographic identity and rotates it automatically | Yes, and the strongest case in either technology. Certificate lifecycle needs its own schedule once a fleet outgrows manual rotation. |
| Service discovery and load balancing | Finds a healthy instance of the service being called | Yes. No business content anywhere in the decision. |
| Retries, timeouts, circuit breaking | Handles transient failures between services | Conditional. Safe when calls are idempotent, failures are classified correctly, and backoff is tuned to the dependency; risky otherwise. |
| Traffic shifting and mirroring | Sends a percentage of traffic to a new version, or a copy to a shadow deployment | Yes. A deployment mechanic, not a business one. |
| Fault injection | Deliberately breaks calls to test resilience | Yes. Testing infrastructure. |
| Golden-signal telemetry and tracing | Auto-generates latency, traffic, error rate, and span data | Yes, as a transport-layer signal. It cannot tell a correctly declined payment from a genuinely broken dependency, so it's a health signal for the network, not a substitute for a service's own error classification. |
| Fine-grained authorization policy | Decides which service may call which path or method on another service | Conditional. |

### Where a Retry Becomes a Second Charge

The act of resending a request is exactly as mechanical as everything else on this list. Whether resending it is safe is a different question, and it isn't a mechanical one.

A mesh retries a call the same way it retries any other. The first attempt times out or drops, so it fires the request again. From where the mesh sits, a timeout only means the response didn't arrive. It has no way to know whether the original request actually reached the far side, processed successfully, and simply lost the response on the way back. If the operation was charging a card or deducting inventory, and the service on the other end wasn't built to treat a repeated request as a no-op, the retry doesn't recover from a failure. It repeats a side effect that already happened, and the customer sees two charges for one order.

A second, quieter harm shows up when nothing about the call is wrong except its timing. A dependency slows down under load, the calling service retries because it has its own retry logic, and a mesh sidecar in front of that service retries again on top, unaware the call above it is already retrying. The dependency now receives multiples of the traffic that was already too much for it, and retries that were supposed to ride out a blip compound it into an outage instead. Backoff and circuit breakers exist to prevent exactly this, slowing the rate of retries and eventually cutting them off, but getting the backoff curve and the breaker's threshold right requires knowing the dependency, how expensive a retry actually is, how much load it can absorb before degrading further, context a mesh's default policy doesn't have. Set generically, the same policy meant to protect a fragile dependency ends up amplifying the exact failure it was supposed to contain.

This is the authorization mistake wearing a different uniform. A mesh can answer whether a connection is safe to retry. It cannot answer whether the operation behind that connection is safe to repeat, and the two questions are not the same. Retry-safety at the transport layer means the bytes can be resent without breaking the connection. Retry-safety at the operation layer means the underlying action can be repeated without changing the outcome, and that second guarantee depends entirely on whether the domain service was built with idempotency in mind, an idempotency key, a conditional write, or a check for an operation that already completed. A mesh has no visibility into any of that, and nothing in its job ever asked it to check.

None of this argues against retry policies at the mesh layer. A retry that's safe to fire blindly is a mechanical concern in exactly the sense the rest of this post uses the word, and centralizing the policy (how many attempts, what backoff, which status codes qualify) is a legitimate reason to keep it out of every service's application code. What has to stay at the service is the guarantee that makes a retry safe to fire blindly in the first place, and the context that makes a backoff curve protective instead of amplifying. A mesh configured to retry aggressively, next to services that were never built to be called twice for the same request, isn't a resilience feature. It's a mechanism for turning a slow response into a duplicate charge.

### Where Every Error Looks the Same

A circuit breaker decides whether to keep calling a dependency by counting failures, and the counting is where a second, quieter mistake creeps in. Something has to decide which responses actually count as failures, and that decision requires the same classification a service's own error handling depends on elsewhere. Telling an expected outcome apart from an unexpected one is exactly that classification. A validation rejection or a declined request is the dependency working correctly. A timeout or a genuine dependency error is not. A circuit breaker that can't tell these apart counts a burst of ordinary bad input the same as a burst of real outages, and trips on customers who did nothing wrong.

This isn't a mechanics problem. It's an authoring problem. Whether a given response represents a business rejection or an actual failure has to be classified at the source, in the status codes and error shapes the service itself returns, before anything downstream can count correctly. A proxy can mechanically apply a threshold, so many failures in so many seconds trips the breaker, but it can only count what already arrived correctly classified. Get that classification wrong at the service, and no amount of threshold tuning downstream fixes it. The breaker keeps tripping on the wrong signal.

### Where a Certificate Stops Being Permission

A mesh authorization policy that says "service A may reach service B at all" is coarse network hygiene, a defensible layer on top of whatever the services themselves enforce. The failure appears when a team treats that policy as the actual authorization mechanism and lets the receiving service skip its own check because the caller already presented a valid mesh certificate. A certificate proves the caller is a specific authenticated workload. It says nothing about whether that workload is allowed to perform this particular operation on this particular piece of data. Those are different questions, and a mesh only answers the first one.

### Where Traffic Shifting Becomes a Segment

Traffic shifting passes the mechanical test the way the interior table describes it. Sending five percent of requests to a canary and the rest to the stable version has no opinion about who's making the request, only about what fraction of requests go where.

That stops being true the moment the criteria for the split change from a percentage to a segment. A team that routes enterprise accounts to the stable version and free-tier accounts to the canary, so that a regression lands on customers who generate the least support cost if something breaks, is no longer shifting traffic. It's deciding who gets the stable product and who gets the experiment, based on what kind of customer each caller is. The routing rule looks identical to the percentage-based version in the mesh's configuration. Both are a weighted list of destinations. But one of them encodes a business judgment about which customers can absorb risk, and that judgment belongs to whoever owns the product decision, not to whoever owns the mesh's traffic-splitting policy.

The same drift that turned a route table into an authorization system turns a canary into a segmentation engine. Nothing about the interception point changed. What changed is which attribute the routing decision reads, a random percentage in one case and a customer's plan tier in the other, and only one of those is a fact the proxy is equipped to act on without borrowing a decision that belongs to the domain.

## The Mistake Both Proxies Invite

Every feature that failed the test above failed the same way. Something that only proves a caller made it through a checkpoint got treated as proof that the caller is allowed to do what it's asking to do. That isn't a gateway problem or a mesh problem. It's what happens whenever a proxy sits in a privileged position in the request path long enough that the services behind it stop checking for themselves.

### Clearance Is Not Need-to-Know

A security clearance tells you someone has been vetted to handle information at a certain sensitivity level. It doesn't tell you they should see this specific document. Every access still requires a demonstrable reason, checked separately from the clearance. A gateway's token validation and a mesh's mTLS certificate are both clearances. They prove that a caller is a known, authenticated party, and nothing more specific than that. Need-to-know, whether this specific caller may perform this specific operation on this specific resource, is a different question, and only the service that owns the resource can answer it, because only that service knows what the resource is and what governs access to it.

### The Same Mistake, Two Addresses

At the edge, the mistake looks like a gateway that validated a token and forwarded the request, after which every internal service assumes anything that already made it past the gateway must be legitimate. In the interior, the mistake looks like a service that sees a valid mTLS certificate and assumes anything holding a certificate from the mesh's own certificate authority must be trustworthy. Both are the same mistake, mistaking proof of identity for proof of permission. A compromised service with a valid certificate can call anything the mesh's coarse policy allows. A forged or stolen token that clears gateway validation can reach anything the gateway routes to. Neither proxy can prevent this alone, because neither one holds the domain knowledge required to tell a legitimate request from an illegitimate one wearing legitimate clothing. Only the service being called holds that knowledge, which is exactly why the check still has to happen there, no matter how much verification already happened upstream.

### The Policy Engine Doesn't Change What's Missing

Both proxies now ship a more sophisticated version of the same mistake, wearing the language of a solution rather than a shortcut. Envoy's `ext_authz` filter, Open Policy Agent's Rego language, and Cedar-based systems like AWS Verified Permissions let a gateway or a mesh sidecar evaluate a policy written against arbitrary request attributes before deciding whether to forward a call. Istio's `AuthorizationPolicy` resource does the same thing natively, with conditions written against headers, claims, or source identity. On paper, this looks like exactly the fix the earlier sections call for. The proxy is no longer guessing with a coarse role check. It's evaluating a real rule.

The rule still doesn't live where the data does. A Rego policy deciding whether a tenant can reach an endpoint reads attributes the request already carries, like a claim in a token or a header set upstream. It still can't see the tenant's current usage, which sub-permission a specific user holds, or whether support issued a manual override, the same domain state a route table can't see either. Moving the decision from a static table to a policy language changes how expressive the rule can be. It doesn't change where the rule's authority comes from. The policy file still deploys on its own schedule, reviewed by whoever owns the gateway or mesh configuration rather than whoever owns the domain the policy is making decisions about.

The redundancy test applies here exactly as it does to a coarse role check. A policy that rejects a request the domain service would also reject is a cache of that verdict, and a legitimate fail-fast optimization. A policy that rejects a request the domain service was never asked to evaluate, because the team trusted the policy engine to be the only check, has become the authority the domain was supposed to be. Sophistication in the policy language doesn't change which side of that line a given check falls on. It just makes the check harder to notice, since a hundred-line Rego file reads like careful engineering in a way a route table never did.

### Capabilities Don't Stay Where They Started

Every drift this post has traced shares a shape: aggregation into presentation logic, token validation into the whole authorization system, a retry into a duplicate charge, a route table into an unaudited entitlement system, a canary into a segmentation engine. A capability passes the mechanical and independent-need test at the moment it's adopted, and nothing about adopting it changes later. What changes is the criteria feeding it, one attribute at a time, until the same feature that was mechanical on day one is making a business call by year three without anyone deciding it should.

That drift never triggers a new adoption conversation, because nobody re-adds the feature. A team just reconfigures a policy that already exists, adds one more condition to a Rego file, or teaches the canary split to read a plan tier instead of a random number. Each individual change looks like configuration, not a decision to hand the proxy new authority, so it clears whatever review a genuine adoption would have required. The test in this post answers whether a capability belongs at the proxy the day someone asks the question. It has nothing to say about a capability nobody asked about again for three years.

The fix isn't a stronger initial test. It's treating the test as something a capability has to keep passing, not something it passes once. A quarterly pass through what a gateway's routes and a mesh's policies are actually keying on, not what they were designed to key on, catches the same drift the removal test catches at adoption time, applied to configuration that already shipped instead of a capability still under debate.

## When the Investment Pays Off

Everything above assumes the capability itself has a legitimate reason to exist. That's a separate question from whether it belongs at the proxy, and skipping it is its own way to misuse one.

A capability earns a place in a gateway or a mesh when it serves a named architectural characteristic, like security, deployability, cost, or time to market, that the system is actually optimizing for today, not one it might need someday. A small team with no compliance mandate and no external partner program adopting mesh-wide mTLS or gateway-level rate limiting anyway pays a sidecar tax, a control plane, and more on-call surface for a priority that was never on the list. That tax isn't hypothetical. Sidecar resource overhead, multiplied across every pod in a fleet, was significant enough that Istio's own project built an entirely different architecture, ambient mode, specifically to remove it, after enough cost-conscious teams held off adopting a mesh at all because of it. The overhead was significant enough to justify a second architecture. It's significant enough to name as a cost before adopting the first one.

Getting this wrong doesn't just waste budget. A capability adopted because the pattern looked standard, not because a named characteristic demanded it, still lives in the same shared config as everything else, still drifts the same way toward deciding things on the domain's behalf, and still needs the same vigilance, the removal test, the redundancy test, the periodic recheck, to keep it honest. None of that work buys anything back if the capability was never solving a problem this system actually had. Skip the justification step, and the proxy still needs watching. You just lose the payoff that would have made the watching worth it.

## Evaluate the Capability, Not the Category

The next time an adoption conversation starts with "should we add a gateway" or "should we add a mesh," break it apart before answering:

- List the specific capabilities under consideration, not the product name
- For each one, name which of your system's top architectural characteristics it actually serves today, not which one it could theoretically help someday
- For each one, check whether it makes a business decision or only moves bytes
- For each one, check whether it needs to scale, fail, or change on a schedule the surrounding services don't share
- Remove it on paper and check whether a service loses a convenience or loses its ability to judge its own callers
- Wherever the proxy verifies a caller's identity, confirm the service on the other end still checks what that caller is allowed to do, rather than trusting that the checkpoint already handled it
- Wherever the proxy filters or rejects on a rule, whether a route table, a Rego policy, or a segmentation condition, confirm the domain would reach the same verdict on its own. If it wouldn't, the rule has become the authority, not a cache of one
- Revisit capabilities that already passed this test on a recurring schedule, since a reconfigured policy or a redefined routing criterion can turn a mechanical capability into a domain decision without ever triggering a new adoption conversation
