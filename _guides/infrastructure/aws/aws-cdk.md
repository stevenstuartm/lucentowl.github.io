---
title: "AWS CDK for System Architects"
layout: guide
category: AWS
subcategory: Infrastructure as Code
description: "How the AWS Cloud Development Kit turns code into CloudFormation: construct levels, Mixins, and grants; writing your own constructs; apps, stacks, environments, and cross-stack references; assets and bootstrapping; the synth, diff, and deploy workflow; logical IDs and removal policies; testing; and CDK Pipelines."
tags: [cdk, constructs, cdk-bootstrap, cdk-assertions, cdk-pipelines, typescript, practical]
---

## What the CDK Is

The **AWS Cloud Development Kit (CDK)** defines infrastructure in a general-purpose programming language and turns it into CloudFormation templates. A CDK program builds a tree of objects called **constructs**, each representing one or more AWS resources. Running the program, called **synthesis**, walks that tree and writes a CloudFormation template for each stack, and deploying hands those templates to CloudFormation. On a normal deployment, everything CloudFormation does, including change sets, rollback, drift detection, and deletion policies, still happens. The CDK decides what the templates say.

The CDK supports TypeScript, JavaScript, Python, Java, C#, and Go. It's written in TypeScript and translated to the other languages, so TypeScript has the most examples and the samples below use it. The CDK itself costs nothing.

What code adds over hand-written templates:

- **Abstraction.** One construct can stand for dozens of resources with sensible defaults. A VPC construct creates subnets, route tables, gateways, and routes across several Availability Zones from a few lines.
- **Relationships as method calls.** Granting a function access to a bucket is one call, and the CDK writes the IAM policy with the right actions and ARNs.
- **Ordinary programming tools.** Loops, functions, classes, packages, type checking, and unit tests replace copy-pasted YAML, parameters, and conditions.

What it costs is a build step and a layer between you and the template. A deployed stack is only as understandable as its synthesized template, so the habit of reading `cdk diff` output before deploying matters more here than with hand-written templates.

---

## Constructs

The **AWS Construct Library** offers constructs at three levels:

| Level | What it is | Example |
|---|---|---|
| **L1** | One-to-one with a CloudFormation resource type, named with a `Cfn` prefix. Every property is yours to set, with no defaults. Generated automatically, so new AWS features appear here first. | `s3.CfnBucket` |
| **L2** | One resource with defaults, validation, and helper methods for common tasks like granting access or creating alarms | `s3.Bucket`, `lambda.Function` |
| **L3** | A pattern, several resources wired together for a common architecture | `ecs_patterns.ApplicationLoadBalancedFargateService` |

Most code uses L2 constructs:

```typescript
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';

const archive = new s3.Bucket(this, 'Archive', {
  versioned: true,
  encryption: s3.BucketEncryption.S3_MANAGED,
  removalPolicy: RemovalPolicy.RETAIN,
});

const exporter = new lambda.Function(this, 'Exporter', {
  runtime: lambda.Runtime.NODEJS_22_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset('lambda/exporter'),
  timeout: Duration.seconds(30),
  environment: { ARCHIVE_BUCKET: archive.bucketName },
});

archive.grants.read(exporter);
```

The last line adds a policy to the function's role allowing it to read the bucket and its objects, and to decrypt them if the bucket uses a KMS key. The older `archive.grantRead(exporter)` form still works, but the `grants` property is now preferred. Grants are one kind of **facade**, a helper that connects a resource to principals and other services, and they work on L1 constructs too.

**Mixins** (generally available since March 2026) add a single feature to a construct with `.with()`, such as versioning or blocking public access, and work on L1 and L2 constructs alike. `Mixins.of(stack).apply(...)` applies one to every matching construct in a scope, which makes Mixins a way to give L1 constructs L2-style conveniences or to apply a standard setting everywhere.

When a construct doesn't expose a property you need, an **escape hatch** reaches the L1 resource underneath through `node.defaultChild`. Set the property on the L1 there, or, for anything the L1 doesn't have a typed property for, call its `addPropertyOverride` method to write a raw value into the template.

---

## Writing Your Own Constructs

An organization's own constructs are where the CDK pays off most. A construct is a class that extends `Construct` and creates other constructs inside itself. This one creates a queue with a dead-letter queue and an alarm, so that every team's queues follow the same pattern:

```typescript
import { Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';

export interface MonitoredQueueProps {
  readonly alarmTopic: sns.ITopic;
  readonly maxReceiveCount?: number;
}

export class MonitoredQueue extends Construct {
  public readonly queue: sqs.Queue;

  constructor(scope: Construct, id: string, props: MonitoredQueueProps) {
    super(scope, id);

    const deadLetters = new sqs.Queue(this, 'DeadLetters', {
      retentionPeriod: Duration.days(14),
    });

    this.queue = new sqs.Queue(this, 'Queue', {
      deadLetterQueue: { queue: deadLetters, maxReceiveCount: props.maxReceiveCount ?? 5 },
    });

    deadLetters.metricApproximateNumberOfMessagesVisible()
      .createAlarm(this, 'DeadLettersAlarm', {
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      })
      .addAlarmAction(new actions.SnsAction(props.alarmTopic));
  }
}
```

Publish shared constructs as an ordinary package in the organization's registry. Written in TypeScript with the jsii tool, one construct library can be published for every CDK language. **Construct Hub** lists open-source construct libraries from AWS and others.

A construct is a unit of reuse, not of deployment. Several of them go into a stack, and a stack is what deploys.

---

## Apps, Stacks, and Environments

An **app** is the root of the construct tree, and it contains one or more **stacks**, each synthesized to one CloudFormation template. The project's `cdk.json` file tells the CLI how to run the app and holds **context**, settings the app can read, including the feature flags described later:

```typescript
import { App } from 'aws-cdk-lib';

const app = new App();
const prod = { account: '111122223333', region: 'us-east-1' };

const network = new NetworkStack(app, 'Network', { env: prod });
new ServiceStack(app, 'Service', { env: prod, vpc: network.vpc });
```

Each stack's **environment** is its account and Region. A stack with an explicit environment can look things up at synthesis, such as an existing VPC by tag with `ec2.Vpc.fromLookup`. The CDK caches each lookup's result in `cdk.context.json`, which belongs in source control, so synthesis gives the same template tomorrow even if the account changes. A stack with no environment is **environment-agnostic**, deployable anywhere but unable to look anything up.

Passing a construct from one stack to another, like `network.vpc` above, creates a **cross-stack reference**. By default the CDK makes it a strong reference, an export in the producing stack and an import in the consuming one, so CloudFormation stops the producer from removing a value still in use. That protection causes a well-known deadlock. When code stops using a shared value, the CDK removes both the export and the import, but the producing stack deploys first, and CloudFormation refuses to delete an export that the consumer still imports. A **weak** reference, built on `Fn::GetStackOutput`, has no export to block anything, and setting `@aws-cdk/core:defaultCrossStackReferences` to `weak` in the context section of `cdk.json` makes weak references the default. References between stacks in different Regions or accounts can use `Fn::GetStackOutput` too, instead of the custom resources that the older `crossRegionReferences` option generated.

A **stage** groups the stacks that make up one copy of an application, so the same stage can be deployed several times, each to its own environment:

```typescript
import { App, Stage, StageProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

class OrdersApp extends Stage {
  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);
    const network = new NetworkStack(this, 'Network');
    new ServiceStack(this, 'Service', { vpc: network.vpc });
  }
}

const app = new App();
new OrdersApp(app, 'Test', { env: { account: '222233334444', region: 'us-east-1' } });
new OrdersApp(app, 'Prod', { env: { account: '111122223333', region: 'us-east-1' } });
```

The stacks inside a stage take its environment.

---

## Assets and Bootstrapping

Many constructs include local files, such as a function's code or a Dockerfile. These are **assets**. Synthesis writes each stack's template and its assets to a **cloud assembly** in the `cdk.out` directory, and deployment uploads the assets before CloudFormation needs them.

The uploads go to resources that must already exist, created by **bootstrapping**, a one-time step per account and Region (`cdk bootstrap`). It deploys a stack named `CDKToolkit` containing an S3 bucket for file assets, an ECR repository for container images, an SSM parameter recording the bootstrap version, and five IAM roles (the two publishing roles share a row here):

| Role | Used for |
|---|---|
| **Deployment role** | Assumed by the CLI or a pipeline to start CloudFormation deployments |
| **File publishing and image publishing roles** | Uploading assets to the bucket and the repository |
| **Lookup role** | Read-only lookups during synthesis |
| **CloudFormation execution role** | The service role CloudFormation uses to create resources |

{% include figure.html id="aws-cdk-synth-deploy" %}

By default, the execution role has `AdministratorAccess`, so anyone who can assume the deployment role can create anything. Narrow it with `--cloudformation-execution-policies`, or with an IAM permissions boundary that caps what the roles CloudFormation creates can do, where that matters. `--trust` lets another account, usually a pipeline's, deploy into the bootstrapped one, and `--termination-protection` guards the bootstrap stack, whose deletion breaks every deployment in the environment. Organizations with many accounts often bootstrap them all with a CloudFormation StackSet, which deploys one template to many accounts. Re-run `cdk bootstrap` now and then, since new CDK features sometimes need a newer bootstrap version.

---

## The Workflow

| Command | Does |
|---|---|
| `cdk synth` | Runs the app and writes the cloud assembly. Synthesis also fails on errors the constructs detect, before anything reaches AWS. |
| `cdk diff` | Compares the synthesized templates with what's deployed, listing added, changed, and replaced resources and IAM changes |
| `cdk deploy` | Uploads assets and deploys through CloudFormation. `--express` uses CloudFormation's express mode, which finishes faster but turns off rollback by default and returns before resources are necessarily ready, so it suits development rather than production. |
| `cdk watch` | Redeploys on every file change, using **hotswaps** that update function code and similar resources directly, bypassing CloudFormation. Changes that can't be hotswapped are ignored unless `--hotswap-fallback` is set. For development only, since hotswaps leave the stack drifted. |
| `cdk destroy` | Deletes stacks |
| `cdk drift` | Runs CloudFormation drift detection on the app's stacks |
| `cdk import` and `cdk migrate` | Bring existing resources into a CDK stack, or generate a CDK app from existing resources or templates |
| `cdk refactor` | Keeps resources in place when code is reorganized (in preview, run with `--unstable=refactor`) |

Programs can run the same operations through the **CDK Toolkit Library** (generally available since May 2025), a package for building deployment tools and custom pipelines around the CDK.

---

## Things the CDK Decides for You

A few defaults surprise people, and each can destroy or orphan a resource:

- **Logical IDs come from the construct path.** A resource's logical ID is built from its construct IDs and those of every construct above it, plus a hash. Renaming a construct, or moving it inside another, changes the logical ID, and CloudFormation treats that as deleting the old resource and creating a new one, data and all. Check `cdk diff` for replacements after any refactoring. To wrap an existing resource in a new construct without changing its ID, give the inner construct the ID `Default`, which the CDK leaves out of the logical ID. For bigger moves, use `cdk refactor` or CloudFormation stack refactoring.
- **Physical names are generated.** Most constructs leave names to CloudFormation, which avoids clashes and allows replacement. Set explicit names only where something outside the app needs a stable one.
- **Stateful resources are retained by default.** A removal policy is the CDK's name for a deletion policy. For buckets, tables, and similar resources, the CDK defaults to `RemovalPolicy.RETAIN`, the opposite of CloudFormation's default, so destroying a development stack leaves them behind. `RemovalPolicy.DESTROY` deletes them, and a bucket also needs `autoDeleteObjects: true`, which adds a custom resource that empties it first.
- **Feature flags change behavior.** New projects get flags in `cdk.json` that turn on newer, safer defaults. Existing projects keep old behavior until a flag is set, so upgrading the CDK doesn't silently change what's deployed.

---

## Testing

The `aws-cdk-lib/assertions` module tests the synthesized templates, which makes infrastructure unit tests fast and free. This test assumes an `OrdersStack` that creates one `MonitoredQueue` from earlier:

```typescript
import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';

test('queue sends failures to a dead-letter queue after five attempts', () => {
  const app = new App();
  const stack = new OrdersStack(app, 'Orders');
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::SQS::Queue', {
    RedrivePolicy: { maxReceiveCount: 5 },
  });
  template.resourceCountIs('AWS::CloudWatch::Alarm', 1);
});
```

**Fine-grained assertions** like these check the properties that matter, such as encryption, retention, or a redrive policy. **Snapshot tests** compare the whole template with a saved copy and fail on any change, which catches surprises but also flags every harmless change, so they need reviewing rather than blindly updating.

**Aspects** visit every construct in a scope during synthesis, to change or check them, such as adding tags everywhere or rejecting unencrypted resources. **Policy validation plugins** check the whole synthesized app against rules. The open-source **cdk-nag** package (version 3) is one, checking an app against rule packs such as AWS Solutions best practices and reporting problems like unencrypted buckets or open security groups:

```typescript
import { App, Validations } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';

const app = new App();
// ... stacks ...
Validations.of(app).addPlugins(new AwsSolutionsChecks(app, { verbose: true }));
```

A finding that's accepted on purpose is acknowledged on the construct with `Validations.of(construct).acknowledge({ id, reason })`, which records why.

---

## CDK Pipelines

**CDK Pipelines** is a construct that builds a CodePipeline pipeline to deploy a CDK app's stages to one environment after another. It's **self-mutating**. After fetching the source, it synthesizes the app and updates the pipeline itself, so adding a stage in code adds it to the pipeline on the next run. Each target account must be bootstrapped with `--trust` for the pipeline's account. The pipeline mechanics themselves, such as stages, actions, and approvals, are CodePipeline's.

---

## When the CDK Fits

The CDK fits teams that write code daily, systems full of repeated patterns that one construct can capture, and organizations that want shared constructs to carry their standards. Hand-written CloudFormation, or AWS SAM for serverless applications, can be simpler for small, stable stacks and for teams that prefer to read exactly what gets deployed. Tools outside AWS, such as Terraform and Pulumi, trade the CloudFormation engine for their own state management and multi-cloud reach. CDK for Terraform (CDKTF), which applied the CDK's programming model to Terraform, was deprecated by HashiCorp in December 2025.

---

## Key Takeaways

- The CDK is a way to write CloudFormation. Synthesis produces templates, CloudFormation deploys them, and `cdk diff` shows what will change before it does.
- Use L2 constructs for most resources, L3 patterns where they fit, and Mixins, grants, and escape hatches to cover the gaps. Put organizational standards into your own constructs.
- Bootstrap each account and Region, protect the bootstrap stack, and narrow the execution role's permissions where it matters.
- Renaming or moving a construct can replace its resource. Check diffs for replacements, and use refactoring tools to move resources.
- Stateful resources are retained by default, and lookups are cached in `cdk.context.json`, which belongs in source control.
- Prefer weak cross-stack references for values that may be removed, test templates with assertions and cdk-nag, keep hotswaps and express mode for development, and deploy through CDK Pipelines or another pipeline rather than from laptops.
