---
title: "AWS CodeDeploy for System Architects"
layout: guide
category: AWS
subcategory: Developer Tools & CI/CD
description: "How AWS CodeDeploy deploys to EC2 and on-premises servers, Lambda, and ECS: applications, deployment groups, and the AppSpec file; the agent, lifecycle hooks, and in-place and blue/green deployments on EC2; traffic shifting for Lambda and ECS; alarm-driven rollback; and where ECS's own deployments and CodePipeline's deploy actions now replace it."
tags: [codedeploy, appspec, blue-green, canary, cicd, practical]
---

## What CodeDeploy Does

**AWS CodeDeploy** rolls a new version of an application out to running compute and rolls it back when something goes wrong. It works on three compute platforms, and does something different on each:

| Platform | What a deployment does |
| --- | --- |
| EC2 and on-premises servers | An agent on each server copies the new files into place and runs your scripts, either on the existing servers (in-place) or on a replacement fleet behind a load balancer (blue/green) |
| Lambda | Moves an alias, a named pointer that callers invoke, from the current function version to a new one, all at once or in steps |
| ECS | Starts a replacement set of tasks and moves the load balancer's traffic to it, all at once or in steps |

CodeDeploy doesn't build anything or decide when to release. A pipeline, a script, or an infrastructure tool starts each deployment and hands it the new version. What CodeDeploy adds is the rollout itself: the order, the pace, the checks along the way, and the automatic rollback.

---

## Core Pieces

An **application** is a name that groups what CodeDeploy deploys, and it belongs to one compute platform. Each application has one or more **deployment groups**, one per set of targets, such as the production fleet or a staging Lambda alias. The deployment group holds the targets, the service role CodeDeploy acts with, the load balancer, the alarms to watch, and the rollback settings.

A **revision** is the version being deployed. For EC2 it's a bundle, a zip or tar archive in S3 or a commit in GitHub or Bitbucket, holding the application files and an **AppSpec file** that tells CodeDeploy where the files go and which scripts to run when. For Lambda and ECS the revision is just the AppSpec file, which names the new function version or task definition.

A **deployment configuration** sets the pace. For EC2 it sets how many instances must stay healthy while others are updated. For Lambda and ECS it sets how traffic moves: all at once, as a **canary** that shifts a percentage and then the rest after a wait, or **linear** steps at a fixed interval.

CodeDeploy is free for EC2, Lambda, and ECS deployments. Deployments to on-premises servers cost $0.02 per server updated.

---

## EC2 and On-Premises

### The agent

On servers, the **CodeDeploy agent** does the work. It runs on each instance, polls CodeDeploy for deployments, downloads the revision, and runs the lifecycle events. Install it through Systems Manager, which can also keep it updated, rather than by hand. The instance profile needs permission to read the revision bucket, and the agent needs a network path to CodeDeploy and S3. In a private subnet that means a NAT gateway, or VPC endpoints for both `codedeploy` and `codedeploy-commands-secure` plus a path to S3, with the agent configured to use them. On-premises servers register with CodeDeploy using an IAM user or role and are targeted by tags like EC2 instances.

The deployment group selects its instances by EC2 tags, on-premises tags, or Auto Scaling groups. With an Auto Scaling group attached, CodeDeploy also deploys the last successful revision to every instance the group launches, and an instance whose deployment fails is terminated. An instance launched while a deployment is running gets the previous revision, and CodeDeploy then runs a follow-up deployment to bring it up to date.

### The AppSpec file

For an EC2 deployment, `appspec.yml` sits at the root of the bundle. A .NET service running under systemd might use:

```yaml
version: 0.0
os: linux
files:
  - source: publish/
    destination: /opt/orders-api
file_exists_behavior: OVERWRITE
permissions:
  - object: /opt/orders-api
    owner: orders
    group: orders
hooks:
  ApplicationStop:
    - location: scripts/stop.sh
      timeout: 60
  AfterInstall:
    - location: scripts/configure.sh
      timeout: 120
  ApplicationStart:
    - location: scripts/start.sh
      timeout: 60
  ValidateService:
    - location: scripts/health-check.sh
      timeout: 120
```

The `files` section says what to copy where, and `hooks` maps lifecycle events to scripts in the bundle. A script that exits non-zero, or runs past its timeout, fails the deployment on that instance. Each event's scripts together can run for at most an hour. `file_exists_behavior` decides what happens when a file the revision installs already exists at the destination but wasn't installed by the last successful deployment. The default, `DISALLOW`, fails the deployment, `OVERWRITE` replaces the file, and `RETAIN` keeps it.

### In-place deployments

An **in-place deployment** updates the existing instances a few at a time. When the deployment group names a load balancer, CodeDeploy takes each instance out of service before replacing its application and returns it afterward, so users never reach an instance mid-update:

{% include figure.html id="aws-codedeploy-inplace-hooks" %}

`ValidateService` is the natural place for a health check, before the instance is registered with the load balancer again. `BeforeBlockTraffic`, `AfterBlockTraffic`, and `ApplicationStop` run the scripts from the last successful revision, because they deal with the version that's being replaced. Every other event runs the new revision's scripts.

The deployment configuration sets how many instances must stay healthy, and so how many update at once. The three built-in configurations have success rules that are easy to misread:

| Configuration | Updates at once | Counts as succeeded when |
| --- | --- | --- |
| `CodeDeployDefault.OneAtATime` (default) | One instance | Every instance succeeds, except that a failure on the last instance still counts as success |
| `CodeDeployDefault.HalfAtATime` | Up to half, rounded down | At least half the instances, rounded up, succeed |
| `CodeDeployDefault.AllAtOnce` | All | At least one instance succeeds |

A custom configuration sets the minimum healthy hosts as a count or a percentage. It can also enable **zonal deployment**, which updates one Availability Zone at a time and waits a set **monitor duration** between zones, so a bad release shows up in one zone's alarms before it reaches the others. Zonal deployment works only for in-place deployments to EC2 instances, and a rollback doesn't follow the zones. It updates random hosts.

In-place deployment is cheap and simple, but it changes the servers that are serving traffic, and its rollback is slow.

### Blue/green deployments

A **blue/green deployment** on EC2 leaves the current instances alone and deploys to a replacement fleet. CodeDeploy can copy the deployment group's Auto Scaling group to create the replacement instances, or deploy to instances you provide by tag. Once the replacement instances pass their lifecycle events, CodeDeploy registers them with the load balancer and deregisters the originals, either immediately or after you approve. If no one approves within the wait you set, the deployment stops.

Afterward, CodeDeploy terminates the original instances after a configured wait of up to two days, or keeps them running. Blue/green on EC2 needs a load balancer and doesn't support on-premises servers. The cost is running two fleets during the deployment and the wait afterward, and the gain is a fast rollback.

---

## Lambda

For Lambda, CodeDeploy moves an alias from the current function version to a new one by changing the alias's routing weights. `CodeDeployDefault.LambdaCanary10Percent5Minutes` sends 10% of the alias's invocations to the new version, waits five minutes, then sends the rest. Built-in configurations cover canaries of 5 to 30 minutes and linear steps of 10% every 1 to 10 minutes, and custom ones can set any percentage and interval.

Two optional hooks run Lambda functions, `BeforeAllowTraffic` before any traffic moves and `AfterAllowTraffic` after it all has. A hook function tests the new version and reports the result by calling CodeDeploy's `PutLifecycleEventHookExecutionStatus` API. If it reports failure, or doesn't report within an hour, the deployment fails and the alias returns to the old version.

Traffic shifting only covers callers that invoke the alias. A caller that invokes the function by name or by an unqualified ARN runs `$LATEST` and bypasses the rollout. Lambda deployments through CodeDeploy are usually set up by AWS SAM's `DeploymentPreference`, which creates the application, the deployment group, and the AppSpec file from a few lines of template.

---

## ECS

### Blue/green through CodeDeploy

An ECS service's **deployment controller** decides what carries out its deployments. A service whose controller is `CODE_DEPLOY` hands every deployment to CodeDeploy. The service sits behind a load balancer listener with two target groups. CodeDeploy starts a replacement **task set** with the new task definition, registers it with the second target group, and moves the listener's traffic to it, all at once or as a canary or linear shift. An optional **test listener** on another port sends traffic to the replacement tasks first, so tests can run against them before any user does. The AppSpec file names the new task definition and the Lambda hooks to run:

```yaml
version: 0.0
Resources:
  - TargetService:
      Type: AWS::ECS::Service
      Properties:
        TaskDefinition: arn:aws:ecs:us-east-1:111122223333:task-definition/orders-api:42
        LoadBalancerInfo:
          ContainerName: orders-api
          ContainerPort: 8080
Hooks:
  - AfterAllowTestTraffic: "orders-api-integration-tests"
  - BeforeAllowTraffic: "orders-api-pre-traffic-check"
```

The hooks are the same kind of Lambda functions as for Lambda deployments, with the same one-hour limit. With a Network Load Balancer, only the all-at-once configuration is available.

### ECS's own blue/green, linear, and canary deployments

Since July 2025, ECS runs blue/green deployments itself, and since October 2025 linear and canary deployments too, with the controller left as `ECS`. They keep the old version running for a bake time after the shift, run Lambda hooks, roll back on alarms, and deploy through a normal `UpdateService` call.

AWS recommends the built-in deployments for ECS, and documents migration paths from CodeDeploy. Keeping CodeDeploy makes sense where pipelines, audit processes, or coordinated multi-service releases are already built around it and there's no need to change.

---

## Rollback and Alarms

A deployment group can watch up to ten CloudWatch alarms. When any of them goes into the `ALARM` state during a deployment, CodeDeploy stops the deployment. Rolling back is a separate setting, which can trigger on a failed deployment, on an alarm, or both. Give the group the alarms that matter for the release, such as error rate and latency for the new version, and turn on rollback for both.

What a rollback does depends on the platform:

- **EC2 in-place** rolls back by starting a new deployment of the last revision that succeeded, with the same pace as any other deployment. Files the failed deployment wrote are replaced, but anything its scripts changed outside the bundle, such as a database migration, is not undone.
- **EC2 blue/green** reregisters the original instances, if they haven't been terminated yet.
- **Lambda** moves the alias back to the original version.
- **ECS** moves the listener back to the original task set, if it hasn't been terminated yet.

Alarms are only watched while the deployment runs. For blue/green on EC2 and ECS that includes the wait before the originals are terminated, so a short wait ends the chance to roll back soon after the shift. For Lambda and in-place EC2, the deployment ends with the last traffic shift or the last instance. A problem that appears ten minutes later won't roll anything back, so build in a watch period, with a termination wait, a longer final canary interval, a zonal monitor duration, or a pipeline stage condition that watches the alarms after the deployment.

---

## Common Pitfalls

- **`AllAtOnce` and `HalfAtATime` succeed with failed instances.** An `AllAtOnce` deployment reports success if any one instance succeeds, leaving the fleet running mixed versions. Choose a configuration whose success rule matches what you'd accept, or define a custom minimum healthy hosts value.
- **Hand-placed files fail the deployment.** A config file edited on the server by hand, when the revision also ships a file of that name, fails the deployment under the default `DISALLOW` behavior. Set `file_exists_behavior` deliberately, and keep files the server writes out of the deployment destination.
- **A broken old script blocks every later deployment.** Because `ApplicationStop`, `BeforeBlockTraffic`, and `AfterBlockTraffic` run the last successful revision's scripts, a broken one fails every new deployment, and fixing it in the new revision doesn't help. Create one deployment with `--ignore-application-stop-failures`, which ignores failures in all three, and the fixed scripts take over from then on.
- **`AllowTraffic` fails with nothing in the logs.** A deployment that fails at `AllowTraffic` with no script error usually has a misconfigured health check on the load balancer's target group, so the instances never become healthy.
- **The agent can't reach CodeDeploy.** When every lifecycle event is skipped and the deployment fails with `HEALTH_CONSTRAINTS`, the agent isn't running or can't reach the CodeDeploy and S3 endpoints. Check the agent log at `/var/log/aws/codedeploy-agent/codedeploy-agent.log` first. Script output is in `/opt/codedeploy-agent/deployment-root/deployment-logs/codedeploy-agent-deployments.log`.

---

## When to Use CodeDeploy

CodeDeploy is the managed way to roll out application code to EC2 instances and on-premises servers, and that's still the main reason to learn it. On EC2 there are two alternatives. Replacing instances instead of updating them, with a new launch template version and an Auto Scaling instance refresh, suits fleets built from images rather than configured by deployment scripts. CodePipeline's EC2 deploy action runs deployment scripts on tagged Linux instances through Systems Manager, without the agent, and suits simpler fleets already deployed from a V2 pipeline.

For Lambda, CodeDeploy runs the canary and linear alias shifts that SAM and the CDK set up, and CodePipeline's Lambda deploy action can do the same without it. For ECS, the built-in deployment strategies have caught up with it, and new services should use those. CodeDeploy doesn't deploy to EKS, where Kubernetes's own rolling updates and tools such as Argo Rollouts fill the role.

In a pipeline, CodePipeline starts CodeDeploy deployments for EC2 and on-premises servers and for ECS blue/green, and any CI system can start one through the API.

---

## Key Takeaways

- CodeDeploy rolls a new version out to EC2 and on-premises servers, Lambda aliases, or ECS services, and rolls it back on failure or alarm. It's free except for on-premises servers.
- On EC2, the agent runs AppSpec lifecycle hooks on each instance. Put health checks in `ValidateService`, and know that the stop and block-traffic hooks run the previous revision's scripts.
- Choose the deployment configuration by its success rule, not just its speed, and use zonal configurations to deploy one Availability Zone at a time.
- Blue/green on EC2 deploys to a replacement fleet and keeps the originals for a fast rollback, at the cost of running two fleets.
- For Lambda, CodeDeploy shifts alias weights. Only callers that use the alias are covered.
- For new ECS services, use ECS's built-in blue/green, linear, and canary deployments rather than CodeDeploy.
- Alarms stop and roll back a deployment only while it runs, so build a watch period, such as a blue/green termination wait, into the rollout.
