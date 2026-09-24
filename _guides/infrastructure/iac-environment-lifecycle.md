---
title: "IaC Environment Lifecycle Patterns"
layout: guide
category: Infrastructure & Cloud
subcategory: Infrastructure as Code
description: "Keeping references stable when infrastructure is recreated, by knowing which identifiers change and putting DNS names, a parameter store, or service discovery in between, and choosing how to give developers and pull requests their own environments: shared data, dedicated stacks, and ephemeral preview environments, with their costs and cleanup."
tags: [practical, preview-environments, service-discovery, parameter-store, dns, aws]
---

## What Changes When Infrastructure Is Recreated

Development and test environments get torn down and rebuilt far more often than production. Resources are also replaced when a change forces it, and copied when each developer or pull request gets its own environment. Each of those events creates new resources, and whether their identifiers change depends on who chose them:

| Kind of identifier | Examples | After the resource is recreated |
|---|---|---|
| **A name the code chooses** | An RDS instance identifier, an S3 bucket name, a queue name | The same, if the code gives the same name. An RDS endpoint is built from the instance identifier and a part fixed per account and region, so deleting and recreating an instance with the same identifier gives the same endpoint |
| **An ID the provider generates** | EC2 instance IDs, security group IDs, subnet and VPC IDs | New every time |
| **A DNS name the provider generates** | Load balancer DNS names, CloudFront distribution domains, API Gateway endpoints | New every time |
| **An ARN** | Any resource's ARN | Follows the name or ID it embeds. Some ARNs, such as a load balancer's or a Secrets Manager secret's, also carry a generated suffix, so they change even when the name stays the same |

Fixed names look like the easy answer, but they only go so far. Most names must be unique within an account and Region, so two copies of an environment there cannot share one, and per-developer and per-pull-request copies need a suffix. A replacement that creates the new resource before deleting the old one needs both to exist at once. S3 bucket names have a wider scope still, unique across every account in an AWS partition, which is why teams traditionally added a random suffix. S3 now also offers an *account regional namespace*, where a name whose suffix carries the account ID and Region can only ever belong to that account, and AWS recommends it. Every suffix that varies by environment makes the identifier change with the environment.

Anything that holds one of these values breaks when it changes: an application's connection string, another stack's configuration, an IAM policy naming an ARN, a DNS record typed in by hand. The fix is to stop giving consumers the value itself.

---

## Stable Names for Changing Resources

The pattern is **indirection**. Consumers refer to a name that never changes, and every apply updates what that name points to. Recreating the resource then changes one pointer, maintained by the same code that created the resource, instead of every consumer's configuration.

### DNS Names

A private DNS zone holds a record with a fixed name for each endpoint, and the IaC code points it at the current resource:

```hcl
resource "aws_route53_zone" "internal" {
  name = "${var.environment}.internal.example.com"
  vpc {
    vpc_id = var.vpc_id
  }
}

resource "aws_route53_record" "db" {
  zone_id = aws_route53_zone.internal.zone_id
  name    = "db.${var.environment}.internal.example.com"
  type    = "CNAME"
  ttl     = 60
  records = [aws_db_instance.main.address]
}
```

The application connects to `db.dev.internal.example.com` in every build of the environment. DNS needs no code change in the application, but it has limits. It only covers values reached by hostname, not ARNs, queue URLs, or ports. A private zone answers only inside the networks associated with it. And clients that cache lookups or hold pooled connections keep using the old address until they look the name up again, so a low TTL shortens the window without closing it.

### A Parameter Store

A parameter store such as [AWS Systems Manager Parameter Store](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html){:target="_blank" rel="noopener noreferrer"} or [Azure App Configuration](https://learn.microsoft.com/en-us/azure/azure-app-configuration/overview){:target="_blank" rel="noopener noreferrer"} holds named values that the IaC code writes and consumers read. It handles anything a DNS record can't, and it is also the usual way one layer hands values to another without reading that layer's state. A hierarchy by environment and service keeps the names predictable:

```
/dev/orders/database/endpoint
/dev/orders/queue/url
/dev/shared/cache/endpoint
```

The value written can be whatever consumers need. An RDS instance's `endpoint` attribute, used below, includes the port, while `address` is the hostname alone:

```hcl
resource "aws_ssm_parameter" "orders_db_endpoint" {
  name  = "/${var.environment}/orders/database/endpoint"
  type  = "String"
  value = aws_db_instance.orders.endpoint
}
```

In .NET, the [`Amazon.Extensions.Configuration.SystemsManager`](https://github.com/aws/aws-dotnet-extensions-configuration){:target="_blank" rel="noopener noreferrer"} package loads a whole path into the application's configuration at startup, here for the environment name the application was started with, stripping the path prefix and handling paging, since the underlying `GetParametersByPath` call returns at most 10 parameters per page.

```csharp
builder.Configuration.AddSystemsManager($"/{environment}/orders/");
var endpoint = builder.Configuration["database:endpoint"];
```

Secrets stay in a secrets manager rather than in plain parameters. Parameter Store can pass a Secrets Manager secret through by name under the `/aws/reference/secretsmanager/` prefix, but only by its full name, never through a path. A path load never returns it, so the application adds a separate `AddSystemsManager` call for each secret it reads this way. Access follows the path hierarchy with one trap. A principal allowed to read a path recursively can read every level beneath it, even a parameter an IAM policy explicitly denies, so secrets and sensitive values need their own branch of the tree.

### Service Discovery

A service registry such as [AWS Cloud Map](https://docs.aws.amazon.com/cloud-map/latest/dg/what-is-cloud-map.html){:target="_blank" rel="noopener noreferrer"}, Consul, or Kubernetes Services tracks instances as they register and deregister, and consumers query it by service name. It suits many instances that come and go on their own, such as tasks scaling in and out, where no IaC apply runs between the change and the lookup. For resources that only change when the IaC code runs, DNS or a parameter store does the same job with fewer moving parts.

### Choosing One

| What consumers need | Pattern |
|---|---|
| A hostname, with no change to the application | DNS record |
| Several values, or values that aren't hostnames (ARNs, queue URLs, ports) | Parameter store |
| Values another layer's IaC code reads | Parameter store |
| Instances that scale or move between applies | Service discovery |

Many environments use DNS for endpoints and a parameter store for everything else.

---

## Environments for Developers

Giving each developer somewhere to run their work trades cost and setup effort against isolation. Most teams land on one of three models.

### Shared Data, Personal Application Stacks

One copy of the network, database, and cache serves every developer. Each developer deploys only the application layer, under their own state and with their name in resource names, and it finds the shared data through the parameter store. A developer can destroy and redeploy their stack freely without touching data.

It is the cheapest model and the quickest to start, but developers share whatever the data holds. A schema change made for one branch reaches everyone. A separate database or schema per developer inside the shared instance restores most of the isolation at little extra cost.

### A Dedicated Environment per Developer

Each developer gets a full copy, including small instances of the database and cache. Schema changes, migrations, and data experiments stay private, and the environment resembles production more closely. The cost is a copy of every stateful resource per developer, and every piece of the environment has to be fully automated, since nobody will build one by hand for each developer.

### Shared Network, Personal Data Stores

The expensive, slow-to-create pieces are shared, such as the network and NAT gateways, while each developer gets small copies of the data stores and their own application stack. An S3 bucket can be shared too, with each developer's application writing under its own prefix, recorded in that developer's parameters.

{% include figure.html id="infra-dev-env-models" %}

### Choosing and Controlling Cost

| Situation | Model |
|---|---|
| Stable schema, tight budget, fast application iteration | Shared data |
| Frequent schema or data-model changes | Dedicated |
| Production-like behavior required for testing | Dedicated |
| A large team where full copies cost too much | Shared network, personal data stores |

Idle development environments are the main cost. Tagging resources with a schedule does nothing by itself. A scheduler, such as AWS's Instance Scheduler solution or a small scheduled function, has to read the tags and stop and start the resources. Stopping has limits too. A stopped RDS instance still bills for its storage and backups, and RDS starts it again automatically after seven days, so a schedule has to stop it again, and an environment unused for weeks is cheaper destroyed and recreated.

---

## Ephemeral Preview Environments

A **preview environment** is a short-lived copy created for one pull request. The pipeline creates it when the pull request opens, updates it on each push, and destroys it when the pull request closes. Reviewers can use the change running, and tests run against real infrastructure instead of a shared environment that other branches are also changing.

Previews apply everything above at speed:

- **Separate state per preview**, such as a state key or workspace named after the pull request number, so destroying one preview cannot touch another.
- **Unique, short names.** A suffix like `pr-482` keeps copies apart, and it has to fit the tightest name limit in the stack. An AWS load balancer name, for example, allows 32 characters.
- **A stable way in.** A DNS record such as `pr-482.preview.example.com`, created with the preview, gives reviewers a predictable URL despite the generated load balancer name behind it. A wildcard certificate for `*.preview.example.com` covers every preview's HTTPS without issuing one per pull request.
- **Shared expensive pieces.** Most previews use the shared-data model, with a database or schema per preview inside a shared instance, because creating a full database for every pull request is slow and costly. Service quotas push the same way. Limits such as VPCs per Region or Elastic IP addresses per Region cap how many full copies can exist at once, whatever the budget.

Teardown is where previews fail. A destroy can stop partway because a bucket still holds objects, a database has deletion protection on, or a final snapshot is required. Preview configurations usually allow these deletions from the start, for example with `force_destroy` on buckets, `skip_final_snapshot` on databases, and deletion protection off, which is safe only because the data is disposable. They have to be in place from the first apply. Terraform acts on the settings recorded in state, so switching them on in the code just before a destroy does nothing until an apply has recorded them.

Pipelines also miss events, so a pull request closed during an outage can leave its preview running indefinitely. A scheduled job that destroys any preview older than a set age, identified by a tag recording when it was created, catches what the pipeline misses.
