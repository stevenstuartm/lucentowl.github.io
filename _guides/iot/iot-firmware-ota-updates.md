---
title: "IoT Firmware and OTA Updates"
layout: guide
category: IoT
subcategory: Security & Firmware
description: "How firmware reaches and stays trustworthy on a device: flash layout, secure boot and the chain of trust, code signing and signing-key custody, A/B, swap, and single-slot update schemes, test-and-confirm rollback, delta updates, anti-rollback counters, and the device-side failures an update client has to survive."
tags: [practical, firmware, secure-boot, code-signing, ota-updates, mcuboot, anti-rollback]
---

## What Firmware Is

Firmware is the software stored in a device's non-volatile memory, usually flash, that runs when the device powers on. It initializes clocks and peripherals, brings up connectivity, and runs the application logic that makes the device a thermostat or a vibration sensor rather than a bare circuit board.

### The Software Layers on a Device

At the bottom sits the **bootloader**, a small program whose job is to verify and start the next layer. Above it is the firmware image, which on a microcontroller usually bundles a real-time operating system like [FreeRTOS](https://www.freertos.org/){:target="_blank" rel="noopener noreferrer"} or [Zephyr](https://zephyrproject.org/){:target="_blank" rel="noopener noreferrer"}, a hardware abstraction layer, middleware, and the application into a single image.

| Layer | Role | Examples |
|-------|------|---------|
| Bootloader | Verifies and starts the firmware; minimal hardware initialization | MCUboot, U-Boot, vendor second-stage bootloaders |
| Real-time OS (optional) | Task scheduling, memory management | FreeRTOS, Zephyr, Eclipse ThreadX |
| Hardware abstraction layer | Portable interface to the chip's peripherals | Vendor SDKs, CMSIS |
| Application | Sensor reading, protocol handling, device logic | Device-specific code |

What counts as "firmware" depends on the device. On a microcontroller, the firmware is one monolithic image that handles everything. On a Linux-class gateway, the bootloader, kernel, and root filesystem play the firmware role, and applications, often containers, are updated separately on top of them.

### The Boot Sequence

On power-up or reset, the processor starts executing at a fixed address. On a device with secure boot, that code is an immutable boot ROM, which verifies the bootloader. The bootloader verifies the firmware image and transfers control only if the check passes. The firmware then configures peripherals, loads configuration and calibration data, connects, and enters its operating loop.

---

## Flash Layout

Flash is divided into partitions, and the layout decides which update schemes are possible. It is also the hardest thing to change once devices ship, since changing partition boundaries usually needs a wired reflash.

| Partition | Purpose | Written by |
|-----------|---------|-----------------|
| Bootloader | Verifies and starts the firmware | Manufacturing only; write-protected afterwards |
| Application slot(s) | The running image, plus a second slot in dual-slot schemes | The update client or the bootloader during an update |
| Update metadata | Which slot to boot, whether a new image is pending confirmation | The bootloader and the update client |
| Data | Configuration, credentials, calibration, application state | The application |

Credentials and calibration data live outside the application slots so an update never overwrites them, and so a rollback returns to old code without returning to old data. That also means new firmware has to read data written by the previous version, which makes data format migration part of every update's design.

---

## Secure Boot

Secure boot makes a device run only firmware that verifies against a key it already trusts. Without it, anyone who can write to flash, through a debug port, a vulnerable update path, or physical access, can make the device run their code.

### The Chain of Trust

The chain starts with a **hardware root of trust**, code and a key that cannot be changed after manufacturing. Typically this is a boot ROM plus a hash of the trusted public key burned into one-time-programmable fuses. The boot ROM verifies the bootloader's signature, and the bootloader verifies the firmware's. Each stage checks the next before handing over control, so the chain is only as strong as its first link. A root key that can be rewritten, or a debug port that lets an attacker skip the boot ROM's check, breaks everything after it.

When verification fails, the device stops rather than running the image. What happens next is a design choice. The device can fall back to the other slot if one holds a valid image, enter a recovery mode that accepts only signed images, or wait for a technician. A device that refuses to boot is visible and fixable. A device quietly running tampered firmware is neither.

### Hardware Support

Most current microcontrollers and application processors support secure boot in their boot ROM, with a fuse-stored key hash and a way to lock debug access once it is enabled. Two hardware features commonly sit alongside it.

[TrustZone](https://www.arm.com/technologies/trustzone-for-cortex-m){:target="_blank" rel="noopener noreferrer"} splits a processor into a secure world and a normal world, so keys and verification code can be isolated from the application. On Cortex-A application processors it has long been standard. On microcontrollers it exists only in the Armv8-M architecture and later, as an option on cores like the Cortex-M23, M33, M55, and M85, and not on older cores like the Cortex-M0, M3, M4, and M7. [Trusted Firmware-M](https://www.trustedfirmware.org/projects/tf-m/){:target="_blank" rel="noopener noreferrer"} is the reference secure-world implementation for those cores.

A secure element or TPM can hold the device's keys and, on a TPM, record measurements of what booted so a remote service can check it. Secure boot and measured boot are different things. Secure boot refuses to run an unverified image. Measured boot runs whatever boots and records it, so a verifier can decide whether to trust the device afterwards.

---

## Code Signing

Every production image carries a signature from the manufacturer's private key, and devices verify it with the matching public key before booting or installing the image.

### How Signing Works

The build produces the image, a hash of it is signed with the private key, and the signature travels with the image, usually in a header or trailer the bootloader understands. The device holds only the public key (or its hash, in fuses), so extracting it from a device gives an attacker nothing they can sign with. Elliptic-curve signatures like ECDSA P-256 and Ed25519 are the usual choice on microcontrollers, since verification is fast and the keys are small.

### Signing-Key Custody

The signing key is the most valuable secret in the product line. Whoever holds it can make every device in the field run their code. It belongs in a hardware security module (HSM), on premises or as a cloud key service, where the key can be used but never exported. Signing should be an automated pipeline step, running only after tests pass, with no developer able to sign from a workstation. Every signature should be logged and traceable to a build and commit.

Plan for key rotation before shipping. If devices trust exactly one public key burned into fuses, rotating it is impossible. Common designs burn several key hashes and allow revoking one, or have the root key sign a subordinate signing key so the subordinate can rotate while the root stays in an offline HSM. A leaked key with no rotation path means the fleet has to be replaced or reflashed by hand.

### Signing Standards and Manifests

Beyond the image signature, an update usually carries a manifest describing what the image is for: which hardware it targets, which version it replaces, and where to fetch it. The IETF's [SUIT architecture (RFC 9019)](https://www.rfc-editor.org/rfc/rfc9019){:target="_blank" rel="noopener noreferrer"} describes a standard approach for constrained devices, where the signed manifest, not just the image, is what the device verifies.

---

## Update Schemes

Over-the-air (OTA) updates are how fixes, features, and security patches reach devices nobody can visit. The update scheme decides what happens when something goes wrong halfway through, and it is fixed by the flash layout, so it has to be chosen before the first device ships.

### Dual-Slot Updates

The device has two application slots. The new image is downloaded into the slot that is not running while the old image keeps running, and nothing changes until the new image is complete and its signature verifies. Then the update metadata marks the new image as pending and the device reboots into it.

The new image boots on probation. It runs a self-test, such as bringing up peripherals and reaching the update service, and then **confirms** itself. If it crashes, hangs until the watchdog resets it, or reboots before confirming, the bootloader reverts to the previous image on the next boot. A power loss during download or install also leaves the old image intact. This test-and-confirm cycle is what makes dual-slot updates hard to brick.

{% include figure.html id="iot-ab-update" %}

Bootloaders implement the two slots in different ways, and the difference matters for how images are built.

| Variant | How it works | Tradeoff |
|---|---|---|
| Execute from either slot | The bootloader boots whichever slot the metadata marks active (ESP-IDF's OTA slots, MCUboot's direct-XIP mode) | Fast switch with no copying, but unless the chip remaps flash addresses (as the ESP32 does), each image has to be linked for the slot it will run from |
| Swap into the primary slot | The image always runs from the primary slot; the bootloader swaps the two slots on update and swaps back on revert (MCUboot's default swap modes) | One image works for every device, at the cost of slower updates, extra flash wear, and a spare sector or scratch area |

[MCUboot's design documentation](https://docs.mcuboot.com/design.html){:target="_blank" rel="noopener noreferrer"} covers these modes in detail. Linux-class devices apply the same idea to whole root filesystems, with tools like Mender, RAUC, and SWUpdate managing two root partitions and the bootloader's fallback.

The cost is flash. Room for two full images rules out dual-slot updates on the most constrained microcontrollers.

### Single-Slot Updates

A device with room for only one image can overwrite it in place. This is the riskiest scheme. A power loss mid-write leaves a partial image that will not verify, and there is no old image to go back to. The usual mitigation is a small, write-protected **recovery image** that the bootloader falls back to, which can connect and download a full image again. An alternative is to stage the new image in external flash and let the bootloader copy it into place, which the bootloader can resume after a power loss. MCUboot's overwrite-only mode works this way, and it gives up the ability to revert.

### Full Images and Delta Updates

A full image is simple and self-contained, but it can run from hundreds of kilobytes to many megabytes, which costs airtime, battery, and money on metered cellular links. A **delta update** sends only the difference between the installed version and the new one, often a small fraction of the size.

Deltas add constraints. The server has to know each device's exact installed version and build a patch for every version pair it supports. The device needs the original image intact while it applies the patch, which dual-slot layouts provide and single-slot layouts do not. The patching algorithm has to fit the device's RAM, which rules out desktop tools like bsdiff on small microcontrollers in favor of patch formats designed for embedded devices. The result must still verify against the signature of the full target image, so a bad patch fails verification instead of booting.

| Approach | Payload | Device requirements | Main risk |
|---|---|---|---|
| Full image | Large | Space to stage a full image | Download time and cost on slow links |
| Delta | Small | The exact base image intact, a patcher that fits in RAM | Version tracking errors produce patches that do not apply |

### The Update Cycle on the Device

Every scheme follows the same sequence.

1. **Learn** that an update is available, usually from the update service over the device's existing connection, or from desired-state configuration.
2. **Check compatibility** against the manifest: hardware revision, current version, and required free space.
3. **Download** in chunks to the staging slot, resuming from the last chunk after an interruption.
4. **Verify** the signature over the complete image (and the manifest) before marking anything bootable.
5. **Mark pending and reboot** into the new image.
6. **Self-test and confirm**, or let the bootloader revert.
7. **Report** the result and the running version to the update service.

The transport matters less than the checks. Many platforms notify over MQTT and download over HTTPS from a CDN, and devices on LPWAN links use protocol-specific fragmentation. In every case the device authenticates the server, verifies the image signature itself rather than trusting the channel, and can resume a partial download.

---

## Anti-Rollback Protection

A signed old image is still a valid image. If version 1.2 has a known vulnerability that 1.5 fixed, an attacker who can feed the device a copy of 1.2 gets the vulnerability back, and signature checks alone will not stop it.

### Security Counters

The defense is a **security counter** stored somewhere that can only increase, usually one-time-programmable fuses or a secure element's monotonic counter. Each signed image declares a security version. The bootloader refuses any image whose security version is below the stored counter, and the counter is raised after a newer image has booted and confirmed.

Fuses run out. ESP-IDF's anti-rollback, for example, stores the counter in eFuse bits and allows [at most 32 increments](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/system/ota.html){:target="_blank" rel="noopener noreferrer"} on the ESP32. So the security version is usually separate from the release version and advances only on releases that fix a vulnerability serious enough that devices must never run the older code again. Ordinary releases keep the same security version, and devices can move between them freely.

### Rolling Back a Bad Release Without Weakening Protection

A release that breaks devices has to be undone somehow. If the bad release did not raise the security version, the previous release is still allowed and can simply be deployed again. If it did, the fix is to rebuild the previous code with the new security version and sign it as a new release. Either way the counter never goes down, and the decision to roll back stays with whoever holds the signing key, not with whoever can reach the device.

---

## Device-Side Update Failures

Each step of the update cycle can fail in the field, and the update client has to survive every one of them.

**Power loss while writing.** Dual-slot schemes lose only the staged image and retry later. Swap-based bootloaders record swap progress so they can resume after power returns. Single-slot schemes need a recovery image or an atomic copy from staging.

**Interrupted downloads.** Cellular links drop and devices sleep. A client that restarts the download from zero may never finish on a slow link, so downloads resume from the last completed chunk, using HTTP range requests or the protocol's equivalent.

**Running out of staging space.** Images grow across versions. A staging slot sized for the launch firmware may not fit an image two years later, so the slot sizes chosen at launch need headroom for growth over the product's life.

**A wrong clock.** Validating a TLS server certificate needs roughly correct time. A device whose clock reset after a power loss or battery change may reject the update server's certificate as not yet valid and never connect. Devices need a time source they can reach before the first TLS connection, or a validation policy that tolerates an unset clock for the update connection while still verifying the image signature.

**The wrong image for the hardware.** Product lines ship in hardware revisions with different chips, memory, and radios. The manifest names the hardware it targets, the service delivers only matching images, and the device checks the hardware identifier again before installing, so a mismatch that slips past the service still stops at the device.

**A new image that cannot read old data.** Rollback returns old code, not old data. If the new firmware migrated a configuration format and then reverted, the old firmware has to cope with data it did not write. Keeping migrations backward-readable, or deferring them until after the new image confirms, avoids stranding a reverted device with configuration it cannot parse.

---

## Design Decisions That Are Hard to Change Later

| Decision | Options | Tradeoff |
|----------|---------|-----------------|
| Update scheme | Dual-slot (execute-in-place or swap), or single-slot with recovery | Flash cost against safety and the ability to revert |
| Payload | Full image or delta | Simplicity against airtime and battery |
| Anti-rollback | Hardware security counter, or software version check only | Resistance to downgrade against a limited counter budget |
| Signing-key hierarchy | Single key, several revocable keys, or root plus rotating subordinate keys | Simplicity against the ability to recover from a leaked key |
| Key custody | On-premises HSM or cloud key service | Control against operational convenience |

The flash layout, the root of trust, and the anti-rollback counter are fixed in hardware or near it, and they are the hardest to change once devices ship. An update system that cannot update itself safely leaves no way to fix it. A device that cannot be updated cannot be secured, and every vulnerability found after launch makes that more expensive.
