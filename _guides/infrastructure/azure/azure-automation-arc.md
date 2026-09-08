---
title: "Azure Automation & Azure Arc for System Architects"
layout: guide
category: Azure
subcategory: Management & Governance
description: "How Azure Automation runs runbooks in the cloud and on hybrid workers, how Azure Arc projects on-premises and multi-cloud machines into Azure as resources, and where patching, configuration, and governance moved after the Update Management and DSC retirements."
tags: [automation, azure-arc, runbooks, hybrid-runbook-worker, update-manager, machine-configuration, practical]
---

## What Azure Automation and Azure Arc Do

[Azure Automation](https://learn.microsoft.com/en-us/azure/automation/overview){:target="_blank" rel="noopener noreferrer"} runs scripts. It stores PowerShell and Python runbooks, holds the credentials and variables those runbooks need, and executes them on a schedule, on demand, or in response to an HTTP call. The execution can happen in a Microsoft-hosted sandbox in Azure or on a machine you own.

[Azure Arc](https://learn.microsoft.com/en-us/azure/azure-arc/overview){:target="_blank" rel="noopener noreferrer"} does something different. It projects infrastructure that is not in Azure into the Azure Resource Manager control plane, so a server in your datacenter or a Kubernetes cluster on another cloud gets an Azure resource ID and behaves, for governance purposes, like a native Azure resource. Policy, RBAC, Azure Monitor, and Defender for Cloud then reach it through the same APIs they use for Azure VMs.

The two services get taught together because Arc is what makes Automation's hybrid story work at scale, and because several capabilities that once lived inside Automation now live in separate services that Arc feeds.

### Where These Resources Live in the Azure Hierarchy

Scope drives more of the behavior here than the feature lists suggest.

An **Automation account** is a resource inside a resource group inside a subscription. Everything it owns (runbooks, schedules, variables, credentials, certificates, connections, modules, and Hybrid Worker groups) is scoped to that one account. A machine hosting a Hybrid Runbook Worker can report to exactly one Automation account, and a worker belongs to exactly one Hybrid Worker group. If two teams in the same subscription need independent automation, they need separate accounts, not separate runbooks in a shared one.

An **Arc-enabled server** is a `Microsoft.HybridCompute/machines` resource in a resource group, which means it inherits every policy assignment above it in the management group, subscription, and resource group chain. Choosing the resource group is therefore a governance decision, not a filing decision. There is no cap on the number of Arc-enabled servers or their extensions in a resource group or subscription, so the constraint is policy blast radius rather than quota.

An **Arc-enabled Kubernetes cluster** is likewise a resource in a resource group, and cluster extensions are child resources of it. Data services deployed on that cluster are children again, which is why a data controller has to be deployed before any database can be.

### How They Compare to AWS Systems Manager and Outposts

| Concept | AWS Systems Manager | Azure Automation + Arc |
|---------|-------------------|----------------------|
| **Agent requirement** | SSM Agent on every managed instance | Hybrid Runbook Worker VM extension for runbook execution; Azure Connected Machine agent for Arc-enabled servers |
| **Scope** | AWS infrastructure plus hybrid machines registered with Systems Manager | Arc extends the Azure control plane to servers and Kubernetes clusters on any OS, cloud, or edge location |
| **Patch management** | Patch Manager orchestrates patches across EC2, on-premises, and other clouds | Azure Update Manager, a separate service from Automation, patches Azure VMs and Arc-enabled servers |
| **Configuration management** | State Manager plus Systems Manager Documents | Azure machine configuration, delivered through Azure Policy |
| **Data services** | AWS databases stay AWS-managed | SQL Managed Instance enabled by Azure Arc runs on your Kubernetes cluster with Azure management and billing |
| **Runbook/automation** | Systems Manager Documents plus Automation | Azure Automation runbooks in PowerShell, Python, or the graphical editor, executed in Azure or on a hybrid worker |
| **Governance across environments** | AWS-centric; non-AWS resources need extra setup | Arc puts any registered resource under Azure Policy, Azure RBAC, and Defender for Cloud |
| **On-premises hardware** | AWS Outposts ships AWS infrastructure to your datacenter | Azure Local and Azure Stack Edge run Azure services on-premises; Arc manages any on-premises machine regardless of hardware |
| **Kubernetes integration** | EKS is AWS-only; other clusters sit outside management | Arc-enabled Kubernetes attaches any CNCF-certified cluster |

---

## Azure Automation

### Runbook Types and Runtime Versions

Runbook type is a permanent choice. You cannot convert a graphical runbook to a text runbook or the reverse, so decide deliberately rather than discovering the constraint later.

**PowerShell runbooks** are the recommended default. The currently supported runtime versions are PowerShell 7.6, 7.4, and 5.1. PowerShell 7.1 and 7.2 have reached end of support in the parent product and Azure Automation follows the parent product's lifecycle, so new work should target 7.6 or 7.4. The runtime version you select also determines which imported modules are used, so a module imported against 5.1 is not visible to a 7.4 job. PowerShell 7.x does not support signed runbooks, and source control integration creates 7.x runbooks in the account as 5.1.

**Python runbooks** compile under Python 3.10. Python 2.7 and 3.8 are no longer supported by the parent product. Python 3.10 modules need wheel files targeting cp310 Linux, and custom packages are validated at job runtime rather than at import, so a missing dependency surfaces as a job failure rather than an import error.

**Graphical runbooks** are built in the portal editor and generate PowerShell underneath. They can only be created and edited in the portal, cannot be digitally signed, and cannot run on a Linux Hybrid Runbook Worker. **Graphical PowerShell Workflow runbooks** and text **PowerShell Workflow runbooks** add checkpoints and parallel execution, but PowerShell 7.x dropped Workflow entirely, so those runbooks cannot be moved to a modern runtime. Treat them as a maintenance category rather than a starting point.

### Where a Runbook Runs

A runbook job executes either in an Azure sandbox or on a Hybrid Runbook Worker, and the choice determines both the resource limits and the network path.

The **Azure sandbox** is a shared container hosted by Microsoft. Jobs from different Automation accounts are isolated from each other, but jobs from the same account can share a sandbox, up to ten at a time, and a `Disconnect-AzAccount` in one job disconnects every other job in that sandbox. Sandbox jobs are bound by [documented limits](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits#azure-automation-limits){:target="_blank" rel="noopener noreferrer"}: a three-hour fair-share ceiling on runtime, 400 MB of memory, 1,000 network sockets, and 1 GB of temporary disk. Sandboxes also cannot call executables or subprocesses, cannot query device or application characteristics through WMI, cannot run elevated, and support only .NET Framework 4.7.2.

The fair-share ceiling is the limit that surprises people. After three hours, Azure unloads the job. PowerShell and Python runbooks are stopped and not restarted, and the job status becomes `Stopped`.

A **Hybrid Runbook Worker** runs the job on a machine you own. It is not subject to fair share and has no runtime ceiling, and its memory, disk, and socket limits are whatever the host machine has. It can reach local file systems, databases, and services that never cross the internet.

```
                         Automation account
                  (runbooks, schedules, shared assets)
                                 |
        job targets sandbox      |      job targets a worker group
              +------------------+------------------+
              |                                     |
              v                                     v
   +----------------------+        +------------------------------+
   |    Azure sandbox     |        | Hybrid Runbook Worker group  |
   |  shared container    |        |   worker A       worker B    |
   |  3 h fair share      |        |      |               |       |
   |  400 MB / 1 GB temp  |        |      +-------+-------+       |
   |  no .exe, no elevate |        |              |               |
   +----------+-----------+        +--------------|---------------+
              |                                   |
              | outbound to public                | outbound HTTPS 443,
              | Azure endpoints                   | polled every 30 s
              v                                   v
     Azure resources reachable        Automation service endpoint
     from the public cloud            (no inbound port is opened;
                                       local resources stay local)
```

The direction of the arrows is the point. A hybrid worker polls outward and pulls its jobs, so a machine in a network with no inbound path from the internet can still be automated from Azure. That same property is why enabling the Azure Firewall on Storage, Key Vault, or Azure SQL blocks sandbox jobs. Automation is not on the trusted-Microsoft-services list, so a firewalled data service can only be reached from a hybrid worker sitting inside a virtual network with a service endpoint.

### Hybrid Runbook Workers

#### The Agent-Based Worker Is Retired

Azure Automation had two Hybrid Runbook Worker platforms, and only one still exists. The **agent-based (V1)** worker, which depended on the Log Analytics agent reporting to a workspace, retired on **31 August 2024**, and jobs running on agent-based workers stopped on **1 April 2025**. Any documentation or script that installs a hybrid worker by first installing the Log Analytics agent describes the retired path.

The **extension-based (V2)** worker is the supported platform. It installs as a VM extension, managed by the Azure VM agent on Azure VMs and by the Azure Connected Machine agent on Arc-enabled servers and Arc-enabled VMware vSphere VMs. It has no Log Analytics dependency, authenticates with a system-assigned managed identity, upgrades minor versions automatically by default, and can be deployed through the portal, PowerShell, Bicep, ARM templates, REST, or the CLI.

#### How Job Dispatch Actually Works

Workers pull; the service does not push, and it does not round-robin.

Every active worker in a group polls the Automation service every 30 seconds. Whichever worker pings first after a job is queued picks it up, on a first-come-first-served basis. You specify the group when you start a runbook and cannot specify a particular worker within it. A single worker generally picks up about four jobs per ping, so a sustained submission rate above four jobs per 30 seconds needs more workers in the group or the jobs may be suspended with an error.

Health is measured the same way. If no worker in a group has pinged the service in the last 30 minutes, the group is treated as having no active workers, and jobs queued against it are suspended after three retry attempts. If a worker's host machine reboots mid-job, the job restarts from the beginning, or from the last checkpoint for PowerShell Workflow runbooks, and is suspended after more than three restarts.

#### Worker Groups and Their Constraints

A group can hold a single worker or many, and multiple workers give both availability and throughput. The binding constraints are ownership rather than capacity. Each machine hosts one worker reporting to one Automation account, and a worker listens for jobs from that account only. An Automation account supports up to 4,000 system workers and 4,000 user workers, and Microsoft recommends a second Automation account beyond roughly 4,000 managed machines. Hybrid Runbook Worker is not supported on Virtual Machine Scale Sets.

Registering the same machine against different groups is how you shape distribution. Target a job at a group whose membership matches the blast radius you want.

#### When a Hybrid Worker Is the Right Answer

- **Long-running work.** Anything beyond the three-hour sandbox ceiling has to run on a worker.
- **Local resource access.** Scripts against on-premises databases, file shares, or services that do not have public endpoints.
- **Network-isolated environments.** Machines with no inbound path from Azure, and Azure data services behind a firewall that blocks sandbox traffic.
- **Third-party executables and elevation.** Sandboxes cannot call `.exe` files or run elevated; a worker can, because you own the operating system.
- **Non-4.7.2 .NET dependencies.** Sandboxes are pinned to .NET Framework 4.7.2 and cannot be upgraded.

Hybrid worker jobs run under the local `System` account on Windows and the `nxautomation` account on Linux, which is a detail that matters when a runbook needs domain credentials rather than machine ones.

### Automation Account Shared Resources

An Automation account is the container for everything a runbook needs at execution time.

**Variables** hold string, integer, boolean, or datetime values shared across runbooks. Encrypted variables cannot be read back in plain text once set. A PowerShell runbook cannot retrieve an unencrypted variable with a null value, and cannot retrieve any variable with `~` in its name.

**Credentials** hold username and password pairs. A runbook retrieves one with the internal `Get-AutomationPSCredential` cmdlet from the `Orchestrator.AssetManagement.Cmdlets` module. The `Get-AzAutomationCredential` cmdlet returns metadata only, not a usable `PSCredential`, which is a common source of confusion. Azure Automation does not support user accounts that require multifactor authentication.

**Certificates** store X.509 certificates, including self-signed ones, for authentication to Azure or third-party endpoints.

**Connections** are named objects holding predefined connection parameters, with built-in types for Azure and custom types for other systems.

**Modules** are the PowerShell or Python libraries runbooks depend on. `AzureRM.Automation` is installed by default when an account is created, but `Az.Automation` (the recommended module) has to be imported manually. Modules are imported per runtime version, so a module available to a 5.1 job is not available to a 7.4 job unless it was imported against 7.4 as well. A module can be at most 100 MB, and at most five modules can be imported per 30 seconds per account.

Credentials, certificates, connections, and encrypted variables are collectively the account's secure assets. Azure Automation generates a unique key per Automation account, stores that key in a system-managed Key Vault, and loads it to encrypt each asset before storage. You do not see or manage that vault. For secrets your own applications also consume, a Key Vault you control plus a managed identity on the runbook is the better arrangement, because it keeps one copy of the secret rather than two.

### Schedules, Webhooks, and Event-Driven Triggers

**Schedules** fire runbooks on a one-time or recurring basis, in UTC or a named timezone, and a single runbook can be linked to several schedules with different parameter values.

**Webhooks** give a runbook an HTTPS endpoint that any external system can POST to. Read the security model before you use one, because it is thinner than it looks. The URL contains a security token and Azure Automation performs no other authentication on the request, so the URL is effectively a password. It is shown only once at creation and cannot be retrieved afterward, including from an ARM template deployment where only the first deployment returns it. A webhook is valid for up to ten years, with the portal defaulting to one year, and can be extended before it expires but never reactivated after. A successful POST returns `202 Accepted` with the job ID in the body as `{"JobIds":["<JobId>"]}`, and the payload cap is 512 KB.

Two behaviors catch people out. Azure Automation logs every input parameter with the job, so anything sensitive in a webhook body is visible to anyone who can read job history. And a webhook cannot start a Python runbook at all, while a PowerShell 7 runbook started by webhook auto-converts the input parameter to invalid JSON, which is why PowerShell 5.1 remains the recommended runtime for webhook-triggered work.

Because there is no authentication step, validate the request inside the runbook. Check the `WebhookName` property of the `WebhookData` parameter, inspect `RequestHeader` and `RequestBody` for an expected marker, or call back to the originating system to confirm the event really happened before acting on it. For network-level control, Azure Automation supports the `GuestAndHybridManagement` service tag on network security groups and Azure Firewall, which lets you trigger webhooks from inside a virtual network without allowlisting IP ranges.

**Event-driven triggers** build on the same mechanism. Azure Event Grid supports Azure Automation runbooks as an event handler through webhooks, so a resource event can start a runbook. Logic Apps can call a runbook as a workflow step through the Azure Automation connector, and an Azure Monitor alert can start one through an action group.

### Configuration Management After State Configuration

Azure Automation State Configuration, the PowerShell DSC pull server built into Automation, **retires on 30 September 2027**. Its Linux half retired earlier, on 30 September 2023. The replacement is [Azure machine configuration](https://learn.microsoft.com/en-us/azure/governance/machine-configuration/overview){:target="_blank" rel="noopener noreferrer"}, which merges the DSC extension, Automation State Configuration, and guest configuration into one feature delivered through Azure Policy.

The practical difference is where the assignment lives. State Configuration assigned configurations from an Automation account to registered nodes. Machine configuration assigns them as policy definitions at a management group, subscription, or resource group scope, which means a new machine that lands in scope picks up its configuration without a separate registration step. Machine configuration also covers Arc-enabled servers natively, so the same assignment reaches on-premises and multi-cloud machines. One current gap is Arm64, which machine configuration does not yet support.

---

## Patching with Azure Update Manager

### Update Management Moved Out of Automation

Azure Automation's Update Management feature **retired on 31 August 2024**, along with the Log Analytics agent it depended on. The replacement is [Azure Update Manager](https://learn.microsoft.com/en-us/azure/update-manager/overview){:target="_blank" rel="noopener noreferrer"}, a separate service. Any guidance that tells you to enable Update Management in an Automation account, or to link a Log Analytics workspace for patching, describes the retired product.

Update Manager has no dependency on Azure Automation, Log Analytics, or the Azure Monitor Agent. It works natively against the Azure VM agent on Azure VMs and the Azure Connected Machine agent on Arc-enabled servers, pushing a patch extension the first time you trigger an operation. Access control is per-resource Azure RBAC rather than permission on a shared Automation account and workspace, which is the change that matters most for large estates.

### How Update Manager Works

Update Manager does not publish updates. It honors whatever update source the machine is already configured for, so a Windows machine pointed at WSUS gets WSUS content and a Linux machine pointed at a private repository gets that repository's packages. It then uses the Windows Update Agent APIs or the Linux package manager to assess and install.

Update data lands in Azure Resource Graph rather than a Log Analytics workspace. Pending updates in the `patchassessmentresources` table are retained for 7 days, and installation results in `patchinstallationresources` for 30 days. Custom reporting is built with Azure Workbooks over that data.

The core capabilities:

- **Periodic assessment** checks each machine for pending updates every 24 hours and can be enforced at scale through Azure Policy.
- **Scheduled patching** defines recurring maintenance windows, with **dynamic scoping** selecting machines by subscription, location, resource group, or tag rather than by an explicit list.
- **Pre and post events** run your own automation before and after a maintenance window.
- **Automatic VM guest patching** rolls updates out to Azure VMs in off-peak hours without a schedule you manage.
- **Hotpatching** applies critical Windows updates without a restart.
- **On-demand operations** install updates immediately outside any schedule.

Maintenance windows are enforced with a reserve. Update Manager holds back 10 minutes on Windows and 15 minutes on Linux for a reboot, and before each additional update it checks whether the expected reboot time plus the average install time still fits. An install already in progress is never forcibly stopped, so a window can overrun slightly, but remaining updates are skipped with a "Maintenance window exceeded" error. An installation is marked successful only if every selected update installed and the reboot and final assessment both succeeded. A required reboot suppressed by a "Never reboot" setting yields "Completed with warnings" rather than success.

One scope limitation carries over from the retired product. Update Manager does not patch Windows 10 or Windows 11, and Microsoft points those devices at Intune instead.

### What Update Manager Costs

Update Manager is free for Azure VMs and for Arc-enabled Azure Local VMs created through an Azure Arc resource bridge. For all other Arc-enabled servers it is charged per server per month, prorated daily, and a machine counts as managed on a given day only if its Arc status was Connected at some point and an update operation ran or a schedule is associated with it.

Three exemptions remove the charge on an Arc-enabled server:

- The machine is enabled for Extended Security Updates through Azure Arc.
- Microsoft Defender for Servers Plan 2 is enabled on the subscription hosting the machine, unless Defender is applied through a security connector.
- The Windows Server licenses have active Software Assurance, a Windows Server subscription, or pay-as-you-go enabled by Azure Arc.

Arc-enabled servers that were using Automation Update Management for free as of 1 September 2023 stay free; newly onboarded machines in the same subscription are charged.

### Patching Strategies

**Immediate patching** deploys everything as soon as it is available. The vulnerability window is shortest and the risk of a breaking change is highest, which suits development and test environments.

**Scheduled patching** puts updates in a fixed weekly or monthly maintenance window, which allows testing before production and aligns with change management. Syncing the schedule to the second Tuesday of the month lines it up with Microsoft's security release cadence. This is the common production pattern.

**Phased patching** uses several maintenance configurations with different dynamic scopes, so a non-production tag is patched days before the production tag. Because scoping is tag-driven rather than list-driven, a new machine joins the right wave by inheriting the tag, without an operator adding it anywhere.

---

## Azure Arc

### Arc-Enabled Servers

Arc-enabled servers extend Azure management to physical machines and VMs hosted outside Azure. Do not install the agent on machines already running in Azure, Azure Stack Hub, or Azure Stack Edge, which already have equivalent capabilities.

#### Onboarding and Identity

Installing the [Azure Connected Machine agent](https://learn.microsoft.com/en-us/azure/azure-arc/servers/agent-overview){:target="_blank" rel="noopener noreferrer"} registers the machine and creates the Azure resource. Onboarding itself authenticates interactively or with a service principal, and the managed identity is a product of onboarding rather than a prerequisite for it. Once registered, the machine has a system-assigned managed identity it uses to authenticate to Azure services, which is what lets a script on that server read a Key Vault secret without a stored credential.

The subscription needs several resource providers registered first: `Microsoft.HybridCompute`, `Microsoft.GuestConfiguration`, `Microsoft.HybridConnectivity`, `Microsoft.AzureArcData` for Arc-enabled SQL Server, and `Microsoft.Compute` for Update Manager and automatic extension upgrades.

Onboarding roles are narrower than Contributor. `Azure Connected Machine Onboarding` is enough to register a machine, and `Azure Connected Machine Resource Administrator` is needed to read, modify, or delete one.

#### Connectivity and Agent Status

The agent needs outbound HTTPS only. There is no inbound requirement and no pull from Azure into your network.

It sends a heartbeat every five minutes. If those stop, the resource moves to **Disconnected** within 15 to 30 minutes. After 45 days disconnected, the resource can move to **Expired** and cannot be managed until an administrator disconnects and reconnects it, because the managed identity credential is valid for up to 90 days and renews every 45.

That lifecycle is why Arc is a poor fit for ephemeral servers and VDI. Arc cannot distinguish a machine that is down for maintenance from one that was deleted, so it does not clean up resources whose heartbeats stopped, and recreating a VM with the same name can collide with the stale resource. Cloned machines and golden images cause a related problem, because two agents sharing a source ID both try to act as the same Azure resource. Onboard after cloning, not before.

#### Supported Operating Systems

Support is a specific list rather than a version floor, and an OS not on the list is not supported. On the Windows side, Windows Server 2016, 2019, 2022, and 2025 are supported, with Windows Server 2012 and 2012 R2 approaching end of Arc support in November 2026. Windows 10 and 11 clients and Windows IoT Enterprise are supported only in a server-like role, meaning always connected, powered, and on mains power.

On the Linux side, current support covers RHEL 8 through 10, Ubuntu 22.04 through 26.04, SLES 15 SP7, AlmaLinux 8 and 9, Rocky Linux 8 and 9, Oracle Linux 8 through 10, Debian 13, and Amazon Linux 2023. Several older versions including RHEL 7, Ubuntu 18.04 and 20.04, Debian 11 and 12, SLES 12 SP5, Oracle Linux 7, and Amazon Linux 2 are approaching end of Arc support in November 2026. CentOS is not on the list.

x86-64 is fully supported. Arm64 support is partial, currently covering RunCommand, Custom Script Extension, and the Azure Monitor Agent, and excluding machine configuration. The agent does not run on 32-bit architectures at all.

#### Capabilities Delivered Through Extensions

Extensions are what turn a registered machine into a managed one:

- **Azure Monitor Agent** collects logs and performance data into a Log Analytics workspace, with a data collection rule defining what is gathered. The Log Analytics agent that previous guidance named is retired.
- **Dependency Agent** feeds VM insights with process and dependency mapping.
- **Custom Script Extension** and **RunCommand** execute PowerShell or shell scripts from Azure.
- **Machine configuration** audits and remediates settings inside the guest OS, replacing the DSC extension.
- **Microsoft Defender for Endpoint**, delivered through Defender for Cloud, provides threat detection and vulnerability management.
- **Hybrid Runbook Worker extension** makes the machine an Automation execution target.
- **Update Manager patch extensions** handle assessment and installation.

The Arc resource itself carries no charge. Cost comes from what you enable on it, including Update Manager for Arc servers, Defender for Servers, Azure Monitor ingestion and retention, and Extended Security Updates.

### Arc-Enabled Kubernetes

Arc-enabled Kubernetes attaches a cluster running anywhere to Azure Resource Manager. Deploying the Arc agents by Helm creates a secure outbound connection, and the cluster appears as its own Azure resource that can be placed in a resource group and tagged like anything else.

Support is defined by conformance rather than by a vendor list. Any CNCF-certified Kubernetes cluster works, including clusters on GCP and AWS, on VMware vSphere, and on Azure Local, and Microsoft runs a [validation program](https://learn.microsoft.com/en-us/azure/azure-arc/kubernetes/validation-program){:target="_blank" rel="noopener noreferrer"} with partner distributions.

AKS is a common point of confusion. AKS clusters are already Azure resources with an Azure control plane, so they are not Arc-enabled and do not need to be. What Arc gives you is a single inventory view where connected clusters appear alongside your AKS clusters, and a common set of extensions across both.

#### What You Get Once a Cluster Is Connected

- **GitOps configuration management** through either [Flux v2](https://learn.microsoft.com/en-us/azure/azure-arc/kubernetes/tutorial-use-gitops-flux2){:target="_blank" rel="noopener noreferrer"} or [Argo CD](https://learn.microsoft.com/en-us/azure/azure-arc/kubernetes/tutorial-use-gitops-argocd){:target="_blank" rel="noopener noreferrer"}, both available as cluster extensions.
- **Azure Policy for Kubernetes**, which installs a Gatekeeper admission webhook and evaluates policy at admission time.
- **Azure Monitor** container insights for logs and Managed Prometheus for metrics.
- **Microsoft Defender for Containers** for image scanning and runtime threat detection.
- **Cluster connect**, which reaches the cluster's API server from anywhere without inbound access, with authorization through Azure RBAC.
- **Azure Machine Learning**, **Event Grid on Kubernetes**, Marketplace applications, and **Azure Kubernetes Fleet Manager**, each delivered as extensions.

Azure RBAC for Kubernetes maps Microsoft Entra identities and Azure role assignments onto cluster authorization, which removes the need to maintain a parallel set of Kubernetes role bindings for those identities. It layers on top of Kubernetes RBAC rather than replacing it, so in-cluster service accounts and any bindings you keep for them continue to work as before.

### Arc-Enabled Data Services

Arc-enabled data services run an Azure data engine on your own Kubernetes cluster with Azure management and Azure billing. The currently available service is **SQL Managed Instance enabled by Azure Arc**. The PostgreSQL offering that earlier guidance describes is no longer part of the product.

SQL Managed Instance on Arc gives you SQL Server engine compatibility on infrastructure you control, updates delivered from the Microsoft Container Registry on a cadence you set, and a subscription billing model that removes end-of-support cliffs for the database engine. Because it is deployed through Kubernetes, scaling up and down is an orchestration operation rather than a migration.

Deploying it requires a Kubernetes cluster that supports persistent volumes, the Azure Arc agents on that cluster, a **data controller** deployed into it to manage the data services, storage classes backing the persistent volumes, and outbound connectivity to `*.<region>.arcdataservices.com` for management and billing.

Reach for it when data residency, latency, or a regulatory constraint keeps the database on your infrastructure but you still want Azure's management surface and billing model. Skip it when Azure SQL Database or Azure SQL Managed Instance in Azure would serve, when you do not need Azure-side management, or when cost reduction is the goal, since the licensing is not cheaper for running the engine on your own hardware.

---

## Governance and Security Across Arc Resources

### Azure Policy Enforces at Two Different Times

Policy reaches Arc servers and Arc Kubernetes clusters through the same assignment, but the enforcement points behave differently enough that designing for one and assuming the other leads to surprises.

```
  Policy assignment at management group / subscription / resource group
                                |
        +-----------------------+------------------------+
        |                                                |
        v                                                v
   Arc-enabled server                        Arc-enabled Kubernetes
        |                                                |
   machine configuration                       Azure Policy extension
   inspects the guest OS                       (Gatekeeper admission
   on a later evaluation                        webhook) evaluates the
   cycle, after the fact                        request before admission
        |                                                |
        v                                                v
   Reports drift; a                           Rejects the non-compliant
   remediation task                           pod at creation; nothing
   corrects it on the                         is ever scheduled
   next cycle
        |                                                |
        +-----------------------+------------------------+
                                v
                  One compliance view in Azure Policy
```

On a server, machine configuration detects drift after it has already happened, and correcting it requires a remediation task. On a cluster, the admission webhook rejects the request before the workload exists. The same policy intent therefore produces detect-and-correct on one and prevent on the other, which is why a server-side control needs an explicit remediation plan while a cluster-side control does not.

Azure Policy has [11 effects](https://learn.microsoft.com/en-us/azure/governance/policy/concepts/effect-basics){:target="_blank" rel="noopener noreferrer"} and they are not interchangeable here. `deployIfNotExists` and `modify` both run through the assignment's managed identity rather than the caller's, so the assignment needs its own role grant before remediation can work. `denyAction` is the only effect that blocks deletion, which is the one to reach for when the risk is an operator removing an agent or extension rather than misconfiguring it.

Common assignments on Arc estates include requiring the Azure Monitor Agent and a data collection rule association, enforcing periodic update assessment, enforcing tagging so dynamic scoping works, and auditing guest OS settings like TLS versions and firewall state.

### RBAC Across Arc Resources

Azure roles apply to Arc servers and Kubernetes clusters the same way they apply to Azure-native resources, so `Reader`, `Contributor`, and custom roles all behave as expected against a `Microsoft.HybridCompute/machines` resource. The Arc-specific roles narrow onboarding and administration further, as described above.

The managed identity on each Arc server is the piece that changes application design. A script on that server can authenticate to Key Vault, Storage, or any other Azure service through the identity, with permission granted by an Azure role assignment rather than a credential stored on the machine.

### Monitoring and Defender

**Azure Monitor** collects from Arc servers through the Azure Monitor Agent and a data collection rule, which defines what is gathered before it is billed. VM insights adds process and dependency mapping. Because the data lands in the same Log Analytics workspace as your Azure resources and carries the machine's Azure resource ID, a single KQL query can span on-premises and cloud workloads and resource-context access control applies uniformly.

On Arc Kubernetes, container insights collects logs and Managed Prometheus collects metrics into an Azure Monitor workspace, which is a distinct resource type from the Log Analytics workspace.

**Defender for Cloud** extends to Arc resources through Defender for Endpoint on servers and Defender for Containers on clusters, producing vulnerability findings, threat detections, and compliance assessments against security benchmarks in the same views used for Azure resources. Microsoft Sentinel can then collect the security events for correlation with other sources.

---

## Choosing Between Automation, Logic Apps, and Functions

### What Each One Is For

| Aspect | Azure Automation | Logic Apps | Azure Functions |
|--------|------------------|-----------|-----------------|
| **Primary use** | Infrastructure scripts, scheduled operational tasks, hybrid administration | Low-code workflow orchestration and system integration | Event-driven code execution |
| **Execution model** | Runbooks in PowerShell, Python, or the graphical editor | Visual workflow with conditions, loops, and actions | Functions bound to triggers |
| **Language** | PowerShell 7.6/7.4/5.1, Python 3.10, or no code | No code, with inline code actions available | C#, Python, Node.js, Java, PowerShell |
| **Execution time** | Azure sandbox 3 hours (fair share); hybrid worker unbounded | Unbounded | Flex Consumption, Premium, and Dedicated default 30 min and are unbounded; legacy Consumption defaults to 5 min with a 10 min maximum |
| **Startup latency** | Seconds to minutes, depending on runbook type and queue depth | Seconds | Milliseconds when warm; cold start applies when scaled to zero |
| **Integration model** | PowerShell and Python modules imported into the account | Hundreds of managed connectors plus built-in operations | Trigger and binding extensions, plus your own SDK calls |
| **Cost model** | Job run time above a monthly free allowance, plus watcher time | Per action executed, and separately per managed-connector call | Executions plus resource consumption, by plan |
| **Debugging** | Job streams and history in the Automation account | Run history in the designer, with per-action inputs and outputs | Application Insights and local debugging |
| **Hybrid reach** | Hybrid Runbook Workers run jobs inside your network | On-premises data gateway or a Standard plan in a virtual network | Virtual network integration on Flex Consumption, Premium, and Dedicated |
| **Orchestration** | Sequential and parallel, with child runbooks | Branches, loops, and error handling as first-class designer constructs | Durable Functions for stateful orchestration |

The billing line is where the three diverge most in practice. A Consumption logic app charges per action *and* per managed-connector call, so a workflow that touches ServiceNow or Office 365 twenty times per run costs considerably more than the action count alone suggests.

### Picking One

**Azure Automation** fits infrastructure and system administration scripts, especially when the target is on-premises. It is the only one of the three with a first-class model for running the same script inside your own network under an account you already manage.

**Logic Apps** fits workflows that span systems and need to be readable by people who did not write them. Its connector catalog is the reason to choose it, and its per-action run history makes production debugging a matter of reading rather than reproducing.

**Azure Functions** fits code triggered by an event, where you want fine-grained cost control and a real programming language. Stateful, long-running orchestration goes to Durable Functions rather than out to another service.

They compose. A Logic App can orchestrate a workflow, call a Function for custom logic, and start an Automation runbook on a Hybrid Runbook Worker to touch an on-premises server, with each service doing the part it is best at.

---

## Common Pitfalls

### Pitfall 1: Designing for a Timeout That Does Not Exist, and Missing the One That Does

**Problem:** Runbooks are split into artificial chunks to fit an imagined short sandbox timeout, or a genuinely long job is left in the sandbox because three hours sounds like plenty.

**Result:** The first produces child-runbook sprawl with no benefit. The second produces a job that runs for three hours, gets unloaded by fair share, and stops without restarting, usually partway through a change.

**Solution:** The Azure sandbox limit is a three-hour fair-share ceiling, with 400 MB of memory, 1 GB of temporary disk, and 1,000 sockets alongside it. Anything comfortably inside that can stay in the sandbox as one runbook. Anything that might approach three hours belongs on a Hybrid Runbook Worker, which fair share does not apply to. Splitting into child runbooks is a parallelism technique for shortening total elapsed time, not a workaround for the ceiling.

---

### Pitfall 2: Assuming Arc's Managed Identity Grants Access

**Problem:** An Arc-enabled server has a system-assigned managed identity, so scripts are written to authenticate with it, but no Azure role is assigned to that identity.

**Result:** Authentication succeeds and authorization fails. The error surfaces as a permission problem at the target service, which sends people looking at the wrong end of the chain.

**Solution:** Onboarding creates the identity. It does not grant anything. Assign the identity the specific roles it needs at the narrowest workable scope, such as `Key Vault Secrets User` on one vault rather than a subscription-wide grant. Because every Arc server gets its own identity, role assignment is per-machine work, so drive it through policy or a deployment template rather than by hand.

---

### Pitfall 3: Following Retired Patching Guidance

**Problem:** A runbook or documented process enables Update Management in an Automation account and links a Log Analytics workspace for patch compliance.

**Result:** The path no longer exists. Automation Update Management retired on 31 August 2024 along with the Log Analytics agent, so machines silently fall out of any patch schedule and compliance reporting goes blank while the machines themselves look healthy.

**Solution:** Move patching to Azure Update Manager, which needs no Automation account, no workspace, and no monitoring agent. For non-Azure machines, Arc is the prerequisite. Once a machine is Arc-enabled, Update Manager reaches it natively. Check the cost side at the same time, since Update Manager is free for Azure VMs but charged per Arc server unless one of the ESU, Defender for Servers Plan 2, or Windows Server Management exemptions applies.

---

### Pitfall 4: Policy That Detects Drift But Never Corrects It

**Problem:** Policies are assigned to Arc resources with `audit` or `auditIfNotExists`, or with `deployIfNotExists` but no remediation task and no role grant on the assignment's identity.

**Result:** The compliance dashboard fills with non-compliant resources and nothing changes. Existing machines in particular stay non-compliant indefinitely, because `deployIfNotExists` acts on resource writes and existing resources need an explicit remediation task.

**Solution:** Decide per control whether you want detection or correction. For correction, use `deployIfNotExists` or `modify`, grant the assignment's managed identity the roles the deployment needs, and create a remediation task to sweep existing resources. Where the risk is deletion rather than misconfiguration, such as an operator removing the Connected Machine agent's extensions, `denyAction` is the effect that blocks it.

---

### Pitfall 5: Hybrid Worker Groups That Go Quiet

**Problem:** A firewall change, proxy update, or certificate rotation breaks a worker's outbound path, and nobody notices until a scheduled job does not run.

**Result:** Jobs queue and then suspend. If no worker in the group has polled within 30 minutes, the group counts as having no active workers and queued jobs are suspended after three retries.

**Solution:** Allow outbound HTTPS on port 443 from every worker, using the `GuestAndHybridManagement` service tag rather than IP ranges where the network path goes through an NSG or Azure Firewall. Put more than one worker in any group that runs production work, so a single machine's outage does not idle the group. Alert on the worker heartbeat rather than on job failures, because a job that never dispatches produces no failure to alert on.

---

### Pitfall 6: Deploying to Arc-Enabled Kubernetes by Hand

**Problem:** Applications reach Arc-connected clusters through `kubectl apply` from an operator's machine rather than through the GitOps extension.

**Result:** Cluster state drifts from any repository, there is no record of who deployed what, and clusters that were meant to be identical diverge. Rollback becomes an archaeology exercise.

**Solution:** Install the GitOps extension, with Flux v2 or Argo CD, and let it reconcile the cluster against a Git repository. Desired state becomes a reviewable commit, drift is corrected by the reconciler, and the audit trail is the repository history. Because the extension is configured as an Azure resource, the same GitOps configuration can be applied across many clusters as a policy assignment rather than a per-cluster setup.

---

### Pitfall 7: Scheduling Work That Is Actually Event-Driven

**Problem:** A runbook runs nightly to check whether something happened, rather than being triggered when it happens.

**Result:** Latency equal to the schedule interval, plus runs that do nothing most nights. An event at 12:01 AM waits almost 24 hours for a response.

**Solution:** Trigger from the event. Event Grid delivers resource events to a runbook webhook, an Azure Monitor alert can start a runbook through an action group, and a Logic App can call one as a workflow step. Keep schedules for work that really is time-based, like maintenance windows and periodic reporting. If the trigger has to be a webhook, remember that webhooks cannot start Python runbooks and misencode input parameters for PowerShell 7, so a PowerShell 5.1 runbook is the reliable target.

---

## Key Takeaways

1. **Azure Automation is a script execution service, and where the script runs is the design decision.** The Azure sandbox is cheap and simple but capped at a three-hour fair-share ceiling with 400 MB of memory and no ability to call executables. A Hybrid Runbook Worker removes those limits and reaches your network, at the cost of a machine you maintain.

2. **Hybrid Runbook Workers pull work; they do not receive it.** Every active worker polls the service every 30 seconds and takes jobs first-come-first-served, which is why the whole model needs only outbound HTTPS and why a group with no worker polling in 30 minutes silently suspends its queue.

3. **The agent-based Hybrid Runbook Worker is gone.** It retired on 31 August 2024 and its jobs stopped on 1 April 2025. The extension-based worker, installed through the VM extension framework with a managed identity, is the only supported platform.

4. **Patching left Azure Automation.** Update Management retired on 31 August 2024 with the Log Analytics agent, and Azure Update Manager replaced it as a native capability on Azure VMs and Arc-enabled servers, with per-resource RBAC and no workspace dependency.

5. **Configuration management is leaving too.** Azure Automation State Configuration retires on 30 September 2027, and Azure machine configuration replaces it by delivering configuration as Azure Policy assignments that reach Arc-enabled servers without a separate node registration.

6. **Azure Arc turns non-Azure infrastructure into Azure Resource Manager resources.** An Arc-enabled server or cluster gets a resource ID in a resource group, which is what lets policy, RBAC, Monitor, and Defender reach it through their normal APIs rather than through a parallel toolchain.

7. **Policy enforces at different moments on servers and clusters.** Machine configuration detects guest OS drift after the fact and needs a remediation task to correct it, while the Kubernetes admission webhook rejects a non-compliant workload before it is scheduled.

8. **Arc-enabled data services means SQL Managed Instance.** That is the current offering, it runs on a Kubernetes cluster with a data controller, and the PostgreSQL option described in older material is no longer part of the product.

9. **Arc is a projection, not a migration.** The agent needs only outbound HTTPS, can be uninstalled, and does not move the workload. What it changes is which control plane governs the machine.

10. **The Arc resource is free; what you enable on it is not.** Update Manager for Arc servers, Defender for Servers, Azure Monitor ingestion and retention, and Extended Security Updates each carry their own charge, so the cost model follows the capabilities you turn on rather than the machine count.
