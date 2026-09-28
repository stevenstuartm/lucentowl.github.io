---
title: "AWS Systems Manager for System Architects"
layout: guide
category: AWS
subcategory: Management & Governance
description: "How AWS Systems Manager operates fleets of EC2 instances and servers outside AWS: what makes a node managed, SSM documents, Run Command, State Manager, maintenance windows, Session Manager and just-in-time access, Patch Manager and patch policies, Automation runbooks, Parameter Store, inventory, and what each costs."
tags: [systems-manager, session-manager, patch-manager, run-command, runbooks, just-in-time-access, fundamentals]
---
{% raw %}

## What Systems Manager Does

AWS Systems Manager runs operational work on servers: opening a shell, running a command across a fleet, applying patches, keeping configuration in place, and automating multi-step fixes. It works on EC2 instances and on servers and virtual machines outside AWS, which it calls **managed nodes** once they're registered. None of it needs SSH keys, bastion hosts, or inbound ports.

Systems Manager is a collection of tools that share one agent, one permission model, and one document format. The tools covered here group by job:

| Job | Tools |
| --- | --- |
| **Reach a node** | Session Manager, just-in-time node access, Fleet Manager |
| **Change nodes** | Run Command, State Manager, maintenance windows, Patch Manager |
| **Automate operations** | Automation runbooks |
| **Store configuration** | Parameter Store |
| **See the fleet** | Inventory, Compliance, the unified console |

Most tools are Regional, working on the nodes of one account in one Region. Since November 21, 2024, the **unified console** gives an organization-wide view of nodes across accounts and Regions. The organization's management account turns it on, and a **delegated administrator**, a member account it designates, runs it for everyone. The console shows which nodes are managed and their operating systems and agent versions, and it can run a diagnosis that explains why a node isn't reporting as managed.

---

## Managed Nodes

A node is managed when three things are true:

1. **SSM Agent is running on it.** Many AWS-provided AMIs include the agent, such as Amazon Linux, Windows Server, and recent Ubuntu. Other images need it installed.
2. **The agent has permissions.** On EC2, these come from an **instance profile**, the IAM role attached to the instance, with the `AmazonSSMManagedInstanceCore` policy, or from **Default Host Management Configuration**, a per-account, per-Region setting that gives every EC2 instance a Systems Manager role without an instance profile. It needs IMDSv2, the token-based instance metadata service, and SSM Agent 3.2.582.0 or later. An instance profile that already grants Systems Manager permissions takes precedence over it.
3. **The agent can reach Systems Manager.** The agent opens outbound HTTPS connections, on port 443, to the Regional `ssm`, `ssmmessages`, and `ec2messages` endpoints, either through a NAT gateway or through interface VPC endpoints for those services. SSM Agent 3.3.40.0 and later use `ssmmessages` in place of `ec2messages` when they can. Nodes also need to reach AWS-managed S3 buckets for agent updates and patches, and a private node that sends logs needs a route to S3 or CloudWatch Logs as well.

Because every connection starts from the agent, a node needs no inbound security group rule and no public IP address. Servers outside AWS, in a data center or another cloud, register through a **hybrid activation**, an activation code and ID that the agent uses to register machines with an account and Region and receive credentials from a service role. An activation can register a set number of machines and expires after 24 hours by default, or up to 30 days, without affecting machines already registered.

---

## SSM Documents

Almost everything Systems Manager does runs an **SSM document**, a JSON or YAML definition of steps, parameters, and the platforms it applies to. Command documents run on nodes, Automation documents (runbooks) call AWS APIs and orchestrate steps, and Session documents define what a session may do. AWS publishes hundreds, such as `AWS-RunShellScript`, `AWS-RunPatchBaseline`, and `AWS-ConfigureAWSPackage`, and you can write your own, version them, and share them with other accounts. A small command document with one parameter looks like this:

```yaml
schemaVersion: '2.2'
description: Restart an application service and show its status
parameters:
  serviceName:
    type: String
    default: orders
    allowedPattern: '^[a-zA-Z0-9_.@-]+$'
mainSteps:
  - action: aws:runShellScript
    name: restartService
    inputs:
      runCommand:
        - sudo systemctl restart {{ serviceName }}
        - systemctl status {{ serviceName }} --no-pager
```

The `allowedPattern` matters. Without it, a caller could pass `orders; <any command>` as the service name, and the document would run that command as root, the same risk as a document that accepts any shell command. A pattern, or `interpolationType: ENV_VAR`, which passes the value as an environment variable instead of pasting it into the command, closes that hole.

Documents are the unit of permission. An IAM policy can allow a user to run `AWS-RunPatchBaseline` on production nodes without allowing `AWS-RunShellScript`, which would let them run anything.

---

## Running Work on Nodes

**Run Command** sends a command document to a set of nodes now. Nodes are chosen by ID, by tag, or by resource group, a saved query that selects AWS resources by tag or CloudFormation stack. **Rate controls** set how many run at a time, as a number or percentage, and an error threshold that stops sending the command after too many nodes fail, so a bad command reaches a few nodes before it reaches a thousand. The console and API return only the first 24,000 characters of each node's output, so send full output to S3 or CloudWatch Logs.

**State Manager** keeps nodes in a defined state over time. An **association** pairs a document with targets and a schedule, such as "make sure the CloudWatch agent is installed on every node tagged `Environment=prod`, checking daily". It runs when the association is created, on its schedule, and when a matching node comes online for the first time, and it reports each node's association compliance. Associations suit things that should always be true. One-off changes belong in Run Command.

**Maintenance windows** schedule disruptive work into agreed times. A window has a schedule, a duration, and a cutoff after which no new tasks start, and it runs registered tasks against registered targets. Tasks can be Run Command documents, Automation runbooks, Lambda functions, or Step Functions state machines.

---

## Session Manager

### How a session works

**Session Manager** opens an interactive shell on a managed node from the console or the AWS CLI, using the node's existing outbound connection. Systems Manager checks the user's IAM permissions, asks the agent to open a channel, and relays traffic between the two, encrypted with TLS and optionally with a KMS key as well.

{% endraw %}
{% include figure.html id="aws-ssm-session-path" %}
{% raw %}

Access is IAM policy rather than keys. A policy can allow `ssm:StartSession` only on nodes with a given tag, or only with a given Session document, and removing the permission stops new sessions. Sessions already open continue until they're terminated or time out. On Linux, a session runs as `ssm-user`, an account the agent creates with sudo rights, unless **Run As** is configured to start sessions as a named operating system user. Starting a session from the AWS CLI needs the Session Manager plugin installed locally. The same channel carries **port forwarding**, from a local port to a port on the node or to a host the node can reach, such as a private database, and can tunnel SSH for tools that need it.

Session activity is recorded in two places. CloudTrail records who started and ended each session. The **session transcript**, the commands and output, is sent to S3 or CloudWatch Logs only if session logging is configured in the Session Manager preferences. Port-forwarding and SSH sessions produce no transcript.

The same preferences set timeouts. An idle session ends after 20 minutes by default, configurable from 1 to 60 minutes, but any input or reconnection resets the timer, and there's no maximum session duration unless you set one.

### Just-in-time node access

**Just-in-time node access** replaces standing permission to start sessions with time-bound approvals. Users get permission only to request access. When they connect, they give a reason, and **approval policies** decide the outcome:

- An **auto-approval policy** names nodes that users can reach without a human approving, such as stateless web servers.
- A **manual approval policy** names nodes that need one or more approvers, such as database servers, and the access window granted.
- A **deny-access policy** blocks auto-approval for the nodes it names.

Auto-approval and manual approval policies apply in the account and Region where they're created, while a deny-access policy applies across the whole organization.

Approvers are notified by email or in Slack or Microsoft Teams, and Systems Manager keeps every request for one year. Approved access lasts for the policy's window, and sessions don't end on their own when it closes, so set the timeouts above. Just-in-time node access needs the unified console, and it can record Remote Desktop (RDP) sessions to Windows Server nodes, made through Fleet Manager. It's billed per node-hour.

---

## Patch Manager

**Patch Manager** scans nodes for missing operating system and some application patches, installs them, and reports patch compliance. A **patch baseline** decides which patches count as approved: rules by classification and severity with an auto-approval delay, such as "security patches rated Critical or Important, seven days after release", plus explicit approved and rejected lists. AWS provides a default baseline for each supported operating system, and custom baselines replace them.

AWS recommends configuring patching with **patch policies**, available since December 2022 in **Quick Setup**, the Systems Manager tool that deploys a recommended configuration across accounts and Regions. One patch policy can cover every account and supported Region in an organization, or chosen organizational units, and sets separate schedules for scanning and installing. Patch policies are available in 16 Regions. Scanning daily keeps compliance data current, while installing weekly or monthly keeps reboots to a planned window. Older setups used **patch groups**, a tag that tied nodes to a baseline, run through maintenance windows. Patch groups keep working where they were already in use, but they aren't needed with patch policies.

Patching changes running systems, so staging matters more than any baseline rule. A common pattern is separate patch policies for development and production OUs, with production installing a week after development. On the same baseline, though, the auto-approval delay counts from each patch's release date, so production's later run also installs patches approved during that week, which development never received. To give production exactly what development tested, set an approval cut-off date on the production baseline, or approve production's patches explicitly. Compliance results are reported per account and Region, and patching can require a reboot, which the policy controls.

### Patching in place or replacing instances

Patch Manager suits long-lived servers. Fleets behind Auto Scaling groups often skip it: they build a patched AMI, for example with EC2 Image Builder, and replace instances with it, so every instance runs a tested image and nothing drifts. Containers work the same way, with patched images rather than patched hosts. Many estates use both, image replacement for stateless fleets and Patch Manager for servers that can't be replaced casually, such as databases or licensed software.

---

## Automation

**Automation** runs runbooks, documents whose steps call AWS APIs, run commands on nodes, wait for resources to reach a state, branch on results, pause for approval, or run a Python or PowerShell script. AWS publishes runbooks for common fixes, such as restarting an instance, enabling S3 Block Public Access, or creating an AMI, and custom runbooks combine the same steps.

A runbook can be run by hand, on a schedule, by a State Manager association or a maintenance window, from an EventBridge rule, or as the remediation for an AWS Config rule. A runbook run by an association also runs for each new node that matches it, which can multiply Automation charges in a fleet that scales often. It can run across many accounts and Regions at once, with the same rate controls as Run Command. Each step can define what happens on failure, such as aborting, continuing, or jumping to a cleanup step, and a runbook that creates resources should say how to undo them.

---

## Parameter Store

**Parameter Store** holds configuration values by hierarchical name, such as `/orders/prod/db-host`, so a service can read everything under `/orders/prod/` in one call and IAM policies can grant access by path. Values can be plain strings, string lists, or **SecureString** values encrypted with a KMS key. Every change creates a new version, and **labels** can point at a version, so a deployment can reference `prod-current` and roll back by moving the label.

Standard parameters hold up to 4 KB and are limited to 10,000 per account and Region. **Advanced parameters** hold up to 8 KB, can be shared with other accounts, and support **parameter policies**: an expiration date, a notification before expiry, and a notification when a parameter hasn't changed for a set time. A change to any parameter can be caught with EventBridge. Applications that read parameters heavily can raise the account's API throughput limit. Documents and runbooks can reference String and StringList parameters directly, so a runbook can take its settings from Parameter Store. Secrets that need automatic rotation belong in Secrets Manager instead.

---

## Seeing the Fleet

**Inventory** collects what's on each node, such as installed applications, packages, services, network configuration, and Windows updates, on a schedule set by a State Manager association. **Resource data sync** copies inventory from many accounts and Regions into one S3 bucket, where Athena, AWS's SQL query service for S3, can answer questions such as "which nodes run this version of OpenSSL?". **Compliance** summarizes patch and association compliance per node.

**Fleet Manager** is the console view of individual nodes, with a file browser, performance counters, log viewing, operating system user management, and on Windows, the registry and Remote Desktop connections, all through the agent rather than an open port.

For operational issues, **OpsCenter** tracks **OpsItems**, work items that CloudWatch alarms, EventBridge rules, and other services can create. Two related tools closed to new customers on November 7, 2025: **Incident Manager**, for which AWS points new customers to OpsCenter for tracking issues and to partner tools for paging and response, and **Change Manager**, for which it points to partner tools. Existing customers can keep using both.

---

## What It Costs

For EC2 instances, the node tools cost nothing: Session Manager, Run Command, State Manager, maintenance windows, Patch Manager, Inventory, Compliance, and Fleet Manager. The paid parts are:

| Item | Price (US East, N. Virginia) |
| --- | --- |
| **Session Manager on nodes outside AWS** | $0.05 per session, from September 30, 2026 |
| **Run Command on nodes outside AWS**, including patching | $0.002 per invocation, from September 30, 2026 |
| **Just-in-time node access** | $0.0137 per node-hour for the first 72,000 node-hours a month, falling at higher volumes |
| **Automation** | $0.002 per step and $0.00003 per second of script run time |
| **Advanced parameters** | $0.05 per parameter per month, plus $0.05 per 10,000 API requests |
| **Parameter Store higher throughput** | $0.05 per 10,000 API requests for every parameter, once turned on |
| **OpsCenter** | $2.97 per 1,000 OpsItems |

The charges for nodes outside AWS replace the advanced-instances tier and the 1,000-node limit on hybrid nodes, both removed on June 30, 2026. Session Manager and Run Command on those nodes are free until the new charges start, and patching them counts as Run Command, since patching runs a command document. The other costs come from what Systems Manager writes to, such as session logs and command output in CloudWatch Logs and S3, and interface VPC endpoints, which are charged per endpoint per Availability Zone.

---

## Common Pitfalls

- **Nodes that never become managed.** A missing role, an instance profile that overrides Default Host Management Configuration, IMDSv1 on an instance that relies on Default Host Management Configuration, or no route to the Systems Manager endpoints all leave a node invisible. The unified console's diagnosis names the cause.
- **Session logging left off.** Without it, CloudTrail shows that a session happened but not what was done in it. Configure logging before granting access, and remember that port-forwarding and SSH sessions aren't transcribed.
- **Permission to run `AWS-RunShellScript` everywhere.** It lets a user run any command as root on any node the policy allows. Scope Run Command and Session Manager by document and by node tag.
- **Staging that doesn't stage.** Production installing a week after development on the same baseline also installs that week's new approvals, untested. Pin production to what development received with an approval cut-off date.
- **Runbooks without failure handling.** A runbook that fails halfway leaves the resources its earlier steps created. Give each step an `onFailure` action, and test runbooks outside production.
- **Hybrid usage assumed free.** From September 30, 2026, Session Manager and Run Command on nodes outside AWS are billed per session and per invocation, and patching counts as Run Command. Account for them when replacing SSH at scale.

---

## Key Takeaways

- A managed node runs SSM Agent with Systems Manager permissions and an outbound route to its endpoints. Default Host Management Configuration removes the need for an instance profile on EC2.
- Nothing connects in to a node. Session Manager relays between the user's connection and the agent's outbound connection, controlled by IAM and logged if configured.
- Just-in-time node access replaces standing session permissions with approvals, auto-approval for low-risk nodes and manual approval for sensitive ones.
- SSM documents define the work and are the unit of permission. Run Command does it now, State Manager keeps doing it, and maintenance windows schedule it.
- Patch policies patch a whole organization with separate scan and install schedules. Stage production behind development.
- Automation runbooks orchestrate multi-step fixes across accounts and Regions, triggered by people, schedules, events, or Config rules.
- The node tools are free on EC2. Nodes outside AWS are billed per session and per command invocation from September 30, 2026. Incident Manager and Change Manager are closed to new customers.

{% endraw %}
