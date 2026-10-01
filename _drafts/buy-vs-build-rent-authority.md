---
layout: post
title: "Buy vs Build Is Really Rent vs Own Authority"
description: "Adopting a managed service or a vendor-controlled project hands its owner four decisions that buy vs build estimates leave out: when you upgrade, what you pay, what the next version's license allows, and when the product ends. Forks recovered some of that authority for open code, funded by the companies the relicensing targeted, but a managed service leaves nothing to fork and only its contract protects you."
tags: [architecture, build-vs-buy, vendor-lock-in, open-source, cloud, decision-making]
author: steven-stuart
sources:
  - title: "AWS: How to migrate your AWS CodeCommit repository to another Git provider (2024)"
    url: "https://aws.amazon.com/blogs/devops/how-to-migrate-your-aws-codecommit-repository-to-another-git-provider/"
  - title: "AWS: The Future of AWS CodeCommit (2025)"
    url: "https://aws.amazon.com/blogs/devops/aws-codecommit-returns-to-general-availability"
  - title: "Amazon EKS User Guide: Understand the Kubernetes version lifecycle on EKS"
    url: "https://docs.aws.amazon.com/eks/latest/userguide/kubernetes-versions.html"
  - title: "Amazon EKS Pricing"
    url: "https://aws.amazon.com/eks/pricing/"
  - title: "Kubernetes Releases"
    url: "https://kubernetes.io/releases/"
  - title: "Jeff Barr: New AWS Public IPv4 Address Charge (AWS News Blog, 2023)"
    url: "https://aws.amazon.com/blogs/aws/new-aws-public-ipv4-address-charge-public-ip-insights/"
  - title: "AWS Customer Agreement"
    url: "https://aws.amazon.com/agreement/"
  - title: "Google Cloud Platform Terms of Service"
    url: "https://cloud.google.com/terms"
  - title: "Amazon API Gateway Pricing"
    url: "https://aws.amazon.com/api-gateway/pricing/"
  - title: "HashiCorp adopts Business Source License (2023)"
    url: "https://www.hashicorp.com/blog/hashicorp-adopts-business-source-license"
  - title: "Redis Adopts Dual Source-Available Licensing (2024)"
    url: "https://redis.io/blog/redis-adopts-dual-source-available-licensing/"
  - title: "Shay Banon: Upcoming licensing changes to Elasticsearch and Kibana (Elastic, 2021)"
    url: "https://www.elastic.co/blog/elastic-license-v2"
  - title: "AWS: Get started with Amazon ElastiCache for Valkey (2024)"
    url: "https://aws.amazon.com/blogs/database/get-started-with-amazon-elasticache-for-valkey/"
  - title: "Amazon ElastiCache User Guide: Engine versions and upgrading"
    url: "https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/engine-versions.html"
  - title: "Shay Banon: Elasticsearch is Open Source. Again! (Elastic, 2024)"
    url: "https://www.elastic.co/blog/elasticsearch-is-open-source-again"
  - title: "Rowan Trollope: Redis is now available under the AGPLv3 open source license (2025)"
    url: "https://redis.io/blog/agplv3/"
  - title: "Linux Foundation Launches Open Source Valkey Community (2024)"
    url: "https://www.linuxfoundation.org/press/linux-foundation-launches-open-source-valkey-community"
  - title: "Linux Foundation: Announcing OpenTofu (2023)"
    url: "https://www.linuxfoundation.org/press/announcing-opentofu"
  - title: "OpenTofu 1.7.0 is out with State Encryption (2024)"
    url: "https://opentofu.org/blog/opentofu-1-7-0/"
  - title: "Google Cloud Infrastructure Manager: Terraform version management policy"
    url: "https://docs.cloud.google.com/infrastructure-manager/docs/terraform-version-deprecation"
  - title: "AWS: Introducing OpenSearch (2021)"
    url: "https://aws.amazon.com/blogs/opensource/introducing-opensearch/"
---

In July 2024, AWS closed CodeCommit, its managed Git service, to new customers and published a guide to migrating repositories to another Git provider. Teams read the signal and planned their exits. In November 2025, AWS returned CodeCommit to full general availability. "If you invested time and resources planning or executing a migration away from CodeCommit, we apologize," the announcement said.

I keep coming back to this episode because nobody in it did anything wrong. Neither decision broke any term AWS had agreed to, and neither needed the customers' consent. The teams that migrated made a reasonable call on the information they had, and they paid for a decision that was reversed sixteen months later. They didn't choose that timing. They had rented it.

Every managed service is a decision you've rented. Read the lease. Buy vs build estimates price cost and speed. What a team also hands over when it adopts a managed service or a project one company controls is authority over four decisions: when to upgrade, what to pay, what the next version's license allows, and when the product ends. The relicensing of Terraform, Redis, and Elasticsearch showed that open code lets a well-funded community take some of that authority back by forking. A managed service leaves nothing to fork, so its terms are the only protection a team has.

## Buy vs Build Prices Cost, Not Control

The standard build-vs-buy comparison is a cost estimate. Building costs a team for the system's whole life, and buying costs fees plus integration. The comparison usually notes what buying gives up as well, with change following the vendor's roadmap and release schedule and risks like vendor viability, price increases, and lock-in.

Both entries name consequences. Neither names what the team handed over to make them possible, which is the right to decide. Lock-in is the cost of leaving, and it's the risk teams price. Before a team ever decides to leave, the owner makes decisions the team can only react to, and each one costs the team something even when it stays. The cost of those reactions is hard to estimate because the owner, not the team, decides when they arrive.

## Four Decisions a Team Hands Over

### The Provider Sets the Upgrade Window

Amazon EKS publishes its Kubernetes version lifecycle. Each minor version gets 14 months of standard support, then 12 months of extended support "at an additional cost per cluster hour." EKS pricing puts that at $0.60 per cluster per hour against $0.10 in standard support, six times the control plane fee. At the end of extended support the cluster is upgraded for the team. The EKS documentation says that "automatic updates can happen at any time after the end of extended support date. You won't receive any notification before the update," and a cluster upgraded that way cannot be rolled back.

A team running EKS chooses when to upgrade only inside a window AWS sets, and it pays more for each month it stays behind. On a small team where I ran EKS, each minor-version upgrade took a full week of research and testing. The Kubernetes project gives each minor release about a year of patch support, so a self-hosted cluster faces a similar cadence. What the managed service adds is the owner's enforcement, a surcharge for waiting and an upgrade the team didn't schedule.

### A Price Change Needs Only Notice

In July 2023, AWS announced a charge of $0.005 per hour "for all public IPv4 addresses, whether attached to a service or not," starting February 1, 2024. Before then, AWS charged only for idle addresses and extra addresses on an instance, so most public addresses in use cost nothing. Jeff Barr's announcement gave AWS's reason, that the cost of acquiring an IPv4 address "has risen more than 300% over the past 5 years." That's a sound reason, but the decision to pass the cost on, and when, was AWS's.

The contracts say this plainly. Section 3.1 of the AWS Customer Agreement says, "We may increase or add new fees and charges for any existing Services you are using by giving you at least 30 days' prior notice." The Google Cloud terms say that "Google may change the Fees at any time unless otherwise expressly agreed in an addendum or Order Form." Usage-based pricing moves the same authority in a quieter way. Amazon API Gateway bills WebSocket APIs for every message sent and received and for every connection minute, so the vendor's price model decides which of a team's designs are affordable.

### The Owner Writes the Next Version's License

HashiCorp moved its products from the Mozilla Public License to the Business Source License in August 2023. Redis moved from the BSD license to the dual RSALv2 and SSPLv1 licenses in March 2024, starting with Redis 7.4. Elastic had done the same with Elasticsearch and Kibana in 2021, moving from Apache 2.0 to the Elastic License and SSPL. Each announcement said that most end users were unaffected, and on paper that was true. The restrictions targeted companies offering the software as a competing service, and every earlier release kept its old license.

A team that self-hosts Redis internally could keep running it. It never had a say in what future versions would allow, and the change made that visible. Managed-service customers found that their provider decided for them. AWS responded to the Redis change by launching ElastiCache for Valkey, a fork of Redis, in October 2024. It priced Valkey 33% lower than other engines on its serverless tier and 20% lower on node-based clusters, and offered an in-place upgrade from Redis OSS. An ElastiCache customer can still choose the Redis OSS engine, but AWS's engine documentation lists no Redis OSS version newer than 7.1. Every newer feature arrives through Valkey. The customer's cache roadmap now follows the engine AWS picked in its dispute with Redis, at a price that makes that engine the cheaper one.

### Closing to New Customers Needs No Notice at All

Section 1.5 of the AWS Customer Agreement promises "at least 12 months' prior notice before discontinuing a material functionality of a Service that we make generally available to customers and that you are using." The Google Cloud terms promise 12 months' notice as well, with exceptions that include changes needed to "avoid a substantial economic or material technical burden."

The AWS clause protects a customer's current use. Closing a service to new customers discontinues nothing a current customer is using, so it needs no notice, and that's how CodeCommit closed in July 2024. For an existing customer, the service kept working. But a service closed to new customers looks like one heading for retirement, and the teams that read it that way began planning exits the contract didn't require them to start. AWS's decision about the service's future reached them only as a signal.

## Owners Exercise These Rights in Both Directions

The license changes didn't stay in place. Elastic added the AGPL as a licensing option in August 2024, and Shay Banon, Elastic's founder, wrote that the 2021 change had done what it was meant to do. "While it was painful, it worked. 3 years later, Amazon is fully invested in their fork." Redis added the AGPL with Redis 8 in May 2025, and its CEO, Rowan Trollope, wrote that the 2024 change "achieved our goal" and that "AWS and Google now maintain their own fork."

Both owners describe the relicensing as a move in a dispute with cloud providers, taken when it served the business and eased when it had worked. CodeCommit followed the same shape. AWS closed it on its own assessment of adoption and reopened it on its own reading of customer feedback. A reversal can look like authority returning to the users, but the owner still made both decisions.

## Forks Recover Authority for the Ecosystem, Not for a Team

If forks made rented authority easy to take back, this whole argument would matter much less. And the forks were fast. The Linux Foundation announced Valkey on March 28, 2024, eight days after Redis's license change. It announced OpenTofu on September 20, 2023, about six weeks after HashiCorp's. But what they recovered, and for whom, narrows how far that speed helps a team.

### The Forks Were Funded by the Companies the Licenses Targeted

Valkey launched with backing from AWS, Google Cloud, Oracle, Ericsson, and Snap, and its founding contributors were long-time Redis contributors from AWS, Google Cloud, and Ericsson, including Madelyn Olson of AWS, a member of the Redis core team. OpenTofu launched with more than 140 organizations pledged and a minimum of 18 full-time developers committed for at least five years. Its supporters included Spacelift, env0, and Scalr, which sell Terraform automation platforms that compete with HashiCorp's own. AWS built OpenSearch from Elasticsearch 7.10.2, which it said took "substantial work to remove Elastic commercial licensed features, code, and branding."

These forks exist because the relicensing threatened the business of companies large enough to fund a replacement. A project whose relicensing threatens nobody's business has no such rescuer, and its users keep only the last open version.

### A Fork Is a New Owner

Moving to a fork is still a migration a team has to decide on, test, and pay for. The fork has its own governance, now a foundation's instead of a company's, and its own direction. OpenTofu has shipped features of its own since the fork, such as the end-to-end state encryption in its 1.7 release. Google Cloud's Infrastructure Manager, meanwhile, supports Terraform only up to 1.5.7, the last release under the open-source license. Infrastructure Manager's customers run a Terraform version fixed by a license decision made at HashiCorp, not at the provider they chose.

A fork restores the ecosystem's right to choose who owns the code next. A single team gets to pick between owners, but it still doesn't decide what either owner does next.

### A Managed Service Leaves Nothing to Fork

Every fork above started from source code under a license that allowed copying it. CodeCommit had no such floor. When AWS closed it to new customers, no foundation could fork the service and no competitor could run the last open version, because there was no version to run. The only way CodeCommit came back was AWS changing its mind.

That makes the rights a team holds depend on what it adopted. Open code gives a team at least the last open version and the chance of a funded fork. A proprietary managed service gives it only what the contract says, which for AWS is 30 days' notice of a price increase and 12 months' notice before losing material functionality it already uses.

## Every Option Rents Some Decisions

Building doesn't mean owning every decision. A built system still runs on a language runtime and framework with their own support windows, and those support lifecycles force change on every choice. The difference between the options is how many decisions sit with someone else, and what, if anything, protects the team when that someone else acts.

| Adoption | When to upgrade | What to pay | Next version's license | When it ends |
| --- | --- | --- | --- | --- |
| Build on openly licensed components | The team, within its runtime's support window | The team's own costs | Each component's maintainers; the team can stay on the last open version | The team |
| Self-host a project one company controls | The team, until patches stop for its version | Support contracts, if any | The company; the team keeps the last open version or moves to a fork | The company decides the project's future; the team can keep running what it has |
| Managed service built on an open engine | The provider, inside its version policy | The provider, within contract notice | The provider picks which engine it offers | The provider; the team can fall back to self-hosting the engine |
| Proprietary managed service | The provider | The provider, within contract notice | Not applicable | The provider, within contract notice |

Moving down the table buys less operating work, which is why managed services often win the TCO comparison. It also moves more decisions to the provider, and the last row has no fallback outside the contract. The contract terms aren't fixed for everyone, though. Google's fee clause applies "unless otherwise expressly agreed in an addendum or Order Form," and a customer large enough to negotiate can buy back some of these decisions as price locks or longer notice periods. A team that doesn't negotiate gets the standard terms. A buy-vs-build decision is sound when it chooses the trade deliberately, knowing which decisions it hands over and whether the business can live with the owner making them.

## Reading the Lease

List the decisions your three biggest vendors could make without asking you. For each vendor, look up:

- The version-support policy, and what happens when it ends: a surcharge, an automatic upgrade, or a hard cutoff
- The notice the contract requires before a price increase, and whether an enterprise agreement or order form could lock the price
- Who decides the license of the next version, and whether you could keep running the last version you're allowed to use
- The notice required before discontinuation, and whether it covers closing to new customers or only the features you use today
- Who else would be harmed enough by each decision to fund a fork or an alternative, and whether anything exists to fork

Whatever the list shows is what the adoption actually handed over. A team can still accept it, since most of the time the owner's decisions will be ones the team would have made. But the team should know those decisions aren't its own.
