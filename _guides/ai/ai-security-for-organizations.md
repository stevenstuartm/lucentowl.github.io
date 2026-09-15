---
title: "AI Security for Organizations"
layout: guide
category: AI & Machine Learning
subcategory: AI in Engineering Practice
description: "Operational security for organizations whose developers use AI tools daily, covering data classification, how data reaches AI tools without anyone deciding it should, what providers actually retain, tool governance, network and identity controls, and calibrating the risk."
tags: [security, governance, dlp, data-classification, shadow-ai, risk-management, practical]
---

Developers already use AI tools every day for writing code, debugging, reviewing, and documenting. For a security team, prohibition is rarely a live option, and attempting it mostly moves usage somewhere unmonitored. The work that remains is managing the data flow those tools create.

This guide covers the operational side, meaning the policies, controls, and architectural decisions that protect an organization when AI tools are part of the daily workflow. It is written for security administrators and engineering leadership. Attacks against models themselves, such as data poisoning, model inversion, and adversarial examples, are covered in [Emerging Technologies Security](/study-guides/security/emerging-technologies.html).

## Start with What Data May Go Where

Every other AI policy depends on one decision: which data is permissible as input to which kind of tool. Map the organization's existing classification tiers to tool permissions rather than inventing a new scheme.

| Classification | Typical contents | Permitted AI input |
|---|---|---|
| **Public** | Open-source code, public documentation | Any tool, any tier |
| **Internal** | Proprietary source code, internal documentation, architecture diagrams | Commercial-tier tools under a data processing agreement |
| **Confidential** | Customer PII, financial data, credentials, security configuration | Self-hosted models, or prohibited |
| **Restricted** | Regulated data such as HIPAA and PCI-DSS scope, trade secrets, encryption keys | Prohibited, or only under an arrangement specifically approved for that regulation |

Two tests make the table usable in the moment. If you would not paste it into a public forum, it does not go into a consumer-tier tool. If you would not email it to a vendor, it does not go into any cloud-hosted tool, whatever the tier.

Classification only works when it is concrete enough to apply without asking. "Don't share sensitive data" gives a developer nothing to act on. Connection strings are confidential. Production stack traces may carry session tokens, so they are confidential too. Internal API schemas are internal. Public library documentation is public. Publish examples like these alongside the tiers.

---

## How Data Reaches AI Tools Without Anyone Deciding It Should

Most exposure through AI tools is a side effect of ordinary work. Developers are trying to fix a bug or ship a feature, and the data goes along because of how the tools gather context. Controls work best when they target the specific pathways rather than the user's intent.

### Secrets Pasted Into Prompts

A developer hits an authentication error and pastes the full output into a chat tool. The output contains a connection string, an API key, or a bearer token, and the developer is looking at the error, not the credential inside it. The same thing happens when someone asks for a Terraform configuration or a Kubernetes manifest and supplies real production values as context.

**Control:** DLP inspection of outbound traffic to AI provider endpoints, matching known credential formats. Secret scanning on the repositories those values came from catches the ones that were already committed.

### Files the Tool Reads on Its Own

IDE-integrated assistants read surrounding files to produce better suggestions, and chat features index repository content to answer questions. A `.env` file, an `appsettings.json` with real values, or Terraform with hardcoded secrets can reach the provider without the developer ever sharing it explicitly.

**Control:** Keep credentials in a secret manager rather than in workspace files, which removes the problem at its source. Content exclusion rules in the tool reduce it further, but verify their coverage before relying on them. GitHub Copilot's [content exclusion](https://docs.github.com/en/copilot/how-tos/configure-content-exclusion/exclude-content-from-copilot){:target="_blank" rel="noopener noreferrer"}, configurable per repository, organization, or enterprise, does not apply to agent mode in Copilot Chat in IDEs, and changes can take up to 30 minutes to reach the editor. An exclusion that silently does not cover the agentic workflows is exactly the one developers are moving to.

### Notebook Output Cells

Notebooks keep their outputs, and those outputs routinely hold query results with customer PII, sample rows from production tables, or API responses with authentication headers visible. An AI tool processing the notebook sees the outputs along with the code.

**Control:** Strip outputs before committing, enforced through repository hooks or filters rather than habit, and clear sensitive outputs before asking for assistance.

### Logs and Pasted Output in the Workspace

Log files dumped into a project directory for debugging become context for any tool that indexes the workspace. Production logs commonly carry session identifiers, internal addresses, and sometimes full request and response bodies. The same happens when a developer copies a stack trace from a monitoring tool into a scratch file in the editor to read it more comfortably.

**Control:** Exclude log patterns in `.gitignore` templates and in the AI tool's exclusion rules. Where the monitoring data is especially sensitive, browser isolation or endpoint DLP on copy operations from those tools closes the clipboard route, and training that describes this specific workflow does more than a general warning.

---

## What the Provider Actually Keeps

The consumer and commercial tiers of the same product can differ more in data handling than in features, and this is the axis most organizations under-examine. Terms change often, so treat the specifics below as a snapshot to verify against each vendor's current terms, not as settled policy.

| | Consumer and individual plans | Commercial and business plans |
|---|---|---|
| **Training on your inputs** | Varies by vendor; often governed by a user-level setting | Contractually excluded by the major vendors |
| **Retention** | Conversation history persists until deleted, and longer where the user allowed training | Short default windows, with zero-retention arrangements available by agreement |
| **Identity** | Personal accounts | SSO through the corporate identity provider |
| **Audit** | None or minimal | Usage logs and admin dashboards |
| **Contractual protection** | Consumer terms | Data processing agreements, breach notification obligations |

The per-vendor details are where the useful answers live, and where most generalizations turn out to be wrong:

| Vendor and plan | Training | Default retention | Notable carve-outs |
|---|---|---|---|
| **OpenAI API** | Not used for training unless you opt in | Abuse monitoring logs up to 30 days | Stateful endpoints such as conversations and assistants retain until deleted; zero data retention for approved customers |
| **Anthropic API** | Never used for training without express permission | Inputs and outputs deleted within 30 days | Flagged content retained up to 2 years even under zero retention; zero retention excludes stateful features like batch jobs, files, and code execution |
| **Anthropic consumer plans** | Only if the user opts in | 30 days if not opted in; 5 years if opted in | Commercial plans and API use are not affected by this setting |
| **GitHub Copilot Business and Enterprise** | Not used to train models | Zero data retention agreements with OpenAI and Anthropic for generally available features | Individual plans are handled differently |
| **GitHub Copilot individual plans** | Interaction data may be used for training | Per GitHub's general privacy statement | Users can opt out of training |

Sources, checked September 2026: OpenAI's [API data usage guide](https://developers.openai.com/api/docs/guides/your-data){:target="_blank" rel="noopener noreferrer"}, Anthropic's [API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention){:target="_blank" rel="noopener noreferrer"} and [consumer terms update](https://www.anthropic.com/news/updates-to-our-consumer-terms){:target="_blank" rel="noopener noreferrer"}, and GitHub's [Copilot model hosting](https://docs.github.com/en/copilot/reference/ai-models/model-hosting){:target="_blank" rel="noopener noreferrer"} documentation.

Three patterns in that table generalize beyond these vendors. Zero data retention is an arrangement you request and get approved for, not a default. Every zero-retention arrangement has exclusions, usually for features that are stateful by design and for content flagged by trust and safety systems. And when a model is consumed through a cloud platform such as Amazon Bedrock or Google Cloud, the cloud provider is typically the data processor, so its terms apply rather than the model developer's.

---

## Tool Governance

### Make the Approved Path the Easy One

Shadow AI, meaning developers using tools the organization has not sanctioned, is the highest-risk pattern because it bypasses every control at once. There is no data agreement, no audit log, no SSO, and often a consumer-tier training setting nobody checked.

Punishment does not fix it, and usually drives it further out of sight. Shadow AI is a symptom of an approved path that is slow to provision, hard to reach, or noticeably less capable than what a developer can get with a personal credit card. Maintain an explicit registry of sanctioned tools with their approved uses and tiers, and measure how long access takes to grant. That number predicts shadow usage better than any policy document.

### Evaluating a New Tool

| Criterion | What to establish |
|---|---|
| **Training** | Whether inputs are excluded by default, by setting, or only by contract |
| **Retention** | The default window, the carve-outs, and whether deletion can be requested |
| **Residency** | Where prompts and responses are processed and stored, and under which jurisdiction |
| **Data processor** | Whether the tool vendor, the model developer, or a cloud platform processes the data |
| **Attestations** | SOC 2 Type II, ISO 27001, and any sector-specific commitments such as a HIPAA BAA or FedRAMP |
| **Identity** | SSO support through your identity provider |
| **Audit** | Whether you can see who used it, when, how much, and which features |
| **Exclusion controls** | Whether sensitive paths can be excluded, and which modes the exclusion actually covers |
| **Traffic path** | Whether it runs through infrastructure you can inspect, or pins certificates and bypasses it |

---

## Network Controls

### What Existing Proxies Already Cover

Organizations running TLS-inspecting forward proxies such as Zscaler, Netskope, or Palo Alto Prisma already have the infrastructure to monitor AI tool traffic. From the proxy's perspective, a request to an AI provider's API is one more HTTPS call to a SaaS endpoint.

```
Developer Workstation          Corporate Proxy / DLP          AI Provider
┌───────────────────┐         ┌─────────────────────┐        ┌──────────┐
│                   │  HTTPS  │                     │ HTTPS  │          │
│  AI Tool / IDE    │────────►│  TLS Inspection     │───────►│  LLM API │
│                   │         │  DLP Pattern Match  │        │          │
│                   │◄────────│  URL Categorization │◄───────│          │
│                   │         │  Logging            │        │          │
└───────────────────┘         └─────────────────────┘        └──────────┘
                                       │
                                       ▼
                              Alert / Block / Log
```

The proxy terminates TLS, inspects the payload, and re-encrypts before forwarding. That means it can see the full request, including prompts and any file contents or tool results the tool attached. Without TLS inspection, visibility stops at the destination hostname.

### DLP Patterns for AI Traffic

Enterprise proxy DLP engines can inspect the JSON payloads of AI API calls and flag or block requests containing recognizable sensitive formats:

- AWS access key IDs beginning with `AKIA`
- Azure Storage connection strings, which contain `DefaultEndpointsProtocol`
- PEM private key headers of the form `-----BEGIN ... PRIVATE KEY-----`
- JWTs, recognizable as three base64url segments separated by dots
- Payment card numbers, national identifiers, and other PII patterns
- Organization-specific markers such as internal project codenames and classification labels

The gap is usually configuration rather than capability. DLP rules tend to be tuned for email and file sharing, not API calls. The practical work is defining a URL category for AI endpoints, many proxy vendors ship one pre-built, and applying stricter inspection to that category, or blocking it from devices that are not managed.

### Where Network Controls Fall Short

Network inspection has three blind spots, and each needs a control elsewhere.

**Certificate pinning.** Some desktop applications and IDE plugins pin certificates, which defeats TLS inspection. The choice is between blocking the application and relying on endpoint controls.

**Traffic that never touches the proxy.** A personal hotspot or a personal VPN routes around it entirely. Endpoint controls and device compliance requirements fill this gap, not the network.

**Local models.** Models run on the developer's machine never generate network traffic. Data stays on the endpoint, which may suit the threat model, but it is also outside organizational visibility and governance.

---

## Identity and Audit

AI tools belong behind the organization's identity provider under the same conditional access policies as any other SaaS application. Require SSO with no personal accounts for work use, enforce MFA, and apply device compliance and session limits.

These matter more for AI tools than for a typical SaaS application, because conversation history accumulates sensitive context over time. A compromised account exposes every secret its owner ever pasted, going back as far as the history retains. Scope features by team or repository where the tool supports it, so that access to the most sensitive codebases is a deliberate grant.

Route usage logs to the SIEM. At minimum, capture the user identity, timestamps, request and token volume, and which features were used, such as chat, completion, or agent mode. Logging full prompt content is usually neither feasible nor desirable, given privacy obligations and storage volume, but metadata is enough to detect anomalies and support an investigation.

---

## Gating AI-Generated Code

Generated code enters the codebase through the same pipeline as everything else, and it should meet the same gates without exception. Treat the organizational requirement as a policy question, and leave the individual review technique to the developers doing the work.

The gates that matter at the organization level are the ones that run regardless of who or what wrote the code. Static analysis with tools such as Semgrep, CodeQL, or SonarQube runs on every pull request. Dynamic scanning covers the paths generated code introduces. License scanning catches reproduced open-source code with obligations attached, which is a legal exposure as much as a security one. Dependency controls verify that newly added packages exist and are approved, since models suggest package names that do not exist and attackers register them.

Accountability belongs in the policy explicitly. The developer who commits generated code owns it, including its vulnerabilities and licensing, exactly as if they had written it.

---

## Writing the Acceptable Use Policy

An acceptable use policy for AI tools needs to address a small set of elements. Each one exists because its absence produces a predictable problem.

**Classification boundaries**, with concrete examples of which data may go into which tier of tool. Without examples, developers guess.

**The approved tool list and how to request additions**, with a stated turnaround. Without a fast path, the request becomes a personal subscription.

**Review and ownership requirements** for generated code. Without them, "the AI wrote it" becomes an accepted explanation for a defect.

**Incident reporting** for accidental exposure, made explicitly safe to use. A developer who pastes a credential into a consumer tool and reports it within the hour allows a rotation. One who fears the consequences stays quiet.

**A learning-first stance on consequences.** Punitive policies push AI usage out of sight, which is the outcome the policy exists to prevent.

---

## Calibrating the Risk

Security teams do better when they separate the risks that need controls from the ones that attract attention out of proportion to their likelihood.

### Risks That Need Controls

**Provider-side exposure during retention.** Even where training is excluded, data exists on provider infrastructure for the retention window, and longer where content is flagged. A provider incident puts it in scope. In [March 2023](https://openai.com/index/march-20-chatgpt-outage/){:target="_blank" rel="noopener noreferrer"}, a bug in an open-source library let some ChatGPT users see the titles of other active users' conversations, and exposed limited payment details for a small share of subscribers.

**Conversation history as an attack surface.** An attacker with access to a developer's AI account gets the full conversation history, and with it anything sensitive the developer ever pasted. This is the argument for SSO, MFA, and retention settings that keep the history short.

**Limited provider-side visibility.** Organizations cannot audit provider logs, verify deletion, or confirm training exclusion beyond the contractual commitment. For regulated industries, that is a governance gap to document and accept deliberately.

**Data passing through additional services.** When a tool calls plugins, browses, executes code in a sandbox, or connects to third-party integrations, request data may transit services with their own retention terms.

### Risks That Are Usually Overstated

**"The model will memorize our secrets and repeat them to someone else."** On commercial tiers where training is contractually excluded, inputs are not training data, so there is no mechanism for a single prompt to resurface in another customer's session. The concern is legitimate for consumer tiers where training has been allowed.

**"Our code will turn up in other companies' suggestions."** The same reasoning applies. GitHub states that it does not use Copilot Business or Copilot Enterprise customer data to train models. The exposure exists on individual plans where training has not been turned off.

**"AI-generated code is a new category of security risk."** Generated code exhibits the same vulnerability classes as hand-written code, and the same review and scanning catch them. The change is in volume and in how fluent flawed code looks, which argues for enforcing existing gates, not inventing new ones. Invented dependencies are the one genuinely new wrinkle, and dependency controls handle them.

---

## Common Pitfalls

| Pitfall | What happens | Better approach |
|---|---|---|
| **Classification without examples** | Developers guess, and guess inconsistently | Publish concrete examples for each tier |
| **Assuming "enterprise tier" settles data handling** | Carve-outs for stateful features and flagged content go unnoticed | Read the retention terms per vendor and per feature |
| **Treating zero retention as a default** | Data is retained under the standard terms nobody replaced | Request the arrangement and confirm which features it covers |
| **Relying on content exclusion for agentic tools** | Agent modes the exclusion does not cover read the excluded files | Check exclusion coverage per mode; remove secrets from workspaces |
| **Slow provisioning of approved tools** | Shadow AI on personal accounts with no controls | Measure and shorten time to access |
| **DLP tuned only for email and file sharing** | Credentials leave through API calls unexamined | Apply AI-specific URL categories and credential patterns |
| **Assuming the proxy sees everything** | Pinned certificates, personal networks, and local models bypass it | Pair network controls with endpoint and identity controls |
| **Punitive incident handling** | Accidental exposures go unreported and unrotated | Make reporting safe and fast |
| **Separate rules for generated code** | Inconsistent gates, or none | Run the same SAST, license, and dependency gates on every change |
