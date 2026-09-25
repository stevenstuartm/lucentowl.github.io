---
title: "AWS WAF & Shield for System Architects"
layout: guide
category: AWS
subcategory: Security & Compliance
description: "How AWS WAF filters web requests with web ACLs, rule priority, labels, managed rule groups, rate-based rules, and bot and anti-DDoS protections, and how Shield Standard and Shield Advanced defend against DDoS attacks, with what each level of protection costs."
tags: [waf, shield, ddos, rate-limiting, bot-control, practical]
---

## What WAF and Shield Do

**AWS WAF** is a web application firewall. It inspects each HTTP request before it reaches your application and allows it, blocks it, or makes the client prove it's a real browser, according to rules you choose. It stops attacks carried in the HTTP requests themselves, the application layer (layer 7), such as SQL injection, abusive request rates, credential stuffing with stolen passwords, and unwanted bots.

**AWS Shield** protects against distributed denial of service (DDoS) attacks. **Shield Standard** is on for every AWS customer at no cost and absorbs common floods at the network and transport layers (layers 3 and 4), such as floods of half-open TCP connections or of UDP traffic reflected off third-party servers, against AWS's edge and Regional infrastructure. **Shield Advanced** is a paid subscription that adds detection and mitigation tuned to your resources, a response team, application-layer DDoS protection through WAF, and cost protection.

The two work together. Shield handles volumetric attacks on the network, and WAF handles what arrives as well-formed HTTP requests, which includes the application-layer floods that Shield alone can't tell apart from real traffic.

---

## AWS WAF

### Where it runs

WAF attaches to the services that terminate HTTP for you: CloudFront distributions, Application Load Balancers, API Gateway REST APIs, AppSync GraphQL APIs, Cognito user pools, App Runner services, and Verified Access instances, among others. It doesn't attach to API Gateway HTTP APIs, Network Load Balancers, or EC2 instances directly.

A **web ACL**, which the console now calls a **protection pack**, holds the rules and is associated with one or more resources. A resource has at most one web ACL, and one web ACL can serve several resources of the same scope. A web ACL for CloudFront has global scope and is managed in US East (N. Virginia). A web ACL for Regional resources, such as an ALB, lives in the resource's Region. Attaching WAF to CloudFront filters requests at the edge, before they reach any Region.

### Rules and evaluation order

A web ACL holds **rules** and **rule groups**, reusable bundles of rules, each with a priority, and evaluates them in priority order, lowest number first. Each rule has a **statement** that matches requests and an **action** for matching requests:

- **Allow** and **Block** end evaluation. Block returns a 403 by default, or a custom response you define.
- **CAPTCHA** and **Challenge**, described below, end evaluation unless the request carries a valid token from an earlier puzzle or browser check, in which case the request continues like a Count.
- **Count** records the match and lets evaluation continue.

A request that no rule stops gets the web ACL's **default action**, usually Allow for a public site:

{% include figure.html id="aws-waf-evaluation" %}

**Labels** connect rules. Any matching rule can add labels, such as `awswaf:managed:aws:bot-control:bot:category:search_engine`, and a later rule can match on them. AWS Managed Rules groups label everything they detect, which is how you override one rule's decision without editing the group. You set that rule to Count, and a later rule of your own matches its label with a narrower condition.

Statements match on the request's IP address against an **IP set**, its country, a string or regular expression anywhere in the URI, headers, cookies, or body, its size, or on built-in SQL injection and cross-site scripting detectors. Statements combine with AND, OR, and NOT, and a **scope-down statement** limits a rule group or rate-based rule to a subset of requests, such as only `/api/` paths.

### Capacity and inspection limits

Every rule costs **web ACL capacity units** (WCUs) according to its complexity. A simple IP match costs 1, a regular expression more, and a managed rule group a fixed amount set by its owner, such as 700 for the core rule set. A web ACL's price includes 1,500 WCUs, can go up to 5,000 at extra per-request cost, and can't exceed that.

WAF inspects only part of a large request. For ALB and AppSync it sees the first 8 KB of the body. For CloudFront, API Gateway, Cognito, App Runner, and Verified Access it sees the first 16 KB by default, extendable to 64 KB for a fee. Headers and cookies are inspected up to 8 KB and 200 entries each. Every rule that inspects one of these components has an **oversize handling** setting that decides what happens to content past the limit: inspect what fits, treat the request as a match, or treat it as a non-match. The rest of an oversize request reaches your application uninspected. The core rule set, described next, blocks bodies over 8 KB by default for this reason, which is also the most common way it breaks legitimate uploads and large form posts.

### Managed rule groups

**AWS Managed Rules** are rule groups that AWS maintains and updates as new threats appear, and most cost nothing beyond the normal rule and request charges:

- **Baseline groups.** The **core rule set** covers the common web attack patterns in the OWASP Top 10, the industry's standard list of web application risks. **Known bad inputs** blocks request patterns tied to known exploits, such as Log4j lookups. **Admin protection** blocks outside access to admin paths.
- **Use-case groups** for SQL databases, Linux, POSIX, and Windows servers, PHP, and WordPress. Add only the ones that match your stack.
- **IP reputation groups.** The **Amazon IP reputation list** blocks addresses AWS threat intelligence has seen attacking. The **anonymous IP list** blocks VPNs, Tor exit nodes, and hosting providers by default, which cuts off real users behind VPNs, so many teams run it in Count or scope it to sensitive paths.

Paid **intelligent threat mitigation** groups add **Bot Control**, **account takeover prevention** (ATP) for login pages, **account creation fraud prevention** (ACFP) for sign-up pages, and the **anti-DDoS** rule group described below.

Most AWS managed groups are versioned, except the IP reputation lists. Pin a version for predictable behavior and move to new versions deliberately, or accept the default version, which AWS updates. Third-party vendors sell further rule groups through AWS Marketplace.

### Rate-based rules

A **rate-based rule** counts requests per key over an **evaluation window** of 1, 2, 5, or 10 minutes, and applies its action, usually Block or Challenge, to keys over the limit. The limit can be as low as 10 requests per window. By default the key is the source IP address. It can instead be an IP address from a header, or a combination of **custom keys**, such as a header, cookie, query argument, the labels under a given prefix, HTTP method, or a fingerprint of the client's TLS handshake. From a header such as `X-Forwarded-For`, WAF uses the first address, which is whatever the client sent, since proxies such as CloudFront and ALBs append to that header rather than replace it. A rule that rate limits per API key header, per logged-in session cookie, or per IP and path limits abuse more precisely than IP alone, which lumps together every user behind a corporate proxy.

Rate limiting in WAF is approximate. WAF estimates the rate with more weight on recent requests, so it limits near the configured number rather than exactly at it, and usually reacts within 30 seconds, occasionally longer. It suits stopping floods and abusive clients, not enforcing contractual quotas, which belong in API Gateway usage plans or the application.

### Bots, CAPTCHA, and Challenge

**Bot Control** has two protection levels. **Common** identifies bots that declare themselves, such as search engines, crawlers, and monitoring tools, from signals like user agents and IP ranges, and blocks the ones it can't verify. By default it also blocks HTTP libraries and clients without a browser user agent, which includes legitimate SDK and command-line API clients, so scope it to browser traffic or override those rules for API paths. **Targeted** adds detection for bots that pretend to be browsers, using browser interrogation, fingerprinting, and behavior across a session. Targeted works best with the **application integration SDK**, JavaScript or mobile code that obtains WAF tokens silently, and it costs ten times as much per request, so scope it to the pages bots target, such as login, search, and checkout.

The **Challenge** action sends a silent browser check that real browsers pass without user interaction, and **CAPTCHA** shows a puzzle. Both leave a **token** that exempts the client for a configurable time, five minutes by default. Both work only in response to `GET` requests for HTML pages over HTTPS. A `POST` from a login form, a CORS preflight, or any API call can't show the interstitial and simply fails, so put the check on the page that renders the form, and let the token carry the later request.

### Testing and logging

Put new rules and managed groups in Count first and watch what they would have blocked, then switch to their real actions. The console's **sampled requests** show recent matches, and CloudWatch metrics count matches per rule and label.

**Logging** sends each request's evaluation record to CloudWatch Logs, S3, or Data Firehose, with a destination name that starts with `aws-waf-logs-`. Logs show which rule decided each request and which labels it collected, which is how false positives get diagnosed. Redact sensitive fields such as authorization headers, and use logging filters to keep only blocked or counted requests if full volume is too costly.

### Pricing

| Item | Price |
| --- | --- |
| Web ACL | $5 per month |
| Rule or rule group | $1 per month |
| Requests | $0.60 per million |
| Capacity above 1,500 WCUs | $0.20 per million requests for each extra 500 WCUs |
| Body inspection beyond the default | $0.30 per million requests for each extra 16 KB |
| Bot Control, common | $10 per month, plus $1 per million requests after the first 10 million |
| Bot Control, targeted | $10 per month, plus $10 per million requests after the first million |
| ATP and ACFP | $10 per month each, plus per-request charges that start high and fall with volume |
| CAPTCHA | $0.40 per thousand attempts |
| Challenge | $0.40 per million challenges served |
| Anti-DDoS rule group | $20 per month, plus $0.15 per million requests |

A web ACL with five rule groups on 100 million requests a month costs about $70 before paid rule groups. CloudFront's flat-rate plans bundle WAF into a fixed monthly price for distributions on those plans.

---

## AWS Shield

### Shield Standard

Shield Standard is automatic and free. It protects every AWS customer against the most common network and transport-layer attacks at CloudFront, Route 53, Global Accelerator, and AWS Regional infrastructure. Resources behind CloudFront and Route 53 get the most from it, because the edge network absorbs floods far from your Region. There's nothing to configure, and no per-resource attack detection or event history, which come with Shield Advanced.

### Shield Advanced

Shield Advanced protects the resources you explicitly add to it: CloudFront distributions, Route 53 hosted zones, Global Accelerator standard accelerators, Application and Classic Load Balancers, and Elastic IP addresses, the fixed public addresses that cover EC2 instances and Network Load Balancers attached to them. For those resources it adds:

- **Detection and mitigation tuned to each resource**, based on its normal traffic, and faster, more precise responses to network-layer attacks.
- **Health-based detection**, which uses Route 53 health checks you associate with a resource so Shield reacts sooner and with fewer false alarms when the application is actually suffering.
- **Automatic application-layer DDoS mitigation**, which adds a Shield-managed rule group, 150 WCUs, to the resource's web ACL and creates rules to block or count attack traffic during an event.
- The **Shield Response Team** (SRT), which can write WAF rules for you during an attack, with access you grant in advance, and **proactive engagement**, in which the SRT contacts you when a health check fails during a detected event. Both need an AWS Business or Enterprise support plan.
- **Cost protection**, credits against your Shield Advanced bill for scaling charges a DDoS attack causes on protected resources, such as CloudFront requests and data transfer, ALB capacity units, and auto-scaled EC2 instances. The resource must have been protected before the attack, and a CloudFront distribution or ALB must also have had a web ACL with a rate-based rule in Block mode.
- **WAF at no extra charge** for protected resources, covering web ACL, rule, and request fees up to 1,500 WCUs, the default body size, and 50 billion requests a month. Paid rule groups such as Bot Control are still billed.

Shield Advanced costs $3,000 a month with a one-year commitment. Each account subscribes separately, but the fee is billed once to the organization's paying account, so one fee covers every subscribed account in an AWS Organizations organization. Data transferred out from protected resources adds a fee, $0.025 per GB from CloudFront and $0.05 per GB from load balancers, EC2, and Global Accelerator. **AWS Firewall Manager** applies Shield Advanced protections and WAF rules across all accounts in an organization, so new resources don't go unprotected. Its policies are included for Shield Advanced subscribers and otherwise cost $100 per policy per Region each month.

### The anti-DDoS rule group

Application-layer floods, such as millions of well-formed requests from a botnet, look like ordinary traffic, so network-layer defenses can't stop them. The **anti-DDoS managed rule group** handles them in WAF without Shield Advanced. It learns each protected resource's normal traffic, detects events as significant departures from it, and then challenges or blocks the requests most likely to be part of the attack, at a sensitivity you set. Shield Advanced waives its monthly fee, and its per-request charge still applies.

---

## Common Pitfalls

- **Blocking before measuring.** A managed rule group turned on in Block without a Count period breaks legitimate requests, often large uploads or unusual but valid headers. Count first, check the logs, and override the specific rules that misfire.
- **Rate limiting the proxy.** A web ACL on an ALB behind CloudFront sees CloudFront's addresses, so a rate-based rule keyed on source IP limits CloudFront, not the client. Put the rule in a web ACL on CloudFront, where the source IP is the client. Keying on `X-Forwarded-For` instead lets clients choose their own key, since WAF reads the first address in that header.
- **Bot Control on API paths.** Common Bot Control blocks HTTP libraries by default, so a web ACL shared by a website and its API blocks the API's legitimate clients. Scope Bot Control to browser paths.
- **Shield Advanced without WAF.** Shield Advanced's application-layer protection works through WAF, and cost protection for CloudFront and ALBs requires a rate-based rule in Block. A protected ALB or distribution with no web ACL gets network-layer protection only.

---

## Choosing a Level of Protection

For most public applications, Shield Standard plus WAF on CloudFront is the baseline: the core rule set, known bad inputs, the Amazon IP reputation list, and a rate-based rule per sensitive path. Add Bot Control, ATP, or ACFP where bots or fraud cost real money, scoped to the paths they target, and the anti-DDoS rule group where application-layer floods are a realistic threat.

Shield Advanced makes sense when a DDoS outage would cost far more than its price, $36,000 a year plus a Business or Enterprise support plan and data transfer fees, and when you want a response team on call, cost protection, and organization-wide protection through Firewall Manager. For an organization running many internet-facing applications, one subscription covers them all, and the included WAF charges offset part of the price.

---

## Key Takeaways

- WAF filters HTTP requests at CloudFront, ALBs, API Gateway, and other HTTP front doors. Shield protects against DDoS attacks, with Shield Standard on for everyone at no cost.
- A web ACL runs rules in priority order. Allow and Block end evaluation, and Count adds labels that later rules can act on.
- Start from AWS Managed Rules, test them in Count, and override individual rules with labels rather than removing whole groups.
- WAF inspects only the first 8 KB to 64 KB of a body, depending on the resource, and the core rule set blocks bodies over 8 KB. Plan for both on upload paths.
- Rate-based rules limit abusive clients approximately, per IP or per custom key. Use a key that identifies the real client.
- Bot Control, ATP, ACFP, and the anti-DDoS rule group cost extra. Scope them to the paths that need them.
- Shield Advanced costs $3,000 a month for a year, one fee per organization, and adds tailored mitigation, the Shield Response Team, cost protection, and WAF fees for protected resources.
