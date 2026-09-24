---
title: "Infrastructure as Code: Fundamentals"
layout: guide
category: Infrastructure & Cloud
subcategory: Infrastructure as Code
description: "What infrastructure as code is and the ideas that make it work: desired state and the plan/apply loop, declarative vs imperative definitions, idempotency, drift, in-place updates vs replacement and how to guard against it, provisioning vs configuration management, immutable infrastructure, and keeping secrets out of templates."
tags: [fundamentals, iac, idempotency, configuration-drift, immutable-infrastructure, desired-state, configuration-management]
---
{% raw %}

## What Infrastructure as Code Is

**Infrastructure as code (IaC)** is managing servers, networks, databases, and the permissions between them through definition files that a tool reads and applies, rather than through console clicks or one-off commands. The files live in version control, so a change to infrastructure goes through the same path as a change to application code: a diff, a review, an automated check, and a deployment that can be repeated.

The alternative is an environment built by hand. It works, but nobody can say exactly how it was built. Rebuilding it means following a document that has usually fallen behind. Two environments that were meant to match diverge one manual fix at a time, and a server nobody dares touch becomes a *snowflake*: unique, undocumented, and impossible to recreate.

| Aspect | Built by hand | Built from code |
|--------|---------------|-----------------|
| Record of what exists | A document, if anyone kept one | The definition files and their history |
| Making a second copy | Repeat every step and hope nothing was missed | Apply the same files with different inputs |
| Reviewing a change | Rarely possible before it happens | A pull request showing the diff and the planned effect |
| Undoing a change | Remember what it was before | Revert the commit and apply again |
| Rebuilding after loss | Reconstruct from memory and notes | Re-apply the files |

The last row carries a caveat. Code recreates the *infrastructure*, such as the database server, its network, and its settings. It does not recreate the *data* inside it, and reverting a commit does not bring back data that a change destroyed, so backups and replication remain a separate concern.

---

## Desired State and the Plan/Apply Loop

Most declarative IaC tools work the same way underneath, and the rest of this guide builds on it. The definition files describe the **desired state**: which resources should exist and how each one should be configured. The tool compares that with what actually exists and makes only the changes needed to close the gap.

To make the comparison, a tool needs two things. It has to know which real resource each definition refers to, and it needs a picture of what that resource looks like now, which it gets from each cloud's API. Terraform, OpenTofu, and Pulumi talk to each cloud through a plugin called a *provider*. The common tools answer both differently:

| Tool | Where the definition-to-resource mapping lives | Reads the live resources when planning? | Its plan is called |
|---|---|---|---|
| [Terraform](https://developer.hashicorp.com/terraform){:target="_blank" rel="noopener noreferrer"}, [OpenTofu](https://opentofu.org/){:target="_blank" rel="noopener noreferrer"} | A **state** record the team stores | Yes, on every plan (a *refresh*) | Plan |
| [Pulumi](https://www.pulumi.com/docs/){:target="_blank" rel="noopener noreferrer"} | A state record, kept by default in the Pulumi Cloud service | Only when asked to refresh | Preview |
| [AWS CloudFormation](https://docs.aws.amazon.com/cloudformation/){:target="_blank" rel="noopener noreferrer"} | Inside the service, as a *stack* | Only when asked (drift detection, or a drift-aware change set) | Change set |
| [Bicep](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/overview){:target="_blank" rel="noopener noreferrer"} (Azure Resource Manager) | No record needed | Yes, on every what-if | What-if |

Bicep needs no record because every Azure resource has a predictable ID, built from its type, its name, and the subscription and resource group that contain it. That design has a side effect. In its default *incremental* mode, Azure leaves alone any resource whose definition was removed from the files, so deleting a definition does not delete the resource. [Deployment stacks](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/deployment-stacks){:target="_blank" rel="noopener noreferrer"} add the tracking needed to delete it, and Microsoft recommends them over *complete* mode, which also deletes such resources but is being deprecated.

From the comparison, the tool works out a set of actions such as create, update in place, replace, or delete. That set is the **plan**, and reviewing it before applying is one of the most useful safety habits in IaC. It shows what the tool expects to change, including deletions that the edit to the files did not make obvious. It is an expectation rather than a guarantee. Some values, such as the ID of a resource not yet created, are unknown until apply, and Azure documents properties that what-if can misreport.

The tool also works out the *order*. Definitions refer to each other, such as a virtual machine naming the subnet it runs in, and the tool builds a dependency graph from those references. It creates the subnet before the machine, deletes them in the reverse order, and runs unrelated changes in parallel. After applying, a tool that keeps a record updates it, so the next comparison starts from what now exists.

{% endraw %}
{% include figure.html id="infra-plan-apply-loop" %}
{% raw %}

A running example makes this concrete. A team defines a web tier of three virtual machines on AWS. On the first apply nothing exists yet, so the plan is "create three". On the second apply, with the files unchanged, the plan is empty. When someone edits the count to four, the plan is "create one". The files never describe *how* to get from three to four. The tool derives that from the difference.

---

## Declarative vs. Imperative

The web-tier example is **declarative**. The files state the end result, and the tool derives the steps. In Terraform, each machine is an `aws_instance` built from a machine image (`ami`) at a size (`instance_type`):

```hcl
# Terraform (declarative): three instances should exist
resource "aws_instance" "web" {
  count         = 3
  ami           = "ami-0abcdef1234567890"
  instance_type = "t3.micro"
}
```

An **imperative** definition lists the steps instead, here as a loop over the AWS SDK for .NET:

```csharp
// Imperative: launch three instances
for (var i = 0; i < 3; i++)
{
    await ec2.RunInstancesAsync(new RunInstancesRequest
    {
        ImageId = "ami-0abcdef1234567890",
        InstanceType = InstanceType.T3Micro,
        MinCount = 1,
        MaxCount = 1
    });
}
```

Run the loop twice and there are six instances. Change it to four and run it again, and there are ten. The code has no notion of what already exists, so the author has to add that logic: look up existing instances, compare, create or delete the difference, and recover when a previous run failed halfway. At that point the author is rewriting the core of a declarative tool by hand.

| | Declarative | Imperative |
|---|---|---|
| You write | The end state | The steps |
| Re-running | Converges on the same result | Repeats the steps unless the author guards against it |
| After a partial failure | The tool rolls back, or the next run finishes what is missing | The author has to detect and recover |
| Suits | Cloud resources that should exist and stay configured | One-time operations, migrations, ordered procedures the tool cannot express |
| Examples | Terraform, OpenTofu, CloudFormation, Bicep | Shell scripts, cloud SDK calls, CLI command sequences |

The line between the two is about the model, not the syntax. **Pulumi and [AWS CDK](https://docs.aws.amazon.com/cdk/){:target="_blank" rel="noopener noreferrer"} use general-purpose languages** such as C#, TypeScript, and Python, with loops, conditionals, and functions, but the program's job is to *build a declarative model* of the desired resources. Pulumi's engine then compares that model with its state, and CDK synthesizes it into a CloudFormation template. Running the program twice still converges on the same resources.

**[Ansible](https://docs.ansible.com/){:target="_blank" rel="noopener noreferrer"}** sits between the two. It is a configuration management tool, built mainly to set up software inside existing machines. Its building blocks are *modules*, each managing one kind of item, and most are declarative about a single item ("this package is installed", "this file has this content") and skip the work when it is already true. But a *playbook*, the file that lists the tasks to run, runs them in the order written, and nothing tracks what was removed from it. Delete a task that created a user, and the user stays.

---

## Provisioning vs. Configuration Management

IaC tools divide roughly into two jobs. **Provisioning** creates the cloud resources themselves: networks, load balancers, databases, virtual machines. **Configuration management** sets up what runs *inside* a machine: packages, files, services, users. Terraform, OpenTofu, Pulumi, CloudFormation, and Bicep are provisioning tools. Ansible, Chef, and Puppet were built for configuration management, though Ansible can provision too.

Teams that change servers in place often pair one of each. A provisioning tool creates the machines, and a configuration management tool configures them. Teams that replace servers from images instead, as described later, move most configuration into the image build, so it runs once per image instead of once per server.

---

## Idempotency

An operation is **idempotent** when applying it once or many times leaves the system in the same state. Declarative tools are built around it, as the running example's empty second plan showed. That property makes automation safe, because a pipeline can re-run an apply after a timeout or a partial failure without first working out what already happened.

Cloud APIs offer a narrower kind. EC2 accepts a client token on a launch request, so a retried request does not start a second instance. That makes one request safe to retry, but it does not make a loop converge on a desired count.

Idempotency holds only as far as the definitions allow. It commonly breaks in three ways:

- **Values that change on every run.** A timestamp in a resource name produces a new name each time, and a new name usually means a new resource.
- **Scripts called from inside a declarative tool.** Most tools can run an arbitrary script as part of creating a resource, such as Terraform's provisioners or CloudFormation's custom resources. That script inherits none of the tool's guarantees. It needs its own check for whether the work was already done.
- **Resources with side effects on creation.** Creating a resource can send an email, start a billing commitment, or run a data migration. The tool will not repeat the creation, but if the resource is ever replaced, the new one repeats all of it.

---

## Drift

**Drift** is the gap between what the code says and what is running. It appears whenever something changes infrastructure outside the tool: an engineer opens a port in the console during an incident, a script adds a tag, or another tool manages an overlapping setting.

Suppose that during an incident someone resizes one of the web servers in the console, from `t3.micro` to `t3.large`. With Terraform, the next plan refreshes, sees the larger size, and shows the tool shrinking the server back. The tool is doing its job, but the result can surprise people, because the incident fix disappears on the next unrelated deployment. The lasting answer is to make the change in code, not to stop running the tool.

A tool only notices drift it looks for. Pulumi and CloudFormation plans compare against the last recorded state by default, so the same resize stays invisible until someone runs a refresh or a drift check. Some tools don't wait to be run at all. A Puppet agent re-applies its configuration on a schedule, and a Kubernetes controller is a process that keeps comparing desired and actual state, so both correct drift continuously. And no tool sees changes to things it does not manage. A firewall rule added in the console, as a new object the code never declared, is outside its view entirely.

Not every difference needs correcting. Some attributes are meant to change at runtime, such as the number of machines an autoscaler is currently running, and the definitions should leave them out of what the tool manages. Terraform expresses this with `ignore_changes` and Pulumi with `ignoreChanges`. CloudFormation and Bicep handle it by leaving the property out of the template.

---

## Updating in Place vs. Replacing

### What Forces a Replacement

When a definition changes, the tool either **updates the resource in place** or **replaces** it with a new one. Which happens is set by the tool's rules for that attribute, which usually follow what the cloud API can change on a live resource, and an author cannot turn a forced replacement into an in-place update. In the web-tier example, changing a machine's tags updates it in place, but Terraform's AWS provider treats a changed `ami` as needing a new instance. Some settings on managed databases force a replacement too, and a replaced database starts empty unless it is restored from a snapshot.

Plans flag replacements explicitly. Terraform marks the resource "must be replaced" and names the attribute that forced it, and CloudFormation's resource reference lists an update behavior for every property. Reading for replacements is a large part of reviewing a plan, because one changed attribute on a resource that holds data can turn a routine change into data loss.

### Replacement Order and Guards

Tools differ in the order they replace a resource, and in how an author can protect one from deletion:

| Tool | Replacement order | Guard against deletion |
|---|---|---|
| Terraform, OpenTofu | Delete the old, then create the new, unless the definition sets `create_before_destroy` | `prevent_destroy` fails any plan that would delete the resource, but only while its definition exists. Deleting the whole definition deletes the guard with it |
| Pulumi | Create the new, then delete the old, unless `deleteBeforeReplace` is set | `protect` blocks deletion for any reason until the protection is removed |
| CloudFormation | Create the new, then delete the old | `DeletionPolicy` and `UpdateReplacePolicy` keep a snapshot or retain the old resource when the stack deletes or replaces it |
| Bicep | Never replaces. A change Azure cannot apply in place fails the deployment | An Azure resource lock blocks deletion of the locked resource |

Delete-first leaves a gap in service. Create-first means both resources exist briefly, which fails when the name must be unique. A guard turns a data-loss mistake into a failed deployment, which is the better way to find out.

---

## Mutable vs. Immutable Infrastructure

The same choice applies to how servers receive new software or configuration.

**Mutable infrastructure** changes running servers in place. An engineer or a configuration management tool connects, installs the update, and restarts the service. It is fast, but each server's setup becomes the sum of every change ever applied to it, including the ones that half-failed, so servers that started identical end up different.

**Immutable infrastructure** never changes a running server. A change produces a new machine image or container image, new servers start from it, and the old ones are removed. The image that was tested is the image that runs.

{% endraw %}
{% include figure.html id="infra-mutable-immutable" %}
{% raw %}

| | Mutable | Immutable |
|---|---|---|
| How a change lands | Modify the running server | Build a new image, replace the servers |
| Time for a small change | Typically quick | Longer, since an image is built and servers replaced |
| Servers on the same version | Can differ | Start identical |
| Rollback | Undo the change on each server | Start servers from the previous image |
| Requires | Usually configuration management tooling | An image build pipeline, and servers that keep no state on local disk |

Immutability depends on servers being disposable. Anything a server must keep, such as uploaded files, sessions, or a database, has to live outside it before it can be replaced freely.

---

## Keeping Secrets Out of Definitions

Definitions often need a password, an API key, or a certificate. Writing one into a file puts it in version control, where every clone and every past commit holds it, and deleting it later does not remove it from history.

The fix is to keep secrets in a secret store and have the definition *refer* to them. CloudFormation resolves a reference at deploy time and does not persist the resolved value in its own logs, though the service receiving the value may still display it:

```yaml
MasterUserPassword: '{{resolve:secretsmanager:prod/db:SecretString:password}}'
```

A Terraform input variable can be marked `sensitive`, but that only hides the value from displayed output. **Terraform still writes sensitive values into its state and saved plan files**, so anyone who can read those files can read them. Terraform 1.10 added ephemeral values and 1.11 added write-only resource arguments, both of which keep a value out of state and plan files entirely. Where a service can generate and hold its own credential, such as a managed database that stores its master password in the provider's secret manager, letting it do so keeps the secret out of the IaC tool altogether.

---

## What IaC Costs

IaC has costs, and for some work it is the wrong tool.

- **A learning curve and a toolchain.** Each tool has its own language, its own model of resources, and its own quirks, and a team needs to learn them before code is faster than the console.
- **State to look after.** Tools that keep their own state record make that record critical. Lose or corrupt it and the tool no longer knows what it manages.
- **Mistakes spread fast.** A wrong change applied by hand usually breaks one thing. A wrong change applied by a pipeline across every environment can break all of them, which is why plan review and staged rollouts matter.
- **Exploration is slower.** Trying an unfamiliar service is quicker in the console. Many teams explore by hand in a sandbox account, then write the result as code once they know what they want. Resources that already exist can be imported, which brings them under the tool's management without recreating them.

For anything that will exist for more than a few days, be recreated, or be copied into another environment, those costs tend to be repaid the first time the environment has to be rebuilt.

{% endraw %}
