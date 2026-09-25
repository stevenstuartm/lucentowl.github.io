# AWS Study Guides Refinement Plan

Tracks the consolidation and review-and-refine pass over the guides (57 before Phase 0, 53 after) in the "AWS" category of `assets/data/study_guides_config.json`, all in `_guides/infrastructure/aws/`. Guides are consumed sequentially in config order. That order encodes the fundamentals-to-advanced learning path, so no guide should add its own prerequisite framing or cross-links to siblings in scope.

**The process rules live in [`.claude/content/guide-refinement-standard.md`](../.claude/content/guide-refinement-standard.md); the checklist and cross-domain gotchas live in [`.claude/content/study-guide-guide.md`](../.claude/content/study-guide-guide.md).** Read both first. This document carries only what is specific to this pass.

Every guide dates from the first rough copy out of the old repo. Phase 0 (consolidation) ran and closed; the file set and config are final for Phase 1.

---

## Phase 0: Consolidation (complete)

57 guides became 53. `serverless-architecture-patterns` merged into Lambda (EMF subsection into CloudWatch); `cloudformation-migration` merged into `cloudformation-advanced`; the Rekognition/Textract, Comprehend/Translate, and Transcribe/Polly guides merged into `aws-ml-service-selection`; `cloudformation-templates` became the resource `_resources/cloudformation-template-reference.md` (its Outputs section moved into `cloudformation-fundamentals`). Rows 30 (Cognito) and 47 (Bedrock) are empty seeds: front matter and a scope comment only.

Subcategories: Foundations; Networking & Content Delivery; Compute Services; Storage Services; Database Services; Application Integration & Messaging; Infrastructure as Code; Developer Tools & CI/CD; Security & Compliance; Management & Governance; Containers in Production; Analytics & Data Processing; Machine Learning & AI; Migration & Hybrid Cloud; Resilience. Compute, Storage, and Database kept their "Services" names to match the Azure category.

Order rationale: Foundations first because every later guide assumes accounts, IAM principals, and the Well-Architected vocabulary. Networking next because compute, data, and security attach to a VPC; load balancers precede Route 53 and CloudFront because both use them as targets and origins, and multi-VPC precedes hybrid because Direct Connect gateways attach to Transit Gateway. Compute, storage, and databases in dependency order; messaging after databases (DynamoDB Streams); IaC and CI/CD together; security and operations once there is something to protect and run; Containers in Production after them because it builds on scanning, secrets, GuardDuty, and pipelines; then the specialist tracks; Resilience last because it composes almost every earlier service.

Moved sections landed wholesale and unpolished. The seams each row must reconcile are listed in its pre-flag.

## Topic ownership map

"Clause" means a non-owner defines the concept in a clause where it's used, or omits it, and doesn't link to the owner. Out-of-scope owners are named by path.

| Concept | Owner | Non-owners treat it as |
|---|---|---|
| Well-Architected pillars, reviews, lenses, pillar trade-offs | 1 well-architected | Clause |
| IAM principals, policy types, policy evaluation logic, roles and trust policies, Access Analyzer, Identity Center, root user | 2 iam | Clause |
| IAM concepts in general (RBAC/ABAC, federation, OAuth/OIDC) | `security/identity-access-management.md` (out of scope) | Row 2 states only the AWS mapping |
| Organizations, OUs, SCPs, RCPs, declarative policies, Control Tower, landing zones, account strategy, delegated administrator | 3 organizations | Row 2 and rows 33/34: clause |
| Guardrail placement (preventive/detective/corrective), tagging strategy, drift response | `infrastructure/iac-governance.md` (out of scope) | Rows 3 and 33 keep only AWS mechanics |
| Single-VPC anatomy: CIDR, subnets, route tables, IGW, NAT, security groups vs NACLs, IPv4 charges and IPv6 | 4 vpc | Row 11 security groups: clause |
| VPC endpoints (gateway and interface), PrivateLink services, peering, Transit Gateway, VPC Lattice, choosing between multi-VPC options | 9 privatelink-tgw | Rows 4, 10, 14, 17, 20: clause ("use a gateway endpoint for S3") |
| Direct Connect, Site-to-Site VPN, BGP, DX gateway, hybrid connectivity choice | 10 direct-connect-vpn | Row 51: clause |
| DNS protocol, record types, TTL semantics | `networking/dns.md` (out of scope) | Row 6 states only Route 53 specifics (alias records, private zones) |
| Route 53 routing policies and health checks | 6 route53 | Rows 52, 53: clause |
| ALB/NLB/GWLB, target groups, health checks, deregistration delay, cross-zone | 5 elb | Rows 11, 13, 29: clause |
| Edge caching, cache keys, Origin Shield, CloudFront Functions vs Lambda@Edge | 7 cloudfront | Rows 8, 14: clause |
| API Gateway API types, authorizers, throttling, usage plans, caching | 8 api-gateway | Rows 12, 30: clause |
| WAF rules, rate-based rules, Bot Control, Shield | 32 waf-shield | Rows 5, 7, 8: clause |
| Choosing EC2 vs Lambda vs containers | 13 container-services | Rows 11, 12: clause ("when this is the wrong compute") |
| Instance families, Graviton, Nitro, IMDSv2, Auto Scaling groups, Spot | 11 ec2 | Clause |
| Lambda execution model, concurrency, cold starts and SnapStart, invocation types and error handling, function design, serverless anti-patterns | 12 lambda | Rows 20–23, 27: clause |
| Savings Plans, RIs, commitment strategy, Compute Optimizer, Cost Explorer, Budgets, cost allocation tags | 38 cost-management | Rows 11, 13, 16, 18, 43: one clause on what the commitment covers |
| TCO and ROI reasoning | `architecture/total-cost-of-ownership.md` (out of scope) | Row 38: clause |
| Object vs block vs file choice | 15 ebs-efs | Rows 11, 14: clause |
| S3 storage classes, lifecycle, request scaling, bucket security, replication mechanics | 14 s3 | Rows 41–45, 52, 53: clause |
| Cross-service database selection, including purpose-built engines | 19 database-selection | Rows 16–18, 43: each keeps at most one clause on when it's the wrong store Its "RDS vs Aurora Decision Framework" cuts to a clause (row 16 owns the choice); its stale figures (5x/3x throughput, 128 TB, 5 RDS replicas, per-instance prices) go with it. |
| RDS vs Aurora choice, Multi-AZ options, Aurora architecture, Aurora serverless | 16 rds-aurora | Row 19: clause |
| Database concepts (replication, isolation, partitioning, key-value and wide-column modelling) | `data/` guides (out of scope) | Rows 16–19 state only the AWS behaviour |
| Cache-aside, write-through, TTL strategy | `architecture/performance_scalability_patterns.md` (out of scope) | Row 18 keeps the ElastiCache specifics |
| SQS and SNS semantics, DLQs, FIFO, fanout, filtering | 20 sqs-sns | Rows 12, 21: clause |
| EventBridge buses, rules, Pipes, Scheduler, EventBridge vs SNS | 21 eventbridge | Rows 12, 20: clause |
| Orchestration vs choreography, saga, CQRS, pub/sub as patterns | `architecture/orchestration_choreography.md`, `architecture/messaging_patterns.md`, `architecture/data_management_patterns.md` (out of scope) | Rows 20–22: clause, AWS mechanics only |
| Step Functions workflow types, states, retries, service integrations | 22 step-functions | Clause |
| Kinesis Data Streams, Data Firehose, shards, Kinesis vs SQS | 23 kinesis | Rows 41, 45: clause |
| CloudFormation stacks, change sets, update behaviours, deletion policies, template sections | 24 cfn-fundamentals | Rows 26, 27: clause |
| Nested stacks, StackSets, custom resources, drift detection, resource import, stack refactoring | 25 cfn-advanced | Rows 3, 26: clause |
| IaC concepts, tool selection, state, testing, GitOps | `infrastructure/iac-*.md` (out of scope) | Rows 24–27, 40: clause |
| CDK constructs, synth, bootstrap, CDK testing | 26 cdk | Row 27: clause |
| SAM vs CDK choice | 27 sam | Row 26: omit |
| Rolling, blue-green, canary, linear as release strategies | `infrastructure/deployment-strategies.md` (out of scope) | Rows 13, 16, 28, 29: AWS mechanics only |
| CodeDeploy traffic shifting, AppSpec, hooks, automatic rollback | 29 codedeploy | Rows 13, 28: clause |
| Customer identity: user pools, identity pools, federation, token exchange for AWS credentials | 30 cognito | Row 8: authorizer config only |
| KMS keys, key policies and grants, envelope encryption on AWS, Secrets Manager, rotation, Parameter Store vs Secrets Manager | 31 kms-secrets | Rows 37, 39: clause |
| Envelope encryption and key hierarchy as concepts | `security/cryptography.md` (out of scope) | Row 31: AWS mechanics only |
| CloudTrail, Config rules, conformance packs, aggregators | 33 cloudtrail-config | Rows 2, 3, 34: clause |
| GuardDuty (including runtime monitoring), Security Hub, findings workflow | 34 security-hub | Rows 13, 39: clause |
| CloudWatch metrics, alarms, logs, Logs Insights, EMF, cross-account observability | 35 cloudwatch | All service guides keep only their key metrics, not a CloudWatch tutorial |
| Telemetry signal concepts, SLOs, alert design | `observability/*.md` (out of scope) | Row 35: clause |
| Distributed tracing on AWS (X-Ray, ADOT/OpenTelemetry) | 36 xray | Rows 12, 13, 20–22: clause |
| Session Manager, Run Command, Patch Manager, State Manager, Automation | 37 systems-manager | Row 11: clause |
| ECR, image scanning, image signing, lifecycle policies | 39 ecr-security | Rows 13, 28: clause |
| Container runtime security practice (non-root, read-only FS) | 39 ecr-security | Row 13: clause |
| ECS capacity providers and placement, Service Connect, EKS node strategy (Karpenter, Auto Mode), pod identity | 40 advanced-containers | Row 13: clause |
| Service mesh as a pattern | `architecture/service-mesh-architecture.md` (out of scope) | Row 40: AWS options only |
| Lake, warehouse, lakehouse, ETL vs ELT, open table formats as concepts | `data/data-architecture.md` (out of scope) | Row 45 maps them to AWS services; rows 41–43 use a clause |
| AWS analytics service selection | 45 data-architecture | Rows 41–44: clause |
| Lake Formation permissions | 45 data-architecture | Rows 41, 42, 44: clause |
| ML tier choice; prebuilt AI services (vision, language, speech, documents) | 46 ml-selection | Rows 47, 48: clause |
| Foundation-model concepts (RAG, fine-tuning, agents, evaluation, LLM security) | `ai/*.md` (out of scope) | Row 47: Bedrock mechanics only |
| MLOps as a practice | `ai/mlops.md` (out of scope) | Row 48: SageMaker mechanics only |
| 7 Rs, migration phases, portfolio assessment | 49 migration-strategy | Rows 50, 51: clause |
| Strangler fig and legacy modernization patterns | `architecture/legacy-modernization-strategies.md` (out of scope) | Row 49: clause |
| MGN, DMS, DataSync mechanics | 50 migration-services | Row 49: clause (its Migration Tools section cuts) |
| Storage Gateway, Outposts, hybrid workload patterns | 51 hybrid | Clause |
| Cross-Region data replication (Aurora Global, DynamoDB global tables, S3 CRR) and consistency trade-offs | 52 multi-region | Rows 14, 16, 17, 53: clause |
| RTO/RPO, business impact analysis, the four DR strategies as concepts, DR testing cadence | `infrastructure/disaster-recovery-patterns.md` (out of scope) | Row 53: clause |
| AWS DR implementation: AWS Backup, Elastic Disaster Recovery, Application Recovery Controller, per-strategy AWS builds | 53 disaster-recovery | Rows 14, 16, 51, 52: clause |

---

## Phase 1: Refinement

Per row: content items (1, 3, 7, and 2 against the ownership map), then the presentation pass, `/refine-prose`, and at most two independent review rounds with findings applied. Then set Complete. Don't stop between rows. No Jekyll build.

New rows (30, 47) are written from empty seeds, with no discount on item 1. Merge survivors (rows 12, 24, 25, 35, 46) and split targets (rows 9, 10) start with pasted seams; split sources (rows 4, 51) have holes where sections left. Reconcile the seams before running item 2.

### Closing the pass

After the last row, re-run the sibling-link grep over the in-scope files:

```bash
grep -nE '(\]\(|href=")/study-guides/infrastructure/aws/[a-z0-9-]+\.html' _guides/infrastructure/aws/*.md
```

Then confirm no concept is re-taught against the ownership map, and add one What's New entry for the pass.

## Sources

- **Primary:** docs.aws.amazon.com (each service's User or Developer Guide, API reference, and Service Quotas page); aws.amazon.com/<service>/pricing for any price, read at us-east-1; the AWS Well-Architected Framework whitepaper and lenses; AWS Prescriptive Guidance (7 Rs, multi-account strategy, migration phases); the whitepaper *Disaster Recovery of Workloads on AWS*; the *Organizing Your AWS Environment Using Multiple Accounts* whitepaper.
- **Dates and launches:** the AWS What's New feed (aws.amazon.com/new) and the AWS News Blog. Use them for "since" dates, renames, end-of-support notices, and closed-to-new-customer notices.
- **Tooling:** the CDK API reference and developer guide, the SAM developer guide, the CloudFormation template reference, and the AWS SDK for .NET developer guide for any C# sample.
- **Off-limits or unreliable:** third-party blogs and Medium as the sole source for a limit, price, or date; certification-prep sites; AWS customer case studies as the source for a general percentage; any "typical" savings or accuracy figure without a primary source.

## Domain notes

**Item 7 (hierarchy and scope clarity).** In this domain it means the containment and scope a resource or control lives at: organization → OU → account → Region → Availability Zone → VPC → subnet → resource. Say where each thing lives when it is introduced:

- Global services versus Regional ones: IAM, Organizations, Route 53, and CloudFront are global. WAF runs at `CLOUDFRONT` or `REGIONAL` scope.
- Quotas are per account per Region unless stated otherwise.
- Policy attachment differs by type: an SCP attaches at the root, an OU, or an account. An identity policy attaches to a principal. A resource policy attaches to a resource.
- Some things live at a finer scope, for example a NAT gateway per AZ, an interface endpoint per subnet, a KMS key per Region, or a Lambda concurrency quota per account per Region.

**Item 9 (tag audit).** Measured across the 57 guides before the pass: `aws` 57, `fundamentals` 32, `cost-optimization` 20, `practical` 15, `architecture` 13, `infrastructure` 11, `cost-analysis` 10, `automation` 9, `security` 9, `performance` 6, `serverless` 6, then `data-architecture`, `analytics`, `cloudformation`, `iac`, `machine-learning`, and `integration` at 5 each. Everything else is 1–4. Only `cloudformation-advanced` carries `advanced`, and several guides carry two skill-level tags. For this category:

- Drop `aws`, because it restates the category.
- Drop `cost-optimization` and `cost-analysis` everywhere except row 38.
- Drop `architecture`, `infrastructure`, `automation`, `integration`, and `performance` as filler unless the guide is about that concern.
- Drop the non-signal tags `best-practices`, `reference`, `framework`, `patterns`, `templates`, and `decision-framework`.
- Give each guide exactly one skill-level tag. Rows 25, 40, 52, and 53 are the likely `advanced` candidates.
- Fill the freed slots with the service names and mechanisms a reader would type.

**Code samples.** AWS-native forms stay as they are: CLI, CloudFormation/SAM YAML, IAM and policy JSON, CDK, buildspec and AppSpec, SQL. The CDK samples are in TypeScript, which is the CDK's reference language, so they stay. SDK samples are mostly Python `boto3`. Following the site's C# default, convert a sample that earns its place to the AWS SDK for .NET, or cut it.

**Diagrams.** No AWS composite resource exists yet. Figures drawn during this pass use the `aws-` id prefix and compose into a new `aws-diagrams` resource, following `aspnet-core-diagrams`.

## Domain gotchas

- **Service renames are vocabulary traps.** Confirm each on first use, then record it under Cross-guide facts:
  - Kinesis Data Firehose → Amazon Data Firehose
  - Kinesis Data Analytics → Managed Service for Apache Flink
  - "CMK" → KMS key (customer managed / AWS managed)
  - AWS SSO → IAM Identity Center
  - Control Tower "guardrails" → "controls"
  - SageMaker → SageMaker AI
  - ElastiCache for Redis → ElastiCache with Valkey or Redis OSS engines
- **Dated headings are a staleness marker.** A heading like "(2024)" or "Pricing (January 2025)" marks a claim frozen at copy time. Re-verify the claim, then remove the date from the heading.
- **"Real-world impact," "Industry Insights," and "Real-World Results" blocks** carry precise percentages with no source. Treat each figure as unverified until a primary source turns up. Most will be cut.
- **Spelling.** The site uses American spelling ("favor", "behavior"); the old guides mix in British forms. Normalize during the presentation pass.
- **Scripted section moves can create setext headings.** A `---` rule placed directly after a text line (no blank line between) makes kramdown render that line as an H2. Keep a blank line before every `---`; the lint script checks for it.
- **Scripted pre-flag deletion.** Ownership-map rows contain the same `| N name |` text as pre-flag rows, so an unanchored pattern deletes half a map row and joins it to the next. Anchor any scripted deletion to the start of the line. This corrupted the map twice before it was caught.
- **Figure class prefixes already used by `aws-` figures:** awsi, awsr, awsv, awsn, awse, awsx, awsx2, awsg, awsg2, awsd, awst, awsc, awsa, awsw, awsp, awsf, awsl, awsh, awsj, awsk, awsq, awsu, awsy, awsz, awsb. Check `grep -o 'class="aws[a-z0-9]*' _figures/aws-*.html` rather than trusting this list. Pick a new tag for each new figure, and add every figure to `_resources/aws-diagrams.md` (and the embedding guide to its `related_guides`).
- **Liquid.** CloudFormation dynamic references (`{{resolve:...}}`), SSM document parameters (`{{ InstanceId }}`), and GitHub Actions expressions evaluate as Liquid. Four guides are raw-wrapped today, so any row that gains such a sample needs the wrap.

## Cross-guide facts in force

Verified during earlier rows; applies to every remaining guide that touches the topic.

- **Root-user MFA.** AWS enforced MFA for Organizations management-account root users from May 2024, standalone-account root users from June 2024, and member-account root users from June 2025 (What's New, 2025-06-17: "all account types"). Centralized root access management for member accounts arrived November 2024. (Row 2 owns the detail.)
- **Commitment discounts.** EC2 Instance Savings Plans and Reserved Instances: up to 72% off On-Demand. Compute Savings Plans: up to 66%. Never merge them into one figure. (Row 38 owns.)
- **Lambda maximum duration.** 15 minutes per invocation for standard functions; Lambda Managed Instances allow longer runs for async and event-source invocations (Lambda quotas page, per the row 1 review). Say "standard functions" when stating 15 minutes. (Row 12 owns.)
- **IAM evaluation (row 2 owns).** Within one account, identity-based and resource-based policies combine as a union; SCPs, RCPs, boundaries, and session policies intersect. Cross-account requires an allow in both accounts. SCPs and RCPs never apply to the management account. Role trust policies and KMS key policies must name the principal even in the same account. Later rows state this in a clause and never write "IAM ∩ SCP ∩ resource policy".
- **IAM Identity Center.** Organization instance in the management account (administration delegable); multi-Region replication for organization instances since February 2026, not with an Active Directory identity source. Permission set sessions default to 1 hour, maximum 12. Role maximum session 1–12 hours; role chaining caps at 1 hour.
- **CodeCommit.** Closed to new customers in July 2024, returned to full general availability on 2025-11-24 (AWS DevOps blog, "The Future of AWS CodeCommit"). Present it as a current, available service.
- **External IDs** are for third-party access only; roles shared between your own accounts don't need them (row 2).
- **Well-Architected vocabulary.** Workload, lens, HRI/MRI, milestone, and improvement status are defined in row 1. Later rows use them in a clause without re-teaching.
- **Control Tower (row 3 owns).** Landing zone 4.0 made every service integration optional and dropped the enforced OU structure. The shared accounts are now the **CloudTrail administrator account** (formerly log archive) and the **Config aggregator account** (formerly audit). In 4.0 the log archive bucket holds only CloudTrail logs; Config data goes to a bucket in the Config aggregator account. The Config integration records only in the integration accounts, and workload-account recording comes from the per-OU Config baseline. Drift notifications go to EventBridge in the management account. Preventive controls use SCPs, RCPs, and declarative policies. A Controls Dedicated experience (November 2025) applies managed controls without a landing zone.
- **Organization policies (row 3 owns).** Two categories: authorization (SCPs, RCPs) and declarative (EC2, tag, backup, AI opt-out, chat, Security Hub, Inspector, Bedrock, S3, upgrade rollout). Declarative policies affect the management account; authorization policies don't. Tag policies' required tag keys validate IaC deployments (November 2025); other callers need an SCP on `aws:RequestTag`.
- **NAT gateways (row 4 owns).** Two availability modes since November 2025: zonal (one public subnet and Elastic IP per AZ, one per AZ for resilience) and regional (no subnet, one ID in every route table, expands into an AZ within up to 60 minutes, priced per AZ-hour, not for private NAT). Both charge per GB processed, including traffic to AWS services, so a gateway endpoint for S3 and DynamoDB is the usual fix. NAT64 is automatic on every NAT gateway; DNS64 is a per-subnet setting, off by default.
- **Public IPv4 (row 4 owns).** $0.005 per hour per public IPv4 address, in use or idle, since February 1, 2024 (about $3.60 a month). BYOIP ranges aren't charged. IPv6 addresses and egress-only internet gateways have no charge of their own. Never cite pre-2024 "free public IP" cost figures.
- **Load balancers (row 5 owns).** ALB, NLB, GWLB are the current types; Classic is legacy. NLB security groups can only be attached at creation. NLB weighted target groups since November 2025; ALB regex matching and URL/host rewrite since October 2025; ALB JWT verification and NLB QUIC passthrough since November 2025. PrivateLink endpoint services need an NLB or GWLB, but resource endpoints (December 2024) don't. The ELB API/CLI/CloudFormation/CDK default TLS policy is still `ELBSecurityPolicy-2016-08` (accepts TLS 1.0). Cross-zone is always on at the ALB (off per target group possible) and off by default on NLB/GWLB, where it incurs inter-AZ data charges. Target group health thresholds give DNS failover and routing failover (fail-open); zonal shift belongs to ARC (row 53).
- **Route 53 (row 6 owns).** Eight routing policies (IP-based added 2022; all but IP-based work in private zones). Control plane in us-east-1, data plane global; accelerated recovery (November 2025) targets a 60-minute RTO for public zone changes during a us-east-1 impairment. The VPC's resolver is now named the Route 53 VPC Resolver; Route 53 Global Resolver (GA March 2026) is a separate internet-reachable resolver. Private hosted zone queries and alias queries to AWS resources are free. Health checks can't reach private addresses; use CloudWatch alarm health checks. Dangling records: delete the record, wait out the TTL, then delete the resource.
- **CloudFront (row 7 owns).** Flat-rate plans (November 2025) attach per distribution: Free $0, Pro $15, Business $200, Premium $1,000 a month, bundling WAF, DDoS protection, Route 53, logs, and S3 credits, with no overages; several features (continuous deployment, Anycast IPs, real-time logs, OAI, dedicated IP) aren't allowed on a plan. A cache policy with minimum TTL above 0 caches even `no-store`/`private` responses. OAC replaces OAI for S3 and covers Lambda function URLs; VPC origins (November 2024) put ALB/NLB/EC2 origins in private subnets. Data transfer from AWS origins to CloudFront is free.
- **API Gateway (row 8 owns).** HTTP API $1.00/M (512 KB metering), REST $3.50/M. REST-only: WAF, private endpoints, usage plans/API keys, caching, request validation, canary, X-Ray, response streaming. REST integration timeout 29 s by default, raisable for Regional and private APIs only; HTTP API 30 s maximum. Account throttle 10,000 rps / 5,000 burst per Region, shared by all APIs; all throttles are best-effort. API keys aren't credentials.
- **Multi-VPC connectivity (row 9 owns).** VPC peering: 50 connections per VPC by default (up to 125), non-transitive, no overlapping CIDRs. Transit Gateway: 5,000 attachments, up to 100 Gbps per VPC attachment per AZ each direction, $0.05/attachment-hour + $0.02/GB on every pass; Network Firewall attaches natively since July 2025; SG referencing across a TGW since 2024. PrivateLink: interface endpoints ~$0.01/hour per AZ + $0.01/GB; cross-Region endpoint services since November 2024; resource endpoints (no NLB) since December 2024; DynamoDB has interface endpoints (no private DNS). VPC Lattice: one service network per VPC, 10-minute connection cap, IAM auth only on HTTP/HTTPS/gRPC. App Mesh is gone; don't mention it.
- **Hybrid connectivity (row 10 owns).** Site-to-Site VPN: 1.25 Gbps standard tunnels ($0.05/hr), 5 Gbps large tunnels since November 2025 ($0.60/hr, transit gateway or Cloud WAN only). Direct Connect: dedicated 1/10/100/400 Gbps, hosted 50 Mbps to 25 Gbps; flat-rate pricing for 10 and 100 Gbps dedicated since September 2026 (no DTO within tier, port-pair included). SLA: 99.99% needs four connections across two locations plus Enterprise Support and a Well-Architected review; single connection 95%; hosted connections have no SLA. MACsec only on 10 Gbps and faster dedicated connections. Direct Connect is unencrypted by default.
- **EC2 (row 11 owns).** Graviton5 GA June 2026 (M9g); Graviton runs Linux and some BSDs, not Windows. Launch configurations can't be created by accounts made on or after October 1, 2024; use launch templates. IMDSv2 can be defaulted or enforced per account and Region, or by an EC2 declarative policy; container hosts need hop limit 2. Placement groups: cluster is single-AZ; partition and spread span AZs; precision time placement groups since June 2026. Default instance warmup is off until set. Spot is not covered by Savings Plans.
- **Lambda (row 12 owns).** Default account concurrency 1,000 per Region; scaling 1,000 environments per 10 s per function; RPS cap is 10x the concurrency quota in aggregate, not per environment. Payloads: 6 MB sync each way, 1 MB async, 200 MB streamed. Init is billed since August 1, 2025. SnapStart: Java 11+, Python 3.12+, .NET 8+, published versions only. Lambda Managed Instances (EC2 in your account, EC2 price + 15% fee, multi-concurrency, up to 90 min for async/most ESMs), durable functions (up to one year, SDKs include .NET since July 2026), and Lambda MicroVMs (June 2026, up to 8 hours) are current. arm64 Lambda is Graviton2 per the docs. Compute Savings Plans cover Lambda duration and provisioned concurrency at up to 17%, not requests.
- **Containers (row 13 owns compute selection).** Fargate us-east-1: $0.04048/vCPU-hr, ~$0.00445/GB-hr (x86), Arm ~20% less; 1-minute minimum Linux, 5-minute Windows; sizes up to 16 vCPU/120 GB plus 32 vCPU (60/120/244 GB). Fargate on EKS is Linux x86 only, no EBS, no Spot. Fargate Spot up to 70% off (ECS only, x86 and Arm). Compute Savings Plans: up to 50% on Fargate. ECS Managed Instances (September 30, 2025; Bottlerocket; patched every 14 days; EC2 price + per-instance fee). ECS Express Mode (November 2025) replaces App Runner, which closed to new customers April 30, 2026. EKS: $0.10/cluster-hour standard support (14 months), $0.60 extended (12 months); Auto Mode per-instance fee; Hybrid Nodes per vCPU-hour. Service-task EBS volumes are always deleted with the task.
- **S3 (row 14 owns).** Max object 50 TB (December 2025); 10,000 general purpose buckets by default, up to 1 million; account regional namespaces (March 2026). Standard $0.023, Standard-IA $0.0125, One Zone-IA $0.01, Glacier IR $0.004, Flexible $0.0036, Deep Archive $0.00099, Express One Zone $0.11 per GB-month (us-east-1). Lifecycle skips objects under 128 KB by default since September 2024. S3 Select and Glacier Select closed to new customers July 25, 2024. SSE-S3 default since January 5, 2023; Block Public Access and ACLs-disabled defaults since April 2023; SSE-C disabled by default on new buckets since April 2026. Object Lock can be enabled on existing buckets (November 2023). Conditional writes: If-None-Match (August 2024), If-Match (November 2024). Event notifications are at least once. RTC: 99.9% within 15 minutes (SLA), not 99.99%.
- **EBS and EFS (row 15 owns).** gp3: 1 GiB–64 TiB, up to 80,000 IOPS and 2,000 MiB/s, $0.08/GB-month, 20% below gp2. io2 Block Express: 256,000 IOPS, 99.999% durability; Multi-Attach up to 16 Nitro instances in one AZ (io1 Multi-Attach only in three Regions). Elastic Volumes: four modifications per rolling 24 hours, grow only. Snapshots: $0.05/GB-month; archive $0.0125 converts to a full snapshot (90-day minimum, up to 72 h restore); fast snapshot restore $0.75 per snapshot per AZ-hour, 5 per Region; provisioned volume initialization rate 100–300 MiB/s. EFS: Elastic throughput (default) up to 20–60 GiB/s read per file system; Max I/O is previous generation; classes Standard $0.30, IA $0.016 (Elastic) / $0.025, Archive $0.008 (Elastic only); lifecycle defaults IA 30 days, Archive 90; encryption at rest fixed at creation; replication RPO 15 minutes.
- **RDS and Aurora (row 16 owns).** RDS: six engines; 15 read replicas per primary (async, no autoscaling); Multi-AZ DB instance failover typically 60–120 s; Multi-AZ DB cluster (writer + two readable standbys, semisynchronous, MySQL/PostgreSQL) under 35 s; gp3 baseline 3,000 IOPS below 400 GiB and 12,000 at 400 GiB+ (striped), $0.115/GB-month Single-AZ; encryption only at creation; RDS Extended Support bills automatically past end of standard support, up to 3 years. Aurora: cluster volume six copies across three AZs, up to 256 TiB, shrinks on delete; 15 replicas, failover typically under 60 s (often under 30); Standard $0.10/GB + $0.20 per million I/Os vs I/O-Optimized $0.225/GB, no I/O charge (choose it at 25%+ I/O spend); Aurora serverless (formerly "Serverless v2") 0–256 ACU, $0.12/ACU-hour, auto-pause resumes in ~15 s and is blocked by an attached RDS Proxy; Global Database up to 10 secondary Regions, lag typically under 1 s (asynchronous); up to 6x MySQL/PostgreSQL throughput is AWS's claim, not the old 5x/3x.
- **DynamoDB (row 17 owns).** On-demand (default, recommended) $0.625 per million writes and $0.125 per million reads since the November 2024 cut; provisioned $0.00065 per WCU-hour, $0.00013 per RCU-hour. New on-demand tables serve 4,000 writes/12,000 reads per second and absorb double the previous peak; warm throughput can be pre-warmed. 40,000 units per table default. Per partition 3,000 RCU/1,000 WCU; the 10 GB limit is per item collection only with LSIs. Streams: exactly once, per-item order, 24 hours, Lambda reads free. TTL deletes within a few days, free. PITR 1–35 days at $0.20/GB-month; AWS Backup does scheduled snapshots, not PITR. Vector indexes GA August 2026. Multi-attribute GSI keys (up to four attributes each) since November 2025. Database Savings Plans cover DynamoDB.
- **ElastiCache (row 18 owns).** Engines Valkey (default for new caches; nodes 20% and Serverless ~33% cheaper than Redis OSS), Redis OSS, Memcached. Serverless: Valkey $0.084/GB-hour and $0.0023 per million ECPUs, minimum 100 MB (1 GB for other engines), always Multi-AZ and encrypted, 99.99% SLA, RBAC only. Node-based: up to 500 shards, 5 replicas per shard, 90 nodes per cluster by default; failover resumes writes in seconds (not minutes); reserved-memory-percent 25%. Durability (Valkey 9.0+, June 2026): sync zero-loss at +18% node price, async up to 10 s loss. At-rest encryption creation-only; cluster mode can switch disabled to enabled only. Database Savings Plans cover ElastiCache for Valkey only.
- **Database selection (row 19 owns).** Aurora DSQL GA May 2025: PostgreSQL wire protocol, optimistic concurrency, repeatable read fixed, 3,000 rows per transaction, no temp tables/triggers/PL/pgSQL, strongly consistent multi-Region writes. Aurora PostgreSQL Limitless Database GA October 31, 2024. DynamoDB global tables multi-Region strong consistency GA June 30, 2025 (exactly three Regions). DocumentDB Serverless GA July 31, 2025. Timestream for LiveAnalytics closed to new customers June 20, 2025; Timestream for InfluxDB added InfluxDB 3 Core/Enterprise October 16, 2025. QLDB end of support July 31, 2025. Zero-ETL into Redshift: sources Aurora MySQL/PostgreSQL, RDS for MySQL/PostgreSQL/Oracle, DynamoDB, Oracle Database@AWS, self-managed databases, and SaaS apps; Aurora/RDS seconds behind, DynamoDB every 15–30 minutes (needs PITR). Database Savings Plans cover Aurora, RDS, Aurora DSQL, DynamoDB, ElastiCache for Valkey, DocumentDB, Neptune (incl. Analytics), Keyspaces, Timestream, OpenSearch Service, DMS; not MemoryDB or Redshift (reserved nodes).
- **SQS and SNS (row 20 owns).** SQS message max 1 MiB (billed per 64 KB chunk); retention 1 min–14 days (default 4); visibility 0–12 h (default 30 s); ~120,000 in flight; FIFO 300 calls/s per action (3,000 msgs batched), high throughput up to 70,000 calls/s in the largest Regions; fair queues on standard queues since July 2025; SSE-SQS default since October 2022; $0.40/M standard, $0.50/M FIFO. SNS messages 256 KiB default, up to 1 MiB via `MaximumMessageSize` since September 18, 2026 (SQS, Lambda, Firehose subscriptions only); FIFO topics deliver to SQS FIFO or standard queues only; retries 100,015 over 23 days for SQS/Lambda/Firehose, 50 over 6 h for email/SMS/push, HTTP 3 by default; deliveries to SQS and Lambda carry no SNS charge; SNS stores messages with disk encryption by default, KMS SSE optional.

## Open pre-flags

Leads for rows not yet done. **A pre-flag is a lead, not a finding.** Re-verify before acting. Delete the entry once its row is complete. The cuts listed here are the ownership-map dispositions each row still has to carry out; the seams are where Phase 0 pasted content.

| Target row | Lead |
|---|---|
| 21 eventbridge | Owns EventBridge vs SNS; row 20's version cuts. The choreography pattern cuts to a clause (Architecture owns). Re-verify pricing and throughput quotas. |
| 22 step-functions | Orchestration vs choreography cuts to a clause. Check JSONata and variables (late 2024) as a gap. Re-verify the Standard vs Express limits. Lambda durable functions (row 12 owns) are the in-code alternative; keep one clause of when each fits. |
| 23 kinesis | Rename Firehose throughout. Check on-demand capacity mode changes (2025 lead). MSK is absent (clause). |
| 24 cfn-fundamentals | Seam: the Outputs section (exports and `ImportValue`) sits after Template Anatomy; teach cross-stack coupling there (exports block deletion of the exporting stack; SSM parameters as the looser alternative). With this row, bring `_resources/cloudformation-template-reference.md` to the resource standard: a one-line lead-in per section, no narrative framing. Check the IaC generator and Git sync as gaps. |
| 25 cfn-advanced | Seams: "Interpret Drift Results" and "Fix Drift" are appended under Drift Detection and overlap Handling Drift. The new H2 "Bringing Existing Resources Under CloudFormation" keeps the old guide's "Step 3/4/5" subsection titles and its overview list; retitle them, and fold Common Challenges into the flow. The file is now whole-document raw-wrapped. Check stack refactoring (2025 lead) and CloudFormation Hooks. The "Testing" best practices cut to a clause (`infrastructure/iac-testing.md` owns). |
| 26 cdk | The "CDK vs Terraform/Pulumi" section cuts to a clause (`infrastructure/iac-tools-comparison.md` owns). Check `cdk refactor` and the CDK Toolkit Library (2025 leads). |
| 27 sam | Owns SAM vs CDK; the "SAM vs CloudFormation vs CDK" comparison and the later "SAM vs CDK" section duplicate each other. The CI/CD pipeline section cuts to a clause. |
| 28 codepipeline-codebuild | CodeCommit is GA again (see Cross-guide facts). Check V2 pipeline type pricing (per action-minute) and triggers. "vs GitHub Actions/GitLab/Jenkins/CircleCI" is a product catalogue: keep the selection reasoning only. |
| 29 codedeploy | Check ECS native blue/green (2025 lead) and what it leaves CodeDeploy for on ECS. Strategy concepts cut to a clause. ECS built-in blue/green (July 2025) and linear/canary (October 30, 2025, ALB or Service Connect only) reached parity with CodeDeploy; row 13 states them. |
| 30 cognito | Empty seed: write the whole guide. Check the Cognito feature tiers (Lite, Essentials, Plus; late 2024) and managed login. OAuth/OIDC protocol flows are owned by `security/identity-access-management.md`. |
| 31 kms-secrets | Replace "CMK" terminology. Owns Parameter Store vs Secrets Manager; row 37's version cuts. Re-verify KMS request quotas and rotation options (on-demand rotation, rotation period). |
| 32 waf-shield | Re-verify Shield Advanced pricing and commitment. Check Bot Control and the targeted inspection levels. |
| 33 cloudtrail-config | "One trail per Region (not per account)" reads backwards; check it against multi-Region and organization trails. Check CloudTrail Lake's current status and pricing. Integration pattern 4 (QuickSight dashboard) may cut. |
| 34 security-hub | Security Hub was relaunched in 2025, with the earlier capability renamed Security Hub CSPM; verify both and the findings format (ASFF vs OCSF). Check GuardDuty Extended Threat Detection and the protection plan list. |
| 35 cloudwatch | Seam: "Embedded Metric Format (EMF)" sits at the end of CloudWatch Metrics with a Python sample. Remove the sibling link at line 819. Check Application Signals, Transaction Search, and log classes as gaps. The "CloudWatch vs X-Ray" section cuts (row 36 owns tracing). |
| 36 xray | The X-Ray SDKs and daemon are reportedly moving to maintenance in favour of OpenTelemetry/ADOT; verify the dates and re-centre instrumentation on OpenTelemetry if confirmed. |
| 37 systems-manager | Parameter Store vs Secrets Manager cuts to a clause (row 31). Check the unified Systems Manager experience (late 2024), and whether any capability (e.g. Incident Manager, Change Manager) is closed to new customers. |
| 38 cost-management | Owns commitment mechanics; rows 11, 13, 16, 18, 43 cut theirs as those rows run. Check Cost Optimization Hub as a gap and Database Savings Plans (late-2025 lead). Check the number of Trusted Advisor categories. |
| 39 ecr-security | Runtime detection cuts to a clause (row 34 owns GuardDuty Runtime Monitoring). The secrets section cuts to a clause (row 31). Check Inspector enhanced scanning, pull-through cache, and image signing. |
| 40 advanced-containers | Remove the App Mesh section; service-mesh options on AWS are now ECS Service Connect, VPC Lattice, and self-managed Istio/Linkerd on EKS. The mesh concept cuts to a clause (Architecture owns). GitOps cuts to a clause. HPA/VPA are generic Kubernetes: keep only the AWS interaction. Check EKS Pod Identity vs IRSA. Row 13 already has a concept-level capacity table (Fargate, EC2, ECS Managed Instances) and an EKS node-option table (managed node groups, Auto Mode, Fargate, self-managed, hybrid); go deeper, don't repeat. |
| 41 glue | The "Glue vs AWS Data Pipeline" section is likely obsolete (Data Pipeline is in maintenance mode); verify and cut. The "Glue vs dbt" catalogue keeps selection reasoning only. |
| 42 athena | The "vs BigQuery/Snowflake" catalogue cuts. Check result reuse and provisioned capacity. |
| 43 redshift | Moved from Databases. Check RA3 vs Serverless guidance, zero-ETL integrations, and whether DC2 is retired. |
| 44 quicksight | QuickSight appears to have been folded into Amazon Quick Suite (late-2025 lead); verify the naming and pricing model. The visual-type, theme, and formatting sections fail the durable test: cut to what a reader decides. The Tableau/Power BI/Looker comparison keeps selection reasoning only. |
| 45 data-architecture | Lake, warehouse, and lakehouse concepts cut to AWS mapping (`data/data-architecture.md` owns). Check SageMaker Lakehouse, S3 Tables/Iceberg, and zero-ETL as gaps. Row 14 gives S3 Tables, S3 Metadata (journal plus optional live inventory Iceberg tables), and S3 Vectors one line each; this row owns their analytics use. |
| 46 ml-selection | Seam: "Prebuilt AI Services" (three H3s, one per merged guide) took the guide from ~4k to ~12k words. Cut to durable reasoning; drop the capability catalogues and pricing tables. Scenario and "real-world impact" figures need sources or cutting. Add Bedrock as a tier. Retitle to cover the prebuilt services. |
| 47 bedrock | Empty seed: write the whole guide (the only Bedrock mention in the merged guides was one bullet, left in row 46). Verify the current feature set (Knowledge Bases, Agents, AgentCore, Guardrails, model customization, cross-Region inference). LLM concepts are clauses (AI & ML category owns). |
| 48 sagemaker | Rename to SageMaker AI where it means the ML service. Check the relationship to SageMaker Unified Studio (late 2024). The "vs Vertex AI/Databricks" catalogue cuts. |
| 49 migration-strategy | AWS Prescriptive Guidance uses 7 Rs (adds Relocate); verify. The Migration Tools section cuts to a clause (row 50). Check Migration Hub status and AWS Transform (2025 leads). Phase durations need a source. |
| 50 migration-services | Check DMS Serverless and DMS Schema Conversion (replacing standalone SCT). |
| 51 hybrid | The connectivity-options section has moved to row 10; the Decision Framework's Step 1 and the patterns still assume it, so cut those to a clause. The DR pattern cuts to a clause (row 53). Check Outposts form factors. |
| 52 multi-region | Route 53 routing sections cut to a clause (row 6). "Strong consistency (Aurora Global Database)" is likely wrong, since secondaries replicate asynchronously; verify. Check DynamoDB global tables multi-Region strong consistency (2025 lead). Row 14 owns S3 replication mechanics (versioning on both, Batch Replication, RTC 99.9% within 15 minutes with SLA, permanent version deletes and lifecycle delete markers not replicated); state only the multi-Region design here. |
| 53 disaster-recovery | RTO/RPO definitions and the strategy spectrum cut to a clause (`infrastructure/disaster-recovery-patterns.md` owns). AWS Elastic Disaster Recovery is absent (item-3 gap); check AWS Backup and Application Recovery Controller coverage. The "DR Test Plan Template" may fail the Lookup Test. |

## Unverified, left standing

Claims on finished guides that could not be confirmed against a source. Each was softened rather than asserted; revisit if a source turns up.

*(Empty at the start.)*

## Progress

| # | Subcategory | Guide | Status |
|---|---|---|---|
| 1 | Foundations | aws-well-architected-framework.md | Complete |
| 2 | Foundations | aws-iam-fundamentals.md | Complete |
| 3 | Foundations | aws-organizations-control-tower.md | Complete |
| 4 | Networking & Content Delivery | aws-vpc-architecture.md | Complete |
| 5 | Networking & Content Delivery | aws-elastic-load-balancing.md | Complete |
| 6 | Networking & Content Delivery | aws-route53.md | Complete |
| 7 | Networking & Content Delivery | aws-cloudfront.md | Complete |
| 8 | Networking & Content Delivery | aws-api-gateway.md | Complete |
| 9 | Networking & Content Delivery | aws-privatelink-transit-gateway.md | Complete |
| 10 | Networking & Content Delivery | aws-direct-connect-vpn.md | Complete |
| 11 | Compute Services | aws-ec2-fundamentals.md | Complete |
| 12 | Compute Services | aws-lambda-fundamentals.md | Complete |
| 13 | Compute Services | aws-container-services.md | Complete |
| 14 | Storage Services | aws-s3-fundamentals.md | Complete |
| 15 | Storage Services | aws-ebs-efs.md | Complete |
| 16 | Database Services | aws-rds-aurora.md | Complete |
| 17 | Database Services | aws-dynamodb.md | Complete |
| 18 | Database Services | aws-elasticache.md | Complete |
| 19 | Database Services | aws-database-selection.md | Complete |
| 20 | Application Integration & Messaging | aws-sqs-sns.md | Complete |
| 21 | Application Integration & Messaging | aws-eventbridge.md | In progress |
| 22 | Application Integration & Messaging | aws-step-functions.md | Not started |
| 23 | Application Integration & Messaging | aws-kinesis.md | Not started |
| 24 | Infrastructure as Code | cloudformation-fundamentals.md | Not started |
| 25 | Infrastructure as Code | cloudformation-advanced.md | Not started |
| 26 | Infrastructure as Code | aws-cdk.md | Not started |
| 27 | Infrastructure as Code | aws-sam.md | Not started |
| 28 | Developer Tools & CI/CD | aws-codepipeline-codebuild.md | Not started |
| 29 | Developer Tools & CI/CD | aws-codedeploy.md | Not started |
| 30 | Security & Compliance | aws-cognito.md | Not started |
| 31 | Security & Compliance | aws-kms-secrets-manager.md | Not started |
| 32 | Security & Compliance | aws-waf-shield.md | Not started |
| 33 | Security & Compliance | aws-cloudtrail-config.md | Not started |
| 34 | Security & Compliance | aws-security-hub-guardduty.md | Not started |
| 35 | Management & Governance | aws-cloudwatch.md | Not started |
| 36 | Management & Governance | aws-xray.md | Not started |
| 37 | Management & Governance | aws-systems-manager.md | Not started |
| 38 | Management & Governance | aws-cost-management.md | Not started |
| 39 | Containers in Production | aws-ecr-container-security.md | Not started |
| 40 | Containers in Production | advanced-container-patterns.md | Not started |
| 41 | Analytics & Data Processing | aws-glue.md | Not started |
| 42 | Analytics & Data Processing | aws-athena.md | Not started |
| 43 | Analytics & Data Processing | aws-redshift.md | Not started |
| 44 | Analytics & Data Processing | aws-quicksight.md | Not started |
| 45 | Analytics & Data Processing | aws-data-architecture.md | Not started |
| 46 | Machine Learning & AI | aws-ml-service-selection.md | Not started |
| 47 | Machine Learning & AI | aws-bedrock.md | Not started |
| 48 | Machine Learning & AI | aws-sagemaker.md | Not started |
| 49 | Migration & Hybrid Cloud | aws-migration-strategy.md | Not started |
| 50 | Migration & Hybrid Cloud | aws-migration-services.md | Not started |
| 51 | Migration & Hybrid Cloud | aws-hybrid-cloud-architecture.md | Not started |
| 52 | Resilience | multi-region-architecture.md | Not started |
| 53 | Resilience | disaster-recovery.md | Not started |
