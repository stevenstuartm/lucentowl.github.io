---
title: "AWS SAM - Serverless Application Model"
layout: guide
category: AWS
subcategory: Infrastructure as Code
description: "How AWS SAM works as a CloudFormation transform: the serverless resource types, Globals, event sources, policy templates and connectors; the SAM CLI workflow for building, local testing, cloud testing with sync and remote invoke, and deploying; gradual deployments; and choosing between SAM and the CDK."
tags: [sam, sam-cli, sam-connectors, policy-templates, serverless, practical]
---

## What SAM Is

The **AWS Serverless Application Model (SAM)** has two parts. The first is a template format, an extension of CloudFormation that adds short resource types for serverless applications. The second is the **SAM CLI**, a command-line tool that builds, tests, and deploys those templates.

A SAM template is a CloudFormation template with one extra line, `Transform: AWS::Serverless-2016-10-31`. The transform is a macro that AWS hosts. When CloudFormation processes the template, the transform expands each `AWS::Serverless::*` resource into the plain CloudFormation resources it stands for, and CloudFormation deploys those. Everything else in the template, including ordinary `AWS::*` resources, parameters, conditions, and outputs, passes through unchanged. A SAM application is therefore a CloudFormation stack, with the same change sets, rollback, and deletion policies.

The template below declares one function, a table, and a queue. The function has an HTTP route and reads from the queue, its connector lets it write to the table, and `AutoPublishAlias` publishes a new version of it on every code change and points an alias named `live` at that version:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Resources:
  OrdersFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: src/orders/
      Handler: app.handler
      Runtime: python3.13
      AutoPublishAlias: live
      Environment:
        Variables:
          TABLE_NAME: !Ref OrdersTable
      Events:
        CreateOrder:
          Type: HttpApi
          Properties:
            Path: /orders
            Method: POST
        OrderQueue:
          Type: SQS
          Properties:
            Queue: !GetAtt OrderQueue.Arn
            BatchSize: 10
    Connectors:
      TableWrite:
        Properties:
          Destination:
            Id: OrdersTable
          Permissions:
            - Write

  OrdersTable:
    Type: AWS::Serverless::SimpleTable

  OrderQueue:
    Type: AWS::SQS::Queue
```

That is about 40 lines. The transform turns the two SAM resources into ten CloudFormation resources, and writing those by hand, with their IAM policies, would take several times as many lines:

{% include figure.html id="aws-sam-transform" %}

---

## The Template

### Resource types

The transform defines a small set of resource types. Each stands for a group of CloudFormation resources that are usually deployed together:

| Type | Generates |
| --- | --- |
| `AWS::Serverless::Function` | A Lambda function, an execution role unless you supply one, and the event source resources for each entry under `Events` |
| `AWS::Serverless::Api` | An API Gateway REST API, with its deployment and stage |
| `AWS::Serverless::HttpApi` | An API Gateway HTTP API, with its stage |
| `AWS::Serverless::WebSocketApi` | An API Gateway WebSocket API |
| `AWS::Serverless::GraphQLApi` | An AppSync GraphQL API, with its data sources and resolvers |
| `AWS::Serverless::StateMachine` | A Step Functions state machine, its role, and the event sources that start it |
| `AWS::Serverless::SimpleTable` | A DynamoDB table with a single-attribute primary key |
| `AWS::Serverless::LayerVersion` | A Lambda layer version |
| `AWS::Serverless::Application` | A nested stack, from a local template or from the Serverless Application Repository, AWS's catalog of published SAM applications |
| `AWS::Serverless::Connector` | IAM policies, and resource policies where needed, between a source and a destination |

Newer types cover Lambda's newer compute options, such as `AWS::Serverless::CapacityProvider` for Lambda Managed Instances, which run functions on EC2 instances in your account. The table and API types are shortcuts. `SimpleTable` can't define a sort key, secondary indexes, or streams, so any table beyond a single key is an ordinary `AWS::DynamoDB::Table`. A SAM template can mix both kinds freely.

A function with an `Api` or `HttpApi` event and no API resource of its own gets an **implicit API**, which SAM creates and names `ServerlessRestApi` or `ServerlessHttpApi`. Every function's events join the same implicit API, which is configured only through `Globals`. Declare the API explicitly when you need more than one API, a stage name of your own, an OpenAPI definition, or settings that `Globals` doesn't cover, such as CORS on an HTTP API. Then point each event at it with `RestApiId` or `ApiId`. The choice between REST and HTTP APIs is an API Gateway decision. HTTP APIs are cheaper and simpler, and REST APIs have features such as usage plans, request validation, and caching.

### Globals

The `Globals` section sets properties once for every function, API, or state machine in the template:

```yaml
Globals:
  Function:
    Runtime: python3.13
    Architectures: [arm64]
    MemorySize: 512
    Timeout: 30
    Tracing: Active
    LoggingConfig:
      LogFormat: JSON
```

A resource's own value replaces a global string or number, but maps are merged and lists are combined, with the global entries included. A resource can't remove a property that `Globals` sets, so a global VPC configuration or layer applies to every function, including ones added later. Globals keep a template short, but they also hide settings from the resource that uses them. Reserve them for values that genuinely apply to everything, such as runtime, architecture, and logging.

### Event sources

Each entry under a function's `Events` becomes the CloudFormation wiring for that trigger:

| Event types | Generates |
| --- | --- |
| `SQS`, `Kinesis`, `DynamoDB`, `MSK`, `MQ` | An event source mapping, plus permission to read the source on the generated role |
| `EventBridgeRule`, and the older `Schedule` | An EventBridge rule, plus a `Lambda::Permission` that lets the rule invoke the function |
| `ScheduleV2` | An EventBridge Scheduler schedule |
| `Api`, `HttpApi`, `S3`, `SNS` | The route, notification, or subscription, plus a `Lambda::Permission` that lets the service invoke the function |

SAM adds read permissions only to a role it generates. A function with its own `Role` needs those permissions in that role. The event's properties expose the settings of the resource underneath, such as batch size, filter criteria, and partial batch responses for SQS. How those settings behave is Lambda and event-source behavior, not SAM's.

### Policy templates and connectors

A function without a `Role` gets a generated execution role with basic logging permissions. SAM has two ways to add more.

**Policy templates** are named, parameterized IAM policies listed under the function's `Policies` property. `DynamoDBReadPolicy`, `DynamoDBCrudPolicy`, `S3ReadPolicy`, `SQSSendMessagePolicy`, `SNSPublishMessagePolicy`, and several dozen others each take a resource name and expand to a policy scoped to that resource:

```yaml
Policies:
  - DynamoDBReadPolicy:
      TableName: !Ref OrdersTable
  - SQSSendMessagePolicy:
      QueueName: !GetAtt ShippingQueue.QueueName
```

Each template grants a fixed action list, which is sometimes broader than the function needs. `DynamoDBCrudPolicy` includes deletes and scans, for example.

**Connectors** describe the relationship instead of the policy. A `Connectors` entry on the source resource names a destination and a direction, `Read`, `Write`, or both, and SAM works out the permissions for that pair of resource types. When the source has a role, such as a function or a state machine, the connector attaches a managed policy to that role, as it did for the table in the first example. When the source is a service with no role of its own, such as an API, an S3 bucket, or an SNS topic, the connector writes the resource-based policy on the destination instead, a `Lambda::Permission`, a queue policy, or a topic policy. Connectors work between SAM resources and plain CloudFormation resources, which also makes them useful in templates that use no other SAM feature. The destination's `Id` refers to a resource in the same template. For a resource defined elsewhere, give its `Arn` and `Type` instead.

Prefer connectors where the pair of resources is supported. They state the intent, and they write resource-based policies as well as role policies. Their `Read` and `Write` categories are fixed action lists, just as coarse as policy templates. A DynamoDB `Write` includes deletes, and an SQS `Write` includes purging the queue. Use an inline IAM statement under `Policies` when a function needs narrower access than either offers, and policy templates for pairs a connector doesn't support.

---

## The SAM CLI Workflow

The SAM CLI covers a project from creation to deployment:

| Command | What it does |
| --- | --- |
| `sam init` | Creates a project from a starter template for a chosen runtime |
| `sam validate` | Checks the template, and with `--lint`, also runs cfn-lint, AWS's open-source CloudFormation linter |
| `sam build` | Resolves dependencies and packages each function and layer into `.aws-sam/build/` |
| `sam local invoke` | Runs one function in a local container with a test event |
| `sam local start-api` | Serves the template's API routes on `localhost:3000` |
| `sam local generate-event` | Writes a sample event for a source, such as `sqs receive-message` or `s3 put` |
| `sam deploy` | Uploads the build output to S3 or ECR and deploys the stack through a change set |
| `sam sync` | Pushes code and template changes to a development stack as you edit |
| `sam remote invoke` | Sends an event to a deployed function, state machine, queue, or stream |
| `sam logs`, `sam traces` | Fetches a function's CloudWatch logs and its X-Ray traces |
| `sam delete` | Deletes the stack and its uploaded artifacts |

### Build

`sam build` installs each function's dependencies with the runtime's package manager, such as pip, npm, or dotnet, and writes a deployable copy of the template alongside the built artifacts. Dependencies with native code must be compiled for Lambda's Linux environment, which `sam build --use-container` does inside a container that matches the runtime. Container-image functions are built from their Dockerfile.

### Test locally

`sam local invoke` and `sam local start-api` run functions in containers built from images that mimic the Lambda runtime. They need a container engine, either Docker or, on macOS and Linux, Finch, AWS's open-source alternative. Local runs are fast to repeat and cost nothing, but they're an emulation. IAM isn't enforced, event sources other than the API aren't running, and the function still calls real AWS services for its dependencies, using your local credentials. Local testing is good for checking handler logic and API routing. It can't tell you whether the deployed permissions are right.

### Test in the cloud

`sam sync --watch` deploys the stack once and then watches the project. When function code changes, it updates the function directly through the Lambda API, which usually takes seconds. When the template changes, it runs a full CloudFormation deployment. Because the direct updates bypass CloudFormation, the stack drifts, and the CLI asks you to confirm that the target is a development stack. Use it against a personal development stack only. On a stack that a pipeline also deploys, the next pipeline run overwrites whatever was synced.

`sam remote invoke` sends an event to a deployed resource and prints the result. It invokes Lambda functions, starts Step Functions executions, sends SQS messages, and puts Kinesis records. It takes a logical ID with a stack name, or an ARN, so it works on any deployed stack, including one built with the CDK. Against deployed resources, it tests what local emulation can't, namely real permissions, real event sources, and real service limits. Lambda's shareable test events can be listed, downloaded, and used from the CLI with `sam remote test-event`.

### Deploy

The first `sam deploy --guided` asks for the stack name, Region, and parameter values, and saves the answers to `samconfig.toml`. Later runs of `sam deploy` read them from the file, with a separate table for each environment:

```toml
version = 0.1

[default.deploy.parameters]
stack_name = "orders-dev"
region = "us-east-1"
resolve_s3 = true
capabilities = "CAPABILITY_IAM"
confirm_changeset = true
parameter_overrides = "Environment=dev"

[prod.deploy.parameters]
stack_name = "orders-prod"
region = "us-east-1"
resolve_s3 = true
capabilities = "CAPABILITY_IAM"
parameter_overrides = "Environment=prod"
```

`sam deploy --config-env prod` selects the `prod` table. `resolve_s3` has the CLI create and use a managed artifact bucket, and `confirm_changeset` shows the change set and waits for approval before executing it. Templates that include `AWS::Serverless::Application` nested stacks also need `CAPABILITY_AUTO_EXPAND`.

In a pipeline, the build and deploy steps are the same commands, run with credentials from the pipeline's role, `--no-confirm-changeset`, and `--no-fail-on-empty-changeset`. Without that last flag, `sam deploy` exits with an error when nothing changed, which fails the pipeline run. `sam pipeline init --bootstrap` generates a starter pipeline configuration for CodePipeline, GitHub Actions, GitLab, Jenkins, or Bitbucket, and creates the IAM roles, artifact bucket, and optional ECR repository for each stage.

### Other templates

The SAM CLI's local and build commands aren't limited to SAM templates. A CDK app can be tested locally by synthesizing it with `cdk synth --no-staging` and pointing `sam local invoke` at the stack's template with `-t ./cdk.out/<stack>.template.json`. Terraform projects are supported through `--hook-name terraform`.

---

## Gradual Deployments

A function with `AutoPublishAlias` publishes a new Lambda version whenever its code changes and points the named alias at it. Adding `DeploymentPreference` shifts traffic to the new version gradually through CodeDeploy, instead of all at once:

```yaml
OrdersFunction:
  Type: AWS::Serverless::Function
  Properties:
    AutoPublishAlias: live
    DeploymentPreference:
      Type: Canary10Percent5Minutes
      Alarms:
        - !Ref OrdersErrorAlarm
      Hooks:
        PreTraffic: !Ref PreTrafficCheckFunction
```

SAM generates the CodeDeploy application, the deployment group, and a service role, and it points its own event sources and API integrations at the alias. Anything else that calls the function must use the alias too. Reference it with `!Ref OrdersFunction.Alias`, or `!Ref OrdersFunction.Version` for the version. A caller that invokes the function by name or by an unqualified ARN runs `$LATEST` and bypasses the traffic shifting. The shifting options, pre-traffic and post-traffic hooks, and alarm-driven rollback are CodeDeploy behavior. CodeDeploy needs an earlier version to shift traffic from, so deploy a new function with `AutoPublishAlias` first and add `DeploymentPreference` in a later deployment.

---

## Common Pitfalls

- **A REST API gets a stray stage named `Stage`.** Every `AWS::Serverless::Api`, implicit or explicit, gets an extra stage called `Stage` alongside the one you use. Setting `OpenApiVersion: '3.0'`, under `Globals.Api` or on the API itself, stops SAM creating it.
- **`sam deploy` ships the last build, not the current source.** When `.aws-sam/build/` exists, `sam deploy` deploys the template and artifacts in it, so an edit made since the last `sam build` silently doesn't ship. With no build at all, it packages `CodeUri` as it stands, without dependencies that live outside the source folder. Run `sam build` before every deploy.
- **Outputs that guess generated names.** An output that builds an endpoint URL from a hard-coded stage name breaks when the stage changes. Reference generated resources through their fixed IDs and properties, such as `ServerlessHttpApi` or `MyApi.Stage`.
- **Changing a `SimpleTable` key.** A `SimpleTable`'s primary key can't change after creation. Changing it replaces the table, and its data with it, unless the deletion and update-replace policies retain it.

---

## SAM or the CDK

Both tools produce CloudFormation, and both deploy through it, so the choice is about how the template is authored.

SAM fits applications that are mostly Lambda functions, APIs, queues, tables, and state machines, maintained by teams that prefer to read the template that gets deployed. The template is short, it maps directly onto what CloudFormation receives, and the SAM CLI's local testing, `sync`, and `remote invoke` cover the inner development loop.

The CDK fits systems with broader infrastructure, such as VPCs, containers, and databases, and patterns that repeat across services. Code can loop, branch, and package organizational standards into reusable constructs, and the CDK's grants do the job connectors do in SAM. Its `cdk watch` does what `sam sync` does, updating function code directly during development. The cost is a larger toolchain and a template that's generated rather than written.

The two can meet. The SAM CLI's local testing and `remote invoke` work on CDK apps. A team that starts with SAM and outgrows it isn't starting over, because the CDK's `CfnInclude` construct can load an existing template, and both deploy the same CloudFormation.

---

## Key Takeaways

- SAM is a CloudFormation transform plus a CLI. The `AWS::Serverless-2016-10-31` transform expands short serverless resource types into plain CloudFormation, and everything else in the template passes through.
- Use `SimpleTable` and implicit APIs only for the simplest cases. Declare a full table or an explicit API as soon as either needs more configuration.
- Prefer connectors for permissions between resources, and fall back to policy templates or inline statements where connectors don't reach.
- Test logic locally with Docker or Finch, and test permissions and integrations in the cloud with `sam sync` against a personal development stack and `sam remote invoke`.
- Run `sam build` before every `sam deploy`, keep per-environment settings in `samconfig.toml`, and run the same commands in a pipeline.
- `AutoPublishAlias` with `DeploymentPreference` gives canary or linear Lambda deployments through CodeDeploy, as long as callers use the alias.
- Choose SAM for serverless-centered applications authored as templates, and the CDK when the infrastructure is broad or repetitive enough to benefit from code.
