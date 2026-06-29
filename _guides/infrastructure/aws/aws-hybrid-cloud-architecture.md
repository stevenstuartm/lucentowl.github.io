---
title: "AWS Hybrid Cloud Architecture"
layout: guide
category: AWS
subcategory: Migration & Hybrid Cloud
description: "Hybrid cloud connectivity options including Direct Connect, VPN, Storage Gateway, and Outposts with decision frameworks and cost analysis"
tags: [aws, hybrid-cloud, networking, connectivity, architecture, cost-analysis]
---

## What Problem This Solves

**The Hybrid Cloud Challenge**:
Organizations often need to maintain workloads both on-premises and in AWS during migrations, for compliance reasons, or to leverage existing infrastructure investments. The challenge is connecting these environments securely, reliably, and cost-effectively while maintaining performance and meeting regulatory requirements.

**What This Guide Provides**:
A comprehensive decision framework for hybrid cloud connectivity options:
- **AWS Direct Connect**: Dedicated network connection (1 Gbps - 100 Gbps)
- **AWS Site-to-Site VPN**: Encrypted IPsec tunnel over the internet
- **AWS Storage Gateway**: Hybrid storage integration (file, volume, tape)
- **AWS Outposts**: AWS infrastructure on-premises for low-latency or data residency requirements

Each option has different cost structures, performance characteristics, and use cases.

---

## Hybrid Cloud Connectivity Options

### Option 1: AWS Site-to-Site VPN

**What it is**: Encrypted IPsec tunnel between on-premises network and AWS VPC over the public internet.

**Architecture**:
```
On-Premises Network → Customer Gateway (CGW) → Internet → Virtual Private Gateway (VGW) → VPC
                      (your router)                         (AWS managed)
```

**Key characteristics**:
- **Bandwidth**: Up to 1.25 Gbps per tunnel (4 tunnels max = 5 Gbps total with ECMP)
- **Latency**: Variable (depends on internet path, typically 20-100ms)
- **Cost**: $0.05/hour per VPN connection (~$36/month) + data transfer
- **Setup time**: Hours (quick to deploy)
- **Encryption**: AES-256 (always encrypted)

**When to use**:
- Quick hybrid connectivity for migrations or DR
- Bandwidth requirements <1 Gbps
- Budget-conscious projects ($36-100/month)
- Temporary connectivity during Direct Connect provisioning
- Backup connectivity for Direct Connect failover

**Configuration example**:

```python
import boto3

ec2 = boto3.client('ec2', region_name='us-east-1')

# 1. Create Customer Gateway (your on-premises router)
cgw_response = ec2.create_customer_gateway(
    BgpAsn=65000,  # Your BGP ASN (or use 65000 for static routing)
    PublicIp='203.0.113.10',  # Your on-premises router public IP
    Type='ipsec.1',
    TagSpecifications=[{
        'ResourceType': 'customer-gateway',
        'Tags': [{'Key': 'Name', 'Value': 'OnPrem-CGW'}]
    }]
)

cgw_id = cgw_response['CustomerGateway']['CustomerGatewayId']
print(f"Customer Gateway created: {cgw_id}")

# 2. Create Virtual Private Gateway (AWS side)
vgw_response = ec2.create_vpn_gateway(
    Type='ipsec.1',
    AmazonSideAsn=64512,  # AWS BGP ASN
    TagSpecifications=[{
        'ResourceType': 'vpn-gateway',
        'Tags': [{'Key': 'Name', 'Value': 'AWS-VGW'}]
    }]
)

vgw_id = vgw_response['VpnGateway']['VpnGatewayId']
print(f"Virtual Private Gateway created: {vgw_id}")

# 3. Attach VGW to VPC
ec2.attach_vpn_gateway(
    VpcId='vpc-0123456789abcdef0',
    VpnGatewayId=vgw_id
)

print(f"VGW {vgw_id} attached to VPC")

# 4. Create VPN Connection
vpn_response = ec2.create_vpn_connection(
    Type='ipsec.1',
    CustomerGatewayId=cgw_id,
    VpnGatewayId=vgw_id,
    Options={
        'StaticRoutesOnly': False,  # Use BGP for dynamic routing
        'TunnelOptions': [
            {
                'TunnelInsideCidr': '169.254.10.0/30',  # Tunnel 1 inside IPs
                'PreSharedKey': 'securePreSharedKey123!'
            },
            {
                'TunnelInsideCidr': '169.254.11.0/30',  # Tunnel 2 inside IPs
                'PreSharedKey': 'securePreSharedKey456!'
            }
        ]
    },
    TagSpecifications=[{
        'ResourceType': 'vpn-connection',
        'Tags': [{'Key': 'Name', 'Value': 'OnPrem-to-AWS-VPN'}]
    }]
)

vpn_id = vpn_response['VpnConnection']['VpnConnectionId']
print(f"VPN Connection created: {vpn_id}")

# 5. Download configuration for your on-premises router
vpn_config = ec2.describe_vpn_connections(
    VpnConnectionIds=[vpn_id]
)

# Apply configuration to your on-premises router (Cisco, Juniper, etc.)
print("Download configuration from AWS Console for your router vendor")
```

**High availability configuration**:

```
# Best practice: Redundant VPN with multiple Customer Gateways

On-Premises:
  Primary Router (CGW-1) → VPN Connection 1 → VGW
  Secondary Router (CGW-2) → VPN Connection 2 → VGW

AWS automatically creates 2 tunnels per VPN connection (different AZs)
Total: 4 tunnels for full redundancy
```

**Cost example**:
```
Monthly cost for Site-to-Site VPN:
- VPN connection fee: $0.05/hour × 730 hours = $36.50/month
- Data transfer OUT: 500GB × $0.09/GB = $45/month
- Data transfer IN: Free
- Total: $81.50/month for 500GB outbound traffic
```

### Option 2: AWS Direct Connect

**What it is**: Dedicated private network connection from on-premises to AWS via AWS Direct Connect locations.

**Architecture**:
```
On-Premises → Cross-Connect → AWS Direct Connect Location → AWS Backbone → VPC/Services
              (fiber)          (colocation facility)           (private)
```

**Key characteristics**:
- **Bandwidth**: 50 Mbps, 100 Mbps, 200 Mbps, 300 Mbps, 400 Mbps, 500 Mbps, 1 Gbps, 2 Gbps, 5 Gbps, 10 Gbps, 100 Gbps
- **Latency**: Consistent, low-latency (typically <10ms within region)
- **Cost**: Port hours + data transfer OUT (more expensive than VPN)
- **Setup time**: Weeks to months (physical provisioning required)
- **Encryption**: Optional (use VPN over Direct Connect for encryption)

**Connection types**:

1. **Dedicated Connection**: 1 Gbps, 10 Gbps, 100 Gbps (AWS provisions entire port)
2. **Hosted Connection**: `50 Mbps − 10 Gbps` (AWS Partner provisions, shares port)

**When to use**:
- High bandwidth requirements (>1 Gbps sustained)
- Consistent low-latency requirements (<10ms)
- Large data transfers (>10TB/month, cost-effective vs VPN)
- Production workloads requiring SLA
- Hybrid cloud with persistent connectivity

**Provisioning process**:

```python
import boto3

dx = boto3.client('directconnect', region_name='us-east-1')

# Step 1: Create Direct Connect connection (Dedicated 10 Gbps)
connection_response = dx.create_connection(
    location='EqDC2',  # AWS Direct Connect location (e.g., Equinix DC2, Ashburn)
    bandwidth='10Gbps',
    connectionName='OnPrem-to-AWS-DX',
    lagId=None,  # Optional: Link Aggregation Group for multiple connections
    tags=[{'key': 'Environment', 'value': 'Production'}]
)

connection_id = connection_response['connectionId']
print(f"Direct Connect connection created: {connection_id}")
print(f"LOA-CFA (Letter of Authorization) will be available in AWS Console")
print("Provide LOA-CFA to colocation provider to establish cross-connect")

# Step 2: Create Virtual Interface (VIF) - Private VIF for VPC access
# (After physical connection is established)

vif_response = dx.create_private_virtual_interface(
    connectionId=connection_id,
    newPrivateVirtualInterface={
        'virtualInterfaceName': 'Production-VPC-VIF',
        'vlan': 100,  # VLAN tag (1-4094)
        'asn': 65000,  # Your BGP ASN
        'authKey': 'bgpAuthKey123',  # BGP MD5 authentication key
        'amazonAddress': '169.254.10.1/30',  # AWS side BGP IP
        'customerAddress': '169.254.10.2/30',  # Your side BGP IP
        'addressFamily': 'ipv4',
        'virtualGatewayId': 'vgw-0123456789abcdef0',  # Attach to VGW
        'tags': [{'key': 'Environment', 'value': 'Production'}]
    }
)

vif_id = vif_response['virtualInterface']['virtualInterfaceId']
print(f"Virtual Interface created: {vif_id}")

# Step 3: Configure BGP on your on-premises router
# - Advertise on-premises networks to AWS
# - Receive AWS VPC routes from AWS

# Example BGP configuration (Cisco):
# router bgp 65000
#   neighbor 169.254.10.1 remote-as 64512
#   neighbor 169.254.10.1 password bgpAuthKey123
#   network 10.0.0.0 mask 255.255.0.0  # Advertise on-prem network
```

**High availability configuration**:

```
# Production best practice: Redundant Direct Connect

Primary Direct Connect:
  On-Prem → DC Location 1 (e.g., Equinix DC2) → AWS Region

Secondary Direct Connect:
  On-Prem → DC Location 2 (e.g., Equinix DC6) → AWS Region

Backup VPN:
  On-Prem → Internet → AWS VPN → AWS Region

Cost: 2× Direct Connect + 1× VPN = High availability
```

**Cost example**:
```
Monthly cost for Dedicated 10 Gbps Direct Connect (us-east-1):
- Port hours: $2.25/hour × 730 hours = $1,642.50/month
- Data transfer OUT: 10TB × $0.02/GB = $204/month
- Cross-connect fee (colocation): ~$100-500/month (varies by provider)
- Total: ~$1,950-2,350/month

Compare to VPN for 10TB transfer:
- VPN connection: $36.50/month
- Data transfer OUT: 10TB × $0.09/GB = $921/month
- Total: $957.50/month

Direct Connect becomes cost-effective at ~5TB/month outbound traffic
```

### Option 3: Direct Connect + VPN (Encrypted Direct Connect)

**What it is**: VPN tunnel running over Direct Connect for encryption.

**When to use**:
- Need Direct Connect performance + encryption for compliance
- Regulated industries (healthcare, finance) requiring encryption in transit
- Hybrid cloud with sensitive data transfer

**Configuration**:

```python
# Create VPN over Direct Connect

# 1. Create Transit Gateway (modern approach, replaces VGW)
tgw_response = ec2.create_transit_gateway(
    Description='Hybrid Cloud TGW',
    Options={
        'AmazonSideAsn': 64512,
        'DefaultRouteTableAssociation': 'enable',
        'DefaultRouteTablePropagation': 'enable',
        'VpnEcmpSupport': 'enable',  # Equal-cost multi-path for VPN
        'DnsSupport': 'enable'
    }
)

tgw_id = tgw_response['TransitGateway']['TransitGatewayId']

# 2. Attach Direct Connect to TGW (via Direct Connect Gateway)
dx_gateway_response = dx.create_direct_connect_gateway(
    directConnectGatewayName='Hybrid-DXGW',
    amazonSideAsn=64512
)

dxgw_id = dx_gateway_response['directConnectGateway']['directConnectGatewayId']

# Associate Direct Connect Gateway with Transit Gateway
dx.create_direct_connect_gateway_association(
    directConnectGatewayId=dxgw_id,
    gatewayId=tgw_id
)

# 3. Create VPN connection to Transit Gateway (encrypted tunnel)
vpn_response = ec2.create_vpn_connection(
    Type='ipsec.1',
    CustomerGatewayId=cgw_id,
    TransitGatewayId=tgw_id,  # Attach to TGW instead of VGW
    Options={
        'TunnelInsideIpVersion': 'ipv4',
        'StaticRoutesOnly': False
    }
)

# Traffic flows: On-Prem → Direct Connect → TGW → VPN (encrypted) → VPC
```

**Cost**: Direct Connect cost + VPN cost (both services charged).

---

## AWS Storage Gateway (Hybrid Storage)

**What it is**: Virtual appliance that provides on-premises applications with cloud-backed storage.

**Gateway types**:

### 1. File Gateway (NFS/SMB → S3)

**Use case**: Replace file servers with S3-backed storage.

**Architecture**:
```
On-Premises Applications → File Gateway (NFS/SMB) → S3 (Standard, IA, Glacier)
                           (cache + upload)
```

**Example deployment**:

```python
import boto3

storagegateway = boto3.client('storagegateway', region_name='us-east-1')

# 1. Deploy File Gateway VM (download OVA, deploy to VMware/Hyper-V)
# 2. Activate gateway

gateway_response = storagegateway.activate_gateway(
    ActivationKey='ABCDE-12345-FGHIJ-67890',  # From gateway VM console
    GatewayName='OnPrem-FileGateway',
    GatewayTimezone='GMT-5:00',
    GatewayRegion='us-east-1',
    GatewayType='FILE_S3'  # File Gateway
)

gateway_arn = gateway_response['GatewayARN']

# 3. Create NFS file share backed by S3
file_share_response = storagegateway.create_nfs_file_share(
    ClientToken='unique-token-12345',
    GatewayARN=gateway_arn,
    Role='arn:aws:iam::123456789012:role/StorageGatewayS3Role',  # IAM role for S3 access
    LocationARN='arn:aws:s3:::my-file-gateway-bucket',  # S3 bucket
    DefaultStorageClass='S3_STANDARD_IA',  # Store in S3 Standard-IA
    ObjectACL='bucket-owner-full-control',
    ClientList=['10.0.0.0/16'],  # On-premises network CIDR
    Squash='RootSquash',
    ReadOnly=False,
    GuessMIMETypeEnabled=True,
    RequesterPays=False,
    Tags=[{'Key': 'Environment', 'Value': 'Production'}]
)

file_share_arn = file_share_response['FileShareARN']
print(f"NFS file share created: {file_share_arn}")

# 4. Mount on-premises (Linux)
# sudo mount -t nfs -o nolock,hard 10.0.1.100:/my-file-gateway-bucket /mnt/s3
```

**Cost**:
```
File Gateway costs:
- Gateway usage: Free (run on your own hardware/VM)
- S3 storage: Standard pricing ($0.023/GB-month)
- Data transfer OUT: $0.09/GB (if accessing from on-premises)
- Requests: S3 request pricing (GET, PUT, etc.)

Example: 10TB stored, 1TB transferred monthly
- S3 storage: 10,240 GB × $0.023 = $235/month
- Data transfer OUT: 1,024 GB × $0.09 = $92/month
- Total: ~$327/month
```

### 2. Volume Gateway (iSCSI → S3)

**Use case**: Block storage for on-premises applications backed by S3.

**Modes**:
- **Cached volumes**: Store frequently accessed data on-premises, full dataset in S3
- **Stored volumes**: Store full dataset on-premises, async backup to S3

**Example** (Cached volumes):

```python
# Create cached volume
volume_response = storagegateway.create_cached_iscsi_volume(
    GatewayARN=gateway_arn,
    VolumeSizeInBytes=1099511627776,  # 1TB
    TargetName='prod-database-vol',
    NetworkInterfaceId='10.0.1.100',  # Gateway IP
    ClientToken='unique-token-67890',
    SnapshotId=None,  # Optional: Create from EBS snapshot
    Tags=[{'Key': 'Application', 'Value': 'Database'}]
)

volume_arn = volume_response['VolumeARN']
target_arn = volume_response['TargetARN']

print(f"iSCSI volume created: {volume_arn}")
print(f"iSCSI target: {target_arn}")

# Mount on-premises (Linux)
# sudo iscsiadm -m discovery -t st -p 10.0.1.100
# sudo iscsiadm -m node -T iqn.1997-05.com.amazon:prod-database-vol -l
```

**Use cases**:
- Database backups (SQL Server, Oracle) to S3
- Application servers needing block storage
- Replace SAN with cloud-backed storage

### 3. Tape Gateway (VTL → S3/Glacier)

**Use case**: Replace physical tape backup infrastructure with cloud-based virtual tapes.

**Architecture**:
```
Backup Software (Veeam, Commvault) → Tape Gateway (VTL) → S3 → Glacier/Deep Archive
                                      (iSCSI)
```

**Cost**:
```
Tape Gateway costs:
- Virtual tapes in S3: $0.023/GB-month
- Archived tapes in Glacier Deep Archive: $0.00099/GB-month
- Retrieval from Glacier: $0.02/GB + time-based fees

Example: 100TB backup archive
- Active (S3): 10TB × $0.023 = $230/month
- Archive (Glacier Deep Archive): 90TB × $0.00099 = $89/month
- Total: $319/month

Compare to physical tapes: $5,000-10,000/year (media + offsite storage)
```

---

## AWS Outposts (AWS Infrastructure On-Premises)

**What it is**: Fully managed AWS compute and storage racks deployed in your on-premises data center.

**Key characteristics**:
- **Hardware**: AWS-designed racks (42U), fully managed by AWS
- **Capacity**: 1 rack (starting at ~90TB storage, compute varies)
- **Services**: EC2, EBS, S3 on Outposts, RDS, ECS, EKS (subset of AWS services)
- **Connectivity**: Requires connection to AWS Region (Direct Connect or VPN)
- **Latency**: Single-digit millisecond latency to on-premises applications
- **Cost**: Monthly subscription ($$$, enterprise pricing)

**When to use**:
- Ultra-low latency requirements (<5ms) to on-premises systems
- Data residency requirements (data must stay on-premises)
- Local data processing for edge/manufacturing use cases
- Hybrid cloud with consistent AWS experience on-premises

**Example architecture**:

```
On-Premises Data Center:
  ┌─────────────────────────────────┐
  │ AWS Outposts Rack               │
  │ - EC2 instances                 │
  │ - EBS volumes                   │
  │ - S3 on Outposts                │
  │ - RDS on Outposts               │
  │ - ECS/EKS clusters              │
  └─────────────────────────────────┘
           ↓ (Direct Connect or VPN)
  ┌─────────────────────────────────┐
  │ AWS Region (us-east-1)          │
  │ - Control plane                 │
  │ - CloudWatch logs/metrics       │
  │ - Systems Manager               │
  │ - Additional AWS services       │
  └─────────────────────────────────┘
```

**Provisioning**:

```python
# Outposts provisioned via AWS Console/Sales (not API)
# High-level workflow:

# 1. Order Outposts (contact AWS Sales)
# 2. Site preparation (power, cooling, network, physical space)
# 3. AWS ships and installs Outposts rack
# 4. AWS manages hardware, patching, monitoring
# 5. You manage applications (EC2, containers, etc.)

# Example: Launch EC2 on Outposts
import boto3

ec2 = boto3.client('ec2', region_name='us-east-1')

# Launch instance on Outposts subnet
instance = ec2.run_instances(
    ImageId='ami-0abcdef1234567890',
    InstanceType='m5.large',
    SubnetId='subnet-outpost-0123456789abcdef0',  # Outposts subnet
    MinCount=1,
    MaxCount=1
)

print(f"EC2 instance launched on Outposts: {instance['Instances'][0]['InstanceId']}")
```

**Cost**:
```
Outposts pricing (estimated, contact AWS for actual pricing):
- Upfront: $0 (AWS retains ownership)
- Monthly subscription: $10,000-50,000/month depending on configuration
- 3-year commitment required
- Includes: Hardware, installation, maintenance, support

Use cases justifying cost:
- Manufacturing with strict latency requirements (<5ms to local systems)
- Healthcare with data residency requirements (HIPAA, patient data on-premises)
- Financial services with regulatory constraints
- Telecom/media rendering requiring local processing
```

---

## Decision Framework: Choosing the Right Option

### Step 1: Determine Connectivity Requirements

| Requirement | VPN | Direct Connect | Direct Connect + VPN | Outposts |
|-------------|-----|----------------|---------------------|----------|
| **Bandwidth** <1 Gbps | ✅ Yes | ⚠️ Overkill | ⚠️ Overkill | ❌ No |
| **Bandwidth** 1-10 Gbps | ❌ No | ✅ Yes | ✅ Yes | ❌ No |
| **Bandwidth** >10 Gbps | ❌ No | ✅ Yes | ✅ Yes | ❌ No |
| **Latency** <10ms consistent | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes (on-prem) |
| **Latency** <100ms acceptable | ✅ Yes | ✅ Yes | ✅ Yes | N/A |
| **Encryption required** | ✅ Yes (built-in) | ❌ No (add VPN) | ✅ Yes | ✅ Yes (regional) |
| **SLA required** | ❌ No | ✅ Yes (99.95%) | ✅ Yes | ✅ Yes |
| **Budget** <$100/month | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Budget** $1,000+/month | ⚠️ Unnecessary | ✅ Yes | ✅ Yes | ⚠️ Depends |
| **Setup time** <1 week | ✅ Yes (hours) | ❌ No (weeks) | ❌ No (weeks) | ❌ No (months) |

### Step 2: Calculate Total Cost of Ownership (3-Year TCO)

**Scenario**: Hybrid cloud with 5TB/month data transfer OUT to on-premises.

**Option 1: Site-to-Site VPN**
```
Monthly:
- VPN connection: $36.50
- Data transfer OUT: 5,120 GB × $0.09 = $460.80
- Total: $497.30/month

3-year TCO: $497.30 × 36 = $17,903
```

**Option 2: Dedicated Direct Connect (1 Gbps)**
```
Monthly:
- Port hours: $0.30/hour × 730 = $219
- Data transfer OUT: 5,120 GB × $0.02 = $102.40
- Colocation cross-connect: ~$200
- Total: $521.40/month

3-year TCO: $521.40 × 36 = $18,770

Breakeven: At ~5TB/month, Direct Connect and VPN cost similar
Above 5TB/month, Direct Connect becomes cheaper
```

**Option 3: Direct Connect + VPN (encrypted)**
```
Monthly:
- Direct Connect: $521.40
- VPN: $36.50
- Total: $557.90/month

3-year TCO: $557.90 × 36 = $20,084
```

**Decision**:
- **<5TB/month**: Use VPN ($497/month vs $521/month for DX)
- **>5TB/month**: Use Direct Connect ($521/month vs $497/month for VPN, but better performance)
- **Encryption required + >5TB/month**: Use Direct Connect + VPN ($558/month)

### Step 3: Storage Gateway vs AWS Services

**Scenario**: Replace on-premises file server with cloud storage.

| Option | Monthly Cost (10TB storage, 1TB transfer) | Use Case |
|--------|-------------------------------------------|----------|
| **File Gateway** | $327 (S3 storage + transfer) | Gradual migration, keep on-prem apps |
| **Direct S3 access** | $235 (S3 storage + SDK integration) | Refactor apps to use S3 API directly |
| **Amazon FSx** | $1,200 (FSx Windows + transfer) | Windows file servers, Active Directory |
| **Amazon EFS** | $3,072 (EFS Standard) | Linux NFS, shared across EC2 |

**Decision**:
- **Hybrid during migration**: File Gateway ($327/month)
- **Cloud-native refactor**: Direct S3 ($235/month, lowest cost)
- **Windows file server replacement**: FSx ($1,200/month, managed service)
- **Linux shared storage**: EFS ($3,072/month for 10TB, or EFS IA for $256/month if infrequent access)

### Step 4: Outposts vs Traditional Hybrid

**Scenario**: Manufacturing facility with <5ms latency requirement for production systems.

| Option | 3-Year TCO | Latency | Data Residency | Pros | Cons |
|--------|------------|---------|----------------|------|------|
| **On-Premises + VPN** | $50K (servers) + $18K (VPN) = $68K | 20-100ms | ✅ Yes | Low cost | High latency, manage infra |
| **On-Premises + DX** | $50K + $19K (DX) = $69K | 5-10ms | ✅ Yes | Lower latency | Still manage infra |
| **AWS Outposts** | $360K-1.8M (subscription) | <5ms | ✅ Yes | AWS managed, low latency | Very expensive |

**Decision**:
- **<5ms latency required + budget available**: Outposts ($10K-50K/month)
- **5-10ms acceptable**: On-premises + Direct Connect ($521/month)
- **Budget-constrained**: On-premises + VPN ($497/month)

---

## Hybrid Architecture Patterns

### Pattern 1: Migration Wave (Temporary Hybrid)

**Use case**: Gradual migration to AWS over 12-18 months.

**Architecture**:
```
Phase 1 (Months 1-3):
  On-Premises (80% workloads) ←→ VPN ←→ AWS (20% workloads)

Phase 2 (Months 4-9):
  On-Premises (50% workloads) ←→ Direct Connect ←→ AWS (50% workloads)
  (Upgrade to DX for bandwidth)

Phase 3 (Months 10-18):
  On-Premises (20% workloads) ←→ Direct Connect ←→ AWS (80% workloads)

Phase 4 (Month 18+):
  AWS (100% workloads)
  (Decommission Direct Connect)
```

**Cost optimization**:
- Start with VPN ($36/month) for initial migration
- Upgrade to Direct Connect ($219+/month) when traffic increases
- Decommission Direct Connect once migration complete

### Pattern 2: Burst to Cloud

**Use case**: On-premises capacity, burst to AWS for peak demand.

**Architecture**:
```
Normal Load:
  Applications → On-Premises Infrastructure (100% capacity)

Peak Load:
  Applications → On-Premises Infrastructure (100% capacity)
               → Direct Connect
               → AWS (autoscaling for overflow traffic)
```

**Implementation**:
```python
# Use hybrid load balancing
# On-premises F5/NGINX forwards overflow to AWS ALB

# AWS autoscaling based on on-premises metrics
cloudwatch = boto3.client('cloudwatch')

# Custom metric: On-Premises CPU
cloudwatch.put_metric_data(
    Namespace='Hybrid',
    MetricData=[{
        'MetricName': 'OnPremisesCPU',
        'Value': 85.0,  # From on-prem monitoring
        'Unit': 'Percent'
    }]
)

# Autoscaling policy: Scale AWS when on-prem CPU >80%
autoscaling = boto3.client('autoscaling')

autoscaling.put_scaling_policy(
    AutoScalingGroupName='hybrid-burst-asg',
    PolicyName='scale-on-onprem-cpu',
    PolicyType='TargetTrackingScaling',
    TargetTrackingConfiguration={
        'CustomizedMetricSpecification': {
            'MetricName': 'OnPremisesCPU',
            'Namespace': 'Hybrid',
            'Statistic': 'Average'
        },
        'TargetValue': 60.0  # Keep on-prem below 60% by scaling AWS
    }
)
```

### Pattern 3: Disaster Recovery (Active-Passive)

**Use case**: On-premises primary, AWS for DR.

**Architecture**:
```
Primary (On-Premises):
  Production workloads (active)
  ↓ (continuous replication via DMS, Storage Gateway, or DataSync)
Secondary (AWS):
  Standby workloads (passive, minimal cost)

Failover:
  1. Detect primary failure
  2. Promote AWS to primary
  3. Update DNS to point to AWS
```

**Implementation**:
```python
# Continuous database replication (DMS)
dms = boto3.client('dms')

# Replicate on-prem database to AWS (CDC mode)
dms_task = dms.create_replication_task(
    ReplicationTaskIdentifier='dr-replication',
    SourceEndpointArn=onprem_db_arn,
    TargetEndpointArn=aws_rds_arn,
    MigrationType='cdc',  # Continuous replication
    # ... (table mappings, settings)
)

# Failover process (automated or manual)
def failover_to_aws():
    # 1. Stop DMS replication
    dms.stop_replication_task(ReplicationTaskArn=dms_task_arn)

    # 2. Promote RDS read replica to primary (if using)
    rds = boto3.client('rds')
    rds.promote_read_replica(DBInstanceIdentifier='dr-database')

    # 3. Update Route 53 to point to AWS
    route53 = boto3.client('route53')
    route53.change_resource_record_sets(
        HostedZoneId='Z1234567890ABC',
        ChangeBatch={
            'Changes': [{
                'Action': 'UPSERT',
                'ResourceRecordSet': {
                    'Name': 'app.company.com',
                    'Type': 'CNAME',
                    'TTL': 60,
                    'ResourceRecords': [{'Value': 'app-alb.us-east-1.elb.amazonaws.com'}]
                }
            }]
        }
    )

    print("Failover to AWS complete")

# Cost: DMS replication instance (~$140/month) + minimal AWS infrastructure (stopped EC2, small RDS)
```

### Pattern 4: Data Analytics (On-Premises Collection, Cloud Processing)

**Use case**: Collect data on-premises, process in AWS for cost efficiency.

**Architecture**:
```
On-Premises:
  IoT Devices → Data Collection Servers → Storage Gateway (File)
                                        → S3 (raw data)
AWS:
  S3 → Glue ETL → Athena/Redshift → QuickSight (analytics)
```

**Implementation**:
```python
# File Gateway uploads to S3
# Trigger Glue ETL on new files

s3 = boto3.client('s3')
glue = boto3.client('glue')

# S3 event notification → Lambda → Glue ETL
def lambda_handler(event, context):
    # Triggered when new file uploaded via File Gateway
    bucket = event['Records'][0]['s3']['bucket']['name']
    key = event['Records'][0]['s3']['object']['key']

    # Start Glue ETL job
    glue.start_job_run(
        JobName='process-iot-data',
        Arguments={
            '--input_path': f's3://{bucket}/{key}',
            '--output_path': 's3://processed-data/'
        }
    )

# Cost: File Gateway (free) + S3 storage + Glue ETL (pay-per-use)
```

---

## Security Best Practices

### 1. Encrypt Data in Transit

**VPN**: Encryption built-in (AES-256).

**Direct Connect**: Add VPN for encryption.

```python
# MACsec encryption for Direct Connect (Layer 2 encryption)
dx.associate_mac_sec_key(
    connectionId=connection_id,
    secretARN='arn:aws:secretsmanager:us-east-1:123456789012:secret:dx-macsec-key'
)

# Or: Run VPN over Direct Connect (Layer 3 encryption)
```

### 2. Use Private Connectivity (No Public Internet)

```python
# Configure VPC endpoints for AWS services (avoid internet)
ec2.create_vpc_endpoint(
    VpcId='vpc-0123456789abcdef0',
    ServiceName='com.amazonaws.us-east-1.s3',  # S3 VPC endpoint
    RouteTableIds=['rtb-0123456789abcdef0']
)

# Access S3 from on-premises via Direct Connect + VPC endpoint (private)
```

### 3. Implement Network Segmentation

```python
# Separate VPCs for different security zones
# Production VPC (isolated)
# Development VPC (isolated)
# Shared Services VPC (Direct Connect attachment)

# Use Transit Gateway for hub-and-spoke routing
tgw = ec2.create_transit_gateway(
    Description='Hybrid Hub',
    Options={'DefaultRouteTableAssociation': 'disable'}  # Custom route tables
)

# Create separate route tables for production vs development
prod_rt = ec2.create_transit_gateway_route_table(
    TransitGatewayId=tgw_id,
    TagSpecifications=[{'ResourceType': 'transit-gateway-route-table', 'Tags': [{'Key': 'Name', 'Value': 'Production'}]}]
)

dev_rt = ec2.create_transit_gateway_route_table(
    TransitGatewayId=tgw_id,
    TagSpecifications=[{'ResourceType': 'transit-gateway-route-table', 'Tags': [{'Key': 'Name', 'Value': 'Development'}]}]
)

# Control which networks can communicate
```

### 4. Monitor Hybrid Connectivity

```python
# CloudWatch metrics for Direct Connect
cloudwatch = boto3.client('cloudwatch')

# Monitor connection state
cloudwatch.put_metric_alarm(
    AlarmName='DirectConnect-Down',
    MetricName='ConnectionState',
    Namespace='AWS/DX',
    Statistic='Minimum',
    Period=60,
    EvaluationPeriods=2,
    Threshold=1,  # 0 = down, 1 = up
    ComparisonOperator='LessThanThreshold',
    AlarmActions=['arn:aws:sns:us-east-1:123456789012:ops-alerts']
)

# Monitor VPN tunnel status
cloudwatch.put_metric_alarm(
    AlarmName='VPN-Tunnel-Down',
    MetricName='TunnelState',
    Namespace='AWS/VPN',
    Dimensions=[{'Name': 'VpnId', 'Value': vpn_id}],
    Statistic='Maximum',
    Period=60,
    EvaluationPeriods=2,
    Threshold=0,  # 0 = down, 1 = up
    ComparisonOperator='LessThanOrEqualToThreshold',
    AlarmActions=['arn:aws:sns:us-east-1:123456789012:ops-alerts']
)
```

---

## Common Pitfalls

### 1. Underestimating Direct Connect Provisioning Time

**Problem**: Order Direct Connect for migration cutover, but takes 2-3 months to provision.

**Solution**: Order Direct Connect early, use VPN as backup during provisioning.

### 2. Not Testing Failover

**Problem**: Direct Connect fails, backup VPN not configured properly.

**Solution**: Always test failover scenarios.

```python
# Test failover by shutting down Direct Connect VIF
dx.delete_virtual_interface(virtualInterfaceId=vif_id)

# Verify traffic fails over to VPN
# Monitor application performance

# Restore Direct Connect VIF
# Verify traffic returns to Direct Connect
```

### 3. Incorrect MTU Settings

**Problem**: Packet fragmentation causes performance issues over VPN/Direct Connect.

**Solution**: Configure MTU correctly.

```bash
# VPN: MTU = 1400 bytes (to account for IPsec overhead)
ip link set dev eth0 mtu 1400

# Direct Connect: MTU = 9001 bytes (jumbo frames supported)
ip link set dev eth0 mtu 9001

# Test MTU
ping -M do -s 1372 aws-endpoint.com  # For VPN (1400 - 28 byte ICMP header)
ping -M do -s 8973 aws-endpoint.com  # For Direct Connect (9001 - 28)
```

### 4. Forgetting Data Transfer Costs

**Problem**: 10TB/month transfer from AWS to on-premises costs $921/month (unexpected).

**Solution**: Factor data transfer costs into TCO.

```
Data transfer OUT pricing (us-east-1):
- First 100 GB/month: $0.09/GB = $9
- Next 10 TB/month: $0.085/GB = $870
- Next 40 TB/month: $0.07/GB

Always calculate: (monthly GB transferred OUT) × ($/GB) = monthly cost
```

### 5. Not Using Transit Gateway for Scalability

**Problem**: Attach 10 VPCs to Direct Connect, hit VGW peering limits.

**Solution**: Use Transit Gateway as hub.

```
❌ BAD (doesn't scale):
  On-Prem → Direct Connect → VGW 1 → VPC 1
                           → VGW 2 → VPC 2
                           → VGW 3 → VPC 3
  (Complex, hard to manage)

✅ GOOD (scales to 1000s of VPCs):
  On-Prem → Direct Connect → Transit Gateway → VPC 1
                                             → VPC 2
                                             → VPC 3
                                             → ... VPC N
  (Single point of management)
```

---

## Key Takeaways

**Connectivity Options**:
1. **Site-to-Site VPN**: $36/month + data transfer, <1 Gbps, encrypted, setup in hours
2. **Direct Connect**: $219+/month + data transfer, 1-100 Gbps, low latency, weeks to provision
3. **Direct Connect + VPN**: Encrypted Direct Connect for compliance, highest cost
4. **Cost breakeven**: Direct Connect becomes cheaper than VPN at ~5TB/month data transfer

**Storage Gateway**:
5. **File Gateway**: Replace file servers with S3-backed NFS/SMB, $327/month for 10TB + 1TB transfer
6. **Volume Gateway**: iSCSI block storage backed by S3, for databases and applications
7. **Tape Gateway**: Replace physical tapes with virtual tapes stored in S3/Glacier, $319/month for 100TB

**AWS Outposts**:
8. **Use for**: <5ms latency requirements, data residency mandates, $10K-50K/month
9. **Don't use for**: Cost optimization (very expensive), standard cloud workloads

**Decision Framework**:
10. **<5TB/month transfer**: Use VPN ($497/month)
11. **>5TB/month transfer**: Use Direct Connect ($521+/month)
12. **Encryption required**: Use VPN (built-in) or Direct Connect + VPN ($558/month)
13. **Ultra-low latency** (<5ms): Use Outposts or on-premises with Direct Connect

**Architecture Patterns**:
14. **Migration**: Start with VPN, upgrade to Direct Connect during migration, decommission post-migration
15. **Burst to cloud**: On-premises primary, AWS autoscales for overflow traffic
16. **Disaster recovery**: On-premises primary, continuous replication to AWS standby
17. **Data analytics**: Collect on-premises (File Gateway), process in AWS (Glue/Athena)

**High Availability**:
18. **Production**: Redundant Direct Connect (2 locations) + backup VPN
19. **Development/Test**: Single VPN (acceptable downtime)
20. **Monitor connectivity**: CloudWatch alarms for connection state, tunnel state

**Cost Optimization**:
21. **Right-size Direct Connect**: Start with 1 Gbps, upgrade only if needed
22. **Hosted connections**: Use AWS Partner hosted connections for <1 Gbps (cheaper than dedicated)
23. **Decommission unused**: Remove Direct Connect and VPN after migration complete
24. **Use Transit Gateway**: Centralize hybrid connectivity, simplify management

**Security**:
25. **Encrypt in transit**: VPN (built-in), Direct Connect + VPN, or MACsec for Direct Connect
26. **Private connectivity**: VPC endpoints + Direct Connect (no public internet)
27. **Network segmentation**: Transit Gateway with separate route tables for prod/dev
28. **Monitor actively**: CloudWatch alarms for connection failures, automated failover testing

**Common Pitfalls**:
29. **Provision Direct Connect early** (2-3 months lead time)
30. **Test failover scenarios** before production (VPN backup, route failover)
31. **Configure MTU correctly** (1400 for VPN, 9001 for Direct Connect)
32. **Budget for data transfer OUT** ($0.09/GB for VPN, $0.02/GB for Direct Connect)

Hybrid cloud connectivity is a critical architectural decision. VPN provides quick, encrypted, low-cost connectivity for temporary or low-bandwidth needs. Direct Connect provides high-bandwidth, low-latency, cost-effective (for high volumes) connectivity for production workloads. Storage Gateway bridges on-premises storage with cloud-backed S3. Outposts brings AWS infrastructure on-premises for ultra-low latency or data residency requirements. Choose based on bandwidth needs, latency requirements, compliance mandates, and budget constraints.
