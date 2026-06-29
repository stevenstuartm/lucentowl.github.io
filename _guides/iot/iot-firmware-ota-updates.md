---
title: "IoT Firmware and OTA Updates"
layout: guide
category: IoT
subcategory: Architecture & Security
description: "Firmware fundamentals, secure boot chains, code signing, OTA update mechanisms including A/B partitioning and delta updates, rollback protection, and fleet-scale update management."
tags: [iot, firmware, security, embedded, reliability, deployment, scalability]
---

## What Firmware Is

Firmware is software stored in a device's non-volatile memory, such as flash or EEPROM, that persists across power cycles. Unlike files on a hard drive, firmware is woven into the device itself. When you power on an IoT sensor, a smart thermostat, or an industrial controller, the firmware is what wakes up and makes the hardware functional. It initializes peripherals, manages hardware registers, and provides the runtime environment for any application logic running on top.

The word "firmware" reflects its position between hardware and software. It is more permanent than software in the traditional sense (you cannot delete it like an app), and yet it is updatable in ways that hardware is not.

### The Software Layers on an IoT Device

Understanding firmware requires understanding how IoT device software is typically layered.

At the bottom sits the bootloader, a small, trust-anchored program stored in protected memory. Its sole job is to verify and load the next layer. Above the bootloader is the firmware image itself, which may include a real-time operating system (RTOS) like [FreeRTOS](https://www.freertos.org/){:target="_blank" rel="noopener noreferrer"} or [Zephyr](https://zephyrproject.org/){:target="_blank" rel="noopener noreferrer"}, hardware abstraction layers (HALs), middleware, and the application logic unique to the device's purpose.

The distinction between firmware and an operating system is somewhat contextual in IoT. On a resource-constrained microcontroller (MCU), there may be no distinct OS at all; the firmware is a monolithic image handling everything from scheduling to peripheral drivers. On more capable devices like industrial gateways, you might see a full Linux distribution running beneath a containerized application. In those cases, "firmware" might refer to the bootloader and kernel while "application" refers to the business logic deployed above it.

| Layer | Role | Examples |
|-------|------|---------|
| Bootloader | Verifies and loads firmware; hardware initialization | U-Boot, MCUboot |
| Real-Time OS (optional) | Task scheduling, memory management, abstraction | FreeRTOS, Zephyr, ThreadX |
| Hardware Abstraction Layer | Portable driver interface for MCU peripherals | Vendor SDKs, CMSIS |
| Application Firmware | Business logic, sensor reading, protocol handling | Device-specific code |

A blank line before a table is required in Kramdown, and the table above shows the layering clearly: each row depends on the one below it.

### The Boot Process

When power is applied or a reset occurs, execution begins at a fixed memory address where the bootloader lives. The bootloader performs the minimum initialization required to run, then verifies the firmware image stored in the application partition using cryptographic checks. If verification passes, control transfers to the firmware. If verification fails, the bootloader refuses to continue and typically enters a safe recovery mode or signals a fault condition.

The firmware then carries out its own initialization: configuring clocks, setting up peripherals, establishing connectivity, and loading any calibration or configuration data from persistent storage. Only after this sequence is complete does the device begin its normal operating loop.

The boot process is deliberately linear and deterministic. Any deviation from expected state should be caught at the earliest possible point rather than allowing a compromised or corrupted image to reach execution.

---

## Memory Layout

Flash memory on an IoT device is divided into partitions, each serving a distinct purpose. The exact layout varies by hardware and firmware architecture, but a typical arrangement looks like this.

The bootloader partition occupies the lowest addresses in flash and is write-protected in hardware after manufacturing. This protection ensures that even if application firmware is compromised, the bootloader cannot be overwritten. Above it sits the application partition (or partitions, in A/B schemes) where the active firmware image lives. A separate data partition holds non-volatile configuration, device certificates, calibration data, and application state. Finally, an OTA staging area provides space to receive and validate a new firmware image before committing it to the active partition.

| Partition | Purpose | Write Protection |
|-----------|---------|-----------------|
| Bootloader | Secure boot, chain of trust | Hardware-locked after manufacturing |
| Application (active) | Running firmware image | Writable during OTA process only |
| Application (inactive) | OTA staging in A/B schemes | Written during update, read-only otherwise |
| Data | Config, certificates, calibration | Writable by application |
| OTA metadata | Version counters, update state | Controlled by bootloader |

The OTA metadata partition deserves special attention. It records which application partition is currently active, what version is running, and whether an update is in progress. The bootloader consults this metadata on every boot to determine where to find the firmware image and whether a newly flashed image is awaiting validation.

---

## Secure Boot

Secure boot is the mechanism that ensures a device only executes firmware that has been cryptographically verified. Without it, an attacker who gains physical or network access to a device could replace the firmware with malicious code, and the device would run it without objection.

### Chain of Trust

Secure boot works by establishing a chain of trust that starts in hardware and extends outward. At the root is a hardware root of trust, a small, immutable piece of code or a cryptographic key baked into the chip at manufacture time. This root verifies the bootloader's signature. The bootloader, once verified, verifies the firmware image's signature. Each layer vouches for the next, and the chain holds as long as the root is trustworthy.

If any link in the chain fails verification, execution halts at that point. The device does not proceed to run unverified code. Depending on the device design, failure might trigger an alert, initiate recovery mode, or permanently disable the device to prevent it from operating in a compromised state.

### What Happens When Verification Fails

A device that refuses to boot because verification failed is doing exactly what it should. The failure surfaces the problem rather than hiding it. Operators will see the device go offline and can investigate. This is preferable to the alternative: a device silently running tampered firmware while appearing healthy.

Recovery from a failed boot verification typically involves reflashing through a hardware debug interface (JTAG or SWD), physical access to the device, or a dedicated hardware recovery mode that bypasses the normal boot path under controlled conditions.

### Hardware Support

Modern microcontrollers and application processors provide hardware features that make secure boot practical. [ARM TrustZone](https://developer.arm.com/ip-products/security-ip/trustzone){:target="_blank" rel="noopener noreferrer"} creates two isolated execution environments on Cortex-M and Cortex-A processors: a Secure World that runs trusted code and a Normal World for untrusted application code. The Secure World can hold cryptographic keys and perform verification without exposing those assets to the application firmware.

[Trusted Platform Modules (TPMs)](https://trustedcomputinggroup.org/resource/tpm-library-specification/){:target="_blank" rel="noopener noreferrer"} provide dedicated cryptographic hardware for key storage, attestation, and measured boot. Secure elements (SEs) are similar but more specialized, often providing tamper-resistant storage for device certificates and signing keys. The distinction between a TPM and a secure element is somewhat product-specific; both serve the goal of isolating secrets from the general-purpose processor.

---

## Code Signing

Every firmware image released to production devices must carry a cryptographic signature that proves it originated from a trusted source and has not been modified since signing. Code signing is the mechanism that delivers this guarantee.

### Asymmetric Cryptography for Signing

Firmware signing uses asymmetric cryptography. The private signing key is held securely by the firmware build infrastructure, often in a hardware security module (HSM) that never exposes the raw key. When a firmware image is ready for release, the build system produces a signature by applying the private key to a hash of the image. This signature is bundled with the image.

Devices store the corresponding public key, typically embedded in the bootloader or provisioned into secure storage during manufacturing. On boot, the bootloader computes the hash of the firmware image and verifies the signature using the public key. If the signature matches, the image is authentic and unmodified. If not, verification fails.

The beauty of this scheme is asymmetry: the private key never leaves the signing infrastructure, so even if an attacker obtains a device and extracts its public key, they cannot produce valid signatures for malicious firmware without also compromising the private key.

### Certificate Management for Signing Keys

Private signing keys must be treated with the same rigor as a certificate authority's root key. Exposure of the signing key means an attacker could sign arbitrary firmware and deploy it to any device that trusts that key. Practices for protecting signing keys include storing them in HSMs, restricting access to automated build systems rather than individual developers, rotating keys on a defined schedule, and maintaining an audit trail of every signing operation.

Certificate management also involves planning for key rotation. Devices need a way to accept firmware signed by a new key when the old key is retired. This often means including an intermediate certificate layer so that the root of trust in the device remains stable while subordinate signing certificates rotate.

### Build Pipeline Integration

Signing should be an automated step in the CI/CD pipeline, not a manual step performed by a developer on their local machine. When signing is manual, it becomes inconsistent and creates opportunities for unsigned or improperly signed images to slip through.

In a well-designed pipeline, the build system produces an unsigned binary, automated tests validate functional correctness, and only after tests pass does the signing step execute against a secured HSM. The signed artifact is then published to a firmware distribution service. No human ever handles the raw signing key, and every release is traceable back to a specific build job and commit.

---

## OTA Update Mechanisms

Over-the-air updates are one of the most operationally important capabilities in any IoT deployment. Devices deployed in the field, whether in homes, factories, utility infrastructure, or vehicles, cannot be physically accessed every time a bug is fixed or a security vulnerability is patched. OTA updates are how software improvements reach devices without sending a technician to each location.

### Full Image vs. Delta Updates

The simplest OTA approach is a full firmware replacement: download a complete new firmware image, verify it, flash it, and reboot. Full image updates are straightforward to implement and verify, and their simplicity reduces the risk of update-related failures. The tradeoff is payload size. A full firmware image might be hundreds of kilobytes or several megabytes, which creates real costs in terms of bandwidth, download time, and storage requirements on the device.

Delta updates address this by sending only the difference between the current firmware version and the new one. A well-designed delta update might be a fraction of the full image size, which matters for devices on metered cellular connections or in regions with constrained bandwidth. The tradeoff is complexity: generating a delta requires knowing the exact starting version on each device, and applying it requires a reliable differential patching algorithm like [bsdiff](http://www.daemonology.net/bsdiff/){:target="_blank" rel="noopener noreferrer"} running on the device.

| Approach | Payload Size | Device Requirements | Failure Risk |
|----------|-------------|---------------------|-------------|
| Full image | Large | Enough storage for staging the full image | Lower complexity, well-understood |
| Delta update | Smaller | Correct base version; patching algorithm | Higher if version tracking is wrong |

### A/B Partition Schemes

The A/B partition scheme is the most robust approach to OTA updates because it separates the act of receiving an update from the act of committing to it. The device maintains two application partitions, commonly labeled A and B. One partition holds the currently running firmware (active) and the other is available for writing (inactive).

During an update, the new firmware image is downloaded and written entirely to the inactive partition. The bootloader does not switch to the new partition until the image has been fully written and its signature verified. Once verified, the bootloader metadata is updated to designate the new partition as active and the device reboots. On first boot from the new partition, the firmware typically runs a self-test or waits for a watchdog confirmation window before marking the update as successful. If the device fails to confirm success within the window, the bootloader rolls back to the previously active partition on the next reset.

The key advantage is that the old firmware remains untouched until the new firmware proves itself. An interrupted download, a failed flash write, or a firmware that crashes on boot all result in automatic rollback rather than a bricked device.

A/B schemes require enough flash storage for two full firmware images plus the staging overhead, which is not always available on severely constrained microcontrollers. That storage cost is the primary reason some devices use simpler single-partition approaches instead.

### Single Partition with Rollback

Devices with limited flash can update in-place, overwriting the active partition as the new image arrives. This approach is riskier because a power loss mid-write leaves the partition partially overwritten and the device potentially unbootable. Mitigations include downloading to a separate staging area first and then moving the image to the application partition in a single atomic operation, or using wear-leveling filesystems that support atomic file replacement.

Rollback from a single-partition update requires that the previous firmware image be retained somewhere, which usually means a compressed backup partition or simply accepting that rollback is not always possible. Some devices treat single-partition updates as one-way operations and rely on a separate minimal recovery image in write-protected memory if something goes wrong.

### The Download-Verify-Apply-Reboot Cycle

Regardless of the scheme, every OTA update follows the same logical sequence.

The device connects to the update service and discovers that a new firmware version is available. It downloads the image (either full or delta) to the staging area, verifying the download as it arrives using checksums or by buffering chunks for later verification. Once the complete image is present, the device verifies the cryptographic signature against the public key it already trusts. If verification passes, the bootloader metadata is updated to direct the next boot to the new image. The device reboots and, after successfully running on the new firmware, confirms the update as successful.

Each step in this cycle is a potential failure point, and robust OTA implementations handle each one explicitly. A failed download resumes from where it left off rather than restarting. A failed signature check discards the staged image without touching the running partition. A failed post-boot confirmation triggers rollback.

### Update Delivery Protocols

Updates can be delivered over MQTT, HTTPS, or device-vendor-specific protocols. MQTT is attractive for IoT because devices already maintain persistent connections to a message broker for telemetry; the update notification can arrive over the same channel. HTTPS is simple and widely supported for downloading firmware binaries from a CDN. Many managed IoT platforms combine both: MQTT for notifying the device that an update is available, then HTTPS to download the actual binary from a content delivery endpoint.

The protocol choice matters less than ensuring that transfers are authenticated, that the device verifies the server's identity (preventing man-in-the-middle substitution of a malicious image), and that the download is resumable to handle intermittent connectivity.

---

## Rollback Protection

Rollback protection prevents a device from downgrading to an older, potentially vulnerable firmware version even if an attacker has physical access or has compromised the update channel.

### Why Downgrade Attacks Are a Concern

If an attacker knows that version 1.2 of a firmware has a specific vulnerability that version 1.5 patched, they might attempt to roll the device back to 1.2, exploiting the vulnerability in a version they have already analyzed. Without rollback protection, the bootloader would accept this downgrade as a valid signed image because it is. The signature is valid; the problem is the version number.

### Monotonic Version Counters

The standard defense is a monotonic version counter stored in hardware that can only increment, never decrement. When firmware version 1.5 is applied, the counter is updated to reflect version 1.5. The bootloader refuses to boot any image with a version number lower than the stored counter, regardless of whether the image has a valid signature.

Some microcontrollers implement this using one-time-programmable (OTP) fuses or eFuses in the secure element. Each firmware release corresponds to burning an additional fuse, and the bootloader counts the fuses to determine the minimum acceptable version. Once burned, fuses cannot be restored; this is what makes the counter truly monotonic and tamper-resistant.

### When Rollback Is Appropriate

Rollback protection is not absolute. If a newly deployed firmware version contains a critical bug that disrupts device operation, the right response may be to roll back to the previous working version before the issue is patched. This is operationally valid, but it should be a controlled decision made by the update service, not something an attacker can trigger.

Managed update services like [Azure Device Update for IoT Hub](https://learn.microsoft.com/en-us/azure/iot-hub-device-update/){:target="_blank" rel="noopener noreferrer"} support controlled rollback by deploying the earlier version as a new update campaign. The monotonic counter is not decremented; instead, the rollback is treated as a forward deployment of the previous version with a higher counter value. This approach maintains the security invariant while allowing operational flexibility.

---

## Fleet-Scale Update Management

Updating a single device is straightforward. Updating ten thousand devices, across multiple hardware revisions, firmware versions, geographic regions, and connectivity types, is an operational discipline in itself.

### Staged Rollouts

Deploying a new firmware version to every device simultaneously is how large-scale outages happen. A bug that slips through testing will brick every device at once, and recovery requires manual intervention across the entire fleet.

Staged rollouts address this by deploying incrementally. A canary deployment sends the update to a small percentage of the fleet, perhaps one percent, and monitors device health metrics before proceeding. If the canary cohort shows increased error rates, connectivity drops, or unexpected reboots, the rollout is paused and the new version is investigated. After the canary passes, the update advances to a broader cohort, perhaps ten percent, and again monitors before proceeding to the full fleet.

The monitoring metrics that matter for a canary include device connectivity (did devices reconnect after the update?), crash and reboot rates, sensor reading validity, and any application-level health signals the device reports. An update that causes even a small fraction of devices to become unreachable should trigger an automatic pause.

### Update Campaigns and Targeting

Not all devices in a fleet should receive the same firmware image. Devices with different hardware revisions may require different binaries. Devices in regions with specific regulatory requirements may need builds compiled with or without certain features. Devices serving as industrial controllers may require longer validation periods before receiving an update that field sensors get immediately.

Update campaigns group devices by attributes and assign specific firmware versions to each group. A campaign might target all devices running hardware revision 3 in North America that are currently on firmware 1.4 or earlier. The update service tracks campaign membership and delivery status for each device.

### Compliance Reporting

At fleet scale, knowing which devices are on which firmware version is as important as deploying the update itself. Compliance reporting provides this visibility: how many devices are on the current version, how many are on older versions, which older versions are still in service, and which devices have not checked in recently and may be offline.

Compliance data drives remediation priorities. If three percent of a fleet is running a version with a known security vulnerability, that number represents real risk and a response timeline. Without compliance tracking, the risk is invisible.

### Azure Device Update for IoT Hub

[Azure Device Update for IoT Hub](https://learn.microsoft.com/en-us/azure/iot-hub-device-update/){:target="_blank" rel="noopener noreferrer"} is a managed service that handles firmware distribution, campaign management, and compliance reporting for IoT Hub-connected devices. Operators import firmware images with metadata describing compatible hardware, create deployment groups by device tags or class, and launch update campaigns with staged rollout configurations. The service handles delivery scheduling, tracks which devices have received and applied the update, and surfaces compliance dashboards showing fleet-wide version distribution.

The [Device Update agent](https://learn.microsoft.com/en-us/azure/iot-hub-device-update/understand-device-update-agent-reference){:target="_blank" rel="noopener noreferrer"} runs on the device and handles the download, verification, and application steps using a pluggable update handler interface, so teams can integrate their existing OTA apply logic without rewriting it.

### Handling Offline Devices

In any large IoT deployment, some devices will be offline during an update campaign. They may be in a location with intermittent connectivity, have entered a low-power sleep mode, or simply been powered off. The update service must hold the campaign open for these devices rather than marking them as failed immediately.

When an offline device reconnects, it should discover the pending update and apply it normally. The campaign remains active until all targeted devices have confirmed the update or until the campaign is manually closed. Devices that remain offline indefinitely eventually show as non-compliant in reporting, surfacing the need for investigation.

---

## Common OTA Failure Modes

OTA updates introduce complexity into what is otherwise a stable embedded system. Each step in the process is a potential failure, and designing for graceful handling of these failures is as important as designing the update mechanism itself.

### Power Loss During Flash Write

Flash memory writes are not instantaneous. If power is lost mid-write, the partition being written may contain a partially valid image, with some sectors updated and others holding stale data. The result is a firmware image that is neither the old version nor the new version, and that will almost certainly fail signature verification or crash at runtime.

The A/B partition scheme specifically addresses this: because the write happens to the inactive partition, a power loss corrupts only the staged image while the running partition remains intact. The bootloader simply retries the update on the next boot when the device recovers power. Single-partition updates do not have this safety net and require careful attention to atomic write semantics or a protected recovery image.

### Network Interruption During Download

IoT devices rarely have the luxury of a stable, high-bandwidth network connection for the full duration of a firmware download. Cellular connections drop, Wi-Fi signals fluctuate, and devices may enter sleep modes mid-download. A robust update client handles interrupted downloads by resuming from the last successfully received chunk using HTTP range requests or a similar mechanism, rather than restarting the entire download. Without resume support, devices on slow or unreliable connections may never complete a download if the transfer window is shorter than the time required to download the full image.

### Insufficient Storage for Staging

Delta updates reduce payload size, but even delta updates need space to be applied. Some update schemes require decompressing the delta in memory or writing intermediate files before producing the final image. Devices that are barely within storage requirements for their current firmware may run out of space during update staging. This is particularly common when firmware images grow across versions due to new features, and the OTA staging partition was sized for earlier, smaller images.

Storage planning should include headroom for at least one full firmware image beyond what current code occupies, accounting for expected growth over the product's lifecycle.

### Clock Synchronization Issues

Firmware images and device certificates carry expiration dates. If a device's real-time clock is significantly wrong, such as after a battery replacement that reset the clock to epoch, certificate validation may fail because the device believes the certificate has expired or is not yet valid. A device that cannot validate a server certificate cannot establish a secure connection to the update service, meaning OTA updates become impossible until the clock is corrected.

Robust devices synchronize their clocks via NTP early in the boot sequence and before attempting any certificate-based operation. Devices that lack NTP access (due to network constraints) need an alternative time source or must implement certificate validation logic that handles clock uncertainty gracefully.

### Heterogeneous Hardware in a Fleet

A product line that has shipped across multiple hardware revisions will inevitably have devices in the field with different processor variants, memory configurations, display hardware, or connectivity modules. A single firmware binary almost certainly will not work correctly across all of them. Deploying the wrong image to incompatible hardware can render devices non-functional.

Update campaigns should encode hardware compatibility requirements in firmware metadata and enforce them at the update service level, refusing to deliver an image to a device that reports an incompatible hardware version. Devices should also perform a hardware compatibility check during the OTA apply step before committing to the new image. Layering these checks provides defense in depth: the service catches most mismatches before download, and the device catches any that slip through.

---

## Summary of Key Design Decisions

Designing an OTA update system requires making explicit choices across several dimensions. These decisions have long-term consequences because changing the update mechanism after devices are in the field is extremely difficult; a broken update system cannot update itself.

| Decision | Options | Primary Tradeoff |
|----------|---------|-----------------|
| Partition scheme | A/B dual partition vs. single partition | Storage cost vs. update safety |
| Update payload | Full image vs. delta | Simplicity vs. bandwidth efficiency |
| Rollback policy | Hardware monotonic counter vs. software version check | Security strength vs. operational flexibility |
| Delivery protocol | MQTT + HTTPS vs. custom protocol | Ecosystem fit vs. optimization |
| Signing infrastructure | Cloud HSM vs. on-premises HSM | Operational convenience vs. control |
| Fleet management | Self-hosted vs. managed service (Azure Device Update, AWS IoT) | Customization vs. operational overhead |

The choices that are hardest to change after deployment are the memory layout (changing partition schemes requires reflashing through hardware), the signing key infrastructure (rotating the root key requires a coordinated update campaign that trusts both old and new keys simultaneously), and the anti-rollback counter scheme (the counter is baked into hardware).

Investing in a solid OTA foundation before devices ship is far less costly than retrofitting one afterward. A device that cannot be reliably updated is a device that cannot be secured, and in IoT, that is a liability that compounds with every vulnerability discovered after deployment.
