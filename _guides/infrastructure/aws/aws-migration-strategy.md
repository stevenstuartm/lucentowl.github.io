---
title: "AWS Migration Strategy: The 7 Rs, Portfolio Assessment, and Waves"
layout: guide
category: AWS
subcategory: Migration & Hybrid Cloud
description: "How a migration to AWS is planned: the seven strategies (the 7 Rs) and how to assign one to each application component, portfolio discovery and the business case, grouping applications into move groups and waves, the assess, mobilize, and migrate phases, and what AWS Transform replaced."
tags: [migration, 7-rs, portfolio-assessment, wave-planning, aws-transform, cloud-adoption-framework, practical]
---

## What a Migration Strategy Decides

Moving a data center or a portfolio of applications to AWS involves two kinds of decisions. The first is made per application. Each one gets a **migration strategy**, the approach used to move it, which ranges from shutting it down to rebuilding it. The second is made for the program as a whole: how the organization gets ready, in what order the applications move, and how the work scales from a handful of servers to thousands.

A portfolio of 500 applications won't move one at a time with a fresh debate over each. Its owners assign strategies from discovery data and a few rules, group the applications into batches, and run each batch through a repeatable process that ends in a **cutover**, the switch of users and traffic from the source system to its copy in AWS. This guide covers that planning. The services that copy servers, databases, and files belong to the execution step and appear here only where the plan depends on them.

---

## The Seven Strategies

AWS Prescriptive Guidance names seven strategies, known as the **7 Rs**. Earlier AWS material listed six, and the seventh, Relocate, was added for moves that keep the virtualization platform.

| Strategy | What changes | Typical AWS path |
|---|---|---|
| **Retire** | The application is decommissioned or archived | Archive its data, often to S3, then shut down its servers |
| **Retain** | Nothing yet, since it stays in the source environment | Revisit at a set review date or the next hardware refresh |
| **Rehost** ("lift and shift") | Only the infrastructure, with servers running unchanged on EC2 | Replicate each server's disks to AWS and launch it on EC2 |
| **Relocate** | Only the hosting platform, with VMs staying on VMware | Run VMware Cloud Foundation on EC2 bare metal instances |
| **Repurchase** ("drop and shop") | The product, replaced by SaaS or a newer version | Data migration and identity integration into the new product |
| **Replatform** ("lift, tinker, and shift") | Some components, which move to managed services | A self-managed database to RDS, VMs to containers, Windows to Linux |
| **Refactor** (re-architect) | The architecture, rebuilt around cloud-native services | A new design, delivered incrementally |

### Retire and Retain Shrink the Migration

Every application retired or retained is one the migration doesn't have to move, test, or cut over, so these two decisions come first. AWS's guidance defines two retirement signals from measured utilization. A **zombie** application averages below 5% CPU and memory use. An **idle** one averages between 5% and 20% over 90 days. An application with no inbound connections in 90 days is another candidate. The numbers find candidates, and the application's owner confirms, because a quarterly batch job or a compliance archive can look unused for most of a year.

Retain covers applications that can't or shouldn't move yet. Data residency rules, a dependency on hardware with no cloud equivalent (such as equipment on a factory floor), mainframe or non-x86 Unix systems that need their own assessment, a recent on-premises upgrade, or a vendor about to release a SaaS version are all reasons. Retain is a decision with a review date, not a permanent exemption.

### Rehost and Relocate Move Without Changing the Application

**Rehost** replicates each server's disks to AWS and launches the server as an EC2 instance. The operating system, application, and configuration stay the same, and the application keeps serving users while replication runs, so downtime shrinks to the cutover window. Rehosting a large estate is mostly logistics, and it is among the most common strategies in large migrations.

**Relocate** moves a whole virtualization platform rather than individual servers. An organization whose VMs run on VMware Cloud Foundation, VMware's stack of hypervisor, storage, and networking software, can run the same stack in its own VPC with **Amazon Elastic VMware Service** (Amazon EVS), generally available since August 2025. Amazon EVS deploys it on EC2 bare metal instances, so VMs move without conversion, keep their IP addresses, and keep their runbooks. The organization brings its own VMware Cloud Foundation subscription, an ongoing license cost on top of the bare metal instances that rehosting doesn't carry. AWS also applies the name Relocate to moving existing AWS resources to a different VPC, account, or Region, such as an RDS instance moving to another account.

The two differ in what the team operates afterward. A rehosted server is an EC2 instance, managed with AWS tooling from day one. A relocated VM sits in a VPC and can call AWS services, but it is still managed with VMware tools under a VMware license, and dropping that license later means rehosting or replatforming it after all.

### Replatform Takes the Cheap Wins

**Replatform** changes only the parts that pay back quickly without redesign. Typical changes include moving a self-managed SQL Server or MySQL database to Amazon RDS, moving from Windows to Linux by porting a .NET Framework application to modern .NET, or packaging VMs as containers. Moving to Graviton instances is another, since AWS's own Arm-based processors give better price performance than comparable x86 instances. The application's architecture stays the same, but patching, backups, and failover for the replaced components become AWS's job.

### Repurchase Swaps the Product

**Repurchase** replaces the application with a product, usually SaaS, such as a hosted CRM in place of a customized on-premises one. The migration work shifts from servers to data. The team exports and loads the data, wires the product into the organization's identity provider, sets up network paths for integrations, and retrains users. The trade is less control and a subscription in exchange for no infrastructure to run.

### Refactor Only When Nothing Else Works

**Refactor** rebuilds the application around cloud-native services as part of the move, and it is the most complex and costly strategy. For large migrations, AWS recommends refactoring only when no other strategy is acceptable. Changing an application's design while also changing where it runs mixes two risks, and a portfolio full of redesigns stalls the migration's schedule. The usual pattern is to rehost, relocate, or replatform first, then modernize applications once they run in AWS, where they can adopt managed services one piece at a time with the techniques in [Legacy Modernization Strategies](/study-guides/architecture/legacy-modernization-strategies.html).

AWS's examples of applications that justify refactoring during the migration include a monolith that already blocks product delivery, a mainframe application that can't meet demand or costs too much to keep, code nobody can maintain or whose source is lost, and a database whose regulated tables must stay on premises, which has to be split before the rest of it can move.

---

## Assigning a Strategy to Each Application

### Discovery Comes First

Strategy assignment runs on data, not on interviews alone. Discovery collects, for every server, its specifications, installed software, the network connections it makes and accepts, and utilization sampled every few minutes over at least a month, so monthly peaks show up. Connection data turns a server list into an application map, showing which servers form one application and which applications call each other. Interviews with application owners then add what tools can't see, such as business criticality, compliance constraints, planned retirements, and licensing terms.

### Components, Not Whole Applications

AWS's portfolio guidance assigns strategies to application components rather than to applications as a whole. A three-tier application might rehost its web tier, replatform its database to RDS, and refactor the one service that holds the business back. Assigning one strategy to the whole application either drags every tier through a redesign or leaves the database on a server the team still patches.

### A Decision Order

With that data, most components fall to a strategy by answering questions in a fixed order. The first three questions look for an exit that avoids a migration project, the next two catch the platform move and the strategic rebuild, and the last one separates a light change from none.

1. **Is it still needed?** If not, retire it.
2. **Can it move now,** given residency, hardware, dependencies, and recent investment? If not, retain it with a review date.
3. **Would a SaaS or vendor product replace it well?** If so, repurchase.
4. **Does it run on VMware Cloud Foundation, with reason to stay there for now?** If so, relocate.
5. **Does its current design block the business, with no other strategy acceptable?** If so, refactor.
6. **Is there a managed service or platform change that pays back quickly?** If so, replatform. Otherwise, rehost.

Rehost sits at the bottom because it is the fastest path for anything that doesn't qualify for a cheaper or more valuable one. AWS's guidance is that a decision tree like this should hold for at least 70 to 80 percent of workloads. The rest are exceptions, and the team records why each one overrides the tree rather than editing the tree for it, which would leave several versions of the rules in circulation.

### The Business Case

The assessment ends with a business case that compares the cost of staying with the cost of moving and running on AWS, over the same horizon. The method is ordinary total cost of ownership reasoning, covered in [Total Cost of Ownership](/study-guides/architecture/total-cost-of-ownership.html). Three costs are specific to migrations and tend to be left out:

- **Dual running.** Both environments are paid for from the first wave until the data center exits, which spans the whole migration.
- **Right-sizing.** On-premises servers are usually sized for peak and bought years ahead. Pricing EC2 at the same specifications overstates the AWS cost, and pricing from measured utilization is what discovery data is for.
- **Licensing.** Moving Windows Server, SQL Server, or Oracle licenses has rules of its own, and bring-your-own-license versus license-included pricing can outweigh the compute cost.

Savings estimates per strategy that don't come from the portfolio's own discovery data are guesses. A rehosted server costs whatever its instance, storage, and data transfer cost, and the only reliable estimate starts from what that server uses.

---

## Grouping Applications into Waves

A migration moves in **waves**, each a batch of applications cut over in the same window. A wave is built from **move groups**, the sets of servers and applications that have to move together.

{% include figure.html id="aws-migration-move-groups" %}

### Dependencies Decide the Move Groups

A move group forms around a rule that ties applications together. Applications that share a database move together, because splitting them leaves one application in AWS calling a database in the data center over a VPN or Direct Connect link, with latency on every query. Applications that call each other constantly belong together for the same reason. Operational ties count too. Applications that share one owner, who can attend only one cutover window, or one patch schedule go in the same group.

Some dependencies don't form groups at all. A directory service such as Active Directory, or DNS, is used by every application, so it would pull the whole portfolio into one group. Instead, the team builds those shared services in AWS before the first wave moves, such as a domain controller in the **landing zone**, the multi-account AWS environment prepared for the migration (set up in the mobilize phase described below). When a dependency can't move and isn't shared by everything, such as a mainframe, the applications that need it reach it over the hybrid link for as long as it stays behind.

### Waves Start Small and Grow

AWS's playbook for large migrations sizes waves to learn first and scale later:

- **Early waves** hold fewer than 10 servers, low-complexity applications, and development or test environments, so the team learns the tools and the cutover process where a mistake costs little.
- **Order within the portfolio** runs from non-critical to mission-critical, from small user bases to large ones, and from small data volumes to large ones.
- **Wave size** stays under about 50 servers, within what the migration team can cut over and what the network link can replicate. AWS's rule of thumb is that four architects can rehost up to 50 servers a week.
- **Planning runs ahead** by at least four or five waves, so application owners, change approvals, and test plans are lined up before each window arrives.

---

## The Three Phases of a Large Migration

AWS divides a large migration into three phases: **assess**, **mobilize**, and **migrate and modernize**. The AWS Migration Acceleration Program (MAP), which pairs a migration with AWS and partner expertise and AWS investment, is organized around the same three phases. Optimization continues after the last wave, but it is ordinary operation rather than a migration phase.

### Assess

Assess answers whether the organization is ready and what it is moving. It combines portfolio discovery and a high-level business case with a **Migration Readiness Assessment** (MRA), which measures the organization against the **AWS Cloud Adoption Framework** (CAF). The CAF groups the capabilities a cloud-ready organization needs into six perspectives:

| Perspective | Covers | Typical owners |
|---|---|---|
| **Business** | Strategy, the application and investment portfolio, innovation, data monetization and business insights | CEO, CFO, CIO, CTO |
| **People** | Culture, organization structure, skills, change management | CIO, CTO, cloud director |
| **Governance** | Program management, risk, cloud financial management, data governance | CIO, CFO, chief risk officer |
| **Platform** | The landing zone, architecture, workload modernization | CTO, architects, engineers |
| **Security** | Identity, data protection, threat detection, compliance | CISO, compliance, security architects |
| **Operations** | Monitoring, incident management, service delivery | Infrastructure and operations leaders, site reliability engineers |

The MRA's output is a list of gaps across those perspectives and an action plan to close them. A team that can migrate servers but has no process for approving cloud spend, or no on-call practice for AWS, finds that out here rather than after the first cutover.

### Mobilize

Mobilize builds what the migration will run on. The platform team sets up the landing zone with its networking, identity, logging, and security baseline, usually with AWS Control Tower, and builds the shared services every application depends on. The security team defines and automates the controls, and the operations team establishes the cloud operating model. Meanwhile the migration team moves a small set of real applications to production, which tests the tools, the runbooks, and the cutover process on low-risk systems. AWS runs mobilize as eight workstreams (business case, portfolio discovery, application migration, migration governance, landing zone, security, operations, and people) over eight two-week sprints, about four months.

### Migrate and Modernize

The migrate phase takes what mobilize proved and runs it at volume through a **migration factory**. The factory is a set of teams, runbooks, and automation that moves every wave through the same sequence, from replication and testing through cutover and validation to handing the application to operations. Each cutover happens in an agreed window, and the source systems stay intact with a defined way to fail back until the application has run in AWS long enough to trust. Modernization of rehosted and replatformed applications runs alongside or after the factory, one application at a time.

---

## Tools for Planning and Executing

**AWS Transform**, generally available since May 2025, is AWS's agentic AI service for migration and modernization, and the tool AWS now points new migrations to. Its server migration experience covers VMware, Hyper-V, bare metal, and other platforms. Agents run discovery, group applications and map dependencies into waves, design the landing zone, translate the source network into VPCs, and rehost servers to EC2 or containerize applications from source code, with a person approving key steps such as deploying to production. Other experiences modernize .NET Framework applications to cross-platform .NET, modernize mainframe applications (IBM z/OS and Fujitsu GS21), and assess workloads for migration readiness. Assessment and the VMware, Windows, and mainframe agents carry no charge, .NET transformation is free up to a monthly allowance, and custom transformations cost $0.035 per agent minute.

AWS Transform replaced a generation of planning tools. On November 7, 2025, AWS Migration Hub (including Strategy Recommendations, Orchestrator, and Journeys), AWS Application Discovery Service, Porting Assistant for .NET, and AWS App2Container closed to new customers. Existing users can finish their projects, but a new migration plans in AWS Transform. Migration Evaluator, which builds a business case from discovery data, remains available.

The services that move the data belong to the execution step. **AWS Transform MGN**, named AWS Application Migration Service until June 8, 2026, replicates servers for rehosting, and its APIs and CLI still use `mgn`. **AWS Database Migration Service** (DMS) migrates databases, including between engines, and **AWS DataSync** transfers files and objects. Snowball Edge devices closed to new customers on November 7, 2025, so a new migration plans bulk transfers around the network, AWS Data Transfer Terminal locations, or partner solutions.

---

## Common Pitfalls

- **Assigning strategies before retiring anything.** Every application migrated that should have been retired costs replication, testing, a cutover, and then a monthly bill.
- **Refactoring by default.** Redesigning applications inside the migration schedule turns a logistics program into a portfolio of software projects, and the data center exit slips with the slowest one.
- **Splitting a shared database across waves.** The application left behind, or the one moved ahead, pays network latency on every query. Build move groups from connection data first and owner and schedule ties second.
- **Moving the directory with the applications.** Active Directory and DNS belong in the landing zone before wave 1, not in a move group.
- **No way back.** A cutover with no fail-back plan turns a bad weekend into an outage. Keep the source intact until the application has proved itself in AWS.

---

## Key Takeaways

- Each application component gets one of seven strategies: retire, retain, rehost, relocate, repurchase, replatform, or refactor. Decide retire and retain first, since each removes work.
- Rehost and relocate move applications without changing them. Refactor during a large migration only when no other strategy is acceptable, and modernize the rest after the move.
- Assign strategies from discovery data (at least a month of utilization, connections, installed software) plus owner interviews, and base the business case on measured utilization, dual running, and licensing.
- Shared dependencies bind applications into move groups, and move groups fill waves. Build directory and DNS in AWS first, start with waves under 10 servers in lower environments, cap waves near 50 servers, and plan four or five waves ahead.
- A large migration runs as assess (discovery, business case, readiness against the CAF's six perspectives), mobilize (landing zone, shared services, operating model, a first set of migrated applications), and migrate at scale through a migration factory.
- AWS Transform is the current planning and migration tool. Migration Hub, Application Discovery Service, Porting Assistant for .NET, App2Container, and Snowball Edge no longer accept new customers.
