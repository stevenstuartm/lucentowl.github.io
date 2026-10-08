---
layout: post
title: "Auth Sessions Should Never Cross Internal Boundaries"
date: 2025-10-10
description: "A user's session token should be validated and consumed at the system's edge, then replaced with signed, request-bound internal context and service credentials. Forwarding the token inward couples internal services to the external auth mechanism, spreads a replayable credential, and breaks when work runs after the session or without one."
tags: [security, architecture, authentication, distributed-systems, event-driven]
author: steven-stuart
sources:
  - title: "Netflix Technology Blog: Edge Authentication and Token-Agnostic Identity Propagation"
    url: "https://netflixtechblog.com/edge-authentication-and-token-agnostic-identity-propagation-514e47e0b602"
  - title: "RFC 8693: OAuth 2.0 Token Exchange"
    url: "https://datatracker.ietf.org/doc/html/rfc8693"
  - title: "RFC 7662: OAuth 2.0 Token Introspection"
    url: "https://datatracker.ietf.org/doc/html/rfc7662"
  - title: "RFC 9700: Best Current Practice for OAuth 2.0 Security"
    url: "https://datatracker.ietf.org/doc/html/rfc9700"
  - title: "45 CFR 164.312: HIPAA Security Rule Technical Safeguards"
    url: "https://www.law.cornell.edu/cfr/text/45/164.312"
  - title: "NIST SP 800-207: Zero Trust Architecture"
    url: "https://csrc.nist.gov/pubs/sp/800/207/final"
---

It is tempting to treat user authentication sessions as ambient context. You pass them through API layers, into service calls, across event processors, and through background jobs. If a component needs to know who the user is, it needs the user's session, right?

<blockquote class="pull-quote">
<p>This conflates authentication with context. You're treating an external trust artifact as internal state.</p>
</blockquote>

The result is coupling, a dependency on the auth server at every hop, and systems that break in asynchronous scenarios, event-driven architectures, and integration patterns.

## Sessions Validate at Boundaries, Context Flows Internally

"Session" here means whatever the client presents to prove who the user is, whether that's a cookie bound to a server-side session or a bearer access token such as a JWT. The arguments below apply to both, and where they differ, the post says which one it means.

Authentication sessions serve one purpose: validating identity at a security boundary. Once validated, the session should be consumed and replaced with explicit context and service credentials.

A user session arrives at the boundary: an API endpoint, gateway, or edge function. The boundary validates the session and confirms identity. The session is then consumed. You extract only the necessary context: user_id, tenant_id, correlation_id, a non-secret session id, and, when a client acts for the user, the client's identity and the scopes the user granted it. From that point forward, internal operations use service roles. Components operate with service credentials like database connections, API keys, and queue permissions. User context is passed explicitly as structured data, not as the original session token.

Explicit doesn't mean unprotected. A downstream service can't accept a bare user_id from anyone who sends one, or any caller could claim to be any user. The context has to arrive in a form the receiver can trust, which means a small object the boundary signs. An authenticated service-to-service channel isn't enough on its own, because it proves which service is calling but not which user that service is acting for, so a compromised caller could assert any user_id it liked. Netflix describes this design in its "Edge Authentication and Token-Agnostic Identity Propagation" post. Its edge services validate the many token types clients present and mint an integrity-protected identity object, called a Passport, which is what downstream services receive.

A signed context object is still a credential, so it needs the limits the post asks of tokens. It's accepted only inside your trust domain and never by an external API, it's bound to one request or one message rather than to the user's login through a short expiry, an audience claim that limits it to your internal services, and a request or message id, and it carries only the fields the work needs. Only the boundary holds the signing key, so a compromised internal service can read the context it was given but can't mint one for a different user. Like Netflix's Passport, the same context is passed along the whole call chain rather than re-signed for each hop, so no hop depends on a central signer. Within its short validity window, a service in the call path could still replay the context to another internal service, which is the same exposure a forwarded token has. What's gone is the external replay. No API outside your system accepts it, and it doesn't outlive the request.

The granted scopes matter. A third-party app that holds only read access to a user's orders must not gain everything the user can do once its token is converted at the edge, so downstream authorization allows an action only when the user's current permissions and the client's granted scopes both permit it.

The session's job ends at the boundary. Everything beyond that point operates within your system's trust domain using service-level credentials and explicit context propagation.

That sets the line the title draws. Whatever travels inward must be issued inside your trust domain, accepted by no external API, and bound to one request or message. A gateway that exchanges the user's token for an internally issued, internally audienced one, using OAuth 2.0 Token Exchange (RFC 8693), meets that line. Forwarding the token the client presented does not. Per-hop delegation from the external identity provider, where each service trades for a new token audienced to the next one, answers the replay concern but not this line. Every hop then calls the provider at runtime and parses its token format, while a boundary-signed context is verified locally with a key you own.

## Why Sessions Don't Belong in Internal Flows

**Sessions are external trust artifacts.** A user session token represents authentication with an external identity provider or your auth system. It's proof that someone outside your system is who they claim to be. Once verified at your boundary, propagating it further treats authentication as global state rather than a specific validation event.

**Repeated validation adds a runtime dependency on the auth server.** Every component that receives a user session has to validate it. For a self-contained token like a JWT, that's a local signature and expiry check, and verifying a boundary-signed context costs about the same, so the saving there is small. For opaque tokens and server-side sessions, validation means a call to the auth server, such as the introspection endpoint defined in RFC 7662. Each hop then adds a network round trip and makes the auth server's availability a condition of every internal call for a single user action.

**Coupling to external authentication.** When internal components accept user sessions, they become coupled to the token format, the issuer's validation requirements, token refresh logic, and external auth provider availability. With one standard OIDC issuer and a shared validation library, switching issuers can be mostly configuration. The coupling shows when the estate isn't that tidy, with several client token types, a proprietary session format, or a migration between them, and every component that parses sessions has to change with it. Netflix's Passport work was a response to exactly that variety. A boundary-signed context still needs a shared format and key distribution, but that format is yours and doesn't change when the external issuer does.

**Forwarding only on synchronous calls keeps the external token inside.** The strongest version of the opposing view forwards a short-lived, audience-restricted token down synchronous call chains and uses explicit context only for async work. Its async half is this post's design. Its sync half still carries the external artifact, so it keeps the coupling above, and widening the token's audience to cover the internal services, which RFC 9700 permits for a small set of resource servers, brings back the replay exposure described under the privilege-escalation objection below. For a system with two or three services and one issuer, the gateway signing a short-lived internal token with a standard JWT library keeps the cost of the boundary pattern to one key to manage.

## Session Propagation Breaks When Work Outlives the Request

Propagating user sessions through internal components creates predictable failures whenever work outlives the request or has no user behind it. These failures are aimed at forwarding tokens into async work, and the synchronous-only variant is answered above.

**Session expiration mid-flow** is the first to appear. Event processors run minutes later and the session has expired. Background jobs run hours later and the session is gone. Async processors retry and the session is invalid. You build workarounds: token refresh in queues, session persistence in metadata, special "system sessions" for background work.

**Missing sessions entirely** breaks your logic. Scheduled reports run at 3 AM with no user logged in. Webhooks arrive from external systems with no user session. System maintenance tasks have no user context. You duplicate logic: one path for user requests and one for non-user operations.

**Context across time and actors** fragments workflows. Multi-step workflows span hours. The original user's session expires. Different actors have different sessions. Background processors have none. The workflow breaks without explicit context that persists beyond the session lifetime.

Storing context as data, which the boundary pattern makes the default, removes all three. The service that owns a workflow stores the original context with the workflow's own record, as data about who started it, and each later step or retry works from that record rather than from a credential that expires. When a later step calls another service, the workflow service calls as itself and passes the initiating user_id as data. The receiver checks that this service is allowed to request this action for this tenant, then checks the user's current permissions. A scheduled job or a webhook handler works the same way, with its own service identity and no user at all.

Async work has a limit here. Nothing in this path ties the user_id to a workflow that user started, so a compromised workflow service can act for any user in the tenants it serves, through the operations its own service identity is allowed. That is the same trust any background job carries, and it's why each service's identity should be allowed only the operations that service performs.

Pair the pattern with one rule. Every step authorizes against the user's current permissions and account status when it runs, so a user whose access was removed, or whose session was revoked after a compromise, is refused even hours later. The rule is independent of the token question, and a design that forwards tokens could adopt it too. The context carries identity and the client's scope ceiling, not the user's roles, so with this pattern a step has to look up permissions to decide anything. That lookup reads your own permission data, which the service already depends on to do the work, rather than making the external auth server a condition of every hop.

## Common Objections

### "We Lose User Context for Auditing"

You lose the session token, not the user context. Proper auditing requires intentional context capture: user_id, tenant_id, correlation_id, source_ip, user_agent, and timestamp.

The identity fields travel in the signed context through every component. Request details like source_ip and user_agent are logged once at the boundary and joined to downstream records by correlation_id, so no internal service can forge them. Relying on session tokens for auditing is worse because sessions don't persist for audit trails, you're logging authentication artifacts instead of business context, and different components might parse tokens differently.

Intentional data flow is the point. If you need user_id in audit logs, require it as an explicit parameter. This forces you to think about what context crosses boundaries and prevents accidental omissions.

### "Compliance Requires User Identity Throughout the System"

Compliance rules ask you to authenticate who is acting and to record what they did. The HIPAA Security Rule, for example, requires verifying that a person seeking access is the one claimed (45 CFR 164.312(d)) and mechanisms that record and examine activity in systems holding health data (164.312(b)). Authentication happens at the boundary. Recording happens wherever the action happens, and a trusted user_id in explicit context is what that record needs. Passing the session token does not improve compliance. It couples your compliance logging to your auth mechanism.

### "Service Roles Create Privilege Escalation Risks"

The risk is that a service with broad credentials can be tricked or compromised into acting outside the current user's rights. Forwarding the user's token limits that risk only for calls to other services. On the request path, a boundary-signed context protects those calls equally, since a compromised service can't mint context for another user. Async steps rest on the calling service's own identity, with the limit described above. For the service's own resources, the token changes nothing. A compromised service with a database connection that reads every tenant's rows can read them whether or not it holds a user token, unless the database itself enforces the user's identity.

Service roles provide technical capability like database access and API credentials. Business logic enforces authorization through grant checks, tenant isolation, and permission verification, and where a breach would be severe, the data layer can enforce tenant isolation too, for example with row-level security keyed to the tenant in the context. These checks are necessary whether you use service roles or propagate user sessions. Scope each service's credentials to what that service does, so a compromise is limited to one service's capability.

A forwarded session adds its own risk. A bearer token works for anyone who holds it, so every internal component that receives the user's token can replay it as that user anywhere the token is accepted. That's why RFC 9700, the OAuth 2.0 security best practice, says access tokens should be audience-restricted to a specific resource server. A token restricted to your API shouldn't be accepted by every service behind it, and one that is has become a credential your whole system leaks.

Service roles also make the split clearer. The service has technical capability but requires explicit business authorization. User sessions blur this distinction by suggesting the session itself grants permission.

### "Zero Trust Means Every Service Verifies the User"

Zero trust doesn't ask for the user's original token at every hop. NIST SP 800-207 requires that authentication and authorization are enforced before every access to a resource, rather than inherited from network location or an earlier step. A downstream service that verifies its caller's service identity and the signature on the user context, then authorizes the action against that context, meets the requirement. Forwarding the session meets it no better and spreads a replayable credential.

The legitimate exception is a component that must call another system as the user, such as a third-party API that only accepts the user's delegated token. Even then the original session doesn't travel. OAuth 2.0 Token Exchange (RFC 8693) lets the component trade for a new token issued for that one audience, scoped to that call.

### "We Need Sessions for Distributed Tracing"

You need correlation IDs for distributed tracing, not session tokens.

Distributed systems require explicit tracing infrastructure: correlation_id, trace_id, span_id, and timestamps. This works for all request types including user requests, background jobs, webhooks, internal system tasks, lambda invocations, and event processors.

If you rely on session tokens for tracing, non-user-initiated requests fail. When you need to join traces to a login session, the non-secret session id in the context does that without carrying the token.

### "We're Using a Monolith, This Doesn't Apply"

Inside one process there's no token crossing a network and nothing to replay, so the security arguments above weigh less. Most web frameworks already apply the boundary rule for you, since their request principal holds a validated identity rather than the raw token. What remains is where business logic gets that identity. You still must avoid global user session context and pass user context within structures appropriate to the needs of each module.

Business logic that reads the current user from the web request couples your service layer to your web layer. A background job, CLI tool, or internal script that calls the same logic has no web request, so it either fails the way a missing session fails or has to fake a request principal first. Logic that takes the user as a parameter can be called from any of them as it stands.

The same principles apply: modules accept explicit context and perform explicit authorization. Whether those modules are in separate processes or the same codebase is irrelevant to that design.

## Respect the Boundary

User authentication sessions serve one purpose: validating identity at a security boundary. Once validated, the session has done its job.

At the boundary:
- Validate the session once, and let no component behind it parse the token
- Extract only the context the work needs, such as user_id, tenant_id, correlation_id, and the calling client's granted scopes
- Sign that context at the boundary, bind it to one request or message, and send it over authenticated service calls
- Give each service its own narrowly scoped credentials
- Authorize every action against current permissions, account status, and the client's granted scopes, whether a user, a webhook, or a scheduled job started it
- When a component must act as the user elsewhere, exchange for a new token scoped to that call

<blockquote class="pull-quote">
<p>This isn't about microservices versus monoliths. It's about recognizing architectural boundaries and respecting them. Authentication artifacts belong at boundaries, not in internal flows.</p>
</blockquote>
