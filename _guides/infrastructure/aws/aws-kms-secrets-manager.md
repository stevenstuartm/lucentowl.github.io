---
title: "AWS KMS & Secrets Manager for System Architects"
layout: guide
category: AWS
subcategory: Security & Compliance
description: "Comprehensive guide to AWS KMS and Secrets Manager covering encryption key management, automatic secret rotation, envelope encryption, Parameter Store comparison, and cost optimization for data protection"
tags: [aws, kms, secrets-manager, encryption, key-management, security, secrets-rotation, parameter-store, fundamentals]
---

## What Problems KMS & Secrets Manager Solve

### Without Centralized Key and Secret Management

**Security Challenges:**
- Database passwords hardcoded in application code (committed to Git)
- Encryption keys stored in plaintext configuration files
- No audit trail for who accessed which secrets when
- Manual secret rotation requires deploying updated code
- Secrets shared via email, Slack, sticky notes
- No separation of duties (developers have production secrets)
- Compliance violations (HIPAA, PCI-DSS require encrypted data at rest)

**Real-World Impact:**
- Hardcoded RDS password in GitHub repo; repo made public; database compromised within 3 hours
- API keys for payment gateway stolen; $100K fraudulent charges before detection
- No secret rotation for 3 years; ex-employee still has access to production database
- Compliance audit failure: Customer data stored unencrypted in S3; $500K fine
- Developer laptop stolen with plaintext AWS access keys; attacker launches EC2 instances for cryptocurrency mining
- Manual secret rotation takes 6 hours; requires coordinated deployment across 50 services; done once per year due to complexity

### With KMS & Secrets Manager

**Automated Encryption and Secret Management:**

**AWS KMS (Key Management Service):**
- **Centralized key management**: Create, rotate, disable, audit encryption keys
- **Envelope encryption**: Encrypt data keys with master keys without exposing master keys
- **Integrated with AWS services**: S3, EBS, RDS, DynamoDB automatically use KMS
- **Hardware security modules**: FIPS 140-2 Level 2 validated, Level 3 for CloudHSM
- **Audit trail**: CloudTrail logs every key usage

**AWS Secrets Manager:**
- **Centralized secret storage**: Database passwords, API keys, OAuth tokens
- **Automatic rotation**: Lambda function rotates secrets on schedule every 30, 60, or 90 days
- **Versioning**: Track secret changes over time with rollback capability
- **Fine-grained access control**: IAM policies control who can retrieve secrets
- **Encrypted at rest**: All secrets encrypted with KMS keys

**Problem-Solution Mapping:**

| Problem | KMS Solution | Secrets Manager Solution |
|---------|-------------|--------------------------|
| Hardcoded passwords | N/A | Store secrets in Secrets Manager and retrieve at runtime |
| Encryption keys in plaintext | Store keys in KMS where keys never leave HSM | N/A |
| No audit trail for key/secret access | CloudTrail logs all KMS API calls | CloudTrail logs all secret retrievals |
| Manual secret rotation | Automatic key rotation every 365 days | Automatic secret rotation every 30-365 days with Lambda |
| Secrets shared insecurely | N/A | IAM-based access control where secrets never exposed |
| Ex-employee retains access | Disable key making all encrypted data inaccessible | Rotate secret making old credentials invalid |
| Unencrypted data causing compliance violation | Enable encryption with KMS for S3, RDS, EBS | N/A |

---

## AWS KMS Fundamentals

### What is AWS KMS?

**AWS Key Management Service (KMS)** is a managed service for creating and controlling encryption keys.

<div class="callout callout--note">
<p class="callout__title">Core Concept</p>
<p>KMS creates and stores Customer Master Keys (CMKs). You use CMKs to encrypt and decrypt data. CMKs never leave AWS HSMs unencrypted.</p>
</div>

### Key Types

**1. AWS Managed Keys**

- **Created automatically** by AWS services (S3, RDS, EBS)
- **Key alias**: `aws/s3`, `aws/rds`, `aws/ebs`
- **Free** (no monthly charge)
- **Automatic rotation**: Every 3 years (1,095 days)
- **Use case**: Default encryption for AWS services

**2. Customer Managed Keys (CMKs)**

- **You create and manage**
- **Full control**: Key policies, grants, rotation schedule, enable/disable
- **Cost**: $1/month per key + $0.03 per 10,000 requests
- **Rotation**: Optional automatic rotation (365 days) or manual
- **Use case**: Custom encryption, cross-account access, compliance requirements

**3. AWS Owned Keys**

- **Owned by AWS** (not in your account)
- **No visibility or control**
- **Free**
- **Use case**: DynamoDB default encryption, S3 default encryption (SSE-S3)

**Key Type Comparison:**

| Feature | AWS Managed | Customer Managed | AWS Owned |
|---------|-------------|------------------|-----------|
| **Who creates** | AWS service | You | AWS |
| **Visibility** | View in KMS console | Full control | No visibility |
| **Cost** | Free | $1/month + usage | Free |
| **Rotation** | Automatic (3 years) | Optional (1 year) | N/A |
| **Key policy** | AWS-managed | You control | N/A |
| **Cross-account** | No | Yes | No |

### CMK Components

**Customer Master Key (CMK)** contains:
1. **Key ID**: Unique identifier (e.g., `12345678-1234-1234-1234-123456789012`)
2. **Key ARN**: `arn:aws:kms:us-east-1:123456789012:key/12345678-...`
3. **Alias**: Human-friendly name (e.g., `alias/database-encryption-key`)
4. **Key material**: Actual encryption key (stored in HSM, never exposed)
5. **Key policy**: JSON document defining who can use the key
6. **Key state**: Enabled, Disabled, PendingDeletion, PendingImport

**Create CMK:**

```bash
aws kms create-key \
  --description "Production database encryption key" \
  --key-usage ENCRYPT_DECRYPT \
  --origin AWS_KMS
```

**Create Alias:**

```bash
aws kms create-alias \
  --alias-name alias/prod-db-key \
  --target-key-id 12345678-1234-1234-1234-123456789012
```

### Key Rotation

**Automatic Rotation (Customer Managed Keys):**
- Enable via console or API
- Rotates key material every 365 days
- Old key material retained for decryption (transparent to applications)
- Cost: No additional charge

**Enable Rotation:**

```bash
aws kms enable-key-rotation \
  --key-id 12345678-1234-1234-1234-123456789012
```

**How Rotation Works:**

```
Year 1: CMK uses key material version 1
Year 2: CMK automatically generates key material version 2
  - New encryptions use version 2
  - Old encrypted data still decryptable with version 1
  - Application code unchanged (KMS handles version selection)
```

**Manual Rotation:**
- Create new CMK
- Update application to use new key
- Re-encrypt data with new key
- Delete old key after retention period

---

## AWS Secrets Manager Fundamentals

### What is Secrets Manager?

**AWS Secrets Manager** is a managed service for storing, retrieving, and rotating secrets (passwords, API keys, credentials).

<div class="callout callout--tip">
<p class="callout__title">Core Concept</p>
<p>Store secrets in Secrets Manager. Applications retrieve secrets at runtime via API. Secrets automatically rotate on schedule.</p>
</div>

### Secret Types

**1. Database Credentials**

- RDS, Aurora, Redshift, DocumentDB
- Automatic rotation with Lambda function
- Secrets Manager updates database password and secret simultaneously

**2. API Keys and Tokens**

- Third-party API keys (Stripe, Twilio, SendGrid)
- OAuth tokens
- Manual rotation or custom Lambda function

**3. SSH Keys**

- Private SSH keys for EC2 access
- Manual rotation

**4. Custom Secrets**

- Any JSON document (up to 65,536 bytes)
- Custom rotation logic via Lambda

### Secret Structure

**Secret JSON:**

```json
{
  "username": "admin",
  "password": "SuperSecret123!",
  "engine": "mysql",
  "host": "mydb.us-east-1.rds.amazonaws.com",
  "port": 3306,
  "dbname": "production"
}
```

**Create Secret:**

```bash
aws secretsmanager create-secret \
  --name production/database/credentials \
  --description "Production RDS MySQL credentials" \
  --secret-string '{
    "username":"admin",
    "password":"SuperSecret123!",
    "host":"mydb.us-east-1.rds.amazonaws.com"
  }'
```

### Retrieving Secrets

**Retrieve Secret (Application Code):**

```python
import boto3
import json

def get_secret():
    client = boto3.client('secretsmanager', region_name='us-east-1')

    response = client.get_secret_value(SecretId='production/database/credentials')
    secret = json.loads(response['SecretString'])

    return {
        'username': secret['username'],
        'password': secret['password'],
        'host': secret['host']
    }

# Use in database connection
secret = get_secret()
conn = mysql.connector.connect(
    host=secret['host'],
    user=secret['username'],
    password=secret['password']
)
```

**Best Practice:** Retrieve secret once at startup and cache for application lifetime, not per-request.

### Secret Versioning

**Secrets Manager maintains versions:**
- `AWSCURRENT`: Current active secret
- `AWSPENDING`: New secret being rotated (not yet active)
- `AWSPREVIOUS`: Previous secret (after rotation completes)

**Version Stages:**

```
Day 0: Secret created
  AWSCURRENT → Version 1

Day 30: Rotation begins
  AWSCURRENT → Version 1
  AWSPENDING → Version 2 (rotation Lambda testing new password)

Day 30 + 5 minutes: Rotation completes
  AWSCURRENT → Version 2
  AWSPREVIOUS → Version 1
```

**Retrieve Specific Version:**

```python
response = client.get_secret_value(
    SecretId='production/database/credentials',
    VersionStage='AWSPREVIOUS'  # Get previous version
)
```

---

## Secrets Manager vs Parameter Store

### Service Comparison

| Feature | Secrets Manager | Parameter Store (Standard) | Parameter Store (Advanced) |
|---------|----------------|---------------------------|---------------------------|
| **Purpose** | Secrets storage + rotation | Configuration management | Configuration + secrets |
| **Automatic Rotation** | Yes (built-in Lambda for RDS) | No | No |
| **Pricing** | $0.40 per secret per month + $0.05 per 10K API calls | Free | $0.05 per advanced parameter per month |
| **Secret Size** | Up to 65,536 bytes | Up to 4 KB | Up to 8 KB |
| **Versioning** | Yes (AWSCURRENT, AWSPENDING, AWSPREVIOUS) | Yes (up to 100 versions) | Yes (up to 100 versions) |
| **Cross-Account** | Yes (resource policy) | No (use cross-account IAM roles) | No |
| **Encryption** | KMS (required) | KMS (optional) | KMS (optional) |
| **Parameter Policies** | No | No | Yes (expiration, change notification) |

### When to Use Secrets Manager

✅ **Use Secrets Manager when:**
- Need automatic secret rotation (RDS, Aurora, Redshift)
- Storing database credentials
- Require cross-account secret access
- Compliance requires automatic rotation (PCI-DSS, HIPAA)
- Need secret versioning with staging labels

**Examples:**
- RDS database password (automatic rotation every 30 days)
- OAuth tokens requiring rotation
- Shared secrets across multiple AWS accounts

### When to Use Parameter Store

✅ **Use Parameter Store when:**
- Storing configuration (not secrets requiring rotation)
- Cost-sensitive (free tier available)
- Secrets don't need automatic rotation
- Application configuration parameters (feature flags, environment variables)

**Examples:**
- Application configuration (API endpoint URLs, feature flags)
- Static secrets (API keys changed manually)
- Non-sensitive configuration data

### Hybrid Approach

**Store configuration in Parameter Store; secrets in Secrets Manager:**

```python
import boto3

ssm = boto3.client('ssm')
secrets = boto3.client('secretsmanager')

# Configuration from Parameter Store (free)
config = ssm.get_parameter(Name='/app/config/api_endpoint')
api_url = config['Parameter']['Value']

# Secret from Secrets Manager (automatic rotation)
secret = secrets.get_secret_value(SecretId='production/api/key')
api_key = json.loads(secret['SecretString'])['api_key']

# Use both
response = requests.get(api_url, headers={'Authorization': f'Bearer {api_key}'})
```

---

## Envelope Encryption

### What is Envelope Encryption?

**Envelope Encryption:** Encrypt data with a data key; encrypt the data key with a master key.

**Why:** The master key never leaves KMS, only encrypted data keys are transmitted. This improves performance since you encrypt large data locally, not via network.

**Architecture:**

```
1. Request data key from KMS (GenerateDataKey API)
2. KMS returns:
   - Plaintext data key (use to encrypt data)
   - Encrypted data key (store with encrypted data)
3. Encrypt data with plaintext data key
4. Discard plaintext data key from memory
5. Store encrypted data + encrypted data key

Decryption:
1. Send encrypted data key to KMS (Decrypt API)
2. KMS returns plaintext data key
3. Decrypt data with plaintext data key
4. Discard plaintext data key from memory
```

### Example: Envelope Encryption

**Encrypt File:**

```python
import boto3
from cryptography.fernet import Fernet

kms = boto3.client('kms')

# 1. Generate data key from KMS
response = kms.generate_data_key(
    KeyId='alias/prod-encryption-key',
    KeySpec='AES_256'
)

plaintext_data_key = response['Plaintext']
encrypted_data_key = response['CiphertextBlob']

# 2. Encrypt data with plaintext data key
file_data = open('sensitive_data.txt', 'rb').read()
cipher = Fernet(plaintext_data_key)
encrypted_data = cipher.encrypt(file_data)

# 3. Store encrypted data + encrypted data key
with open('sensitive_data.txt.encrypted', 'wb') as f:
    f.write(encrypted_data_key)  # First, store encrypted data key
    f.write(encrypted_data)      # Then, store encrypted data

# 4. Discard plaintext data key
del plaintext_data_key
```

**Decrypt File:**

```python
# 1. Read encrypted data key and encrypted data
with open('sensitive_data.txt.encrypted', 'rb') as f:
    encrypted_data_key = f.read(512)  # Encrypted data key is fixed size
    encrypted_data = f.read()

# 2. Decrypt data key with KMS
response = kms.decrypt(CiphertextBlob=encrypted_data_key)
plaintext_data_key = response['Plaintext']

# 3. Decrypt data with plaintext data key
cipher = Fernet(plaintext_data_key)
decrypted_data = cipher.decrypt(encrypted_data)

# 4. Discard plaintext data key
del plaintext_data_key
```

**Benefits:**
- Master key never exposed
- Encrypt/decrypt large files without network latency (only data key sent to KMS)
- Performance: Local encryption with data key faster than KMS API calls

---

## Key Policies and Grants

### Key Policies

**Key Policy:** JSON document controlling access to CMK.

**Default Key Policy (Created by Root User):**

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "Enable IAM policies",
    "Effect": "Allow",
    "Principal": {
      "AWS": "arn:aws:iam::123456789012:root"
    },
    "Action": "kms:*",
    "Resource": "*"
  }]
}
```

**Custom Key Policy (Principle of Least Privilege):**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "Allow administrators to manage key",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::123456789012:role/KeyAdministrator"
      },
      "Action": [
        "kms:Create*",
        "kms:Describe*",
        "kms:Enable*",
        "kms:List*",
        "kms:Put*",
        "kms:Update*",
        "kms:Revoke*",
        "kms:Disable*",
        "kms:Get*",
        "kms:Delete*",
        "kms:ScheduleKeyDeletion",
        "kms:CancelKeyDeletion"
      ],
      "Resource": "*"
    },
    {
      "Sid": "Allow use of key for encryption",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::123456789012:role/ApplicationRole"
      },
      "Action": [
        "kms:Encrypt",
        "kms:Decrypt",
        "kms:ReEncrypt*",
        "kms:GenerateDataKey*",
        "kms:DescribeKey"
      ],
      "Resource": "*"
    }
  ]
}
```

**Key Policy vs IAM Policy:**

- **Key Policy**: Attached to CMK; controls access to specific key
- **IAM Policy**: Attached to IAM principal; controls what keys principal can use

**Both Required:** Key policy must allow principal; IAM policy must allow action.

### KMS Grants

**Grant:** Programmatic, temporary permission to use CMK.

**Use Case:** Allow AWS service (Lambda, S3) to use your CMK without modifying key policy.

**Create Grant:**

```bash
aws kms create-grant \
  --key-id 12345678-1234-1234-1234-123456789012 \
  --grantee-principal arn:aws:iam::123456789012:role/LambdaExecutionRole \
  --operations Encrypt Decrypt GenerateDataKey
```

**Grant vs Key Policy:**
- **Grant**: Temporary, programmatic, can be revoked
- **Key Policy**: Permanent (until changed), declarative

---

## Automatic Secret Rotation

### Rotation for RDS/Aurora

**Secrets Manager Automatic Rotation:**

**Setup:**

```bash
aws secretsmanager rotate-secret \
  --secret-id production/database/credentials \
  --rotation-lambda-arn arn:aws:lambda:us-east-1:123456789012:function:SecretsManagerRDSRotation \
  --rotation-rules AutomaticallyAfterDays=30
```

**Rotation Lambda (AWS-Provided):**
- `createSecret`: Generate new password
- `setSecret`: Update RDS database password
- `testSecret`: Test new password works
- `finishSecret`: Mark secret as `AWSCURRENT`

**Rotation Workflow:**

```
Day 0: Current password = "OldPassword123"
  Version 1 (AWSCURRENT)

Day 30: Rotation begins
  1. Lambda creates new password: "NewPassword456" (Version 2, AWSPENDING)
  2. Lambda updates RDS: ALTER USER admin IDENTIFIED BY 'NewPassword456'
  3. Lambda tests connection with new password
  4. Lambda marks Version 2 as AWSCURRENT
  5. Version 1 becomes AWSPREVIOUS

Application behavior:
  - Applications always retrieve AWSCURRENT
  - No downtime (new password tested before activation)
  - Rollback possible (revert to AWSPREVIOUS if needed)
```

### Custom Rotation (API Keys)

**Custom Lambda Function:**

```python
import boto3
import requests

def lambda_handler(event, context):
    secret_id = event['SecretId']
    token = event['ClientRequestToken']
    step = event['Step']

    secrets = boto3.client('secretsmanager')

    if step == 'createSecret':
        # Generate new API key from third-party service
        response = requests.post('https://api.example.com/keys/rotate')
        new_api_key = response.json()['api_key']

        # Store new key as AWSPENDING
        secrets.put_secret_value(
            SecretId=secret_id,
            ClientRequestToken=token,
            SecretString=new_api_key,
            VersionStages=['AWSPENDING']
        )

    elif step == 'setSecret':
        # No action needed (API already updated)
        pass

    elif step == 'testSecret':
        # Test new API key works
        secret = secrets.get_secret_value(
            SecretId=secret_id,
            VersionStage='AWSPENDING'
        )
        api_key = secret['SecretString']

        # Test API call
        response = requests.get(
            'https://api.example.com/test',
            headers={'Authorization': f'Bearer {api_key}'}
        )
        if response.status_code != 200:
            raise Exception('API key test failed')

    elif step == 'finishSecret':
        # Mark new version as AWSCURRENT
        secrets.update_secret_version_stage(
            SecretId=secret_id,
            VersionStage='AWSCURRENT',
            MoveToVersionId=token,
            RemoveFromVersionId=<previous_version_id>
        )
```

**Configure Rotation:**

```bash
aws secretsmanager rotate-secret \
  --secret-id production/api/key \
  --rotation-lambda-arn arn:aws:lambda:...:function:CustomAPIRotation \
  --rotation-rules AutomaticallyAfterDays=60
```

---

## Cross-Account Access

### Cross-Account Secret Access

**Use Case:** Central security account stores secrets; application accounts retrieve them.

**Setup:**

**1. Secret in Account A (111111111111):**

```bash
aws secretsmanager put-resource-policy \
  --secret-id production/database/credentials \
  --resource-policy '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::222222222222:role/ApplicationRole"
      },
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "*"
    }]
  }'
```

**2. IAM Role in Account B (222222222222):**

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "secretsmanager:GetSecretValue",
    "Resource": "arn:aws:secretsmanager:us-east-1:111111111111:secret:production/database/credentials-*"
  }]
}
```

**3. Retrieve Secret from Account B:**

```python
# Application in Account B
secrets = boto3.client('secretsmanager')

response = secrets.get_secret_value(
    SecretId='arn:aws:secretsmanager:us-east-1:111111111111:secret:production/database/credentials-abc123'
)
```

### Cross-Account KMS Access

**CMK in Account A; used by Account B:**

**1. Key Policy in Account A:**

```json
{
  "Sid": "Allow Account B to use key",
  "Effect": "Allow",
  "Principal": {
    "AWS": "arn:aws:iam::222222222222:root"
  },
  "Action": [
    "kms:Decrypt",
    "kms:DescribeKey"
  ],
  "Resource": "*"
}
```

**2. IAM Policy in Account B:**

```json
{
  "Effect": "Allow",
  "Action": [
    "kms:Decrypt",
    "kms:DescribeKey"
  ],
  "Resource": "arn:aws:kms:us-east-1:111111111111:key/12345678-1234-1234-1234-123456789012"
}
```

---

## Integration with AWS Services

### S3 + KMS

**Server-Side Encryption with KMS (SSE-KMS):**

```bash
# Enable default encryption with CMK
aws s3api put-bucket-encryption \
  --bucket my-bucket \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "aws:kms",
        "KMSMasterKeyID": "arn:aws:kms:us-east-1:123456789012:key/12345678-..."
      }
    }]
  }'

# Upload object (automatically encrypted)
aws s3 cp sensitive_data.txt s3://my-bucket/
```

**Benefit:** All objects encrypted at rest; key managed by KMS; audit trail in CloudTrail.

---

### RDS + KMS

**Enable Encryption at Rest:**

```bash
aws rds create-db-instance \
  --db-instance-identifier production-db \
  --storage-encrypted \
  --kms-key-id arn:aws:kms:us-east-1:123456789012:key/12345678-...
```

**Encrypted Snapshots:**
- Manual snapshots of encrypted DB encrypted with same key
- Automated backups encrypted with same key

---

### Lambda + Secrets Manager

**Retrieve Secret in Lambda:**

```python
import boto3
import json
import os

secrets_client = boto3.client('secretsmanager')

def lambda_handler(event, context):
    # Retrieve secret
    secret_arn = os.environ['DB_SECRET_ARN']
    secret = secrets_client.get_secret_value(SecretId=secret_arn)
    credentials = json.loads(secret['SecretString'])

    # Use credentials
    db_password = credentials['password']
```

**Best Practice:** Cache secret for Lambda container lifetime (not per-invocation):

```python
# Cache secret outside handler
secret = None

def get_secret():
    global secret
    if secret is None:
        response = secrets_client.get_secret_value(SecretId=os.environ['DB_SECRET_ARN'])
        secret = json.loads(response['SecretString'])
    return secret

def lambda_handler(event, context):
    credentials = get_secret()  # Cached after first invocation
```

---

## Cost Optimization Strategies

### KMS Pricing (us-east-1, 2025)

**Customer Managed Keys:**
- $1.00 per CMK per month
- $0.03 per 10,000 requests (Encrypt, Decrypt, GenerateDataKey)

**AWS Managed Keys:**
- Free (no monthly charge)
- $0.03 per 10,000 requests

**Free Tier:**
- 20,000 requests per month free (across all keys)

### Secrets Manager Pricing

- $0.40 per secret per month
- $0.05 per 10,000 API calls

### Parameter Store Pricing

**Standard Parameters:**
- Free (up to 10,000 parameters)
- Free API calls

**Advanced Parameters:**
- $0.05 per parameter per month
- Free API calls

### 1. Use Parameter Store for Non-Rotated Secrets

**Problem:** Storing 100 static API keys in Secrets Manager.

**Cost (Secrets Manager):**

```
100 secrets × $0.40 = $40/month
```

**Cost (Parameter Store):**

```
100 standard parameters = $0/month
```

**Savings: $40/month (100%)**

**When to Use Secrets Manager:** Only for secrets requiring automatic rotation.

---

### 2. Reuse CMKs Across Services

**Problem:** Creating separate CMK for each service.

**Without Reuse:**

```
CMK for S3: $1/month
CMK for RDS: $1/month
CMK for EBS: $1/month

Total: $3/month
```

**With Reuse (Single CMK):**

```
CMK for all services: $1/month

Savings: $2/month (67%)
```

**Best Practice:** One CMK per environment (e.g., `prod-encryption-key`) used across all services.

---

### 3. Cache Secrets in Application

**Problem:** Application retrieves secret on every request.

**Without Caching:**

```
1M requests/day
1M Secrets Manager API calls/day = 30M/month
Cost: 30M × $0.05/10K = $150/month
```

**With Caching (Retrieve Once per Hour):**

```
24 retrievals/day = 720/month
Cost: 720 × $0.05/10K = $0.004/month

Savings: $150/month (99.9%)
```

**Best Practice:** Cache secret for container/process lifetime; refresh every 1-24 hours.

---

### 4. Use AWS Managed Keys for Default Encryption

**Problem:** Creating CMK for S3 default encryption when AWS managed key sufficient.

**Customer Managed Key:**

```
CMK cost: $1/month
Use case: No cross-account access, no custom key policy needed
```

**AWS Managed Key (`aws/s3`):**

```
Cost: $0/month (free)
Same functionality for single-account S3 encryption
```

**Savings: $1/month**

**Use CMK Only When:** Need cross-account access, custom key policy, or compliance requires customer-managed keys.

---

### Cost Example: Production Application

**Scenario:**
- 10 secrets in Secrets Manager (RDS passwords, API keys)
- 1 CMK for encryption
- 1M secret retrievals/month (cached)
- 100K KMS requests/month

**Secrets Manager:**

```
Secrets: 10 × $0.40 = $4.00/month
API calls: (1M / 10K) × $0.05 = $5.00/month

Total: $9.00/month
```

**KMS:**

```
CMK: $1.00/month
Requests: (100K - 20K free) / 10K × $0.03 = $0.24/month

Total: $1.24/month
```

**Total Cost: $10.24/month for secure secret management**

**ROI:** Prevents hardcoded secrets, provides automatic rotation and compliance, and is far lower cost than a security breach.

---

## Performance and Scalability

### KMS Throughput

**Request Limits:**
- Shared quota: 5,500 requests/sec (us-east-1, us-west-2)
- Other regions: 1,200 requests/sec
- Request limit increase: Available via AWS Support

**Latency:**
- GenerateDataKey: 10-50 ms
- Decrypt: 10-50 ms
- Encrypt: 10-50 ms

**Best Practice:** Use envelope encryption (encrypt locally with data key, not KMS API per-record).

### Secrets Manager Throughput

**No Hard Limits:**
- Scales automatically
- Typical latency: 50-200 ms

**Best Practice:** Cache secrets; don't retrieve on every request.

---

## Security Best Practices

### 1. Enable Key Rotation

```bash
aws kms enable-key-rotation --key-id <key-id>
```

**Benefit:** Automatic annual rotation; reduces risk of key compromise.

---

### 2. Use Separate Keys per Environment

```
Development: dev-encryption-key
Staging: staging-encryption-key
Production: prod-encryption-key
```

**Benefit:** Compromise of dev key doesn't affect production.

---

### 3. Principle of Least Privilege

**Key Policy:**

```json
{
  "Sid": "Allow decrypt only",
  "Effect": "Allow",
  "Principal": {
    "AWS": "arn:aws:iam::123456789012:role/ReadOnlyRole"
  },
  "Action": "kms:Decrypt",
  "Resource": "*"
}
```

**Deny Encrypt:** Read-only applications should only decrypt, not encrypt.

---

### 4. Monitor Key Usage

**CloudWatch Alarm (Unusual Key Usage):**

```
Metric: KMS API Calls (custom metric from CloudTrail)
Threshold: >10,000 requests in 5 minutes
Action: Alert security team
```

---

### 5. Use VPC Endpoints for KMS

**Keep traffic private:**

```
Application in VPC → VPC Endpoint → KMS (private connection)
```

**Benefit:** No internet gateway; reduced attack surface.

---

## Observability and Monitoring

### CloudTrail Logging

**All KMS API calls logged:**

```json
{
  "eventName": "Decrypt",
  "userIdentity": {
    "arn": "arn:aws:iam::123456789012:role/ApplicationRole"
  },
  "requestParameters": {
    "encryptionContext": {
      "application": "payment-processor",
      "environment": "production"
    }
  },
  "responseElements": null,
  "resources": [{
    "ARN": "arn:aws:kms:us-east-1:123456789012:key/12345678-..."
  }]
}
```

**Audit Questions:**
- Who decrypted production database encryption key?
- How many times was API key retrieved today?
- Which keys were deleted?

---

### CloudWatch Metrics

**Custom Metrics (from CloudTrail):**

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| KMS Decrypt Calls | Decrypt operations | Spike indicates unusual access |
| Secrets Retrieved | GetSecretValue calls | Compare to baseline |
| Key Disabled | DisableKey API calls | >0 (unauthorized key disable) |

---

## Common Pitfalls

### Pitfall 1: Not Caching Secrets

**Problem:** Retrieving secret on every request; 1M requests = $150/month API costs.

**Solution:** Cache secret for application lifetime; refresh hourly.

**Cost Impact:** 99.9% savings with caching.

---

### Pitfall 2: Hardcoding Key IDs

**Problem:** Application code contains `key-id=12345678-...`; key rotation breaks application.

**Solution:** Use key alias (`alias/prod-key`); update alias to point to new key during rotation.

**Cost Impact:** Application downtime during key rotation.

---

### Pitfall 3: Not Enabling Key Rotation

**Problem:** CMK used for 5 years without rotation; compliance violation.

**Solution:** Enable automatic rotation for all customer managed keys.

**Cost Impact:** Compliance audit failure; regulatory fines.

---

### Pitfall 4: Using Secrets Manager for Static Configuration

**Problem:** 100 feature flags stored in Secrets Manager; $40/month cost.

**Solution:** Use Parameter Store (free) for non-secret configuration.

**Cost Impact:** $40/month wasted on non-secret storage.

---

### Pitfall 5: Over-Permissive Key Policy

**Problem:** Key policy allows `kms:*` for all principals.

**Solution:** Principle of least privilege; grant only required actions.

**Cost Impact:** Unauthorized key usage; potential data breach.

---

### Pitfall 6: No Cross-Account Key Policy for Shared CMK

**Problem:** Application in Account B can't decrypt data encrypted in Account A.

**Solution:** Update key policy to allow Account B principals.

**Cost Impact:** Application failures; deployment delays.

---

## Key Takeaways

1. **KMS manages encryption keys; Secrets Manager manages secrets.** KMS creates/rotates keys for encrypting data. Secrets Manager stores/rotates passwords and API keys.

2. **Use Customer Managed Keys for cross-account access and custom policies.** AWS managed keys are free but limited. CMKs cost $1/month but provide full control.

3. **Envelope encryption improves performance and security.** Encrypt data locally with data key; encrypt data key with master key. Master key never leaves HSM.

4. **Secrets Manager provides automatic rotation for RDS/Aurora.** Built-in Lambda rotates database passwords every 30-365 days without downtime.

5. **Parameter Store is free for standard parameters.** Use for configuration and static secrets. Use Secrets Manager only for secrets requiring rotation.

6. **Cache secrets to reduce API costs 99%.** Retrieve secret once per hour instead of per-request. Reduces Secrets Manager costs from $150/month to $0.15/month.

7. **Enable automatic key rotation for compliance.** CMKs rotate annually; old key material retained for decryption. Application code unchanged.

8. **Key policies and IAM policies both required for access.** Key policy must allow principal; IAM policy must allow action. Both evaluated together.

9. **All KMS and Secrets Manager API calls logged to CloudTrail.** Provides audit trail for compliance (who accessed which key/secret when).

10. **Use separate keys per environment (dev, staging, prod).** Prevents compromise of dev key from affecting production data.

11. **Secret versioning enables zero-downtime rotation.** AWSCURRENT, AWSPENDING, AWSPREVIOUS stages; applications always retrieve AWSCURRENT.

12. **Cross-account access requires resource policy + IAM policy.** Secret/key policy allows Account B; IAM policy in Account B allows GetSecretValue/Decrypt.

13. **KMS request limits: 5,500 req/sec (us-east-1).** Use envelope encryption to reduce KMS API calls. Encrypt locally with data key.

14. **Reuse CMKs across services to reduce costs.** One CMK for S3, RDS, EBS saves $2/month per eliminated key.

15. **Use VPC endpoints for KMS/Secrets Manager to keep traffic private.** Prevents secrets from traversing internet; reduces attack surface.

**AWS KMS and Secrets Manager provide enterprise-grade encryption and secret management, enabling automatic rotation, fine-grained access control, and complete audit trails for compliance and security. KMS handles encryption keys while Secrets Manager handles passwords, API keys, and credentials. Both are essential for protecting sensitive data in production.**