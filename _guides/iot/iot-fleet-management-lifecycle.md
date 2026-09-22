---
title: "IoT Device Lifecycle and Provisioning"
layout: guide
category: IoT
subcategory: Fleet Operations
description: "How devices enter and leave a fleet: the lifecycle from manufacturing to decommissioning, injecting identity at the factory, zero-touch provisioning with enrollments, attestation, and allocation, claim-certificate and ownership-voucher onboarding, pre-provisioning versus just-in-time registration, grouping and tag taxonomy, and decommissioning."
tags: [practical, device-provisioning, zero-touch-provisioning, device-lifecycle, device-registry, decommissioning]
---

## Why the Lifecycle Needs Designing

One device is an engineering problem. Thousands of devices are an operational one, where the questions change from "why is this device broken" to "which devices share this problem, and can we act on all of them at once." Answering those questions depends on decisions made long before the fleet grew. A device that left the factory without a unique credential cannot be provisioned without a person touching it. A device that was never recorded against its hardware revision cannot be targeted by the right firmware. A device retired without revoking its identity can still connect.

Every device passes through the same stages, and each stage sets up what the next can do.

| Stage | Typical duration | What happens | What it sets up for later |
|---|---|---|---|
| Manufacturing | Minutes per device | Firmware flashed, identity injected, hardware tested | Whether the device can prove who it is without human help |
| Provisioning | Seconds to minutes | Device proves its identity, is assigned to a tenant and endpoint, receives initial configuration | Where its data goes and which policies apply to it |
| Operation | Months to years | Telemetry, commands, updates, monitoring | The bulk of its life and its cost |
| Maintenance | Hours to days, occasionally | Hardware service, part replacement, recovery | Service history tied to the device's identity |
| Decommissioning | Minutes | Identity revoked, registry entry removed, data handled | Whether the device, or a copy of its credentials, can ever reconnect |

---

## Manufacturing: Establishing Identity

Manufacturing is when a device gets the identity it will use for its whole life, and it is the cheapest time to do it. Retrofitting unique credentials to devices already in the field means a site visit or a trusted update channel, and the device may have neither.

At a provisioning station on the production line, each device receives a unique identity. The strongest pattern has the device generate its own key pair inside a secure element or TPM, so the private key never exists outside the device. The station sends the public key, as a certificate signing request, to a manufacturing CA, which returns a device certificate signed by an intermediate the fleet's provisioning service trusts. Devices without a secure element receive a key written by the station instead, which then has to be protected in the factory as carefully as any other secret.

The station also records what it produced. A **batch manifest** links each device's serial number to its identity (a certificate thumbprint, a public key, or a registration ID), its hardware revision, and the firmware version it shipped with. The manifest becomes the fleet's first record of what exists, and later it is how an operator finds a device's credential to revoke it, or every device of a revision that needs a different firmware track.

Each device also ships with the address of the provisioning service, not of the final endpoint it will send data to. The final endpoint is chosen later, which lets the same factory image serve every customer and region.

---

## Zero-Touch Provisioning

Provisioning turns a manufactured device into a working member of a specific deployment. It registers the device with the broker or hub that will receive its data, assigns it to a tenant, site, or region, and delivers its initial configuration. The goal at scale is **zero-touch provisioning**, where the device powers on, proves its identity, and gets everything else automatically.

### Enrollments, Attestation, and Allocation

Provisioning services such as [Azure IoT Hub's Device Provisioning Service](https://learn.microsoft.com/en-us/azure/iot-dps/concepts-service){:target="_blank" rel="noopener noreferrer"} and [AWS IoT Core's fleet provisioning](https://docs.aws.amazon.com/iot/latest/developerguide/iot-provision.html){:target="_blank" rel="noopener noreferrer"} share the same building blocks.

An **enrollment** tells the service which devices may register and what to do with them. An individual enrollment names one device. A group enrollment covers every device that can prove membership in the group, usually by presenting a certificate signed by a particular CA, or by presenting a key derived from a group key and the device's own ID. Group enrollments are what make zero-touch provisioning scale, because adding a device means only manufacturing it with a qualifying credential. Nobody touches the cloud side.

**Attestation** is how the device proves it matches an enrollment. It presents a certificate and proves it holds the private key, signs a challenge with a TPM key, or presents a token signed with its symmetric key. Which methods a group enrollment accepts varies by service. Azure DPS enrollment groups, for example, accept X.509 and symmetric-key attestation, while TPM attestation is limited to individual enrollments.

**Allocation** decides where an accepted device goes. Simple policies spread devices evenly across endpoints or pick the one with the lowest latency. Static policies assign the endpoint in the enrollment. Custom policies call a function that can read the device's identity and enrollment and choose by tenant, region, or product line, which is how multi-tenant deployments route each customer's devices to that customer's endpoint.

The service then registers the device on the chosen endpoint, attaches its initial configuration, and returns the endpoint address. From then on the device connects to that endpoint directly and only returns to the provisioning service if it needs reassigning.

{% include figure.html id="iot-zero-touch-provisioning" %}

### Bootstrap Credentials

Some manufacturing lines cannot give each device a unique credential the cloud already trusts. Two patterns cover that gap.

**Claim-based provisioning** ships every device in a batch with the same narrowly scoped **claim certificate**. On first connection the device uses it to request a unique certificate for itself, ideally by sending a signing request for a key it generated, and from then on uses only the unique certificate. The claim certificate can do nothing except request a device certificate, but if it leaks, anyone can mint devices until it is disabled. [AWS's provisioning guidance](https://docs.aws.amazon.com/iot/latest/developerguide/iot-provision.html){:target="_blank" rel="noopener noreferrer"} notes that disabling it stops new registrations and leaves already-provisioned devices untouched. A variant has an installer's app obtain a temporary claim for each device during setup, which avoids a shared secret in the factory.

**Ownership-voucher onboarding**, standardized as [FIDO Device Onboard (FDO)](https://fidoalliance.org/device-onboarding-overview/){:target="_blank" rel="noopener noreferrer"}, lets the manufacturer ship devices without knowing who will own them. An ownership voucher, signed along the supply chain from manufacturer to distributor to buyer, travels separately from the device. When the device first powers on, it contacts a rendezvous service, is directed to its owner's onboarding service, verifies the voucher chain back to its manufacturer, and receives its operational credentials from the owner. FDO is used mostly for gateways, edge servers, and Linux-class devices sold through distribution.

### Pre-Provisioning and Just-in-Time Registration

The two approaches differ in when the device's assignment is decided, not in how it proves its identity.

**Pre-provisioning** registers devices before deployment, usually from the batch manifest. When a device powers on in the field, its registry entry and configuration are already waiting. It fits enterprise and B2B deployments where the destination of each device is known before it ships.

**Just-in-time registration** creates the registry entry on first connection, from a template, using the identity and whatever the installer or customer supplied during setup. It fits consumer and retail products whose owner is unknown until someone buys one.

| Pattern | When the assignment is known | Fits | Tradeoff |
|---|---|---|---|
| Pre-provisioning | Before shipping | Enterprise, B2B, known installation sites | Simple first connection, but registry work up front and manifests to keep in sync |
| Just-in-time registration | At first connection | Consumer and retail products | Nothing to do before shipping, but allocation logic has to handle every case correctly |
| Mixed | For some devices | Fleets sold through both channels | Most flexible and most complex to operate |

### Reprovisioning

Devices move. A customer relocates equipment to another region, a device is resold, or an operator splits a tenant across endpoints. Because the device knows the provisioning service's address rather than a hard-coded endpoint, reassignment means updating its enrollment and telling it to provision again. Decide in advance whether reprovisioning keeps the device's configuration and history or starts fresh, and whether a resold device needs a new identity as well as a new owner.

---

## Grouping and Tag Taxonomy

A large fleet is not uniform, and every operation on it, from firmware campaigns to alert thresholds to a support query, targets a subset. Targeting depends on metadata recorded consistently from the start.

### Dimensions That Matter

**Hardware revision** decides which firmware a device can run, which sensors it has, and what normal readings look like. Mixed revisions need separate firmware tracks and separately calibrated thresholds.

**Firmware version** shows how far a release has spread and which devices still run a vulnerable version.

**Customer or tenant** keeps operations inside multi-tenancy boundaries. A configuration change for one customer should not be able to reach another's devices.

**Site, region, and network** matter because connectivity differs. Devices on satellite or congested cellular links need different retry policies and heartbeat intervals from devices on wired networks.

**Rollout ring** assigns devices to canary, early, and broad groups for any change to the fleet, so a bad change reaches a small group first.

### Where the Metadata Lives

Operator-assigned attributes like tenant, site, and rollout ring belong in the registry as cloud-side tags that the device cannot see or change. Device-reported facts like hardware revision and running firmware version come from the device itself, in its reported state. Keeping them separate matters. A device that could edit its own tenant or ring tag could move itself into another customer's scope or out of a canary group. Registries that support queries over tags and reported state, such as IoT Hub's twin queries or AWS IoT's fleet indexing, let operators select devices by any combination without scanning the fleet.

A tag taxonomy needs the same discipline as a database schema. Agree on the tag names and allowed values before the first device ships, validate them when devices are provisioned, and avoid free-text fields that drift into five spellings of the same site. Most fleet-wide operations select devices by tag, so a messy taxonomy leaves operators unsure which devices an operation will reach.

---

## Decommissioning

A device removed from service without being decommissioned keeps working credentials, and its data may linger past what regulations allow. Decommissioning is short but has to be complete.

### Revoke the Identity

Disable the device's registration so it can no longer authenticate. For certificate identities that usually means disabling or deleting the device in the registry, since many IoT services do not check certificate revocation lists for device certificates. For symmetric keys it means deleting the key.

Removing the device from the registry is not enough when it belongs to a group enrollment. Its certificate still chains to the group's CA, or its key still derives from the group key, so it can simply provision itself back in. Block it at the provisioning service as well. Azure DPS, for example, [blocks one device in a group](https://learn.microsoft.com/en-us/azure/iot-dps/how-to-revoke-device-access-portal){:target="_blank" rel="noopener noreferrer"} with a disabled individual enrollment for that device, which the service checks before any group. Delete individual enrollments outright.

Decommissioning should be final. If a decommissioned identity tries to connect or provision again, treat it as a security event to investigate. It may be a device that was never actually retired, or someone using credentials extracted from one that was.

### Remove the Registry Entry and Handle the Data

Deleting the registry entry deletes its tags and state, so archive what audit or analysis will need first. Telemetry the device produced over its life may have its own retention rules, requiring it to be kept for a set period or deleted on request. Both need the data to be keyed by device identity so it can be found.

On the device itself, erase credentials and stored data before disposal, resale, or return to the vendor. A device whose keys sit in a secure element can erase them on command. A device that cannot erase its keys, and held credentials that matter, should be physically destroyed.

### Keep an Audit Trail

Record when the device was decommissioned, who or what triggered it, why, and confirmation that revocation took effect. The record answers later questions about a specific device, and it is often what compliance audits ask for.
