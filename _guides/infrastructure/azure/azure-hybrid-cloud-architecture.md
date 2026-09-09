---
title: "Azure Hybrid Cloud Architecture"
layout: guide
category: Azure
subcategory: Migration & Hybrid Cloud
description: "Azure Arc as the hybrid control plane and the Connected Machine agent constraints that decide what can be Arc-enabled, Azure Local for on-premises infrastructure, Route Server for hybrid transit routing, and the three hybrid identity authentication methods."
tags: [azure-arc, azure-local, hybrid-identity, route-server, edge-computing, connected-machine-agent, practical]
---

## What Hybrid Cloud Architecture Solves

Organizations rarely get to abandon on-premises infrastructure on a schedule. Legacy applications, regulatory constraints, data sovereignty, latency floors, and hardware still inside its depreciation window all keep workloads where they are. Hybrid architecture is about running that estate under one control plane instead of two, rather than about eventually eliminating it.

Azure approaches this from two directions. [Azure Arc](https://learn.microsoft.com/en-us/azure/azure-arc/){:target="_blank" rel="noopener noreferrer"} projects infrastructure you already own into Azure Resource Manager so Azure governance applies to it. [Azure Local](https://learn.microsoft.com/en-us/azure/azure-local/overview){:target="_blank" rel="noopener noreferrer"} runs Azure infrastructure on hardware in your own facility.

### The name changed

**Azure Stack HCI is now Azure Local.** Documentation moved to `learn.microsoft.com/azure/azure-local/` and is versioned by release moniker rather than by the old 22H2 and 23H2 numbering. Anything still saying "Stack HCI" predates the rename. Microsoft positions Azure Local as part of its **adaptive cloud** approach, with Azure Arc as the control plane rather than as a bolt-on.

### What changes against a pure-cloud design

| Aspect | Pure cloud | Hybrid |
|---|---|---|
| **Resource scope** | Subscriptions only | Subscriptions plus projected on-premises and other-cloud resources |
| **Management plane** | Azure Resource Manager over Azure resources | ARM extended by Arc, subject to agent support constraints |
| **Identity** | Entra ID alone | Entra ID synchronized with on-premises AD DS, with one of three authentication methods |
| **Capacity** | Elastic | Elastic in cloud, fixed and procurement-bound on-premises |
| **Networking** | VNets and peering | VNets plus ExpressRoute or VPN, and transit routing that does not work by default |
| **Data residency** | Region selection | Region selection, or physical control of the facility |

The two rows that generate the most unplanned work are identity and networking. Both are covered below, and both fail in ways that look like something else.

---

## Azure Arc

Arc projects resources hosted outside Azure into ARM. Each connected machine gets an Azure Resource ID and lives in a resource group, so RBAC, Azure Policy, Defender for Cloud, Azure Monitor, and Update Manager reach it the way they reach a native VM.

**What Arc covers:**

| Arc service | What it manages |
|---|---|
| **Arc-enabled servers** | Windows and Linux physical servers and VMs hosted outside Azure |
| **Arc-enabled Kubernetes** | Any CNCF-certified Kubernetes cluster, wherever it runs |
| **Arc-enabled SQL Server** | SQL Server instances on machines already Arc-enabled |
| **Arc-enabled data services** | SQL Managed Instance, running in containers on your Kubernetes |

Arc supports **Azure Lighthouse**, so a service provider can manage delegated Arc estates from their own tenant.

### Arc-enabled servers: what can actually be enrolled

This is where hybrid designs most often assume more reach than the product has. Four constraints decide whether a machine can be Arc-enabled at all.

**Do not install the agent on machines that are already Azure resources.** Microsoft states you should not install Arc on virtual machines hosted in **Azure, Azure Stack Hub, or Azure Stack Edge**, because they already have equivalent capabilities. Installing it on an Azure VM is supported only to simulate an on-premises environment for testing. Supported environments are VMware (including Azure VMware Solution), Azure Local, and other clouds.

**The supported OS list is an allowlist, not a version floor.** Microsoft's wording is direct: if an OS version is not listed, it is not supported. **CentOS does not appear on the list at all.** Distributions are enumerated individually, with per-version end-of-Arc-support dates.

**A large cliff lands in November 2026.** These reach end of Arc support then: Windows Server 2012 and 2012 R2, RHEL 7, Oracle Linux 7, Ubuntu 18.04 and 20.04, Debian 11 and 12, SLES 12 SP5 and 15 SP3 through SP6, Amazon Linux 2, and Azure Linux 3.0. An estate audit that only checks "is it Windows Server 2012" will miss most of that list.

**Architecture matters.** x86-64 is fully supported. Arm64 is partial, and **Azure machine configuration is not compatible with Arm64**, so policy-driven in-guest settings do not apply there. The agent does not run on 32-bit at all.

### Where Arc is the wrong tool

**Short-lived servers and VDI.** Microsoft explicitly does not recommend Arc for ephemeral servers or virtual desktop infrastructure. Arc cannot distinguish a machine that is offline for maintenance from one that was deleted, so it does not clean up resources that stop sending heartbeats. Recreating a deleted VM with the same name then collides with the orphaned Arc resource. Azure Virtual Desktop on Azure Local is the documented exception, because those desktop VMs are not short-lived.

**Cloned machines and golden images.** Two agents sharing a source ID both try to act as one Azure resource, which produces inconsistent behavior and HTTP 429 errors. Onboard after cloning or restoring, using automation, rather than baking an enrolled agent into an image.

**End-user machines.** Windows 10 and 11 are supported only in server-like conditions: always powered, always connected, always on. Laptops belong in Intune or Configuration Manager.

### Agent connectivity lifecycle

The status a machine shows is a function of three thresholds, and they set the floor on how quickly Arc can tell you anything is wrong.

| Interval | Behavior |
|---|---|
| **Every 5 minutes** | The agent sends a heartbeat |
| **15 to 30 minutes** without a heartbeat | Status changes to **Disconnected** |
| **45 days** disconnected | Status may change to **Expired** |

An **Expired** machine cannot be managed through Arc until an administrator disconnects and reconnects it. The exact expiry follows the managed identity credential, which is valid for up to 90 days and renews every 45. Treating Arc as a real-time availability monitor does not work when the fastest possible detection is a quarter of an hour.

### Onboarding requirements

**Resource providers** that must be registered: `Microsoft.HybridCompute`, `Microsoft.GuestConfiguration`, `Microsoft.HybridConnectivity`, `Microsoft.AzureArcData` (for Arc-enabled SQL Server), and `Microsoft.Compute` (for Update Manager and automatic extension upgrades).

**Roles:** Azure Connected Machine Onboarding or Contributor to enroll machines, and Azure Connected Machine Resource Administrator to read, modify, and delete them.

**On Windows**, the agent runs under the low-privileged virtual account `NT SERVICE\himds`, which needs the "log on as a service" right. Group Policy that customizes user rights assignments will block onboarding until that account is added.

**Scale:** there is no limit on the number of Arc-enabled servers or extensions per resource group or subscription. The standard 800-instance limit does apply to the Azure Arc Private Link Scope resource type.

### Reaching an Arc server remotely

**Azure Bastion does not work for Arc-enabled servers.** Bastion is a PaaS service that lives in an Azure VNet and reaches VMs by private IP on that VNet. Arc-enabled servers sit outside it, so Bastion has no route to them.

The mechanisms that do work go through `Microsoft.HybridConnectivity`:

- **SSH access via Azure Arc**, which needs no public IP, no inbound firewall opening, and no VPN
- **RDP over SSH** for Windows targets
- **Windows Admin Center in Azure**, where the portal requests access through the hybrid connectivity provider, a Layer 4 SNI proxy brokers the session, and a short-lived unique URL is issued. No line of sight and no direct RDP required

### Arc-enabled Kubernetes

Any **CNCF-certified** Kubernetes cluster can be Arc-enabled, wherever it runs. Once connected, it takes Azure Policy, Azure Monitor, and GitOps configuration.

Three details commonly get stated wrong:

- **AKS is not Arc-enabled and does not need to be.** It is already an ARM resource. Arc adds a shared inventory view across clusters, not management AKS lacks.
- **GitOps ships as two supported extensions**, Flux v2 **and** Argo CD, not Flux alone.
- **Azure Policy for Kubernetes is a Gatekeeper admission webhook.** It admits or rejects at the API server. Pod security policies no longer exist in Kubernetes, so a guide prescribing them is describing a removed feature.

### Arc-enabled data services

**Arc-enabled data services means SQL Managed Instance.** The PostgreSQL offering is no longer part of the product, and MySQL was never in it. Any material listing three engines here is out of date.

SQL Managed Instance enabled by Arc runs in containers on Kubernetes you operate. Microsoft supplies engine updates through the Microsoft Container Registry on a cadence you set, billing flows through your Azure subscription, and you remain responsible for the compute, storage, networking, and Kubernetes underneath it.

---

## Azure Local

Azure Local is Microsoft's distributed infrastructure platform for customer-owned environments. It runs modern and legacy applications in distributed or sovereign locations, uses **Azure Arc as its control plane**, and supports deployments that are **connected or disconnected** from Azure.

**Pricing is per physical core** on your machines, plus consumption charges for any Azure services you enable on top. Everything rolls into your existing Azure subscription.

**Management** runs through the familiar Azure surfaces: portal, Azure CLI, and ARM templates, with Azure Policy, Defender for Cloud, and Azure Monitor available as add-ons. Hardware comes from a partner catalog with prescriptive bills of materials rather than being assembled ad hoc.

### When Azure Local fits

Microsoft's own framing is four scenarios, and they are narrower and more specific than "hybrid":

- **Local AI inferencing** where data must be processed at its source, such as retail self-checkout and loss prevention, or pipeline leak detection
- **Mission-critical business continuity** for systems that must survive network outages, such as factory production lines and stadium or transit access control
- **Control systems and near-real-time operations** with extreme latency requirements, such as manufacturing execution systems and industrial quality assurance
- **Strict sovereignty and regulatory requirements** demanding data be kept and controlled locally

### When it does not

- You are building new infrastructure with no on-premises constraint, where public cloud is usually cheaper at scale
- You lack data center and virtualization operations capability, which Azure Local still requires
- You need elastic capacity, which fixed hardware cannot provide
- Your workloads are already cloud-native and stateless, and nothing forces them to stay local

### Azure Local, Azure Stack Hub, and Azure Stack Edge

| Aspect | Azure Local | Azure Stack Hub | Azure Stack Edge |
|---|---|---|---|
| **Purpose** | Distributed infrastructure in your facilities, Arc-managed | Self-contained Azure region for disconnected or sovereign operation | Edge appliance for inference, IoT, and data staging |
| **Control plane** | Azure Arc, connected or disconnected | Its own, independent of Azure | Azure, cloud-driven |
| **Scale** | Edge site to data center | Data center | Branch or edge appliance |
| **Workloads** | VMs, AKS, Arc services, traditional Windows Server | VMs, containers, a subset of Azure PaaS | Containers, ML inference, data staging |
| **Pricing** | Per physical core, plus consumption | Capacity-based | Per device |
| **Choose when** | You need Azure operations on your hardware | You need Azure APIs with no dependency on public Azure | You need compute at a branch or on a factory floor |

The dividing question is what the control plane depends on. Azure Local is Arc-managed and designed to be Azure-connected, though it supports disconnected operation. Stack Hub carries its own control plane so it can run genuinely independent of Azure, which is why it suits sovereign and disconnected scenarios and why its update cadence is separate.

---

## Hybrid Networking

### Connectivity options

| Connection | Characteristics | Fits |
|---|---|---|
| **Site-to-site VPN** | IPsec over the internet, variable latency, set up in days, low cost | Initial connectivity, smaller estates, failover for ExpressRoute |
| **ExpressRoute** | Private circuit to the Microsoft network, consistent latency, weeks of lead time via a connectivity provider, higher cost | Large sustained transfer, latency-sensitive workloads, compliance requirements |
| **SD-WAN through an NVA** | Varies by appliance, application-aware routing | Many branch sites already running an SD-WAN fabric |

The common production shape is ExpressRoute primary with VPN failover, which requires both gateways in the same virtual network.

### Transit routing does not work by default

Two on-premises sites connected to the same VNet through different gateway types cannot reach each other by default. Neither can an NVA and a gateway exchange routes on their own. **Azure Route Server** is the component that fixes this, and it is the piece most often missing from a hybrid design that "should work."

Route Server provides automated BGP peering with virtual network gateways. By default it does **not** propagate routes between different component types, and each component only exchanges routes with the Route Server itself. Enabling **route exchange**, also called branch-to-branch, makes it act as a route reflector so NVAs, ExpressRoute gateways, and VPN gateways learn each other's routes.

```
   On-premises Site A                        On-premises Site B
   (via VPN)                                 (via ExpressRoute)
          |                                         |
          | IPsec                                   | private circuit
          v                                         v
   +--------------+                          +------------------+
   | VPN Gateway  |                          | ExpressRoute GW  |
   | active-active|                          |                  |
   | ASN 65515    |                          |                  |
   +------+-------+                          +--------+---------+
          |                                           |
          |  BGP                                 BGP  |
          +-------------+               +-------------+
                        v               v
                   +----------------------------+
                   |    Azure Route Server      |
                   |  route exchange ENABLED    |
                   |  (acts as route reflector) |
                   +----------------------------+
                        |
                        |  without route exchange enabled,
                        |  A and B cannot reach each other
                        v
                   Spoke VNets

   NOT supported: ExpressRoute circuit to ExpressRoute circuit.
   Use ExpressRoute Global Reach for that.
```

The constraints that break this in practice:

- **The VPN gateway must be in active-active mode with its ASN set to 65515.** BGP does not have to be enabled on the VPN gateway to talk to the Route Server, but active-active and that ASN are requirements.
- **All gateways must sit in the same virtual network as the Route Server.** Route exchange applies to every gateway in that VNet, not selectively.
- **ExpressRoute circuit-to-circuit is not supported** through Route Server. Routes from one circuit are not advertised to another on the same gateway. Use **ExpressRoute Global Reach** instead.
- **ExpressRoute routes take precedence over VPN routes** by default, adjustable through routing preference.
- **Creating or deleting a Route Server in a VNet that already contains a gateway causes downtime** until the operation completes. Existing ExpressRoute circuits and their connections to other VNets are unaffected.
- Avoid advertising the reserved BGP community `65517:65517` from on-premises.

### Hub-and-spoke with on-premises connectivity

On-premises networks terminate on gateways in the hub VNet. Spokes peer with the hub. Inter-spoke and on-premises-to-spoke traffic routes through the hub's firewall for inspection. Address spaces on both sides must not overlap, which is a planning decision made once and expensive to revisit.

---

## Hybrid Identity

Hybrid identity connects on-premises **Active Directory Domain Services** with **Microsoft Entra ID**. These are separate directories with different protocols, not one product renamed.

### Sync technology and authentication method are separate choices

**Microsoft Entra Connect** is the product. It comes in two sync technologies, **Entra Connect Sync** (the server-based agent) and **Entra Cloud Sync** (lightweight agents, cloud-managed configuration). Microsoft is explicit that the choice of sync technology does not determine or change authentication behavior. These are two independent decisions.

### The three authentication methods

| Method | Where authentication happens | On-premises footprint beyond Entra Connect |
|---|---|---|
| **Password hash synchronization (PHS)** | In the cloud, against a synchronized hash | None |
| **Pass-through authentication (PTA)** | In the cloud, after a secure exchange with an on-premises agent | One server per additional agent, three recommended |
| **Federation (AD FS)** | On-premises | Two or more AD FS servers plus two or more Web Application Proxy servers in the DMZ, plus load balancing |

**Microsoft Entra Domain Services is not one of these.** It is a managed domain providing LDAP, Kerberos, and group policy for VMs that need traditional directory services, and it *requires* password hash synchronization to work. Treating it as a third authentication option confuses a consumer of hybrid identity with a way of doing it.

### The difference that decides most designs

PHS is simplest and has no on-premises dependency, but it does not enforce on-premises account state immediately.

| Account state enforced at sign-in | PHS | PTA | Federation |
|---|---|---|---|
| Disabled account | Yes, up to 30-minute delay | Yes | Yes |
| Account locked out | No | Yes | Yes |
| Account expired | No | Yes | Yes |
| Password expired | No | Yes | Yes |
| Sign-in hours | No | Yes | Yes |

An organization that must revoke access the instant an account is disabled needs PTA or federation. One that can tolerate a synchronization delay gets meaningfully better availability from PHS, because PHS has no on-premises component that can fail.

Password hash synchronization runs every **two minutes** as part of Connect Sync. Note that the password-expired and account-locked-out states are not synced at all, so setting "user must change password at next logon" prevents the new hash from syncing until the user actually changes it.

### Enable PHS regardless

Microsoft recommends enabling password hash synchronization whichever method you choose, for two reasons:

- **It is the fallback when on-premises is gone.** In ransomware incidents, organizations that already had PHS enabled alongside federation or PTA switched primary authentication and were back online in hours. Those that had not took weeks to restore on-premises identity infrastructure before anyone could sign in to cloud apps.
- **Entra ID Protection's leaked-credentials report requires it**, regardless of the primary sign-in method.

Failover from PTA to PHS is not automatic. You switch the sign-on method in Entra Connect manually, so write that step into a runbook before you need it.

For availability, deploy a second Entra Connect server in **staging mode**, and for PTA deploy two additional agents beyond the one on the Connect server so a single agent can fail while another is under maintenance.

---

## Policy and Governance Across Hybrid

Azure Policy applies to Arc-connected resources the same way it applies to native ones, which is the practical payoff of projecting them into ARM.

**Azure machine configuration** audits and enforces settings inside the OS: whether a service is running, registry values, Linux configuration files. This was previously called guest configuration, and it requires the `Microsoft.GuestConfiguration` resource provider. It does not support Arm64.

**Management groups** carry policy assignments down to subscriptions created later, which is what makes governance survive organizational growth. **Tags** applied consistently across cloud and Arc resources make cost allocation possible across the boundary. **RBAC** uses the same model and the same Entra groups on both sides.

The gap to watch is scope. A policy assigned to a subscription reaches the Arc resources in it, but only for machines that were successfully onboarded. Everything blocked by the OS support list is outside governance entirely, and it will not appear as non-compliant, because it does not appear at all.

---

## Hybrid Monitoring

Azure Monitor collects from Azure resources, Arc-connected servers, and Kubernetes clusters into a shared Log Analytics workspace, so alerts and queries span the boundary.

- **Arc-connected servers** use the **Azure Monitor Agent**, deployed as an Arc VM extension. Data carries the machine's Azure Resource ID, which enables resource-context access control
- **VM insights** covers OS performance and process dependency discovery
- **Change tracking and inventory** runs through the Azure Monitor Agent
- **Azure Update Manager** handles OS patching for Arc-enabled Windows and Linux servers, needing `Microsoft.Compute` registered

Arc-connected monitoring has the agent heartbeat behind it, so the availability signal it produces is subject to the same 15-to-30-minute Disconnected threshold. Pair it with workload-level health checks rather than relying on Arc status as an outage detector.

---

## Edge

**Azure Stack Edge** is a managed appliance placed in branch offices, factories, and remote sites. It provides local compute and storage, containerized workloads, optional GPU for inference, and staged transfer of data to Azure. It works through disconnected periods, batching and syncing when connectivity returns.

**Azure IoT Edge** runs containerized modules on devices and gateways rather than on an appliance. It is managed through IoT Hub, processes sensor data locally, forwards only what matters, and continues operating when the cloud is unreachable.

The choice is about form factor and management surface. Stack Edge is hardware Microsoft ships and manages the lifecycle of. IoT Edge is a runtime you put on hardware you already have.

Note that Arc should not be installed on Azure Stack Edge, which already has equivalent management.

---

## Workload Placement

### Keep it on-premises when

- **Sovereignty or residency rules** require data in a specific facility or jurisdiction
- **Existing hardware** is recent and under maintenance, so replacing working systems has no return
- **Demand is flat and predictable**, which is the case where elasticity provides nothing and fixed capacity is cheaper
- **Latency floors** are below what a round trip to a region can deliver
- **Data volume** makes continuous transfer impractical, so processing belongs next to the data

### Move it when

- **Demand varies** enough that paying for peak capacity year-round is wasteful
- **Users are distributed** and regional deployment or edge caching matters
- **Operational burden** is the constraint, and managed services remove it
- **The application is new**, where cloud-native patterns are the natural design
- **Modernization is blocked** by the platform it currently runs on

### Hybrid patterns

**Baseline plus burst** keeps steady capacity on-premises and expands into Azure at peak. It requires an application that tolerates being split, and it only pays off when the peak is both large and infrequent.

**Arc-governed retention** keeps workloads where they are and brings governance to them. This is the pattern behind CAF's Retain strategy, and it is the lowest-effort way to stop running two governance regimes.

**Replatform in place** moves workloads onto Azure Local, gaining Azure operational tooling without moving data out of the facility.

---

## AWS and GCP Hybrid Comparison

| Aspect | Azure | AWS | GCP |
|---|---|---|---|
| **Governance plane for external resources** | Arc projects servers, Kubernetes, and SQL Server into ARM | Systems Manager for hybrid instances; Outposts extends AWS itself | Anthos/GKE Enterprise, Kubernetes-centered |
| **On-premises infrastructure** | Azure Local, partner hardware, per-core pricing | Outposts, AWS-supplied and AWS-operated hardware | Google Distributed Cloud |
| **Kubernetes anywhere** | Arc-enabled Kubernetes, any CNCF-certified cluster | EKS Anywhere | GKE on Google Distributed Cloud |
| **Managed database on your hardware** | SQL Managed Instance enabled by Arc | RDS on Outposts | Limited |
| **Disconnected operation** | Azure Local supports it; Azure Stack Hub is built for it | Outposts requires a connection to its home Region | Google Distributed Cloud has an air-gapped configuration |

The architectural difference is what each vendor extends. AWS Outposts extends AWS hardware and services into your facility, so the operating model is AWS's throughout. Azure Arc takes the opposite approach, leaving infrastructure where it is and extending only the control plane over it. Google Distributed Cloud sits closer to the Azure model but is more tightly centered on Kubernetes.

Which suits a given organization depends on what it already runs. An estate of VMware and Windows Server gains more from a control plane that reaches existing hardware. One that is already containerized has more equivalent options across all three.

---

## Common Pitfalls

### Assuming everything can be Arc-enabled

Planning governance coverage across the estate, then discovering that CentOS machines are unsupported, several distributions hit end of Arc support in November 2026, and Arm64 machines cannot take machine configuration. Audit the estate against the supported OS list before promising coverage, and remember that unsupported machines do not show as non-compliant, they simply do not appear.

### Using Arc on ephemeral or VDI infrastructure

Arc does not clean up resources that stop heartbeating, because it cannot tell deletion from maintenance. Regularly recreating VMs with the same names produces orphaned resources and name collisions. Use Intune or Configuration Manager for end-user machines, and note that Azure Virtual Desktop on Azure Local is the documented exception.

### Expecting transit routing to work without Route Server

Connecting one site by VPN and another by ExpressRoute to the same VNet, then finding they cannot reach each other. Route Server with route exchange enabled is the fix, and it carries its own requirements: VPN gateway in active-active mode with ASN 65515, all gateways in the Route Server's VNet, and downtime when the Route Server is created alongside an existing gateway. Circuit-to-circuit still needs Global Reach.

### Treating Entra Domain Services as an authentication method

Choosing "Entra Domain Services" as an alternative to password hash sync or pass-through authentication. It is neither. It is a managed domain for workloads needing LDAP and Kerberos, and it depends on password hash synchronization being enabled.

### Choosing PHS without checking account-state requirements

Password hash sync does not enforce lockout, expiry, or sign-in hours at sign-in, and disabled accounts can take up to 30 minutes to propagate. Where immediate revocation is a control requirement, that rules PHS out as the primary method, though Microsoft still recommends enabling it as a fallback.

### Silent identity sync failure

Entra Connect stops syncing and nobody notices until access control has drifted between the directories. Monitor Connect health, alert on sync failure, deploy a second server in staging mode, and know in advance that PTA-to-PHS failover is a manual switch.

### Capacity planning Azure Local like cloud

Provisioning for today's workload and expecting to scale on demand. Azure Local capacity is fixed at deployment and expanding it means procurement and change windows. Plan on the same multi-year horizon as any other hardware purchase.

### Data transfer economics

Moving large datasets between on-premises and Azure repeatedly until egress cost exceeds the savings that justified the design. Process locally, cache aggressively, and prefer periodic bulk transfer over continuous synchronization for anything archival.

---

## Key Takeaways

1. **Azure Stack HCI is now Azure Local**, priced per physical core, using Arc as its control plane and supporting connected or disconnected operation. Material using the old name predates the rename.

2. **The Connected Machine agent's support list is an allowlist.** If an OS version is not listed it is unsupported, CentOS is absent entirely, and a large set of distributions including Windows Server 2012 and 2012 R2 reaches end of Arc support in November 2026.

3. **Do not Arc-enable machines that are already Azure resources.** Azure VMs, Azure Stack Hub, and Azure Stack Edge are excluded because they already have equivalent management.

4. **Arc is not an availability monitor.** Heartbeat every 5 minutes, Disconnected at 15 to 30 minutes, Expired after 45 days, and an expired machine needs a manual disconnect and reconnect before it can be managed again.

5. **Arc is a poor fit for ephemeral and VDI estates**, because it never cleans up resources that stop heartbeating and recreated VMs collide with orphaned ones.

6. **Azure Bastion cannot reach Arc-enabled servers.** Use SSH via Azure Arc, RDP over SSH, or Windows Admin Center in Azure, all brokered through `Microsoft.HybridConnectivity` without inbound firewall openings.

7. **Arc-enabled data services means SQL Managed Instance**, not a family of engines. The PostgreSQL offering has been removed.

8. **ExpressRoute-to-VPN transit requires Azure Route Server with route exchange enabled**, plus an active-active VPN gateway with ASN 65515 and every gateway in the Route Server's VNet. Circuit-to-circuit needs ExpressRoute Global Reach instead.

9. **Hybrid identity has three authentication methods**: password hash synchronization, pass-through authentication, and federation. Entra Domain Services is not one of them. PHS trades immediate account-state enforcement for having no on-premises dependency, and Microsoft recommends enabling it as a fallback whichever method is primary.

10. **Governance only covers what got onboarded.** Machines outside the supported OS list are not non-compliant, they are invisible, which is the more dangerous of the two states.
