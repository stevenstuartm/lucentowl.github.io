---
title: "AWS KMS & Secrets Manager for System Architects"
layout: guide
category: AWS
subcategory: Security & Compliance
description: "How AWS KMS keys protect data through envelope encryption, key policies, grants, and rotation; how Secrets Manager stores, rotates, replicates, and shares secrets; and when Parameter Store is the better home for a value."
tags: [kms, secrets-manager, parameter-store, key-policies, secrets-rotation, fundamentals]
---

## What KMS and Secrets Manager Do

**AWS Key Management Service (KMS)** creates and holds encryption keys and performs cryptographic operations with them, so the keys themselves never have to leave it. Most AWS services that encrypt data at rest, such as EBS, RDS, and DynamoDB, can do so with a KMS key, and S3 does when a bucket uses SSE-KMS, server-side encryption with a KMS key. Your own code can use the same keys.

**AWS Secrets Manager** stores secrets, such as database passwords, API keys, and OAuth client secrets, encrypts them with KMS, hands them to applications at runtime, and rotates them on a schedule. **Parameter Store**, part of Systems Manager, also stores values, including encrypted ones, and overlaps with Secrets Manager for secrets that don't rotate.

The three answer different questions. KMS decides who can encrypt and decrypt with which key. Secrets Manager and Parameter Store decide where a secret lives, who can read it, and how it changes over time.

---

## KMS

### KMS keys and who manages them

A **KMS key** is a logical key: an ID, an Amazon Resource Name (ARN), optional aliases such as `alias/orders-data`, a key policy that says who may use it, and one or more versions of key material that KMS generates and keeps in hardware security modules. The key material never leaves KMS unencrypted. Older documentation calls these customer master keys, or CMKs, a term AWS has dropped. A key belongs to one Region, and a service encrypting a resource uses a key in that resource's Region.

KMS keys come in three kinds, by who manages them:

| Kind | Who controls it | Cost | Rotation |
| --- | --- | --- | --- |
| **AWS owned key** | An AWS service, invisibly, often shared across accounts | Free | Decided by the service |
| **AWS managed key** | AWS, in your account, with an alias such as `aws/s3`, created when a service first needs one | No monthly fee, request charges apply | Every year, automatically |
| **Customer managed key** | You: the key policy, grants, rotation, and deletion | $1 a month plus requests | Optional, on a schedule you choose |

Many services encrypt with an AWS owned key by default, and some let you choose an AWS managed or customer managed key instead. The customer managed key is the one to choose when you need control: a key policy that names who may use it, access from another account, an audit trail of every use under your own key, or the ability to disable the key so nothing more can be decrypted with it. Disabling doesn't reach data keys already decrypted, so an attached EBS volume, for example, keeps working until it next needs KMS. An AWS managed key's policy can't be edited, so it can't be shared with another account.

Most keys are **symmetric encryption keys**, a single AES-256 key that KMS uses internally. KMS also offers asymmetric keys, for signing or for encryption outside AWS with a downloadable public key, and HMAC keys for message authentication codes.

### Envelope encryption

KMS encrypts at most 4 KB directly, and every call is a network request, so bulk data isn't sent to KMS. Instead, services and SDKs use **envelope encryption**. KMS generates a fresh **data key**, returns it both in plaintext and encrypted under the KMS key, and the caller encrypts the data locally with the plaintext copy, discards it, and stores the encrypted copy next to the data. To read, the caller sends the encrypted data key to KMS's `Decrypt` operation, gets the plaintext data key back, and decrypts locally:

{% include figure.html id="aws-kms-envelope" %}

This is what S3 does behind SSE-KMS, and what EBS and other services do behind their own KMS encryption options. The concept itself is covered in [Cryptography](/study-guides/security/cryptography.html). What matters on AWS is that every `GenerateDataKey` and `Decrypt` is a KMS request, recorded in CloudTrail, AWS's API audit log, checked against the key policy, and counted against the account's request quota. Two features exist to reduce those calls. **S3 Bucket Keys** make S3 generate a bucket-level key from KMS and derive object keys from it, cutting KMS requests for SSE-KMS buckets by up to 99%. The **AWS Encryption SDK** can cache data keys, so application code reuses one data key across several messages.

An **encryption context** is a set of non-secret key-value pairs, such as `{"tenant": "acme"}`, passed with an encrypt request. KMS binds it to the ciphertext, so decryption only succeeds with the same context, and it appears in CloudTrail entries. The key policy, described next, can require a particular context, which lets one key serve many tenants while each role can decrypt only its own tenant's data.

### Key policies, IAM, and grants

Every KMS key has a **key policy**, a policy attached to the key itself that is the starting point for all access to it. Unlike most AWS resources, an IAM policy alone never grants a user or role, a **principal**, access to a KMS key. The key policy must either allow the principal directly or allow the account, which then lets IAM policies in that account grant access. The default key policy does the second:

```json
{
  "Sid": "Enable IAM User Permissions",
  "Effect": "Allow",
  "Principal": { "AWS": "arn:aws:iam::111122223333:root" },
  "Action": "kms:*",
  "Resource": "*"
}
```

`root` here means the account, not the root user. Without such a statement, and without one naming an administrator, a key can become unmanageable, since no one has permission to change its policy. A tighter key policy keeps that account statement or names specific administrator roles, and gives the roles that use the key only the operations they need, such as `kms:Decrypt` and `kms:GenerateDataKey`. Conditions narrow it further:

- `kms:ViaService` limits use to requests that come through a particular service, such as `s3.us-east-1.amazonaws.com`, so a role can decrypt S3 objects but can't call KMS directly with the same key.
- `kms:EncryptionContext:<key>` requires a particular encryption context value.
- `kms:CallerAccount` limits use to principals in named accounts.

**Grants** are a second way to give access. A grant lets a principal use a key for specific operations, can be created and retired through the API without editing the policy, and is how AWS services such as EBS and RDS get temporary use of your key for the resources you create. Grants are eventually consistent, so a new grant usually takes effect within seconds but occasionally takes several minutes. A **grant token**, returned when the grant is created, lets the grantee use it immediately.

Cross-account use of a key needs both sides. The key policy in the owning account must allow the other account or its role, and an IAM policy in the other account must allow the role to use that key's ARN. The key must be a customer managed key.

### Rotation

**Automatic rotation** creates new key material for a customer managed key on a schedule, by default every 365 days and configurable from 90 to 2,560 days. The key's ID, ARN, and policy don't change. New encryptions use the newest material, and KMS keeps every older version to decrypt data encrypted before the rotation, so nothing needs re-encrypting and no code changes. **On-demand rotation** rotates immediately, whether or not a schedule is set. AWS managed keys rotate every year and can't be changed.

Automatic rotation works only for symmetric encryption keys with material that KMS generated. Asymmetric keys, HMAC keys, and keys in custom key stores rotate manually, by creating a new key and moving the alias. Keys with imported material can rotate on demand. The first two rotations of a key each add $1 a month to its price, and later rotations add nothing.

Rotation replaces the key material, not the data keys. Data encrypted under a data key stays encrypted under that data key, and a leaked data key isn't made safe by rotating the KMS key.

### Deleting keys

Deleting a KMS key makes everything encrypted under it permanently unreadable, so KMS requires a waiting period of 7 to 30 days, 30 by default, during which the deletion can be canceled and the key can't be used. Disable a key first and watch for failed requests in CloudTrail before scheduling deletion. An alarm on attempts to use a key pending deletion catches forgotten dependencies before the data is lost.

### Other key options

- **Multi-Region keys** are sets of keys in different Regions that share key material and key ID, so data encrypted in one Region can be decrypted in another without re-encryption. They suit data encrypted client-side, with the AWS Encryption SDK or the AWS Database Encryption SDK, that moves between Regions, and active-active or disaster recovery designs built on it. Most AWS services re-encrypt under a key in the destination Region when they replicate, so they don't need multi-Region keys, and a few features, such as Cognito's multi-Region replication, require them. Single-Region keys remain the default choice, because they keep each Region's data isolated.
- **Imported key material** lets you generate the material yourself and import it, for rules that require keys to originate outside AWS. You're responsible for keeping a copy, since KMS can't regenerate it.
- **Custom key stores** keep the key material outside standard KMS, in an AWS CloudHSM cluster, dedicated hardware security modules that you control, or in an external key manager you run outside AWS. They suit strict regulatory requirements and cost more in money, latency, and availability risk.

### Quotas and cost

Cryptographic operations with symmetric keys share one request quota per account and Region: 10,000 requests per second by default, 20,000 in some Regions, and 100,000 in US East (N. Virginia), US West (Oregon), and Europe (Ireland). Requests that services make on your behalf, such as S3 calling `Decrypt` for every SSE-KMS object read, count against it too, and so does use of AWS managed keys. AWS owned keys don't count. The quotas are adjustable.

A customer managed key costs $1 a month, and requests cost $0.03 per 10,000 for symmetric keys, with 20,000 free requests a month across all Regions. Requests with asymmetric keys cost more. For a busy application, the request charge and the quota matter more than the key count, which is why caching data keys and enabling S3 Bucket Keys pay off.

---

## Secrets Manager

### Storing and retrieving secrets

A **secret** holds a value of up to 64 KB, usually a JSON document such as a database's host, port, username, and password, encrypted with a KMS key of your choice or the `aws/secretsmanager` AWS managed key. Each change creates a new **version**, and **staging labels** mark which version is which: `AWSCURRENT` is the one applications read, `AWSPREVIOUS` is the one before it, and `AWSPENDING` is a new value during rotation.

Applications read the secret at runtime with `GetSecretValue`, or several at once with `BatchGetSecretValue`, rather than keeping it in code, configuration files, or environment variables. Every call costs money and adds latency, so applications should cache secrets and refresh them periodically. AWS provides caching libraries for .NET, Java, Python, Go, and Rust, a Lambda extension, and the **AWS Workload Credentials Provider**, formerly the Secrets Manager Agent, a local HTTP service that caches secrets for any code on the host. In .NET:

```csharp
using Amazon.SecretsManager.Extensions.Caching;

public class OrdersDatabase
{
    // Refreshes each cached secret every hour by default.
    private static readonly SecretsManagerCache Cache = new();

    public async Task<string> GetConnectionSecretAsync() =>
        await Cache.GetSecretString("prod/orders/db");
}
```

Many services read secrets directly, which keeps them out of application code altogether. ECS injects secrets into containers as environment variables when a task starts, CloudFormation templates can reference them, and EKS mounts them into pods as files through the Secrets Store CSI driver. RDS and Aurora can create the database's administrative password, its master user password, and manage it in Secrets Manager themselves.

### Rotation

**Rotation** changes a secret's value in both Secrets Manager and the system that checks it, on a schedule as frequent as every four hours, at some point within a window of time you set. There are three ways it happens:

- **Managed rotation**, for secrets that another AWS service manages, such as an RDS master user password. The service rotates the secret itself, with no function to write.
- **Managed external secrets**, for secrets held with software vendors that partner with Secrets Manager, such as Salesforce. Secrets Manager calls the partner's system to rotate the credential.
- **Rotation by Lambda function** for everything else. AWS provides template functions for RDS, Aurora, Redshift, and DocumentDB, and you write one for other systems.

A rotation function runs four steps. `createSecret` generates the new value and stores it as `AWSPENDING`, `setSecret` changes the credential in the target system, `testSecret` checks that the new value works, and `finishSecret` moves `AWSCURRENT` to the new version. If a step fails, `AWSCURRENT` stays where it was. The function needs a network path to both the target system and the Secrets Manager endpoint, which for a database in a private subnet means a VPC endpoint or NAT gateway, and a missing path is a common reason rotation fails.

For databases, the rotation strategy decides what happens to clients that hold the old password:

- **Single user** changes one user's password. Connections already open keep working, but a client that opens a new connection with a cached old password fails until it refreshes its cache. AWS considers it appropriate for most cases.
- **Alternating users** keeps two users with the same permissions and rotates whichever isn't current, so the previous credentials still work until the next rotation. It needs a separate secret with permission to change both users' passwords, and the two users' permissions have to be kept identical.

Applications should connect as a least-privilege user of their own rather than the database's master user, even when RDS manages the master password.

Clients should handle an authentication failure by refreshing the secret from Secrets Manager and retrying once, which covers both strategies and manual rotations.

### Replication and cross-account access

A secret belongs to one Region. It can be **replicated** to others, where each replica stays in sync with the primary, is encrypted with a KMS key in its own Region, and can be promoted to a standalone secret during a regional outage. Each replica is billed as a secret.

Reading a secret from another account needs three permissions: a **resource policy** on the secret allowing the other account, a key policy allowing it to decrypt with the secret's KMS key, and an IAM policy in the other account allowing the role `secretsmanager:GetSecretValue` and `kms:Decrypt`. Because the AWS managed `aws/secretsmanager` key can't be shared, such a secret must use a customer managed key.

### Cost

A secret costs $0.40 a month, including each replica, and API calls cost $0.05 per 10,000. Rotation creates new versions at no extra charge, but a rotation function's Lambda and KMS usage is billed by those services. Caching keeps the call charge small, while uncached reads in a busy application can cost more than the secrets themselves.

---

## Parameter Store or Secrets Manager

Parameter Store holds configuration values as plain strings, lists, or **SecureStrings**, which it encrypts with a KMS key. Its two storage tiers differ in size and cost:

| | Parameter Store standard | Parameter Store advanced | Secrets Manager |
| --- | --- | --- | --- |
| Maximum value | 4 KB | 8 KB | 64 KB |
| Storage cost | Free, up to 10,000 parameters | $0.05 per parameter per month | $0.40 per secret per month |
| API cost | Free at the default request rate, charged at higher throughput | $0.05 per 10,000 interactions | $0.05 per 10,000 calls |
| Rotation | No | No, but parameter policies can expire a value or notify before it expires | Built in |
| Cross-account | No | Sharing through AWS Resource Access Manager | Resource policies |
| Cross-Region replication | No | No | Built in |

Use Secrets Manager for credentials that should rotate, secrets shared across accounts or replicated across Regions, and anything that fits its integrations, such as database credentials managed by RDS. Use Parameter Store for configuration, such as endpoints, feature flags, and tuning values, and for secrets that don't rotate, where standard SecureString parameters cost nothing in Parameter Store itself, only KMS's request charges. Applications that read everything through Parameter Store can reach Secrets Manager secrets through it too, with names under `/aws/reference/secretsmanager/`.

---

## Common Pitfalls

- **Throttling from services acting for you.** A job that reads millions of SSE-KMS objects makes millions of `Decrypt` calls against the account's quota, and every other application using KMS in that Region gets throttled with it. Turn on S3 Bucket Keys, and request a quota increase before large batch jobs.
- **Secret values copied at deploy time.** A secret pasted into a Lambda environment variable or a configuration file when the application deploys is visible to anyone who can read that configuration, and goes stale at the first rotation. Read it at runtime, or through a service integration that fetches it when the task starts.
- **Rotation turned on before clients can handle it.** Clients that read a secret once at startup and never refresh break at the first rotation. Make them refresh and retry on an authentication failure first.
- **Cached secrets without invalidation.** Caching libraries and the Workload Credentials Provider refresh on a timer, not when the secret rotates, so a client can hold an old value for up to the cache's lifetime. The refresh-on-failure path covers that window.

---

## Key Takeaways

- KMS keys never leave KMS. Services and SDKs use envelope encryption, asking KMS for data keys, and every such request is logged, authorized by the key policy, and counted against a per-Region quota.
- Use customer managed keys where you need control over the key policy, cross-account use, or the ability to cut off access. AWS managed keys rotate yearly but can't be shared.
- A key policy must allow access before any IAM policy can. Narrow use with `kms:ViaService` and encryption context conditions.
- Automatic rotation is transparent and free after the second rotation. It doesn't rotate data keys or re-encrypt data.
- Store secrets in Secrets Manager, read them at runtime with caching, and let services such as ECS and RDS handle them where they can.
- Rotate with managed rotation where available, choose alternating users for databases that can't tolerate failed logins, and make clients refresh on authentication failure.
- Use Parameter Store for configuration and non-rotating secrets, and Secrets Manager for rotating, shared, or replicated secrets.
