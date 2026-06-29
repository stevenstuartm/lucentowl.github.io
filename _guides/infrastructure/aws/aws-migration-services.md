---
title: "AWS Application Migration Service & Database Migration Service"
layout: guide
category: AWS
subcategory: Migration & Hybrid Cloud
description: "AWS MGN for application rehosting, AWS DMS for database migrations, homogeneous and heterogeneous migrations, and migration best practices"
tags: [aws, migration, databases, rehosting, data-transfer, practical]
---

## What Problems These Services Solve

**The Migration Execution Challenge**:
After planning your cloud migration strategy, you need to actually move applications and databases to AWS. Manual migrations are time-consuming, error-prone, and require extended downtime. Organizations need automated tools that minimize downtime, reduce risk, and handle complex migration scenarios.

**What AWS Provides**:
- **AWS Application Migration Service (MGN)**: Automated lift-and-shift (rehost) for physical, virtual, or cloud servers to AWS
- **AWS Database Migration Service (DMS)**: Migrate databases with minimal downtime, including homogeneous (Oracle→Oracle) and heterogeneous (Oracle→PostgreSQL) migrations

Both services use continuous replication to minimize downtime and enable testing before cutover.

---

## AWS Application Migration Service (MGN)

### What It Is

AWS MGN is an automated lift-and-shift solution that replicates on-premises or cloud servers to AWS EC2 instances with minimal downtime.

**Key features**:
- Continuous block-level replication (sub-minute RPO)
- Non-disruptive testing (test instances without affecting source)
- Automated cutover (minutes of downtime)
- Supports physical, virtual (VMware, Hyper-V), and cloud servers
- Free for 90 days (no service charges, only pay for AWS resources)

**How it works**:
```
Source Server → Replication Agent → Staging Area (AWS) → Test/Cutover Instance
                (continuous sync)      (low-cost)           (production-ready)
```

### Installation and Setup

**1. Install Replication Agent**

The agent runs on the source server and continuously replicates data to AWS.

**Linux installation**:
```bash
# Download installer
wget -O ./aws-replication-installer-init.py \
  https://aws-application-migration-service-us-east-1.s3.us-east-1.amazonaws.com/latest/linux/aws-replication-installer-init.py

# Install agent (requires root)
sudo python3 aws-replication-installer-init.py \
  --region us-east-1 \
  --aws-access-key-id AKIAIOSFODNN7EXAMPLE \
  --aws-secret-access-key wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY \
  --no-prompt

# Agent automatically begins replication
# Check status
sudo systemctl status aws-replication-agent
```

**Windows installation**:
```powershell
# Download installer
Invoke-WebRequest -Uri "https://aws-application-migration-service-us-east-1.s3.us-east-1.amazonaws.com/latest/windows/AwsReplicationWindowsInstaller.exe" -OutFile "C:\Temp\AwsReplicationInstaller.exe"

# Install agent (requires Administrator)
C:\Temp\AwsReplicationInstaller.exe `
  --region us-east-1 `
  --aws-access-key-id AKIAIOSFODNN7EXAMPLE `
  --aws-secret-access-key wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY `
  --no-prompt

# Check service status
Get-Service -Name "AWS Replication Agent"
```

**2. Configure Replication Settings**

```python
import boto3

mgn = boto3.client('mgn', region_name='us-east-1')

# Configure replication for a source server
response = mgn.update_replication_configuration(
    sourceServerID='s-1234567890abcdef0',
    replicationServerInstanceType='t3.small',  # Staging server size
    replicationServersSecurityGroupsIDs=['sg-0123456789abcdef0'],
    subnetID='subnet-0123456789abcdef0',  # Staging subnet
    ebsEncryption='DEFAULT',  # Encrypt staging volumes
    dataPlaneRouting='PRIVATE_IP',  # Use private networking
    defaultLargeStagingDiskType='GP3',  # Staging disk type
    createPublicIP=False,  # Don't create public IPs for staging
    useDedicatedReplicationServer=False  # Share replication servers
)

print(f"Replication configured for {response['sourceServerID']}")
```

**3. Monitor Replication Progress**

```python
# Check replication status
source_servers = mgn.describe_source_servers(
    filters={'isArchived': False}
)

for server in source_servers['items']:
    server_id = server['sourceServerID']
    replication_status = server.get('dataReplicationInfo', {}).get('dataReplicationState')
    lag = server.get('dataReplicationInfo', {}).get('lagDuration', 'N/A')

    print(f"Server: {server_id}")
    print(f"  Hostname: {server.get('sourceProperties', {}).get('identificationHints', {}).get('hostname', 'Unknown')}")
    print(f"  Replication Status: {replication_status}")
    print(f"  Lag: {lag}")
    print(f"  Total Storage: {server.get('sourceProperties', {}).get('disks', [{}])[0].get('bytes', 0) / (1024**3):.2f} GB")
    print()

# Expected output:
# Server: s-1234567890abcdef0
#   Hostname: web-server-01
#   Replication Status: CONTINUOUS_REPLICATION
#   Lag: PT2M30S (2 minutes 30 seconds)
#   Total Storage: 100.00 GB
```

### Testing Before Cutover

<div class="callout callout--warning">
<p class="callout__title">Critical Practice</p>
<p>Always test migrated instances before cutover. Cutover failures in production are preventable with proper testing validation.</p>
</div>

**Critical practice**: Always test migrated instances before cutover.

**1. Launch Test Instance**

```python
# Launch test instance from replicated data
response = mgn.start_test(
    sourceServerIDs=['s-1234567890abcdef0']
)

job_id = response['job']['jobID']
print(f"Test job started: {job_id}")

# Monitor test job
import time

while True:
    job = mgn.describe_jobs(
        filters={'jobIDs': [job_id]}
    )

    status = job['items'][0]['status']
    print(f"Test job status: {status}")

    if status in ['COMPLETED', 'FAILED']:
        break

    time.sleep(30)

# Get test instance details
if status == 'COMPLETED':
    launched_instance = mgn.describe_source_servers(
        filters={'sourceServerIDs': ['s-1234567890abcdef0']}
    )['items'][0]

    test_instance_id = launched_instance.get('launchedInstance', {}).get('ec2InstanceID')
    print(f"Test instance launched: {test_instance_id}")
```

**2. Validate Test Instance**

```bash
# Connect to test instance
aws ssm start-session --target i-0abcdef1234567890

# Run validation tests
# 1. Check application is running
systemctl status nginx

# 2. Test application endpoints
curl http://localhost:80/health

# 3. Verify data integrity
md5sum /var/www/html/index.html
# Compare with source server checksum

# 4. Check disk space
df -h

# 5. Verify network connectivity to dependencies
ping -c 4 database.internal.company.com
```

**3. Terminate Test Instance (After Validation)**

```python
# Terminate test instance once validation complete
mgn.terminate_target_instances(
    sourceServerIDs=['s-1234567890abcdef0']
)

print("Test instance terminated")
```

### Cutover (Production Migration)

**1. Launch Cutover Instance**

```python
# Configure launch template (optional, before cutover)
mgn.update_launch_configuration(
    sourceServerID='s-1234567890abcdef0',
    name='web-server-01-prod',
    targetInstanceTypeRightSizingMethod='BASIC',  # Auto right-size
    copyPrivateIp=True,  # Keep same private IP
    copyTags=True,
    launchDisposition='STARTED',  # Start instance automatically
    licensing={
        'osByol': False  # Use AWS-provided licenses
    }
)

# Start cutover
response = mgn.start_cutover(
    sourceServerIDs=['s-1234567890abcdef0']
)

cutover_job_id = response['job']['jobID']
print(f"Cutover started: {cutover_job_id}")

# Monitor cutover
while True:
    job = mgn.describe_jobs(filters={'jobIDs': [cutover_job_id]})
    status = job['items'][0]['status']
    print(f"Cutover status: {status}")

    if status in ['COMPLETED', 'FAILED']:
        break

    time.sleep(30)
```

**2. Validate Cutover Instance**

```python
# Get cutover instance details
source_server = mgn.describe_source_servers(
    filters={'sourceServerIDs': ['s-1234567890abcdef0']}
)['items'][0]

cutover_instance_id = source_server['launchedInstance']['ec2InstanceID']
cutover_instance_ip = source_server['launchedInstance']['firstBoot']['privateIp']

print(f"Cutover instance: {cutover_instance_id}")
print(f"Private IP: {cutover_instance_ip}")

# Update DNS to point to new instance
route53 = boto3.client('route53')

route53.change_resource_record_sets(
    HostedZoneId='Z1234567890ABC',
    ChangeBatch={
        'Changes': [{
            'Action': 'UPSERT',
            'ResourceRecordSet': {
                'Name': 'web-server-01.internal.company.com',
                'Type': 'A',
                'TTL': 300,
                'ResourceRecords': [{'Value': cutover_instance_ip}]
            }
        }]
    }
)

print("DNS updated to point to cutover instance")
```

**3. Finalize Cutover**

```python
# Mark migration complete (stops replication)
mgn.finalize_cutover(
    sourceServerIDs=['s-1234567890abcdef0']
)

print("Migration finalized. Replication stopped.")

# Archive source server (removes from active view)
mgn.mark_as_archived(
    sourceServerID='s-1234567890abcdef0'
)

print("Source server archived")
```

### Rollback Strategy

**Always maintain ability to rollback**:

```python
# Rollback plan (if cutover fails)

# 1. Keep source server running for 30 days post-cutover
# 2. Maintain DNS flexibility

def rollback_migration(source_server_id, original_ip):
    """Rollback to on-premises server"""

    # Terminate AWS instance
    mgn.terminate_target_instances(
        sourceServerIDs=[source_server_id]
    )

    # Revert DNS to on-premises
    route53.change_resource_record_sets(
        HostedZoneId='Z1234567890ABC',
        ChangeBatch={
            'Changes': [{
                'Action': 'UPSERT',
                'ResourceRecordSet': {
                    'Name': 'web-server-01.internal.company.com',
                    'Type': 'A',
                    'TTL': 300,
                    'ResourceRecords': [{'Value': original_ip}]
                }
            }]
        }
    )

    print(f"Rolled back to on-premises: {original_ip}")

# Use only if critical issues discovered post-cutover
# rollback_migration('s-1234567890abcdef0', '192.168.1.100')
```

---

## AWS Database Migration Service (DMS)

### What It Is

AWS DMS migrates databases to AWS with minimal downtime using continuous replication.

**Supported migration types**:

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Homogeneous Migrations</h4>
<ul>
<li>Same database engine (Oracle→Oracle, MySQL→MySQL)</li>
<li>No schema conversion required</li>
<li>Simpler setup and execution</li>
<li>Lower risk of compatibility issues</li>
<li>Use DMS only for data replication</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Heterogeneous Migrations</h4>
<ul>
<li>Different engines (Oracle→PostgreSQL, SQL Server→Aurora)</li>
<li>Requires AWS Schema Conversion Tool (SCT)</li>
<li>Schema conversion needed before data migration</li>
<li>Manual intervention for engine-specific features</li>
<li>Use SCT for schema, DMS for data replication</li>
</ul>
</div>
</div>

**Key features**:
- Continuous replication (sub-second lag)
- Schema conversion (using AWS Schema Conversion Tool for heterogeneous)
- Minimal downtime (applications stay online during migration)
- Supports 20+ source/target databases
- Data validation (ensure data integrity)

### Architecture

```
Source Database → DMS Replication Instance → Target Database (AWS)
                  (continuous CDC)             (RDS, Aurora, Redshift, S3)
```

**Replication modes**:

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Full Load</h4>
<ul>
<li>Migrate existing data only (one-time)</li>
<li>No ongoing replication</li>
<li>Requires downtime during migration</li>
<li>Use for offline migrations or test environments</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Full Load + CDC</h4>
<ul>
<li>Migrate existing data + replicate ongoing changes</li>
<li>Continuous replication after initial load</li>
<li>Minimal downtime (only during cutover)</li>
<li>Recommended for production migrations</li>
</ul>
</div>
<div class="content-card content-card--accent">
<h4>CDC Only</h4>
<ul>
<li>Replicate ongoing changes only</li>
<li>Assumes data already migrated</li>
<li>Use for continuous replication or hybrid cloud</li>
<li>Ideal for disaster recovery scenarios</li>
</ul>
</div>
</div>

### Homogeneous Migration (MySQL → RDS MySQL)

**Example scenario**: Migrate on-premises MySQL 8.0 to Amazon RDS for MySQL 8.0.

**1. Create Replication Instance**

```python
import boto3

dms = boto3.client('dms', region_name='us-east-1')

# Create replication instance
response = dms.create_replication_instance(
    ReplicationInstanceIdentifier='mysql-migration-instance',
    ReplicationInstanceClass='dms.c5.large',  # 2 vCPU, 4GB RAM
    AllocatedStorage=100,  # GB
    VpcSecurityGroupIds=['sg-0123456789abcdef0'],
    ReplicationSubnetGroupIdentifier='dms-subnet-group',
    MultiAZ=False,  # Single-AZ for cost savings during migration
    PubliclyAccessible=False,
    EngineVersion='3.4.7'
)

replication_instance_arn = response['ReplicationInstance']['ReplicationInstanceArn']
print(f"Replication instance created: {replication_instance_arn}")

# Wait for instance to be available
waiter = dms.get_waiter('replication_instance_available')
waiter.wait(
    Filters=[{'Name': 'replication-instance-id', 'Values': ['mysql-migration-instance']}]
)
print("Replication instance ready")
```

**2. Create Source and Target Endpoints**

```python
# Source endpoint (on-premises MySQL)
source_endpoint = dms.create_endpoint(
    EndpointIdentifier='mysql-source',
    EndpointType='source',
    EngineName='mysql',
    ServerName='192.168.1.50',  # On-premises IP
    Port=3306,
    DatabaseName='production_db',
    Username='dms_user',
    Password='SecurePassword123!',
    ExtraConnectionAttributes='initstmt=SET FOREIGN_KEY_CHECKS=0'  # Disable FK checks during migration
)

source_endpoint_arn = source_endpoint['Endpoint']['EndpointArn']
print(f"Source endpoint created: {source_endpoint_arn}")

# Target endpoint (RDS MySQL)
target_endpoint = dms.create_endpoint(
    EndpointIdentifier='rds-mysql-target',
    EndpointType='target',
    EngineName='mysql',
    ServerName='prod-db.abc123.us-east-1.rds.amazonaws.com',
    Port=3306,
    DatabaseName='production_db',
    Username='admin',
    Password='AWSSecurePass456!',
    ExtraConnectionAttributes='initstmt=SET FOREIGN_KEY_CHECKS=0;parallelLoadThreads=4'
)

target_endpoint_arn = target_endpoint['Endpoint']['EndpointArn']
print(f"Target endpoint created: {target_endpoint_arn}")
```

**3. Test Endpoints**

```python
# Test source endpoint connectivity
test_source = dms.test_connection(
    ReplicationInstanceArn=replication_instance_arn,
    EndpointArn=source_endpoint_arn
)

# Test target endpoint connectivity
test_target = dms.test_connection(
    ReplicationInstanceArn=replication_instance_arn,
    EndpointArn=target_endpoint_arn
)

# Check test results
import time
time.sleep(30)  # Wait for tests to complete

connections = dms.describe_connections(
    Filters=[
        {'Name': 'endpoint-arn', 'Values': [source_endpoint_arn, target_endpoint_arn]}
    ]
)

for conn in connections['Connections']:
    print(f"Endpoint: {conn['EndpointIdentifier']}, Status: {conn['Status']}")

# Expected: Status = 'successful'
```

**4. Create Replication Task**

```python
# Define table mappings (which tables to migrate)
table_mappings = {
    "rules": [
        {
            "rule-type": "selection",
            "rule-id": "1",
            "rule-name": "include-all-tables",
            "object-locator": {
                "schema-name": "production_db",
                "table-name": "%"  # All tables
            },
            "rule-action": "include"
        },
        {
            "rule-type": "transformation",
            "rule-id": "2",
            "rule-name": "add-prefix",
            "rule-target": "table",
            "object-locator": {
                "schema-name": "production_db",
                "table-name": "%"
            },
            "rule-action": "add-prefix",
            "value": "migrated_"  # Optional: prefix table names
        }
    ]
}

# Create replication task
import json

task_response = dms.create_replication_task(
    ReplicationTaskIdentifier='mysql-full-load-cdc',
    SourceEndpointArn=source_endpoint_arn,
    TargetEndpointArn=target_endpoint_arn,
    ReplicationInstanceArn=replication_instance_arn,
    MigrationType='full-load-and-cdc',  # Full load + ongoing replication
    TableMappings=json.dumps(table_mappings),
    ReplicationTaskSettings=json.dumps({
        "TargetMetadata": {
            "SupportLobs": True,
            "FullLobMode": False,
            "LobChunkSize": 64,  # KB
            "LimitedSizeLobMode": True,
            "LobMaxSize": 32  # MB
        },
        "FullLoadSettings": {
            "TargetTablePrepMode": "DROP_AND_CREATE",  # Drop target tables and recreate
            "MaxFullLoadSubTasks": 8,  # Parallel threads
            "TransactionConsistencyTimeout": 600
        },
        "Logging": {
            "EnableLogging": True,
            "LogComponents": [
                {"Id": "SOURCE_CAPTURE", "Severity": "LOGGER_SEVERITY_DEFAULT"},
                {"Id": "TARGET_APPLY", "Severity": "LOGGER_SEVERITY_INFO"}
            ]
        },
        "ValidationSettings": {
            "EnableValidation": True,  # Validate data integrity
            "ValidationMode": "ROW_LEVEL",
            "ThreadCount": 5
        }
    })
)

task_arn = task_response['ReplicationTask']['ReplicationTaskArn']
print(f"Replication task created: {task_arn}")
```

**5. Start Migration**

```python
# Start replication task
dms.start_replication_task(
    ReplicationTaskArn=task_arn,
    StartReplicationTaskType='start-replication'
)

print("Migration started")

# Monitor progress
while True:
    task = dms.describe_replication_tasks(
        Filters=[{'Name': 'replication-task-arn', 'Values': [task_arn]}]
    )['ReplicationTasks'][0]

    status = task['Status']
    stats = task.get('ReplicationTaskStats', {})

    print(f"Status: {status}")
    print(f"  Full Load Progress: {stats.get('FullLoadProgressPercent', 0)}%")
    print(f"  Tables Loaded: {stats.get('TablesLoaded', 0)}")
    print(f"  Tables Loading: {stats.get('TablesLoading', 0)}")
    print(f"  Tables Queued: {stats.get('TablesQueued', 0)}")
    print(f"  CDC Latency: {stats.get('CDCLatencySource', 'N/A')} seconds")
    print()

    if status in ['stopped', 'failed']:
        print(f"Migration {status}")
        break

    if status == 'running' and stats.get('FullLoadProgressPercent') == 100:
        print("Full load complete. CDC replication ongoing.")
        break

    time.sleep(60)
```

**6. Cutover**

```python
# When ready to cutover:

# 1. Stop application writes to source database
# (Application downtime begins)

# 2. Wait for CDC to catch up (zero lag)
while True:
    task = dms.describe_replication_tasks(
        Filters=[{'Name': 'replication-task-arn', 'Values': [task_arn]}]
    )['ReplicationTasks'][0]

    cdc_latency = task.get('ReplicationTaskStats', {}).get('CDCLatencySource', 999999)

    print(f"CDC Latency: {cdc_latency} seconds")

    if cdc_latency < 5:  # Less than 5 seconds lag
        print("CDC caught up. Safe to cutover.")
        break

    time.sleep(10)

# 3. Update application connection string to RDS
# DATABASE_HOST=prod-db.abc123.us-east-1.rds.amazonaws.com

# 4. Start application (pointing to RDS)
# (Application downtime ends - typically 2-5 minutes)

# 5. Stop replication task
dms.stop_replication_task(ReplicationTaskArn=task_arn)

print("Migration complete")
```

### Heterogeneous Migration (Oracle → PostgreSQL)

**Additional step**: Use AWS Schema Conversion Tool (SCT) to convert schema.

**1. Install and Run SCT**

```bash
# Download SCT from AWS Console
# https://docs.aws.amazon.com/SchemaConversionTool/latest/userguide/CHAP_Installing.html

# Launch SCT (GUI application)
# 1. Create new project
# 2. Connect to source Oracle database
# 3. Connect to target PostgreSQL database
# 4. Analyze schema (SCT identifies conversion issues)
# 5. Review Assessment Report
#    - Automatic conversions (green)
#    - Manual actions required (red/yellow)
# 6. Convert schema
# 7. Apply to target PostgreSQL database
```

**Assessment Report example**:
```
Schema Conversion Assessment

Total Objects: 150
Automatically Converted: 120 (80%)
Require Manual Intervention: 30 (20%)

Manual Actions Required:
- Oracle-specific features:
  - ROWNUM → Use ROW_NUMBER() window function in PostgreSQL
  - CONNECT BY → Use recursive CTEs in PostgreSQL
  - Oracle packages → Convert to PostgreSQL functions
  - Oracle sequences → PostgreSQL sequences (auto-converted, verify)

Storage Estimate:
- Source: 500GB (Oracle)
- Target: 480GB (PostgreSQL, compressed)
```

**2. Migrate Data with DMS**

```python
# After schema conversion, use DMS for data migration

# Create endpoints (similar to homogeneous, but different engines)
source_oracle = dms.create_endpoint(
    EndpointIdentifier='oracle-source',
    EndpointType='source',
    EngineName='oracle',
    ServerName='oracle-db.company.com',
    Port=1521,
    DatabaseName='PRODDB',
    Username='dms_user',
    Password='OraclePass123!',
    ExtraConnectionAttributes='useLogminerReader=N;useBfile=Y'
)

target_postgres = dms.create_endpoint(
    EndpointIdentifier='postgres-target',
    EndpointType='target',
    EngineName='postgres',
    ServerName='prod-postgres.abc123.us-east-1.rds.amazonaws.com',
    Port=5432,
    DatabaseName='proddb',
    Username='postgres',
    Password='PostgresPass456!',
    ExtraConnectionAttributes='captureDDLs=N;'
)

# Create replication task (full-load-and-cdc)
# (Same as homogeneous example above)
```

### Data Validation

<div class="callout callout--tip">
<p class="callout__title">Best Practice</p>
<p>Always enable validation for production migrations. DMS can perform row-level validation to ensure data integrity and detect discrepancies between source and target databases.</p>
</div>

**Enable validation to ensure data integrity**:

```python
# Check validation results
table_stats = dms.describe_table_statistics(
    ReplicationTaskArn=task_arn
)

print("Table Validation Results:")
print(f"{'Table Name':<40} {'Rows Validated':<15} {'Validation Status':<20}")
print("-" * 75)

for table in table_stats['TableStatistics']:
    table_name = table['TableName']
    validated = table.get('ValidationState', 'N/A')
    validation_pending = table.get('ValidationPendingRecords', 0)
    validation_failed = table.get('ValidationFailedRecords', 0)

    if validation_failed > 0:
        status = f"⚠️ {validation_failed} FAILED"
    elif validated == 'Validated':
        status = "✅ Valid"
    else:
        status = f"🔄 Pending ({validation_pending})"

    print(f"{table_name:<40} {table.get('FullLoadRows', 0):<15} {status:<20}")

# Example output:
# Table Name                               Rows Validated   Validation Status
# ---------------------------------------------------------------------------
# customers                                1,000,000        ✅ Valid
# orders                                   5,000,000        ✅ Valid
# products                                 50,000           ⚠️ 5 FAILED
```

**Investigate validation failures**:
```python
# Query DMS validation failure table (in target database)
import psycopg2

conn = psycopg2.connect(
    host='prod-postgres.abc123.us-east-1.rds.amazonaws.com',
    database='proddb',
    user='postgres',
    password='PostgresPass456!'
)

cur = conn.cursor()

# DMS creates awsdms_validation_failures_v1 table
cur.execute("""
    SELECT table_name, key_type, key, failure_type, failure_time
    FROM awsdms_validation_failures_v1
    ORDER BY failure_time DESC
    LIMIT 10
""")

failures = cur.fetchall()

for failure in failures:
    print(f"Table: {failure[0]}, Key: {failure[2]}, Type: {failure[3]}, Time: {failure[4]}")

cur.close()
conn.close()
```

---

## Migration Patterns and Best Practices

### Pattern 1: Multi-Server Migration (Wave-Based)

**Scenario**: Migrate 20 servers in parallel.

```python
# Automated wave migration
servers_to_migrate = [
    {'hostname': 'web-01', 'source_id': 's-1111111111111111'},
    {'hostname': 'web-02', 'source_id': 's-2222222222222222'},
    {'hostname': 'web-03', 'source_id': 's-3333333333333333'},
    # ... 20 servers total
]

def migrate_wave(servers, wave_name):
    """Migrate multiple servers in parallel"""

    # 1. Launch test instances for all servers
    source_ids = [s['source_id'] for s in servers]

    test_response = mgn.start_test(sourceServerIDs=source_ids)
    test_job_id = test_response['job']['jobID']

    print(f"{wave_name}: Test instances launching for {len(servers)} servers")

    # 2. Wait for all tests to complete
    wait_for_job_completion(test_job_id)

    # 3. Validate all test instances
    for server in servers:
        validate_server(server['hostname'], test=True)

    # 4. If all validations pass, proceed to cutover
    print(f"{wave_name}: All tests passed. Starting cutover...")

    cutover_response = mgn.start_cutover(sourceServerIDs=source_ids)
    cutover_job_id = cutover_response['job']['jobID']

    # 5. Wait for cutover
    wait_for_job_completion(cutover_job_id)

    # 6. Finalize all
    for source_id in source_ids:
        mgn.finalize_cutover(sourceServerIDs=[source_id])

    print(f"{wave_name}: Migration complete")

# Execute waves
wave_1 = servers_to_migrate[0:5]
wave_2 = servers_to_migrate[5:10]
wave_3 = servers_to_migrate[10:15]
wave_4 = servers_to_migrate[15:20]

migrate_wave(wave_1, "Wave 1")
migrate_wave(wave_2, "Wave 2")
migrate_wave(wave_3, "Wave 3")
migrate_wave(wave_4, "Wave 4")
```

### Pattern 2: Database Migration with Zero Downtime

<div class="callout callout--note">
<p class="callout__title">Zero Downtime Pattern</p>
<p>Using Full Load + CDC replication, you can achieve database migrations with less than 1 minute of downtime. The key is continuous replication during the migration period, followed by a quick cutover when CDC lag reaches near-zero.</p>
</div>

**Scenario**: Migrate production database with <1 minute downtime.

```
Timeline:
- Day 1-7: DMS replicates historical data (full load)
- Day 7-30: DMS replicates ongoing changes (CDC)
- Day 30: Cutover (1 minute downtime)

Cutover process:
1. Enable read-only mode on source database (30 seconds)
2. Wait for CDC lag to reach zero (<30 seconds)
3. Update application config to point to target database
4. Deploy application update (30 seconds)
5. Verify application functionality
6. Total downtime: ~1 minute
```

**Implementation**:
```sql
-- On source database (MySQL)

-- 1. Enable read-only mode
SET GLOBAL read_only = ON;

-- Allow DMS user to continue replicating
GRANT ALL ON *.* TO 'dms_user'@'%';
FLUSH PRIVILEGES;

-- 2. Monitor DMS lag (via Python script)
-- (Wait for lag < 5 seconds)

-- 3. Update application connection string
-- DATABASE_HOST=new-rds-endpoint.amazonaws.com

-- 4. Deploy application
-- (kubectl rollout restart deployment/web-app)

-- 5. Disable read-only on source (rollback option)
-- SET GLOBAL read_only = OFF;
```

### Pattern 3: Hybrid Cloud (Continuous Replication)

**Scenario**: Keep on-premises and AWS databases in sync for disaster recovery.

```python
# Create DMS task for continuous replication (no cutover)

task = dms.create_replication_task(
    ReplicationTaskIdentifier='dr-continuous-replication',
    MigrationType='cdc',  # CDC only (not full-load)
    # ... endpoints, table mappings
)

# Run indefinitely
dms.start_replication_task(
    ReplicationTaskArn=task_arn,
    StartReplicationTaskType='start-replication'
)

# Monitor lag continuously
# If primary fails, promote AWS database to primary

# Cost: ~$150/month (dms.t3.medium instance) for DR protection
```

---

## Cost Optimization

<div class="callout callout--tip">
<p class="callout__title">Cost Optimization Tip</p>
<p>MGN offers 90 days free from first server replication. Complete your migrations within this window to avoid service charges entirely. After migration, always delete replication instances and finalize cutover to prevent ongoing costs.</p>
</div>

### MGN Costs

**Free tier**: 90 days from first server replication (no MGN service charges).

**Costs after free tier**:
- **Per hour**: $0.0237/hour per source server replicating
- **Example**: 10 servers × 30 days × 24 hours × $0.0237 = $170.64/month

**Optimization strategies**:
1. **Complete migrations within 90 days** (avoid charges entirely)
2. **Batch migrations** (migrate in waves, archive completed servers)
3. **Right-size staging instances** (use t3.small instead of larger)

### DMS Costs

**Replication instance costs** (on-demand pricing, us-east-1):
- **dms.t3.micro**: $0.0175/hour ($13/month) - POC/testing
- **dms.t3.medium**: $0.140/hour ($102/month) - Small databases (<100GB)
- **dms.c5.large**: $0.192/hour ($140/month) - Medium databases (100GB-500GB)
- **dms.c5.xlarge**: $0.384/hour ($280/month) - Large databases (500GB-2TB)
- **dms.c5.4xlarge**: $1.536/hour ($1,120/month) - Very large databases (2TB+)

**Data transfer costs**:
- **Data IN to AWS**: Free
- **Data OUT from AWS**: Standard data transfer rates ($0.09/GB after 100GB/month)

**Optimization strategies**:
1. **Right-size replication instance** (start small, scale up if needed)
2. **Delete replication instance after migration** (don't leave running)
3. **Use single-AZ** during migration (Multi-AZ adds 2x cost)
4. **Compress data** (enable compression in table mappings)

**Example cost calculation**:
```
Migration: 500GB MySQL database
Timeline: 30 days

Costs:
- Replication instance (dms.c5.large): $140
- Data transfer IN: $0 (free)
- Data transfer OUT: $0 (staying in AWS)
- Total: $140 for entire migration

Post-migration: Delete replication instance = $0/month ongoing
```

---

## Common Pitfalls

### MGN Pitfalls

**1. Not testing before cutover**

**Problem**: Cutover fails because application doesn't work in AWS.

**Solution**: Always launch test instances and validate.

**2. Forgetting to finalize cutover**

**Problem**: Replication continues indefinitely, incurring costs.

**Solution**:
```python
# After successful cutover, always finalize
mgn.finalize_cutover(sourceServerIDs=['s-1234567890abcdef0'])
mgn.mark_as_archived(sourceServerID='s-1234567890abcdef0')
```

**3. Insufficient staging area storage**

**Problem**: Replication fails due to disk space.

**Solution**: Provision staging storage = 1.5× source server storage.

**4. Not handling licensing**

**Problem**: Windows/SQL Server migrations without proper licensing.

**Solution**:
```python
# Configure BYOL (Bring Your Own License) or License Included
mgn.update_launch_configuration(
    sourceServerID='s-1234567890abcdef0',
    licensing={
        'osByol': True  # BYOL for Windows/SQL Server
    }
)
```

### DMS Pitfalls

**1. Incompatible data types (heterogeneous migrations)**

**Problem**: Oracle CLOB doesn't map cleanly to PostgreSQL TEXT.

**Solution**: Use SCT to identify and manually convert incompatible types before migration.

**2. Not enabling validation**

**Problem**: Data corruption goes undetected.

**Solution**:
```python
# Always enable validation for production migrations
"ValidationSettings": {
    "EnableValidation": True,
    "ValidationMode": "ROW_LEVEL"
}
```

**3. Running out of replication instance storage**

**Problem**: DMS stores change logs; disk fills up.

**Solution**:
- Provision 2x source database size for replication instance storage
- Monitor disk usage: CloudWatch metric `FreeStorageSpace`

**4. Not handling LOBs correctly**

**Problem**: Large objects (BLOBs, CLOBs) cause task failures.

**Solution**:
```python
"TargetMetadata": {
    "SupportLobs": True,
    "LimitedSizeLobMode": True,
    "LobMaxSize": 32  # MB, adjust based on data
}
```

**5. Forgetting to delete replication instance after migration**

**Problem**: $280/month ongoing costs for unused instance.

**Solution**:
```python
# After migration complete, delete replication instance
dms.delete_replication_instance(
    ReplicationInstanceArn=replication_instance_arn
)

print("Replication instance deleted. $0/month ongoing cost.")
```

---

## Security Best Practices

### 1. Use IAM Roles Instead of Access Keys

```python
# ❌ BAD: Hardcoded access keys
mgn.install_agent(
    access_key_id='AKIAIOSFODNN7EXAMPLE',
    secret_access_key='wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
)

# ✅ GOOD: Use IAM role for EC2 instances running agent
# Attach MGNSourceServerRole to source EC2 instances
# Agent automatically uses instance role credentials
```

### 2. Encrypt Staging Area and Target Volumes

```python
# MGN: Encrypt staging volumes
mgn.update_replication_configuration(
    sourceServerID='s-1234567890abcdef0',
    ebsEncryption='CUSTOM',
    ebsEncryptionKeyArn='arn:aws:kms:us-east-1:123456789012:key/abcd1234'
)

# DMS: Encrypt target database
rds.create_db_instance(
    DBInstanceIdentifier='migrated-db',
    StorageEncrypted=True,
    KmsKeyId='arn:aws:kms:us-east-1:123456789012:key/abcd1234'
)
```

### 3. Use VPN/Direct Connect for Data Transfer

```python
# Avoid transferring sensitive data over public internet
# Configure DMS to use private IPs

mgn.update_replication_configuration(
    sourceServerID='s-1234567890abcdef0',
    dataPlaneRouting='PRIVATE_IP',  # Use VPN/Direct Connect
    createPublicIP=False
)
```

### 4. Least Privilege Database Users

```sql
-- Create DMS-specific user with minimal permissions

-- MySQL source
CREATE USER 'dms_user'@'%' IDENTIFIED BY 'SecurePassword123!';
GRANT SELECT ON production_db.* TO 'dms_user'@'%';
GRANT REPLICATION SLAVE, REPLICATION CLIENT ON *.* TO 'dms_user'@'%';
FLUSH PRIVILEGES;

-- MySQL target
CREATE USER 'dms_user'@'%' IDENTIFIED BY 'SecurePassword123!';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, INDEX, ALTER ON production_db.* TO 'dms_user'@'%';
FLUSH PRIVILEGES;
```

---

## Key Takeaways

**AWS Application Migration Service (MGN)**:
1. **Automated lift-and-shift** with continuous replication and minimal downtime (<5 minutes)
2. **Always test before cutover** using test instances to validate functionality
3. **Free for 90 days** from first server replication (complete migrations within 90 days)
4. **Finalize cutover** to stop replication and avoid ongoing costs
5. **Right-size instances** post-migration using AWS Compute Optimizer

**AWS Database Migration Service (DMS)**:
6. **Supports homogeneous and heterogeneous** migrations (Oracle→Oracle, Oracle→PostgreSQL)
7. **Use AWS SCT** for schema conversion in heterogeneous migrations (Oracle→PostgreSQL)
8. **Enable validation** to ensure data integrity (row-level validation recommended)
9. **Full-load + CDC** migration type for minimal downtime (applications stay online)
10. **Delete replication instance** after migration to avoid ongoing costs

**Migration Patterns**:
11. **Wave-based migrations** for multiple servers (batch 5-10 servers per wave)
12. **Zero-downtime database migrations** using CDC with <1 minute cutover window
13. **Hybrid cloud continuous replication** for disaster recovery scenarios
14. **Test-cutover-finalize workflow** for both MGN and DMS migrations

**Cost Optimization**:
15. MGN is **free for 90 days** (plan migrations to complete within free period)
16. DMS replication instances cost **$100-1,000/month** depending on size
17. **Delete resources after migration**: Replication instances, staging servers, test instances
18. **Right-size replication instances**: Start with smaller instances, scale up if needed

**Common Pitfalls**:
19. **Not testing before cutover** leads to production failures (always launch test instances)
20. **Forgetting to finalize cutover** causes ongoing replication costs
21. **Incompatible data types** in heterogeneous migrations (use SCT assessment report)
22. **Running out of storage** on replication instances (provision 2x source size)

**Security Best Practices**:
23. **Use IAM roles** instead of access keys for agent installation
24. **Encrypt staging and target volumes** using AWS KMS
25. **Use private connectivity** (VPN/Direct Connect) for sensitive data transfer
26. **Least privilege database users** for DMS replication (SELECT for source, DML for target)

**Validation & Monitoring**:
27. **Enable DMS validation** to detect data discrepancies (row-level validation)
28. **Monitor CDC lag** before cutover (wait for <5 seconds lag)
29. **Check validation failure tables** in target database for data integrity issues
30. **Archive source servers** in MGN after finalization to clean up console view

AWS MGN and DMS provide automated, low-risk migration paths for applications and databases. The key to successful migrations is thorough testing, validation, and following the test-cutover-finalize workflow to minimize downtime and ensure data integrity.
