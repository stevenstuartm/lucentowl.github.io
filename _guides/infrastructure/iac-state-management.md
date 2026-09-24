---
title: "IaC State Management"
layout: guide
category: Infrastructure & Cloud
subcategory: Infrastructure as Code
description: "How Terraform, OpenTofu, and Pulumi keep their state record: what state holds and what one state covers, remote backends and locking, protecting the secrets state contains, refactoring with moved, import, and removed blocks, and recovering or migrating state safely."
tags: [practical, terraform, opentofu, pulumi, state-locking, security]
---

## What State Records

**State** is a tool's record of the resources it manages. For each resource it maps an address in the code, such as `aws_instance.web`, to the real resource that address created, such as the instance `i-0abc123`. Alongside that link it keeps the attributes the tool last saw, the dependencies between resources, and the output values the code exports.

This guide is about the tools that leave that record for the team to look after: [Terraform](https://developer.hashicorp.com/terraform/language/state){:target="_blank" rel="noopener noreferrer"} and [OpenTofu](https://opentofu.org/docs/language/state/){:target="_blank" rel="noopener noreferrer"}, which write state as a JSON file, and [Pulumi](https://www.pulumi.com/docs/iac/concepts/state-and-backends/){:target="_blank" rel="noopener noreferrer"}, which keeps an equivalent record. CloudFormation and Bicep keep theirs inside the cloud service.

The record matters because the code alone cannot say which real resource it refers to. If the state is lost, the tool no longer knows it created anything. The next plan proposes creating every resource again, which either fails on names that must be unique or builds a second copy beside the first, while the originals carry on unmanaged. If the state is overwritten with an older or conflicting copy, the tool loses track of whatever was created after that copy was taken.

### What One State Covers

A Terraform or OpenTofu state belongs to one *root module*, the directory where `plan` and `apply` run, in one *workspace*. CLI workspaces let the same code keep several separate states, one per workspace, and each backend stores them under its own naming scheme. The S3 backend, for instance, keeps non-default workspaces at `env:/<workspace>/<key>` by default. Pulumi's unit is the *stack*, one deployed instance of a Pulumi program. A program can have many stacks, such as one per environment, each with its own state.

That scope does more than decide which resources a plan considers. A state is also the unit of locking, so one run blocks every other change to anything in it, and the unit of access, since reading any part of a state means reading all of it. A single state for a whole estate makes plans slow and makes every change wait on every other. How to split infrastructure across several states is a layering decision, and it should be made with those two effects in mind.

---

## Where State Lives

### Local State

With no backend configured, Terraform writes `terraform.tfstate` to the working directory. That is fine for learning and for throwaway experiments, and wrong for anything shared. A second engineer has no copy of it, two people running at once have nothing to stop them, the file disappears with the laptop, and any secrets it holds sit in plain text on a disk.

### Remote Backends

A **backend** stores state somewhere shared, usually an object storage bucket or a hosted service such as HCP Terraform (HashiCorp's hosted platform, formerly Terraform Cloud) or Pulumi Cloud. The common ones differ mainly in how they lock and how they recover:

| Backend | Locking | Recovery |
|---|---|---|
| Amazon S3 (`s3`) | A lock file stored next to the state, enabled with `use_lockfile` | Bucket versioning, which HashiCorp highly recommends |
| Azure Blob Storage (`azurerm`) | Built in, using Blob Storage's own capabilities | The backend's `snapshot` option, which snapshots the state blob before each use, or the storage account's own versioning |
| Google Cloud Storage (`gcs`) | Built in | Object versioning, which HashiCorp highly recommends |
| HCP Terraform | Built in | Keeps every state version |
| Pulumi Cloud | Built in | Keeps every state version |
| Pulumi self-managed backends (S3, Blob Storage, GCS, PostgreSQL, local files) | A basic file-based lock, on by default | Keeps history files in the storage. Backups are the team's job |

The S3 backend used to lock through a separate DynamoDB table. Terraform 1.11 made the S3 lock file generally available and deprecated the DynamoDB arguments, which will be removed in a future minor version. Both can be configured at once while every user moves to a version that supports the lock file. A current [S3 backend](https://developer.hashicorp.com/terraform/language/backend/s3){:target="_blank" rel="noopener noreferrer"} looks like this:

```hcl
terraform {
  backend "s3" {
    bucket       = "example-terraform-state"
    key          = "network/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}
```

In Terraform, the `backend` block cannot refer to variables, because Terraform reads it before evaluating anything else. Values that differ between environments, such as the bucket name, are passed to `terraform init` with `-backend-config` as a *partial configuration* instead. OpenTofu relaxes this and accepts variables and locals in the backend block, provided they can be resolved during `tofu init`. In both, the storage has to exist before the first `init`, so the bucket that holds state is usually created once by hand or by a small separate configuration that keeps its own state locally.

---

## Locking

Terraform locks the state for every operation that could write it. If it cannot get the lock, it stops rather than carrying on. Given `-lock-timeout`, it keeps retrying for that long before returning an error, which suits a pipeline where runs occasionally overlap.

The lock exists because every run reads the state at the start and writes it back at the end. Without one, two applies that start together both read the same record. Each makes its changes and writes back its own version, and whichever finishes last wins. The resources the other run created still exist in the cloud, but they are missing from the record, so the tool has lost track of them. With a lock, the second run fails or waits until the first has written its record, then starts from that record.

{% include figure.html id="infra-state-lock" %}

A lock can outlive the run that took it, when a runner crashes or a pipeline is cancelled mid-apply. Terraform's `force-unlock` command releases it, given the lock ID that a blocked run prints along with the lock's holder. HashiCorp warns that unlocking while someone else holds the lock can produce two writers, so confirm the holder's process is gone before forcing it. Pulumi's equivalent is `pulumi cancel`, which works on Pulumi Cloud and on self-managed backends. Pulumi calls it dangerous, because an update cut off mid-operation can leave the state out of step with the resources, and recommends a `pulumi refresh` afterwards.

---

## Protecting State

### State Holds Secrets in Plain Text

Terraform writes every resource attribute into state, including the ones that are secret: a generated database password, a private key created by the TLS provider, an access key issued to a service account. Marking a variable `sensitive` hides it from displayed output but not from state or saved plan files. Anyone who can read the state can read every one of them.

That reach extends further than it looks. Reading another configuration's outputs through the `terraform_remote_state` data source requires read access to that configuration's whole state, not just the outputs, so it grants every secret along with them.

### Controlling Who Can Read It

Access to the backend should be limited to the identity the pipeline runs as and a small number of administrators. On S3, Terraform needs only these permissions:

- `s3:ListBucket` on the bucket
- `s3:GetObject` and `s3:PutObject` on the state object
- `s3:GetObject`, `s3:PutObject`, and `s3:DeleteObject` on the lock file

Encrypting with a KMS key through `kms_key_id` adds a second gate, since reading the state then also requires permission to decrypt with that key. On Azure, the backend supports Microsoft Entra ID authentication to the storage account, which HashiCorp recommends over storage access keys.

State files also never belong in version control, where every clone and every past commit would keep a copy. A `.gitignore` covering `*.tfstate` and `*.tfstate.*` keeps the local file and its backup out.

### Keeping Secrets Out of the Readable Record

Encryption at rest in the storage service protects against someone stealing the disk, not against someone with read access to the bucket. Some tools go further:

- **OpenTofu** can [encrypt state and plan files](https://opentofu.org/docs/language/state/encryption/){:target="_blank" rel="noopener noreferrer"} on the client before they reach the backend, with a key from a passphrase, AWS KMS, Google Cloud KMS, Azure Key Vault, or OpenBao (an open-source fork of HashiCorp Vault). Anyone with bucket access but not the key sees ciphertext. The key becomes as critical as the state, because losing it loses the state, and encrypting an existing unencrypted state needs a transitional configuration that can still read the old plain copy.
- **Pulumi** [encrypts values marked secret](https://www.pulumi.com/docs/iac/concepts/secrets/){:target="_blank" rel="noopener noreferrer"}, and everything derived from them, with a per-stack key. On Pulumi Cloud the default key is held by the service, and on a self-managed backend the default is a passphrase. A team can choose a cloud KMS key or HashiCorp Vault instead. A resource's physical ID, the provider's own ID such as `i-0abc123`, stays in plain text even when it was built from a secret.
- **Terraform** has no state encryption of its own beyond what the backend provides, but its ephemeral values and write-only arguments keep a value out of state and plan files entirely.

---

## Refactoring Without Rebuilding

State links an *address* to a real resource, so changing the address breaks the link. By default, Terraform reads a renamed resource, or one moved into a module, as one resource deleted and a new one added, and plans to destroy the original and create a replacement. For a database, that is data loss from a change that only reorganized the code.

### Blocks for Each Kind of State Change

Terraform and OpenTofu handle each kind of state change with a block written in the code:

| Change | Block | Older CLI command | Effect on state | Effect on the real resource |
|---|---|---|---|---|
| Rename a resource or move it into a module | `moved` (Terraform 1.1+) | `terraform state mv` | The entry moves to the new address | None |
| Bring an existing resource under management | `import` (1.5+) | `terraform import` | An entry is added for its ID | Updated in place wherever it differs from the code |
| Stop managing a resource but keep it | `removed` with `destroy = false` (1.7+) | `terraform state rm` | The entry is dropped | None, if `destroy = false` is set |

The blocks are the better default because they go through a plan, so the refactoring is reviewed like any other change before it touches state. A `moved` block also sits in the code that every environment's state shares, so each state picks up the rename on its next apply, instead of someone running `state mv` against each one by hand with no record left behind. An `import` block names a specific resource ID, which usually differs per environment, so it tends to be written for one state at a time.

HashiCorp recommends leaving old `moved` blocks in place in a shared module. A caller still on an older version of the module needs them on upgrade, so removing one is a breaking change for that caller.

### `removed` Can Destroy

The two tools disagree on what a bare `removed` block does. In Terraform, `destroy` defaults to `true`, so a `removed` block without `destroy = false` deletes the real resource along with the state entry. In OpenTofu, a `removed` block without a `lifecycle` block only forgets the resource, and OpenTofu warns that the intent is unstated. The same code can therefore destroy a resource under one tool and keep it under the other. In either tool, set `destroy` explicitly so the intent is visible in review.

### Adopting Resources in Bulk

Import has grown past one resource at a time. Given `-generate-config-out`, a plan writes starting `resource` blocks for the imported resources, a feature HashiCorp still marks experimental. Terraform can also search a provider for existing resources in bulk and generate the import blocks. Generated code is a starting point and usually needs rewriting before it is maintainable.

### Moving Resources Between States

Splitting one state into several means moving resources from one state to another without touching them. In Terraform, the usual path pairs a `removed` block with `destroy = false` in the source configuration and an `import` block in the destination, applied in that order.

### Pulumi's Equivalents

Pulumi covers the same ground with different tools. A resource's `aliases` option records its previous names so a rename does not replace it, `pulumi import` adopts existing resources, `pulumi state delete` drops an entry without touching the resource, and `pulumi state move` moves resources from one stack to another.

---

## Recovering and Migrating State

### Restoring an Earlier Version

Bucket versioning, or a hosted service's state history, is the backup. Before any manual state operation or backend change, taking a copy gives a known point to return to. `terraform state pull` prints the current state, and `pulumi stack export` writes a stack's state to a file.

Restoring an old version rolls back the record, not the infrastructure. Anything created after that version was written still exists but is no longer tracked, and anything deleted since is still listed. After a restore, run a plan. With the live resources refreshed against the restored record, the plan shows every mismatch, and each one is resolved by importing, removing, or letting the plan recreate it.

Terraform guards against pushing the wrong file. Every state carries a *lineage*, an ID fixed when the state was first created, and a *serial* that increases on every write. `terraform state push` refuses a file whose lineage differs from the destination's, or whose serial is lower. Its `-force` flag skips both checks and overwrites whatever is there.

### When the Final Write Fails

An apply can change resources and then fail to save the record, because a credential expired or the backend refused the write. Terraform then saves the state it could not upload as `errored.tfstate` in the working directory. Pushing that file with `terraform state push errored.tfstate` restores the record. Running apply again first starts from the stale remote copy and loses track of what the failed run created. On a CI runner that is discarded after each job, the file disappears with the runner unless the pipeline keeps it as an artifact.

### Moving to a Different Backend

In Terraform, changing the `backend` block and running `terraform init -migrate-state` copies the existing state to the new location, including the first move from local state to a remote backend. Pulumi's `pulumi stack migrate` moves a stack between backends and re-encrypts its secrets with the target's secrets provider.

Afterwards, a plan that shows no changes confirms the migrated state matches what is running. The old copy stays where it was, secrets included, until someone deletes it.
