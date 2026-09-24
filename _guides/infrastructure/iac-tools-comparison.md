---
title: "Choosing an IaC Tool"
layout: guide
category: Infrastructure & Cloud
subcategory: Infrastructure as Code
description: "How to choose between CloudFormation, CDK, Bicep, Terraform, OpenTofu, Pulumi, and Ansible by the questions that actually separate them: provisioning or configuration, one cloud or many, a configuration language or a programming language, who holds the state, and who stewards the tool."
tags: [practical, decision-making, terraform, opentofu, pulumi, bicep, cloudformation]
---

## The Questions That Separate the Tools

Most IaC tools can create most cloud resources, so comparing feature lists rarely decides anything. What separates them is a handful of design choices, each of which suits some teams and costs others:

1. **Provisioning or configuration management?** Creating cloud resources, or setting up software inside machines.
2. **One cloud or several?** A tool built by one cloud vendor, or one that talks to many APIs.
3. **A configuration language or a programming language?** A restricted language built for describing resources, or C#, TypeScript, or Python.
4. **Who holds the state?** The cloud service, storage the team looks after, or a hosted service.
5. **Who stewards the tool?** A cloud vendor, a single company, or a foundation, and under what license.

The sections below take each question in turn, and the decision tree at the end combines them.

---

## Provisioning or Configuration Management

The first question usually settles which *kind* of tool, not which tool. Provisioning tools are the main subject of this guide. Configuration management tools fill a narrower need, and a team that builds its configuration into machine or container images may not need one at all. Where both are needed, the common answer is two tools: a provisioning tool creates the machines, and a configuration tool sets them up.

Using one tool for both jobs tends to go badly. [Ansible](https://docs.ansible.com/){:target="_blank" rel="noopener noreferrer"} can create cloud resources, but it keeps no record of what it created, so removing a resource from a *playbook* (Ansible's file of ordered tasks) does not remove it from the cloud. Provisioning tools can hand a machine a startup script, but they have no way to keep what runs inside it configured afterwards.

Among configuration tools, the main choice is how changes reach machines. Ansible is **agentless**. It connects over SSH (or WinRM, Windows' remote management protocol) from wherever it runs and needs nothing installed on the target. [Chef](https://www.chef.io/){:target="_blank" rel="noopener noreferrer"} and [Puppet](https://www.puppet.com/){:target="_blank" rel="noopener noreferrer"} traditionally run an **agent** on every machine that pulls its configuration from a server and re-applies it on a schedule. The agent corrects drift continuously, but it is one more thing to install, secure, and upgrade on every server.

---

## One Cloud or Several

**Cloud-native tools** are built by a cloud vendor for its own platform. On AWS that means [CloudFormation](https://docs.aws.amazon.com/cloudformation/){:target="_blank" rel="noopener noreferrer"} and [AWS CDK](https://docs.aws.amazon.com/cdk/){:target="_blank" rel="noopener noreferrer"}, which generates CloudFormation templates. On Azure it means [Bicep](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/overview){:target="_blank" rel="noopener noreferrer"}, which compiles to the JSON templates that Azure Resource Manager (ARM), Azure's deployment service, accepts. Google Cloud no longer has a separate native language. Its old Deployment Manager is out of support and shuts down in mid-2027, and its replacement, Infrastructure Manager, runs Terraform, though only versions up to 1.5.7, the last release under the open-source license.

The cloud-native tools add no charge for the vendor's own resource types (CloudFormation bills only for third-party resource types and custom hooks, which are checks that run before a deployment), the vendor supports them, and they often support new services early. Coverage is not complete, though. AWS publishes a coverage roadmap because some features reach CloudFormation after they reach the API.

**Multi-cloud tools** such as [Terraform](https://developer.hashicorp.com/terraform){:target="_blank" rel="noopener noreferrer"}, [OpenTofu](https://opentofu.org/){:target="_blank" rel="noopener noreferrer"}, and [Pulumi](https://www.pulumi.com/docs/){:target="_blank" rel="noopener noreferrer"} reach each API through providers. The Terraform and OpenTofu registries hold providers for every major cloud and for thousands of other services, including Kubernetes, GitHub, DNS hosts, and monitoring products, and Pulumi can use Terraform providers alongside its own.

"Multi-cloud" is easy to misread. It means one language, one workflow, and one state model across providers. It does not mean portable definitions. An AWS database and an Azure database are different resources with different settings, and moving a workload between clouds still means rewriting its definitions. The value lies in not learning a second toolchain.

That makes the question broader than it first looks. A team whose compute runs entirely on AWS may still manage DNS at another provider, repositories in GitHub, and alerts in a monitoring service. A multi-cloud tool can manage all of those in the same plan. A cloud-native tool reaches only some of them, through third-party extensions, with far thinner coverage than the Terraform registry's. So the cloud-native answer fits best when everything the team wants under code lives in one cloud, which is a narrower condition than it sounds.

---

## A Configuration Language or a Programming Language

Some tools use a language designed only for describing resources: **HCL** (HashiCorp Configuration Language) for Terraform and OpenTofu, **YAML or JSON** for CloudFormation, and **Bicep's own language** for Azure. Others use general-purpose languages. AWS CDK supports TypeScript, JavaScript, Python, Java, C#, and Go, and Pulumi supports TypeScript, JavaScript, Python, Go, .NET languages, and Java. Pulumi also accepts YAML and, since 2026, HCL, running Terraform-style `.tf` files directly, so it now spans both groups.

Loops and conditionals are not what separates the two groups, because the configuration languages have them too. Here is a set of versioned log buckets, one per environment, in Terraform and in AWS CDK with C#:

```hcl
# Terraform
resource "aws_s3_bucket" "logs" {
  for_each = toset(["dev", "staging", "prod"])
  bucket   = "example-logs-${each.key}"
}

resource "aws_s3_bucket_versioning" "logs" {
  for_each = aws_s3_bucket.logs
  bucket   = each.value.id
  versioning_configuration {
    status = "Enabled"
  }
}
```

```csharp
// AWS CDK (C#)
foreach (var env in new[] { "dev", "staging", "prod" })
{
    new Bucket(this, $"Logs-{env}", new BucketProps
    {
        BucketName = $"example-logs-{env}",
        Versioned = true
    });
}
```

The differences show up at a larger scale:

| | Configuration language | Programming language |
|---|---|---|
| Abstraction | Modules with inputs and outputs | Classes, interfaces, and packages from the language's own ecosystem |
| Testing | The tool's test command where one exists, plus linters and policy scanners | The language's unit test frameworks, plus the tool's testing support |
| Editor support | Syntax checking and completion through tool-specific extensions | The language's full compiler, type checking, and refactoring |
| Reading a change | The code is close to what gets created | The code *builds* the resources, so reviewers often read the generated CloudFormation template or the plan instead |
| Who already knows it | Often operations engineers | Often application developers |
| Main risk | Repetition when abstraction runs out | Layers of abstraction that hide what gets created |

The last row matters most. A configuration language limits what an author can do, which also limits how confusing the result can get. A programming language lets a platform team build a tested library of approved components that application teams use in a few lines, and it also lets someone build a framework nobody else can follow. Whichever the team picks, reviewing the plan stays the reliable check, because it shows the effect no matter how the code produced it.

---

## Who Holds the State

Most tools keep a record that maps each definition to the real resource it created, and they differ in who looks after it.

| Model | Tools | What the team looks after |
|---|---|---|
| **Kept by the cloud service** | CloudFormation (as a stack), CDK (through CloudFormation) | Nothing; the service stores and locks it |
| **No record kept** | Bicep, whose resources have predictable IDs | Deletion. By default, removing a definition leaves the resource in Azure; deleting it takes Azure's deployment stacks (or the older complete mode, which is being deprecated) |
| **Hosted service** | [HCP Terraform](https://developer.hashicorp.com/terraform/cloud-docs){:target="_blank" rel="noopener noreferrer"} (formerly Terraform Cloud), [Pulumi Cloud](https://www.pulumi.com/docs/iac/concepts/state-and-backends/){:target="_blank" rel="noopener noreferrer"} (Pulumi's default, which since 2026 also hosts Terraform and OpenTofu state), and third-party platforms such as Spacelift, env0, and Scalr | Access control and the subscription |
| **Self-managed** | Terraform, OpenTofu, or Pulumi with storage the team runs | Storage, locking, encryption, access, backups, and recovery |

Self-managed state is the model with an ongoing operating cost. The state holds every managed resource's attributes, often including secrets, and losing or corrupting it leaves the tool unaware of what it manages. None of the safeguards is hard, but all of them are the team's job, and getting them wrong is a common reason a first Terraform setup goes badly.

That cost pays off when the tool brings something the service-held ones cannot. The usual reasons are managing more than one cloud, or non-cloud services, from one codebase, an organization standard, or a team and codebase that already use the tool. The cost is harder to justify for a team that is entirely on AWS or Azure, has no existing investment, and picks a self-managed tool by default. There, CloudFormation, CDK, or Bicep removes most of the state problem.

---

## Who Stewards the Tool

A tool chosen now will be in use for years, and several have changed hands, licenses, or status recently:

- **Terraform** moved in 2023 from an open-source license to the Business Source License, which allows free use but forbids offering Terraform in a product that competes with HashiCorp. HashiCorp is now part of IBM.
- **OpenTofu** is a fork of Terraform: a copy of its last open-source code, developed independently since under the MPL 2.0 license. It joined the Cloud Native Computing Foundation (CNCF) in 2025 at *sandbox* level, the foundation's entry stage for early projects. It started as a drop-in replacement and has since added features Terraform lacks, such as built-in state encryption, so the two are gradually diverging.
- **CDK for Terraform**, HashiCorp's programming-language front end for Terraform, was archived in December 2025.
- **Google Cloud Deployment Manager** reached end of support in 2026, replaced by Terraform through Infrastructure Manager.
- **Puppet's** owner, Perforce, moved its builds to private repositories in 2025 under a license that is free only up to 25 nodes. The community forked the open-source code as OpenVox.

The pattern is that tools backed by one company's commercial interests can change terms, and tools with a thin user base can be retired. For most teams this argues for a mainstream tool with a large community and a credible fallback. Terraform and OpenTofu are each other's fallback, and CloudFormation and Bicep are backed by the clouds they serve.

---

## Deciding

```
Is the job configuring software inside machines rather than creating cloud resources?
├─ Yes → Ansible (agentless), or Chef/Puppet where already in place
└─ No → Does everything to be managed live in one cloud (no other clouds,
        and no GitHub, DNS, or monitoring services under the same code)?
        ├─ Yes, AWS          → CloudFormation, or AWS CDK for a programming language
        ├─ Yes, Azure        → Bicep, with deployment stacks if removals should delete
        ├─ Yes, Google Cloud → Terraform, through Infrastructure Manager or directly
        └─ No → A tool with its own state: host it, or run storage for it
                 ├─ Programming language wanted → Pulumi
                 └─ Configuration language      → Terraform, or OpenTofu where an
                                                  open-source license matters
```

Treat the tree as a default, not a rule. A team on one cloud that strongly prefers a programming language may still choose Pulumi and accept the state cost. An existing codebase, the team's experience, or an organization standard can outweigh any branch, because switching tools has a cost that a small advantage does not repay.

---

## Switching Tools Later

A switch rarely means recreating infrastructure. Tools that keep state can *import* resources that already exist, taking them under management without rebuilding them, and Bicep takes over any existing resource whose type, name, and resource group match a definition, but the first deployment resets any property the definition leaves out to its default, so definitions have to be complete before they take over live resources. So a migration can move resources one group at a time. The work is in rewriting the definitions and in the period when two tools each manage part of the estate.

Some paths are easier than others:

- **Terraform to OpenTofu** is documented and usually straightforward, though the gap grows as the two diverge.
- **CloudFormation to CDK** can start by including existing templates in a CDK app and converting them gradually.
- **Terraform to Pulumi** can keep the existing HCL, which Pulumi now runs directly, or convert it into a Pulumi program in another language. Either way, Pulumi does not read Terraform's state, so existing resources come across through Pulumi's import.
- **Anything to Terraform or OpenTofu** relies on import, which can bring in many resources in one plan and generate starting definitions for them, though those still need rewriting into maintainable code.

The easiest switch is the one avoided. Settling the questions above before the codebase grows is cheaper than any migration.
