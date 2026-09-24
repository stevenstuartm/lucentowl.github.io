---
title: "IaC Implementation Patterns"
layout: guide
category: Infrastructure & Cloud
subcategory: Infrastructure as Code
description: "How to organize infrastructure code as it grows: modules for reuse, separating environments, layers with their own state, where the code lives and who owns it, breaking circular dependencies, and delivering changes through pull-request workflows and GitOps."
tags: [practical, terraform, modules, gitops, cicd, atlantis]
---

## Modules

### What a Module Is

A **module** is a set of resource definitions packaged behind input variables and outputs, so other code can create the whole set by calling it with different inputs. It plays the role a function or library plays in application code. A network module might take an address range and a list of availability zones and create the network, its subnets, route tables, and gateways, returning the subnet IDs.

Every tool has the idea under a different name: Terraform and OpenTofu modules, [Bicep modules](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/modules){:target="_blank" rel="noopener noreferrer"}, CloudFormation modules and nested stacks, AWS CDK constructs, and Pulumi component resources. A call to a shared Terraform module looks like this:

```hcl
module "network" {
  source  = "app.terraform.io/example-org/network/aws"
  version = "2.3.0"

  cidr_block         = "10.0.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]
}
```

### Designing the Interface

A module earns its place by making decisions its callers would otherwise repeat. A good one wraps resources that belong together, bakes in the organization's defaults such as encryption and logging being on, and exposes only the inputs callers genuinely vary. Inputs can validate themselves, so a bad value fails at plan time with a clear message instead of partway through an apply:

```hcl
variable "environment" {
  type = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging, or prod."
  }
}
```

Two shapes tend to go wrong. A module that wraps a single resource and passes every argument through adds a layer without making any decision, and HashiCorp advises against writing them. A module that nests other modules several levels deep hides what gets created, and a caller who needs to change one setting at the bottom has to thread a new input through every level above it. HashiCorp recommends keeping the module tree flat and composing instead. The configuration that calls the modules wires one module's outputs into the next one's inputs, such as passing the network module's subnet IDs to a database module, so each module stays usable on its own.

### Versioning Modules

A shared module is a dependency like any library, so callers pin a version and upgrade deliberately. In Terraform, the `version` argument works only for modules from a registry. A module fetched from Git is pinned with a `ref` in its source address instead, such as `?ref=v2.3.0`. A tag can be moved to a different commit, so pinning to a commit SHA is the stricter choice. Terraform's dependency lock file, `.terraform.lock.hcl`, records provider versions but not module versions, so the pin in the module call is the only thing holding a module still.

Pinning is also what makes promotion work. Each environment names the module version it runs, and a change reaches production by raising that version in dev, then staging, then production, each step reviewed and planned on its own.

---

## Separating Environments

Every environment should run the same code with different inputs, and each needs its own state so that applying to one cannot touch another. Environments that live in separate cloud accounts or subscriptions also get separate credentials, which limits what a mistake in dev can reach. The common layouts trade isolation against duplication:

| Layout | How it works | Suits | Watch for |
|---|---|---|---|
| **A directory per environment** | Each environment has a small *root configuration*, the directory Terraform runs `plan` and `apply` in, with its own backend and variable values, calling shared modules | Most teams | Some repetition across the root files, and each environment is updated separately |
| **Terraform CLI workspaces** | One directory and one backend, with a separate state per workspace | Short-lived copies for testing a change | All workspaces share the backend and its credentials, so HashiCorp calls them unsuitable where environments need separate access. Applying to the wrong workspace is one forgotten command away |
| **A repository per environment** | Full copies of the code | Rarely a good fit | The copies drift apart, and promoting a change means porting it |
| **Tool-native environments** | Pulumi stacks with per-stack configuration, HCP Terraform workspaces (each with its own configuration, variables, and state), or HCP Terraform Stacks, which deploy one configuration to several environments as separate *deployments* | Teams already on that tool or platform | Ties the layout to the platform |

[Terragrunt](https://terragrunt.gruntwork.io/){:target="_blank" rel="noopener noreferrer"}, a wrapper around Terraform and OpenTofu, is another common answer to the repetition in the directory-per-environment layout. It generates the backend and shared inputs for each environment directory from one definition.

Whatever the layout, environment differences belong in input values, not in conditionals on the environment's name. A resource that reads `terraform.workspace == "production" ? "t3.large" : "t3.micro"` hides the difference inside the code, where a reviewer comparing environments has to hunt for it. An `instance_type` variable set per environment puts every difference in one visible place.

---

## Layering Deployments

### Modules Are Code, Layers Are Deployment Units

Modules organize code for reuse. **Layers** organize deployment. A layer is a root configuration with its own state that is planned and applied on its own, usually calling several modules. Splitting infrastructure into layers keeps the unit of locking and the unit of access small, so an application deploy does not wait on a network change, and the team deploying applications cannot read or break the network's state.

Layers usually follow how often things change and who owns them:

| Layer | Typical contents | Changes | Usually owned by |
|---|---|---|---|
| **Foundation** | Networks, subnets, routing, VPN and transit connections, DNS zones, baseline security groups | Rarely | Platform or network team |
| **Shared platform** | Container clusters, shared databases, message buses, container registries, logging and monitoring, CI/CD tooling | Occasionally | Platform team |
| **Application** | A service's compute, its queues, its load balancer, its IAM roles, its scaling settings | Often | The application's team |

Placement follows ownership rather than resource type. A database shared by many services sits in the shared platform layer, while a database only one service uses belongs with that service. Stateful resources an application owns are often split into their own layer, so the application layer can be torn down and rebuilt without any plan touching the data.

### Dependencies Flow One Way

Lower layers publish outputs and higher layers consume them. The foundation exports subnet IDs, for example, and the platform layer places a cluster in those subnets. A higher layer never feeds a lower one, which is what lets each be applied independently and in order.

Terraform can read another layer's outputs directly with the `terraform_remote_state` data source, but that requires read access to the lower layer's whole state. Many teams instead have each layer publish the values others need to a parameter store and have consumers look them up there.

Layers have costs. Each one is another state, another pipeline, and another thing to apply in the right order. A change that spans layers, such as a new subnet that a new service needs, takes two applies, lower layer first, and removing it runs in reverse. Renaming or removing an output breaks every layer that reads it. A small estate with one team often does better with two layers, or one, than with a structure copied from a large organization.

---

## Where the Code Lives

A common split puts application-layer code in the application's own repository and keeps the shared layers in a platform repository. The service's infrastructure then changes in the same pull request as the code that needs it, the application team deploys both without filing a ticket, and a rollback of the application can carry its infrastructure with it. The shared layers stay with the team that has the networking and security expertise, under stricter review, because a change there reaches every application.

These questions settle where a given resource belongs:

| Question | Points to the application repo | Points to the platform repo |
|---|---|---|
| Who uses it? | One application | Several applications |
| When does it change? | With the application's releases | On its own, rarely |
| What breaks if a change goes wrong? | That application | Every application |
| Who can safely change it? | The application team | Specialists in networking or security |

Handing application teams their own infrastructure code works only if their pipeline's permissions are limited to their own resources, with organization-wide guardrails catching anything that slips past review.

---

## Breaking Circular Dependencies

A tool builds its dependency graph from references between definitions. When two resources each refer to an attribute of the other, the graph has a cycle and there is no order to create them in. Terraform stops with a cycle error, and CloudFormation rejects the template.

The classic case is two security groups that allow traffic from each other. If each group's rules are written inline and name the other group, neither can be created first. The fix is to create both groups with no rules, then attach the rules as separate resources, which depend on both groups but on nothing that depends on them.

{% include figure.html id="infra-dependency-cycle" %}

In Terraform, the rule becomes its own resource:

```hcl
resource "aws_security_group" "app" {
  name   = "app"
  vpc_id = var.vpc_id
}

resource "aws_security_group" "db" {
  name   = "db"
  vpc_id = var.vpc_id
}

resource "aws_vpc_security_group_ingress_rule" "db_from_app" {
  security_group_id            = aws_security_group.db.id
  referenced_security_group_id = aws_security_group.app.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
}
```

CloudFormation uses the same move with separate `AWS::EC2::SecurityGroupIngress` resources. The pattern generalizes: separate the attachment (a rule, a policy, a permission) from the resources it connects. When no attachment resource exists, a definition can build the other resource's name or identifier from a naming convention instead of referring to it, at the cost of an access grant that matches anything following the convention.

Cycles between layers have a different fix. If two layers each need an output from the other, the resource they share usually belongs in a lower layer that both read. Applying in two passes, first creating resources and then connecting them, works as a last resort, but it leaves a window where the infrastructure is half-built.

---

## Delivering Changes Through Pull Requests

The usual workflow runs a plan when a pull request opens, posts the plan to the pull request for review, and applies only after approval. Checks such as formatting, validation, and security scans run alongside the plan, some of them against the plan's output. Production applies usually sit behind an approval gate, such as a CI environment that only named reviewers can approve deployments to.

A plan is not read-only from a security point of view. It runs provider and data-source code with the pipeline's credentials, so a pipeline that plans pull requests from forks or untrusted contributors can leak those credentials. Such pull requests should plan with restricted credentials, or wait for a maintainer to trigger the plan.

The main design choice is when the apply happens.

- **Apply after merge.** A pipeline on the main branch applies whatever was merged. The main branch shows what was approved, but an apply that fails after merge needs a new pull request to fix. Terraform can apply the exact plan that was reviewed if the pipeline saves it as a file, and it refuses a saved plan whose state has changed since the plan was made. [HCP Terraform](https://developer.hashicorp.com/terraform/cloud-docs/vcs){:target="_blank" rel="noopener noreferrer"} works this way when connected to a repository. It runs *speculative* plans on pull requests, which show the change but can never be applied, and a merge starts a run whose apply waits for confirmation unless auto-apply is on.
- **Apply before merge.** [Atlantis](https://www.runatlantis.io/){:target="_blank" rel="noopener noreferrer"} is the common example. It plans when a pull request opens, locks that directory and workspace against other pull requests until this one is merged or closed, and applies from the branch on a comment. The branch is merged after the apply succeeds, so the main branch reflects what is deployed, and a failed apply can be fixed and retried in the same pull request.

Reverting a merged change and applying again rolls the infrastructure back to the previous definitions. It does not bring back anything the change deleted, such as data in a replaced database.

---

## GitOps

**GitOps**, as defined by the CNCF's [OpenGitOps](https://opengitops.dev/){:target="_blank" rel="noopener noreferrer"} project, has four principles:

1. **Declarative.** The desired state is expressed declaratively.
2. **Versioned and immutable.** It is stored in a way that enforces immutability and keeps a complete version history, as Git does.
3. **Pulled automatically.** Software agents pull the desired state from that source.
4. **Continuously reconciled.** The agents keep observing the actual state and applying the desired state.

The last two separate GitOps from the pull-request workflows above. A CI pipeline or Atlantis *pushes* a change when an event such as a merge or a pull-request comment triggers it, using credentials the pipeline holds. Between runs nothing reconciles, and drift shows up only if a scheduled plan or drift check is set up. A GitOps agent *pulls* from Git on its own schedule and keeps comparing what is running with what Git declares. Whether it also puts back a manual change depends on the tool and its settings. Flux re-applies plain manifests on every interval, while Argo CD only reports the difference unless automated sync with self-healing is turned on.

{% include figure.html id="infra-push-pull-delivery" %}

[Argo CD](https://argo-cd.readthedocs.io/){:target="_blank" rel="noopener noreferrer"} and [Flux](https://fluxcd.io/){:target="_blank" rel="noopener noreferrer"} are the standard agents, built for Kubernetes. Cloud infrastructure reaches GitOps through them in two ways. The first uses Kubernetes *operators*, controllers that extend Kubernetes to manage something outside it. [Crossplane](https://www.crossplane.io/){:target="_blank" rel="noopener noreferrer"}, AWS Controllers for Kubernetes, and Azure Service Operator represent cloud resources as Kubernetes objects. The GitOps agent applies those objects, and the operator creates and corrects the cloud resources behind them, holding the cloud credentials to do so. The second is the [Tofu Controller](https://flux-iac.github.io/tofu-controller/){:target="_blank" rel="noopener noreferrer"}, a community controller for Flux that runs Terraform or OpenTofu configurations on a reconcile loop.

The pull model moves production credentials out of the CI system and into the cluster that runs the agent or operator, and it can correct drift without a pull request. It also needs a cluster to host those components. Where it reverts manual changes, it will also revert an emergency fix made by hand unless someone pauses reconciliation first, so a team adopting it needs a *break-glass* procedure, an agreed way to bypass the normal path during an incident.

---

## What to Commit

Commit the code, the modules, each environment's non-secret variable values, and `.terraform.lock.hcl`. HashiCorp recommends committing the lock file so provider upgrades go through review like any other change. Leave out the `.terraform` directory Terraform downloads providers and modules into, state files, crash logs, saved plan files, which can hold sensitive values, and any variable file that holds a secret:

```
.terraform/
*.tfstate
*.tfstate.*
crash.log
*tfplan*
crash.*.log
# plus whichever variable files hold secrets
```
