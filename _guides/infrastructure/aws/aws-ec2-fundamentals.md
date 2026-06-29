---
title: "EC2 for System Architects"
layout: guide
category: AWS
subcategory: Compute Services
description: "Comprehensive guide to AWS EC2 instance selection, cost optimization, security, high availability, and architectural patterns for system architects"
tags: [infrastructure, aws, cloud-computing, cost-analysis, practical, fundamentals]
---

## What Problems EC2 Solves

Amazon EC2 (Elastic Compute Cloud) provides resizable compute capacity in the cloud, addressing fundamental infrastructure challenges that organizations face:

**Infrastructure challenges solved:**
- **Eliminates upfront hardware investment**: No need to purchase and maintain physical servers, data center space, or supporting infrastructure
- **Rapid scaling**: Launch instances in minutes and scale capacity up or down as requirements change
- **Pay-per-use model**: Only pay for compute time consumed, measured in instance seconds
- **Complete control**: Full control over operating system, networking, storage configuration, and security settings
- **Global availability**: Deploy across multiple geographic regions and availability zones for high availability and low latency
- **Flexibility**: Wide variety of instance types optimized for different workload characteristics

EC2 provides the foundation for compute workloads on AWS, offering the control of traditional servers with the flexibility and economics of cloud computing.

## Instance Type Families and Selection

### Instance Naming Convention

EC2 instance names follow a structured convention: **family + generation + processor family + capabilities + size**

Example: `m7g.xlarge`
- `m` = instance family (general purpose)
- `7` = generation
- `g` = Graviton processor (ARM-based)
- `xlarge` = size

### Instance Type Families

#### General Purpose (M, T series)

Balanced compute, memory, and networking resources suitable for most workloads.

**M-series** (e.g., M5, M6i, M7g):
- Consistent performance for steady-state workloads
- Balance of compute, memory, and network resources
- Good default choice when workload characteristics are unknown

**T-series** (e.g., T3, T4g):
- Burstable performance instances that accumulate CPU credits during idle periods
- Cost-effective for workloads with variable usage patterns
- Ideal for development environments, code repositories, microservices

**When to use:**
- Web servers and application servers
- Small-to-medium databases
- Development and testing environments
- Code repositories and build servers
- Microservices with variable load

#### Compute Optimized (C series)

High-performance processors with the highest CPU-to-memory ratio.

**Examples**: C5, C6i, C7g

**When to use:**
- Batch processing workloads
- Media transcoding and video encoding
- High-performance web servers
- Scientific modeling and simulations
- Machine learning inference
- Gaming servers
- Ad serving engines

**Trade-offs**: Higher compute capacity means higher cost per hour compared to general purpose instances with similar memory.

#### Memory Optimized (R, X, U series)

High memory-to-CPU ratio for memory-intensive applications.

**R-series** (e.g., R5, R6i, R7g):
- Standard memory-optimized instances
- Good for in-memory databases and caching

**X-series** (e.g., X2):
- Higher memory capacity (up to 4 TB per instance)
- Optimized for memory-intensive enterprise applications

**U-series**:
- Ultra-high memory (up to 24 TB per instance)
- Purpose-built for large in-memory databases like SAP HANA

**When to use:**
- In-memory databases (Redis, Memcached)
- Real-time big data analytics
- High-performance relational databases
- SAP HANA and other in-memory ERP systems
- Large-scale data processing and ETL workloads

#### Storage Optimized (D, I, Im, Is series)

High sequential read/write access to very large datasets on local storage.

**D-series** (e.g., D3):
- Dense HDD storage for distributed file systems

**I-series** (e.g., I4i):
- NVMe SSD storage for low-latency workloads

**Im/Is-series** (e.g., Im4gn, Is4gen):
- AWS Graviton processors with high-performance local storage

**When to use:**
- NoSQL databases (Cassandra, MongoDB, ScyllaDB)
- Data warehousing applications
- Distributed file systems (Hadoop HDFS, MapReduce)
- Log processing and analytics
- Elasticsearch and OpenSearch clusters

**Important consideration**: These instances use instance store (ephemeral) storage. Data is lost when the instance stops or terminates. Implement replication and backup strategies accordingly.

#### Accelerated Computing (P, G, Inf, Trn series)

Hardware accelerators (GPUs, FPGAs, inference processors) for specialized workloads.

**P-series** (e.g., P4, P5):
- NVIDIA GPUs for machine learning training and HPC

**G-series** (e.g., G5):
- NVIDIA GPUs for graphics-intensive applications and machine learning inference

**Inf-series** (e.g., Inf2):
- AWS Inferentia chips optimized for machine learning inference

**Trn-series** (e.g., Trn1):
- AWS Trainium chips optimized for deep learning training

**When to use:**
- Machine learning model training and inference
- High-performance computing (HPC) simulations
- Graphics rendering and video processing
- Financial modeling and risk analysis
- Genomics research and computational chemistry

<div class="callout callout--tip">
<p class="callout__title">Instance Selection Strategy</p>
<p>Start with a general purpose (M or T series) instance unless you know your workload is specifically compute, memory, or storage bound. With per-second billing, testing different instance types is cost-effective.</p>
</div>

### Selection Criteria

Choose instance types based on these key factors:

**1. Workload characteristics**: Identify whether your application is CPU-bound, memory-bound, I/O-bound, or requires specialized accelerators.

**2. Performance requirements**: Consider throughput, latency, IOPS, and network bandwidth needs.

**3. Cost constraints**: Balance performance needs with budget. Higher-performance instances cost more per hour.

**4. Operating system compatibility**: Graviton (ARM) instances only support Linux operating systems. Windows workloads require x86-based instances.

**5. Regional availability**: Newer instance types may not be available in all AWS regions and availability zones.

**Best practice**: AWS recommends testing instance types with benchmark applications. With per-second billing, experimentation is cost-effective. Launch test instances, run representative workloads, and measure actual performance before committing to long-term purchases.

## AWS Graviton Processors

### What is Graviton?

AWS Graviton processors are custom 64-bit ARM Neoverse cores designed by AWS for optimized cloud performance. Graviton instances are identifiable by the letter "g" in the processor family (e.g., m7g, c7g, r7g).

### Performance and Cost Benefits

AWS Graviton delivers significant advantages over comparable x86-based instances:

**Cost and performance improvements:**
- **Up to 40% better price-performance** compared to equivalent x86-based instances
- **Up to 60% less energy consumption** for equivalent workloads
- **Graviton2 improvements**: 7x more performance, 4x more compute cores, 5x faster memory, 2x larger caches compared to first-generation Graviton
- **Graviton4 improvements** (latest generation): Up to 40% performance enhancement and 29% price-performance improvement over Graviton3

### Real-World Results

Organizations report substantial benefits from Graviton adoption:

- **National Australia Bank**: Saving an estimated $1 million per month
- **Pix4D**: Reduced infrastructure costs by 20%
- **OpenSearch workloads**: 38% improvement in indexing throughput, 50% reduction in indexing latency, 40% improvement in query performance
- **T4g vs T3 instances**: Up to 40% more efficient performance

### When to Use Graviton

**Ideal for:**
- Linux-based workloads (containers, web applications, microservices)
- Open-source software with ARM64 support
- Cost-sensitive workloads where 40% savings matter significantly
- Sustainability initiatives (60% lower energy consumption)
- Container-based architectures using multi-architecture images

**Important considerations:**
- **Linux only**: Graviton processors only support Linux operating systems (Amazon Linux 2, Ubuntu, RHEL, etc.)
- **ARM compatibility required**: Applications and dependencies must be ARM64-compatible
- **Container images**: Build multi-architecture container images (ARM64 and AMD64) for maximum flexibility
- **Built on Nitro System**: All Graviton instances leverage AWS Nitro System benefits

**Best practice**: For new Linux workloads, default to Graviton instances unless you have specific x86 dependencies. The cost savings and performance improvements typically outweigh any migration effort.

## AWS Nitro System

### What is Nitro?

The AWS Nitro System is a collection of building blocks that offloads traditional virtualization functions to dedicated hardware and software. Nitro provides the foundation for all modern EC2 instances.

### Architecture Components

**Nitro Cards**:
- Dedicated hardware for VPC networking
- EBS storage connectivity
- Instance storage (NVMe)
- Controller functions

**Nitro Security Chip**:
- Hardware-based security
- Integrated into the motherboard
- Continuous monitoring and protection

**Nitro Hypervisor**:
- Lightweight hypervisor
- Memory and CPU allocation
- Minimal overhead

### Key Benefits

**Performance**: Nitro delivers practically all compute and memory resources of the host hardware to instances. Traditional hypervisors reserve 10-20% of resources for virtualization overhead. Nitro reduces this to near zero.

**Security**:
- **Minimized attack surface**: Offloading functions to dedicated hardware reduces the hypervisor attack surface
- **Locked-down security model**: Prohibits all administrative access, including by AWS employees
- **Hardware-based protection**: Eliminates possibility of human error, misconfiguration, or insider threats
- **Continuous attestation**: Nitro Security Chip continuously validates system integrity

**Networking**: High-speed networking (up to 400 Gbps) and EBS bandwidth (up to 80 Gbps) delivered via dedicated Nitro Cards.

**Enhanced capabilities**: Support for significantly more IP addresses per instance, larger instance sizes, and bare-metal instances.

### AWS Nitro Enclaves

Nitro Enclaves provide isolated compute environments within EC2 instances for processing highly sensitive data.

**Characteristics:**
- **Fully isolated**: Separate virtual machines with no persistent storage, no interactive access (no SSH/RDP), no external networking
- **Cryptographic attestation**: Verify enclave identity and that only authorized code runs inside
- **AWS KMS integration**: Decrypt data inside the enclave using KMS with attestation-based access
- **Low-latency communication**: High-throughput communication between parent instance and enclave via local vsock sockets
- **No additional cost**: Only pay for the EC2 instance and associated AWS services

**Use cases:**
- Processing personally identifiable information (PII)
- Healthcare data processing (HIPAA compliance)
- Financial data and payment card information (PCI DSS)
- Intellectual property protection
- Digital rights management (DRM)
- Multi-party computation scenarios

**How it works**: Nitro Enclaves allocate CPU cores and memory from the parent EC2 instance, creating an isolated environment. Even root or administrator users on the parent instance cannot access the enclave. The enclave uses cryptographic attestation to prove to AWS KMS (or other services) that only authorized code is running, enabling secure key access.

**Best practice**: Use Nitro Enclaves when processing sensitive data that requires cryptographic proof of isolation. The attestation mechanism provides stronger security guarantees than traditional instance-level isolation.

## Cost Optimization Strategies

### Pricing Models Overview

AWS offers four distinct pricing models, each tailored to different usage patterns:

| Pricing Model | Discount | Commitment | Flexibility | Best For |
|---------------|----------|------------|-------------|----------|
| **On-Demand** | 0% (baseline) | None | Maximum | Unpredictable workloads, testing |
| **Savings Plans** | Up to 72% | 1 or 3 years | High | Mixed workloads, evolving architectures |
| **Reserved Instances** | Up to 72% | 1 or 3 years | Moderate | Predictable workloads, specific configurations |
| **Spot Instances** | Up to 90% | None | Low (can be interrupted) | Fault-tolerant, flexible workloads |

### Savings Plans (AWS Recommended)

AWS recommends Savings Plans over Reserved Instances as "the easiest and most flexible way to save money on AWS compute."

#### Compute Savings Plans

**Discount**: Up to 66% off On-Demand pricing

**Flexibility**: Applies automatically to:
- EC2 instances (any family, size, region, OS, tenancy)
- AWS Fargate
- AWS Lambda
- Dedicated Hosts

**How it works**: Commit to a specific dollar amount per hour (e.g., $10/hour) for 1 or 3 years. AWS automatically applies the discount to your compute usage up to the commitment amount.

**When to use**: Best for organizations with workloads that vary across services, instance types, or regions. Ideal when your architecture is evolving and you need maximum flexibility.

#### EC2 Instance Savings Plans

**Discount**: Up to 72% off On-Demand pricing

**Flexibility**: Tied to a specific instance family within a region, but flexible on:
- Instance size within the family
- Operating system
- Tenancy (shared or dedicated)

**Example**: Commit to M5 instances in us-east-1. You can switch between m5.large, m5.xlarge, m5.2xlarge, and change between Linux and Windows.

**When to use**: Best for predictable EC2 workloads where you know the instance family but may need to adjust sizes or operating systems.

### Reserved Instances

#### Standard Reserved Instances

**Discount**: Up to 72% off On-Demand pricing (matching EC2 Instance Savings Plans)

**Flexibility**:
- Can modify instance size within the same family
- Cannot change instance family, region, or OS
- Can be sold on AWS Reserved Instance Marketplace

**When to use**: Best for fixed, high-utilization workloads where resale flexibility on the marketplace matters. Also useful when you need instance reservations for capacity planning in specific availability zones.

#### Convertible Reserved Instances

**Discount**: 31-54% off On-Demand pricing (lower than Standard RIs)

**Flexibility**:
- Can be exchanged for different instance types, families, OS, or tenancy
- Cannot be sold on the marketplace

**When to use**: Best for predictable workloads that may need configuration changes over the commitment period. Trade lower discount for exchange flexibility.

### Spot Instances

**Discount**: Up to 90% off On-Demand pricing

**How it works**: Use spare AWS capacity that can be reclaimed with a 2-minute warning when AWS needs the capacity back.

**Reliability**: AWS data from March 2024 shows only 5% of Spot instances were interrupted in the previous three months. Interruptions are infrequent, not constant.

**When to use**:
- Fault-tolerant applications that can handle interruptions
- Batch processing workloads
- Data analysis and ETL jobs
- CI/CD build systems
- Containerized workloads with orchestration (Kubernetes, ECS)
- Stateless web services behind load balancers

**When NOT to use**:
- Databases or stateful applications without replication
- Real-time applications requiring guaranteed availability
- Workloads that cannot checkpoint and resume

**Best practice**: Combine Spot instances with On-Demand instances in Auto Scaling Groups. Use Spot for the baseline capacity and On-Demand for peak demand, or vice versa depending on your risk tolerance.

### Industry Insights and Recommendations

**2024 adoption data**:
- **53% of organizations** use no commitment discounts, leaving significant savings on the table
- **38% use Savings Plans** vs. **18% use Reserved Instances** (2x adoption rate)
- Organizations increasingly prefer Savings Plans for flexibility over Reserved Instances

**Cost optimization strategy**:

1. **Analyze before committing**: Use AWS Cost Explorer and Compute Optimizer to understand your usage patterns
2. **Right-size first**: Ensure instances are appropriately sized before purchasing commitments
3. **Layer pricing models**:
   - **Compute Savings Plans**: Cover baseline compute across all services (EC2, Lambda, Fargate)
   - **EC2 Instance Savings Plans or RIs**: Cover predictable EC2 workloads in specific families
   - **Spot Instances**: Use for fault-tolerant, flexible workloads
   - **On-Demand**: Fill the gap for unpredictable demand
4. **Start conservative**: Purchase commitments covering 60-70% of baseline usage, not 100%
5. **Leverage Consolidated Billing**: Apply Savings Plans across multiple accounts in AWS Organizations
6. **Review quarterly**: Adjust commitments as usage patterns change

**Example strategy for a typical organization**:
- 60% coverage with Compute Savings Plans (flexibility across services)
- 20% coverage with EC2 Instance Savings Plans for known workloads
- 15% using Spot Instances for batch processing and testing
- 5% On-Demand for unpredictable bursts

This approach balances cost savings (up to 72% on committed capacity, up to 90% on Spot) with flexibility to adapt to changing needs.

## Right-Sizing with Compute Optimizer

### What is AWS Compute Optimizer?

AWS Compute Optimizer is a free service that analyzes CloudWatch metrics to generate rightsizing recommendations for EC2 instances, Auto Scaling Groups, and EBS volumes.

**How it works**:
- Analyzes CloudWatch metrics over the last 14 days
- Uses machine learning to identify optimization opportunities
- Generates recommendations for instance type/size changes
- Refreshes recommendations daily
- Supports organizational, account, or regional-level configuration

### March 2024 Enhancement: Memory Utilization

AWS added customizable EC2 rightsizing recommendations based on memory utilization, not just CPU metrics.

**Why it matters**: Previous recommendations only considered CPU, network, and disk metrics. Many applications are memory-bound, not CPU-bound. Memory-aware recommendations prevent undersizing memory-intensive workloads.

**How to enable**:
1. Install CloudWatch Agent on EC2 instances to collect memory metrics
2. Alternatively, integrate third-party observability tools (Datadog, New Relic, Dynatrace)
3. Configure Compute Optimizer to use memory utilization in recommendations

### Customization Options

Compute Optimizer offers four preset recommendation preferences:

| Preset | CPU Threshold | CPU Headroom | Memory Headroom | Use Case |
|--------|---------------|--------------|-----------------|----------|
| **AWS default** | P99.5 | 10% | 10% | Balanced approach |
| **AWS optimized** | P90 | 15% | 15% | Prioritize stability |
| **Maximum savings** | P90 | 0% | 10% | Minimize cost |
| **Custom** | Configurable | Configurable | Configurable | Specific needs |

**Headroom**: Reserved capacity above observed utilization to handle traffic spikes. 10% memory headroom means if your instance uses 8 GB on average, Compute Optimizer recommends at least 8.8 GB capacity.

### Right-Sizing Best Practices

**1. Right-size before purchasing commitments**: Avoid locking in oversized instances with Reserved Instances or Savings Plans. Right-size first, then commit.

**2. Enable memory metrics**: Install CloudWatch Agent to get memory-aware recommendations, not just CPU-based suggestions.

**3. Use Auto Scaling Groups even for single instances**: ASGs provide free monitoring, automatic replacement on failure, and easier management. Compute Optimizer provides recommendations for ASG configurations.

**4. Review recommendations regularly**: Check Compute Optimizer weekly or monthly. Usage patterns change as applications evolve.

**5. Test before implementing**: Recommendations are suggestions, not guarantees. Test recommended instance types with production workloads before making changes.

**6. Consider fewer, larger instances**: In Kubernetes and containerized environments, fewer larger instances reduce scheduler and API server overhead compared to many small instances.

**7. Tag resources properly**: Use consistent tagging to group related resources and track cost allocation. Makes it easier to identify candidates for rightsizing.

**8. Set up cost alerts**: Configure AWS Cost Anomaly Detection and budget alerts to catch unexpected cost increases from oversized instances.

### Example Scenario

**Current state**: Running 10 x m5.2xlarge instances (8 vCPUs, 32 GB RAM each) for a web application.

**Observed metrics**: Average CPU utilization 15%, average memory utilization 40%.

**Compute Optimizer recommendation**: Downsize to m5.large (2 vCPUs, 8 GB RAM) based on utilization patterns.

**Analysis**:
- m5.2xlarge: $0.384/hour × 10 instances = $3.84/hour = $2,765/month
- m5.large: $0.096/hour × 10 instances = $0.96/hour = $691/month
- **Savings**: $2,074/month (75% reduction) while maintaining adequate headroom

**Action**: Gradually migrate instances to m5.large, monitor performance, and adjust if needed. Once validated, purchase Savings Plans or Reserved Instances for the right-sized configuration.

## Security Best Practices

### IMDSv2 (Instance Metadata Service Version 2)

<div class="callout callout--warning">
<p class="callout__title">Critical Security Configuration</p>
<p>IMDSv1 is vulnerable to SSRF attacks that can steal IAM role credentials. Always enforce IMDSv2 with <code>HttpTokens: required</code> in launch templates and use AWS Config rule <code>ec2-imdsv2-check</code> for compliance monitoring.</p>
</div>

#### Why IMDSv2 is Critical

The Instance Metadata Service (IMDS) provides EC2 instances with configuration information, including temporary IAM role credentials. IMDSv1 uses a simple HTTP request that is vulnerable to Server-Side Request Forgery (SSRF) attacks.

**The vulnerability**: If your application has an SSRF vulnerability, an attacker can trick the application into making a request to `http://169.254.169.254/latest/meta-data/iam/security-credentials/role-name` and steal IAM credentials.

**IMDSv2 solution**: Requires a session token for metadata requests, preventing SSRF exploitation.

#### How IMDSv2 Works

**Session-oriented security**:
1. Request a session token with a PUT request including a TTL header
2. Use the session token in subsequent metadata requests
3. Tokens have limited duration (1 second to 6 hours)
4. PUT requests cannot be forwarded by typical proxy or web application layers

**Why this prevents SSRF**: Most SSRF attacks can only control the URL in a GET request. IMDSv2 requires a PUT request first, which is not possible in typical SSRF scenarios.

#### How to Enforce IMDSv2

**In launch templates** (recommended approach):

```json
{
  "MetadataOptions": {
    "HttpTokens": "required",
    "HttpPutResponseHopLimit": 1,
    "HttpEndpoint": "enabled"
  }
}
```

**Key settings**:
- `HttpTokens: required` – Enforces IMDSv2, disables IMDSv1
- `HttpPutResponseHopLimit: 1` – Limits token to single network hop (prevents forwarding)
- `HttpEndpoint: enabled` – Keeps IMDS available

**In CloudFormation**:

```yaml
MetadataOptions:
  HttpTokens: required
  HttpPutResponseHopLimit: 1
```

#### Monitoring and Compliance

Use AWS Config rule `ec2-imdsv2-check` to verify all instances enforce IMDSv2:
- Rule returns `NON_COMPLIANT` if `HttpTokens` is set to `optional` (allows IMDSv1)
- Rule returns `COMPLIANT` if `HttpTokens` is set to `required` (enforces IMDSv2)

**Best practice**: Implement organizational policy requiring IMDSv2 for all new instances. Use AWS Config for continuous compliance monitoring and automated remediation.

### IAM Roles for EC2

#### Use IAM Roles Instead of Access Keys

**Never store AWS access keys on EC2 instances.** Use IAM roles instead.

**Why IAM roles are better**:
- **Temporary credentials**: Automatically rotated every few hours
- **No credential storage**: No risk of credentials in code, configuration files, or AMIs
- **Automatic retrieval**: AWS SDK automatically retrieves credentials from IMDS
- **Easier management**: Change permissions by updating the role, not by rotating keys across instances

#### Apply Least Privilege

Grant only the minimum permissions required for the instance to function.

**Bad practice**:
```json
{
  "Effect": "Allow",
  "Action": "*",
  "Resource": "*"
}
```

**Good practice**:
```json
{
  "Effect": "Allow",
  "Action": [
    "s3:GetObject",
    "s3:PutObject"
  ],
  "Resource": "arn:aws:s3:::my-app-bucket/*"
}
```

**Best practice**: Start with no permissions. Add only what the application needs as you discover requirements. Use AWS CloudTrail and IAM Access Analyzer to identify unused permissions.

#### Restrict Credential Usage

Use AWS global condition context keys to restrict where IAM role credentials can be used:

**Restrict to specific VPC**:
```json
{
  "Condition": {
    "StringEquals": {
      "aws:EC2InstanceSourceVPC": "vpc-12345678"
    }
  }
}
```

**Restrict to specific private IP addresses**:
```json
{
  "Condition": {
    "IpAddress": {
      "aws:EC2InstanceSourcePrivateIPv4": ["10.0.1.0/24"]
    }
  }
}
```

**Why this matters**: If an attacker exfiltrates temporary credentials from an EC2 instance, these conditions prevent using the credentials from outside the instance or VPC. Credentials only work when used from the issuing instance.

**Best practice**: Combine IMDSv2 (prevent credential theft) with VPC/IP restrictions (limit damage if credentials are stolen).

### Security Groups vs. NACLs

#### Security Groups (Instance-Level, Stateful)

**Characteristics**:
- Operate at the instance/ENI level
- Stateful: Return traffic automatically allowed
- Only allow rules (implicit deny all)
- All rules evaluated together (not ordered)

**Best practices**:
- Create custom security groups with least permissive rules
- Use descriptive names indicating purpose (e.g., "web-server-sg", "database-sg")
- Reference other security groups in rules instead of IP addresses when possible
- Regularly audit rules to remove unnecessary access
- Never allow 0.0.0.0/0 (all internet) for databases or internal services

**Example architecture**:
- Web tier security group: Allow 443 from 0.0.0.0/0, allow 22 from bastion security group
- App tier security group: Allow 8080 from web tier security group
- Database security group: Allow 3306 from app tier security group

#### Network ACLs (Subnet-Level, Stateless)

**Characteristics**:
- Operate at the subnet level
- Stateless: Must explicitly allow both inbound and outbound traffic
- Support allow and deny rules
- Processed in order by rule number (lowest first)

**When to use NACLs**:
- Block specific IP addresses at the subnet boundary (security groups only support allow rules)
- Add defense-in-depth at the subnet level
- Implement subnet-level isolation between environments

**Best practice**: Use security groups as the primary access control mechanism (instance-specific, easier to manage). Use NACLs for subnet-level defense-in-depth and explicit deny requirements.

### Additional Security Best Practices

#### Encrypt Data

**EBS volumes**:
- Enable EBS encryption by default at the account level
- Use AWS KMS for key management
- Encrypted snapshots create encrypted volumes
- Minimal performance impact

**Data in transit**:
- Use TLS/SSL for all network communication
- Terminate TLS at load balancers or on instances
- Use AWS Certificate Manager for free, auto-renewing certificates

#### Patch Management

**Use AWS Systems Manager Patch Manager**:
- Automate operating system and application patching
- Define maintenance windows for updates
- Track patch compliance across instances
- Reduces window of vulnerability exposure

**Best practice**: Configure automated patching for security updates during maintenance windows. Test patches in non-production environments first.

#### Secret Management

**Never store secrets in plain text**:
- Use AWS Secrets Manager for database credentials, API keys, and other secrets
- Use AWS Systems Manager Parameter Store for configuration data
- Never hardcode secrets in application code, configuration files, or AMIs
- Use IAM roles to grant instances access to specific secrets

**Example**: Application retrieves database credentials from Secrets Manager at startup using the instance's IAM role, instead of storing credentials in a config file.

#### AMI Management

**Security considerations**:
- Regularly audit AMI permissions (ensure AMIs aren't public unless intended)
- Encrypt volumes before creating AMIs to prevent data exposure
- Remove sensitive data before creating AMIs
- Patch base AMIs regularly and replace instances with updated AMIs
- Use golden AMI pipelines with automated security scanning

#### Monitoring and Auditing

**Enable comprehensive logging**:
- **AWS CloudTrail**: Log all API calls for auditing
- **VPC Flow Logs**: Capture network traffic for analysis
- **CloudWatch Logs**: Centralize application and system logs
- **AWS GuardDuty**: Automated threat detection using machine learning

**Best practice**: Store logs in a separate security account with restricted access. Use automated analysis for anomaly detection.

## High Availability and Reliability

### Multi-AZ Deployments

#### Understanding Availability Zones

**Availability Zones (AZs)** are distinct locations within an AWS Region:
- Engineered to be isolated from failures in other AZs
- Connected via low-latency, high-throughput, redundant networking
- Each Region has multiple AZs (minimum 3, typically 3-6)
- AZ failures are rare but happen (power outages, network issues, natural disasters)

#### Why Multi-AZ Matters

**Single AZ risk**: If your application runs in a single AZ and that AZ becomes unavailable, your entire application goes down.

**Multi-AZ benefits**:
- Protection against AZ-level failures
- Enables zero-downtime maintenance (move traffic away from AZ during updates)
- Required for Route 53 Health Check DNS failover
- Better load distribution

**Best practice**: Always deploy across at least two Availability Zones. For critical workloads, use three AZs for additional resilience.

### Auto Scaling Groups

#### Why Use Auto Scaling Groups

Auto Scaling Groups (ASGs) provide automated instance management, not just scaling:

**Key benefits**:
- **Health monitoring**: Continuously checks instance health
- **Automatic replacement**: Terminates unhealthy instances and launches replacements
- **Distribution**: Automatically distributes instances across multiple AZs
- **Scaling**: Adjusts capacity based on demand, schedules, or predictive patterns
- **Load balancer integration**: Registers/deregisters instances automatically

**Best practice**: Every EC2 instance should be in an Auto Scaling Group, even single instances. ASGs are free, and the operational benefits (automatic replacement, easier management) far outweigh any complexity.

#### Launch Templates (Required for New Accounts)

**Important change**: Accounts created after October 1, 2024 cannot create launch configurations. Launch templates are now mandatory.

**Launch Templates vs. Launch Configurations**:

| Feature | Launch Templates | Launch Configurations |
|---------|------------------|----------------------|
| **Versioning** | Yes | No |
| **New instance types** | Supported | Limited |
| **Mixed instance types** | Yes | No |
| **Spot + On-Demand** | Yes | No |
| **Override per ASG** | Yes | No |
| **Status** | Current standard | Deprecated |

**Launch template benefits**:
- Version control: Track changes and roll back if needed
- Support for all new EC2 features and instance types
- Mix instance types and purchase options in a single ASG
- Override specific settings per Auto Scaling Group
- JSON or YAML configuration

**Migration recommendation**: If you're using launch configurations, migrate to launch templates now. Use the AWS CLI or console to create templates from existing configurations.

#### Auto Scaling Strategies

**1. Predictive Scaling** (recommended for regular patterns):
- Uses machine learning to analyze historical traffic patterns
- Proactively schedules instances before demand spikes
- Ideal for workloads with daily, weekly, or seasonal patterns
- Reduces latency by having capacity ready before needed

**Example**: E-commerce site sees traffic spike every day at 9 AM. Predictive scaling launches instances at 8:45 AM.

**2. Dynamic Scaling**:

**Target tracking** (recommended for most workloads):
- Maintains a specific metric target (e.g., 50% CPU utilization)
- Automatically calculates how many instances needed
- Simple to configure and manage

**Step scaling**:
- Adds/removes capacity based on CloudWatch alarm thresholds
- Different scaling amounts for different threshold breaches
- More control than target tracking

**Simple scaling**:
- Single adjustment based on alarm state
- Waits for cooldown period before additional scaling
- Less responsive than step scaling

**3. Scheduled Scaling**:
- Scales based on known time-based patterns
- Useful for predictable daily/weekly traffic changes
- Can combine with dynamic scaling

**Example**: Scale up Monday-Friday `8 AM − 6 PM`, scale down at night and weekends.

#### Auto Scaling Best Practices

**Enable detailed monitoring**: Use 1-minute CloudWatch metrics instead of 5-minute metrics for faster scaling response to demand changes.

**Combine multiple policies**: Use predictive scaling for baseline capacity, target tracking for unexpected spikes, and scheduled scaling for known patterns.

**Use placement groups**: For latency-sensitive applications, use placement groups (cluster, partition, or spread) to control instance placement for better network performance.

**Implement warm pools**: For applications with long startup times (several minutes), use warm pools to maintain pre-initialized instances that can join the ASG quickly.

**Use instance refresh**: When updating launch templates, use instance refresh to gradually replace instances across the ASG, maintaining availability during updates.

**Set appropriate cooldown periods**: Prevent thrashing (rapid scaling up and down) by setting cooldown periods. Default is 300 seconds (5 minutes).

### Load Balancer Integration

#### Why Integrate ASGs with Load Balancers

Load balancers distribute traffic across healthy instances, providing:
- Automatic traffic distribution
- Health checking
- SSL/TLS termination
- Connection draining during scale-in
- Cross-AZ load balancing

#### Load Balancer Types

**Application Load Balancer (ALB)**:
- Operates at Layer 7 (HTTP/HTTPS)
- Advanced routing (path-based, host-based, header-based)
- WebSocket and HTTP/2 support
- Best for web applications and microservices

**Network Load Balancer (NLB)**:
- Operates at Layer 4 (TCP/UDP/TLS)
- Ultra-low latency (microseconds)
- Static IP addresses and Elastic IPs
- Millions of requests per second
- Best for TCP/UDP workloads, gaming, IoT

**Gateway Load Balancer (GWLB)**:
- Operates at Layer 3 (Network layer)
- Distributes traffic to third-party virtual appliances
- Best for firewalls, intrusion detection, deep packet inspection

#### Health Check Best Practices

**Implement deep health checks**, not shallow health checks.

**Shallow health check problem**:
```
# Bad: Only checks if web server responds
Health check: GET / => returns 200 OK
```

If the web server is running but the database is unavailable, the health check passes but the application returns errors to users. The load balancer continues sending traffic to a failing instance.

**Deep health check solution**:
```
# Good: Checks critical dependencies
Health check: GET /health => checks:
  - Database connectivity
  - Cache connectivity
  - Critical API dependencies
  - Returns 200 only if all dependencies are healthy
```

**Deep health check benefits**:
- Detects gray failures (partial functionality)
- Removes instances from rotation when dependencies fail
- Prevents routing traffic to instances that will return errors
- Combined with ASG, triggers automatic replacement

**Health check configuration**:
- Set appropriate interval (default 30 seconds)
- Set healthy/unhealthy thresholds (how many consecutive checks before changing state)
- Configure timeout less than interval
- Monitor health check failures in CloudWatch

#### DNS Failover with Route 53

When integrated with Route 53 Health Checks:
- Route 53 monitors load balancer endpoint health in each AZ
- If all targets in an AZ fail, Route 53 marks that AZ's load balancer IP as unhealthy
- Removes unhealthy IPs from DNS responses
- Routes traffic only to healthy AZs
- Provides automatic regional failover

**Best practice**: Configure Route 53 health checks for load balancers in multi-AZ deployments. This provides DNS-level failover in addition to load balancer-level traffic distribution.

### Backup and Recovery

#### EBS Snapshots

**What are snapshots**:
- Point-in-time backups of EBS volumes
- Incremental (only changed blocks stored after first snapshot)
- Stored in Amazon S3 with high durability
- Can create new volumes from snapshots in any AZ within the same Region

**Best practices**:
- Automate snapshots using AWS Backup or lifecycle policies
- Take snapshots during low-usage periods to minimize performance impact
- Tag snapshots with metadata (application, environment, date)
- Test restore procedures regularly
- Encrypt snapshots for sensitive data
- Use cross-region snapshot copying for disaster recovery

#### Amazon Machine Images (AMIs)

**What are AMIs**:
- Templates including boot volume, launch configuration, and block device mapping
- Saves entire instance configuration
- Faster recovery than rebuilding from scratch

**Best practices**:
- Create golden AMIs with pre-configured software and security hardening
- Build AMI pipelines with automated security scanning
- Remove sensitive data before creating AMIs
- Test AMI launches regularly
- Use AMI encryption to prevent data exposure
- Deprecate old AMIs to prevent accidental use of outdated configurations

#### Disaster Recovery Strategies

**Multi-AZ** (high availability, same region):
- Protects against AZ-level failures
- RTO: Minutes, RPO: Near-zero
- Cost: Moderate (running resources in multiple AZs)

**Multi-Region** (disaster recovery, different regions):
- Protects against region-level failures
- RTO: Minutes to hours, RPO: Minutes
- Cost: Higher (duplicated resources across regions)
- Requires cross-region replication for data

**Best practice**: For critical workloads, implement multi-AZ for high availability and multi-region for disaster recovery. Use automated failover mechanisms to minimize recovery time.

## Storage Options

EC2 instances can use three types of storage, each with distinct characteristics and use cases.

### EBS (Elastic Block Store)

#### Characteristics

- Block-level storage volumes that behave like physical hard drives
- Persistent storage (data survives instance stop/termination when configured)
- Automatically replicated within its Availability Zone for durability
- Can only be attached to one instance at a time (except io2 multi-attach volumes)
- Must be in the same AZ as the EC2 instance
- Can be detached from one instance and attached to another

#### EBS Volume Types

**General Purpose SSD (gp3, gp2)**:
- Balanced price and performance
- gp3: 3,000 IOPS baseline, up to 16,000 IOPS, 125-1,000 MB/s throughput
- gp2: IOPS scale with volume size (3 IOPS per GB, up to 16,000 IOPS)
- Best for: Boot volumes, development/test, small-to-medium databases, virtual desktops

**Provisioned IOPS SSD (io2 Block Express, io2, io1)**:
- Highest performance SSD for mission-critical workloads
- io2 Block Express: Up to 256,000 IOPS and 4,000 MB/s throughput
- io2: Up to 64,000 IOPS, 99.999% durability
- io1: Up to 64,000 IOPS, 99.8-99.9% durability
- Best for: Large relational/NoSQL databases, latency-sensitive workloads, business-critical applications

**Throughput Optimized HDD (st1)**:
- Low-cost HDD for frequently accessed, throughput-intensive workloads
- Up to 500 MB/s throughput
- Cannot be used as boot volumes
- Best for: Big data, data warehouses, log processing, streaming workloads

**Cold HDD (sc1)**:
- Lowest-cost HDD for less frequently accessed workloads
- Up to 250 MB/s throughput
- Cannot be used as boot volumes
- Best for: Infrequently accessed data, archival storage, cold data requiring sequential reads

#### When to Use EBS

**Ideal for:**
- Boot volumes for EC2 instances
- Relational and NoSQL databases requiring persistent storage
- Applications requiring consistent, low-latency storage
- Workloads needing snapshots for backup/recovery
- Block-level storage for single instances
- Data that must survive instance stop/termination

**Performance considerations**:
- Use EBS-optimized instances for dedicated bandwidth between instance and EBS
- Choose appropriate volume type based on IOPS/throughput requirements
- Use io2 for latency-sensitive, high-IOPS workloads (databases)
- Use gp3 for general-purpose workloads (better price-performance than gp2)

#### EBS Best Practices

**Encryption**: Enable EBS encryption by default at the account level. Minimal performance impact.

**Backups**: Automate snapshots using AWS Backup or Data Lifecycle Manager.

**Monitoring**: Track VolumeReadOps, VolumeWriteOps, VolumeQueueLength, and BurstBalance (gp2 only) in CloudWatch.

**Right-sizing**: Monitor IOPS and throughput utilization. Don't overprovision. gp3 allows independent IOPS and throughput configuration.

**Multi-attach (io2 only)**: Enable up to 16 Nitro instances to concurrently attach to the same volume for clustered applications.

### Instance Store (Ephemeral Storage)

#### Characteristics

- Temporary block-level storage physically attached to the host machine
- Sub-millisecond latency (fastest storage option)
- Data is lost when instance stops, terminates, hibernates, or underlying hardware fails
- Free (included with instance type)
- Size and type determined by instance type (not configurable)
- Cannot be detached and reattached to another instance

#### Performance

Instance store provides the lowest latency storage available on AWS:
- Direct attachment to host hardware (no network overhead)
- NVMe SSD storage on modern instance types
- Very high IOPS and throughput
- Ideal for applications requiring ultra-low latency

#### When to Use Instance Store

**Ideal for:**
- Temporary storage of constantly changing data (buffers, caches, scratch data)
- Data replicated across multiple instances (stateless web servers, load-balanced fleets)
- High-performance computing (HPC) requiring extremely low latency
- Storage-optimized workloads (I-series) for NoSQL databases with replication
- Applications that checkpoint frequently and can recover from instance loss

**When NOT to use:**
- Critical data that must survive instance termination
- Databases without replication to other nodes
- Data requiring backups
- Long-term persistent storage

#### Best Practices

**Never store irreplaceable data**: Treat instance store as disposable. Replicate critical data to EBS, EFS, or S3.

**Use for replicated data**: Configure applications (Cassandra, Elasticsearch) to replicate data across multiple instances with instance store.

**RAID configurations**: Use software RAID to combine multiple instance store volumes for increased performance or redundancy.

**Checkpoint frequently**: For long-running computations, save checkpoints to persistent storage (EBS, S3) periodically.

### EFS (Elastic File System)

#### Characteristics

- Fully managed Network File System (NFS)
- Automatically grows and shrinks based on usage (no capacity planning)
- Can be mounted concurrently by thousands of EC2 instances
- Accessible across multiple Availability Zones within a region
- Accessible from on-premises via AWS Direct Connect or VPN
- File-level storage (not block-level)
- Pay only for storage used (no pre-provisioning)
- Supports NFS v4.0 and v4.1 protocols

#### Performance Modes

**General Purpose** (default):
- Lowest latency
- Up to 7,000 file operations per second
- Best for most workloads

**Max I/O**:
- Higher aggregate throughput and IOPS
- Slightly higher latency
- Best for thousands of concurrent instances

#### Throughput Modes

**Bursting** (default):
- Throughput scales with storage size
- 50 MB/s per TB of storage, burst to 100 MB/s
- Credit system similar to T-series instances

**Elastic** (recommended for most):
- Automatically scales throughput based on workload
- No need to provision
- Pay only for throughput used

**Provisioned**:
- Specify throughput independent of storage size
- Useful when throughput requirements exceed bursting capacity

#### When to Use EFS

**Ideal for:**
- Shared file storage across multiple EC2 instances
- Web serving and content management systems (WordPress, Drupal)
- Development and testing environments (shared code repositories)
- Big data analytics requiring shared access
- Media processing workflows (video transcoding, rendering)
- Home directories for users
- Container storage (persistent volumes for ECS, EKS)

**When NOT to use:**
- Single-instance, high-IOPS databases (use EBS instead)
- Latency-sensitive applications requiring sub-millisecond access (use instance store)
- Windows workloads (EFS only supports Linux/NFS; use FSx for Windows)

#### EFS Best Practices

**Lifecycle management**: Enable EFS Lifecycle Management to automatically transition infrequently accessed files to lower-cost storage classes (Infrequent Access, Archive).

**Storage classes**:
- **Standard**: Frequently accessed files
- **Infrequent Access (IA)**: Files not accessed for 7, 14, 30, 60, or 90 days (configurable)
- **Archive**: Files not accessed for 90 days (lowest cost)

**Encryption**: Enable encryption at rest using AWS KMS. Encryption in transit available via TLS.

**Access points**: Use EFS Access Points to enforce user identity and permissions, simplifying application access.

**VPC security**: Use security groups to control which instances can mount the file system.

**Monitoring**: Track ClientConnections, DataReadIOBytes, DataWriteIOBytes, and PercentIOLimit in CloudWatch.

### Storage Comparison

| Feature | EBS | Instance Store | EFS |
|---------|-----|----------------|-----|
| **Persistence** | Persistent | Ephemeral | Persistent |
| **Latency** | Low (milliseconds) | Lowest (sub-millisecond) | Moderate (network latency) |
| **Attachment** | Single instance* | Single instance | Multiple instances |
| **Scope** | Single AZ | Single instance | Multi-AZ, multi-region |
| **Capacity** | `1 GB − 64 TB` | Fixed per instance | Unlimited (automatic scaling) |
| **Use case** | Databases, boot volumes | Caches, temp data, HPC | Shared file storage |
| **Cost model** | Pay for provisioned capacity | Included with instance | Pay for usage |
| **Replication** | Within AZ only | None | Across AZs automatically |
| **Snapshots** | Yes (incremental) | No | AWS Backup supported |

*io2 supports multi-attach up to 16 instances

### Choosing the Right Storage

**Decision framework**:

**Does data need to survive instance termination?**
- No → Instance Store
- Yes → EBS or EFS

**Do multiple instances need concurrent access?**
- Yes → EFS
- No → EBS or Instance Store

**What latency requirements?**
- Sub-millisecond → Instance Store
- Low (milliseconds) → EBS
- Moderate (network latency acceptable) → EFS

**What's the primary access pattern?**
- Block-level, database → EBS
- Ultra-fast temporary → Instance Store
- File-level, shared → EFS

**Example architectures**:
- **Web application**: EBS for boot volume and application files, Instance Store for session caching, EFS for shared uploads/media
- **Database**: EBS io2 for data volumes (high IOPS), EBS gp3 for backups
- **Analytics cluster**: Instance Store for temporary processing, EFS for shared datasets, S3 for final results
- **Container orchestration**: EBS for node boot volumes, EFS for persistent volumes shared across pods

## Service Comparison: EC2 vs Lambda vs Containers

AWS offers multiple compute services, each with distinct trade-offs. Understanding when to use each service is critical for system architects.

### When to Choose EC2

**Best for:**
- Applications requiring full control over the server environment (OS, kernel modules, network configuration, storage)
- Consistently high or predictable workloads that run continuously
- Long-running tasks with variable or unpredictable execution times
- Legacy applications requiring traditional server environments
- Workloads needing specific hardware (GPUs, Graviton processors, high-memory instances)
- Applications with strict compliance requirements (HIPAA, PCI DSS) requiring dedicated infrastructure
- Monolithic applications difficult to decompose into smaller services

**Advantages:**
- Maximum control and flexibility
- No execution time limits
- Predictable costs for consistent workloads
- Wide variety of instance types for specific needs
- Support for any OS or runtime

**Trade-offs:**
- Higher operational overhead (provisioning, scaling, patching, monitoring)
- Pay for instance hours even if underutilized
- Responsibility for OS security updates and configuration management
- Manual or semi-automated scaling

**Cost model**: Pay per second for instance runtime (minimum 60 seconds).

### When to Choose Lambda (Serverless)

**Best for:**
- Event-driven architectures (HTTP requests via API Gateway, S3 file uploads, DynamoDB changes, SQS messages)
- Variable or infrequent workloads with idle periods
- Short-lived functions (maximum 15 minutes / 900 seconds execution time)
- Microservices requiring minimal operational overhead
- Rapid deployment of small, on-demand applications
- Cost-sensitive intermittent workloads (pay only for execution time)
- Backend for mobile and web applications

**Advantages:**
- Zero server management (fully managed)
- Automatic scaling (handles 1 to 10,000+ concurrent executions)
- Pay only for actual execution time (millisecond granularity)
- Built-in high availability and fault tolerance
- Integrated with AWS services (S3, DynamoDB, Kinesis, SQS, etc.)

**Limitations:**
- **15-minute maximum execution time** (hard limit)
- Cold start latency (100ms - 1s+) when function invoked after idle period
- Limited runtime environment customization
- Maximum deployment package size (250 MB unzipped)
- Memory allocation limits (128 MB - 10 GB)
- Difficult to debug and test locally
- Higher cost for high-frequency, long-running workloads

**Cost model**: Pay per request ($0.20 per 1M requests) + compute time ($0.0000166667 per GB-second). Free tier includes 1M requests and 400,000 GB-seconds per month.

**Cost comparison example**:
- EC2 t3.small running 24/7: ~$15/month
- Lambda equivalent (~2 GB memory): If running 24/7, ~$50/month
- Lambda intermittent (1 hour/day): ~$2/month

Lambda is cost-effective for intermittent use, expensive for continuous operation.

### When to Choose Containers (ECS/EKS)

#### Amazon ECS (Elastic Container Service)

**Best for:**
- Docker container orchestration without Kubernetes complexity
- Tasks or batch jobs running longer than 15 minutes (avoids Lambda timeout)
- Teams wanting container benefits without Kubernetes learning curve
- AWS-native architectures (good integration with ALB, CloudWatch, IAM, Secrets Manager)
- Microservices requiring isolation and portability
- Mixed workloads (long-running services + batch jobs)

**Advantages:**
- Simpler than Kubernetes (less operational complexity)
- Deep AWS integration
- Supports both Fargate (serverless) and EC2 launch types
- No control plane management fees (unlike EKS)
- Task definitions version-controlled

**ECS Launch Types:**
- **Fargate**: Serverless container execution (no EC2 management), pay per vCPU/memory per second
- **EC2**: Run containers on self-managed EC2 instances, more control, lower cost for consistent workloads

#### Amazon EKS (Elastic Kubernetes Service)

**Best for:**
- Organizations already using Kubernetes or planning adoption
- Complex orchestration needs (StatefulSets, DaemonSets, custom controllers)
- Multi-cloud or hybrid cloud strategies (Kubernetes portability)
- Large-scale microservices architectures
- Advanced deployment patterns (blue/green, canary, A/B testing) using service mesh
- Need for Kubernetes ecosystem tools (Helm, Operators, Prometheus, Istio)

**Advantages:**
- Industry-standard Kubernetes API and tooling
- Portability across cloud providers and on-premises
- Large ecosystem of tools and community support
- Advanced scheduling and orchestration features

**Trade-offs:**
- Higher complexity (Kubernetes learning curve)
- Control plane costs ($0.10/hour = ~$73/month per cluster)
- More operational overhead than ECS
- Requires Kubernetes expertise

#### Containers General Benefits

**Why choose containers (ECS or EKS)?**
- Portability across environments (dev/test/prod consistency)
- Isolation with less overhead than VMs
- Efficient resource utilization (pack multiple containers per instance)
- Faster deployment than EC2 (container images vs AMI builds)
- Immutable infrastructure (version-controlled container images)
- CI/CD integration (automated builds and deployments)
- Microservices architectures with independent scaling

### Decision Framework

#### Control Requirements

**Maximum control needed** (OS, kernel, hardware):
- **Choose**: EC2

**Moderate control** (application and dependencies):
- **Choose**: Containers (ECS/EKS)

**Minimal control** (just code):
- **Choose**: Lambda

#### Operational Overhead Tolerance

**Want minimal operational overhead**:
- **Choose**: Lambda (fully managed) or ECS on Fargate (serverless containers)

**Willing to manage orchestration**:
- **Choose**: ECS on EC2 or EKS

**Want full infrastructure control**:
- **Choose**: EC2

#### Execution Time Requirements

**Under 15 minutes, event-driven**:
- **Consider**: Lambda

**Over 15 minutes or continuous operation**:
- **Choose**: EC2 or Containers

#### Workload Predictability

**Unpredictable, intermittent, event-driven**:
- **Choose**: Lambda (cost-effective, auto-scales)

**Predictable baseline with occasional spikes**:
- **Choose**: Containers with auto-scaling or EC2 with Auto Scaling Groups

**Consistently high utilization**:
- **Choose**: EC2 (most cost-effective with Reserved Instances/Savings Plans)

#### Application Architecture

**Monolithic application**:
- **Choose**: EC2 (easier to lift-and-shift)

**Microservices**:
- **Choose**: Containers (ECS/EKS) or Lambda (for small services)

**Mixed (microservices + monolith)**:
- **Choose**: Containers for flexibility

#### Team Expertise

**Team knows Kubernetes**:
- **Consider**: EKS

**Team wants simplicity**:
- **Choose**: Lambda (events) or ECS (containers)

**Team has traditional ops experience**:
- **Choose**: EC2 (familiar model)

### Example Scenarios

**E-commerce website**:
- **Frontend**: Lambda + API Gateway (handles variable traffic)
- **Product catalog**: ECS on Fargate (microservices, moderate scaling)
- **Order processing**: ECS on EC2 (predictable load, cost-optimized)
- **Database**: EC2 with EBS io2 (full control, high IOPS)

**Data processing pipeline**:
- **Ingestion**: Lambda triggered by S3 uploads
- **Processing**: ECS tasks on Fargate (jobs run 30+ minutes)
- **Analytics**: EC2 with instance store (high-performance computing)

**Enterprise application migration**:
- **Phase 1**: Lift-and-shift to EC2 (minimal changes)
- **Phase 2**: Containerize components to ECS (modernization)
- **Phase 3**: Decompose to microservices, move functions to Lambda (cloud-native)

<div class="callout callout--note">
<p class="callout__title">Compute Service Selection</p>
<p>There's overlap between EC2, containers, and Lambda, but each service has limitations.</p>
</div> The right choice depends on your specific requirements for control, operational overhead, execution time, cost model, and team expertise. Many architectures use multiple compute services, selecting the best fit for each component.

## Common Pitfalls

### Security Misconfigurations

#### Storing Secrets in Plain Text

**Problem**: Hardcoding credentials in application code, configuration files, or AMIs exposes secrets if code is leaked or AMIs are shared.

**Fix**:
- Use AWS Secrets Manager for database credentials, API keys, and secrets
- Use Systems Manager Parameter Store for configuration data
- Grant instances IAM role permissions to retrieve specific secrets
- Never hardcode secrets in code, config files, or AMIs
- Rotate secrets regularly using Secrets Manager automatic rotation

#### Overly Permissive Security Group Rules

**Problem**: Security groups allowing 0.0.0.0/0 (all internet) access to databases, internal services, or SSH/RDP expose infrastructure to attacks.

**Fix**:
- Implement least permissive rules (only allow required sources)
- Create custom security groups for each application tier
- Use security group chaining (reference other security groups in rules)
- Regularly audit security group rules using AWS Firewall Manager
- Never allow 0.0.0.0/0 for databases or internal services
- Restrict SSH/RDP to specific bastion host security groups or IP ranges

#### Not Enforcing IMDSv2

**Problem**: IMDSv1 is vulnerable to SSRF attacks, allowing attackers to steal IAM role credentials from metadata service.

**Fix**:
- Enforce IMDSv2 in all launch templates with `HttpTokens: required`
- Disable IMDSv1 across infrastructure
- Use AWS Config rule `ec2-imdsv2-check` for compliance monitoring
- Implement organizational policy requiring IMDSv2 for new instances

#### Public AMIs with Sensitive Data

**Problem**: Accidentally making AMIs public exposes data baked into the AMI (credentials, configuration, proprietary software).

**Fix**:
- Regularly audit AMI permissions
- Enable EBS encryption by default to prevent unencrypted AMI creation
- Remove sensitive data before creating AMIs
- Use golden AMI pipelines with automated security scanning
- Review permissions before sharing AMIs

### Infrastructure Management Mistakes

#### Manual Infrastructure Management (ClickOps)

**Problem**: Managing infrastructure through the console is error-prone, not reproducible, lacks version control, and doesn't scale.

**Fix**:
- Use Infrastructure as Code (CloudFormation, Terraform, CDK)
- Version control infrastructure definitions in Git
- Make infrastructure reproducible and documented
- Use CI/CD pipelines for infrastructure changes
- Code review infrastructure changes before deployment

#### Not Using Auto Scaling Groups

**Problem**: Managing individual instances manually means no automatic health monitoring, no automatic replacement on failure, and difficult scaling.

**Fix**:
- Launch every EC2 instance inside an Auto Scaling Group, even single instances
- ASGs provide free monitoring and automatic replacement
- ASGs simplify updates using instance refresh
- ASGs enable easier scaling when requirements change
- Use launch templates for version-controlled configuration

#### Using Deprecated Launch Configurations

**Problem**: Launch configurations are deprecated and don't support new instance types or features. Accounts created after October 1, 2024 cannot create launch configurations.

**Fix**:
- Migrate to launch templates immediately
- Launch templates offer versioning, mixed instance types, Spot+On-Demand mixing
- Use CloudFormation or Terraform to manage launch templates as code
- Test launch template versions before updating ASGs

### Cost Management Failures

#### Running Underutilized Instances

**Problem**: Overprovisioned instances waste money. Common scenario: m5.2xlarge instance running at 10% CPU utilization.

**Fix**:
- Monitor CloudWatch metrics regularly (CPU, memory, network, disk)
- Use AWS Compute Optimizer for rightsizing recommendations
- Enable CloudWatch Agent for memory metrics
- Right-size before purchasing Reserved Instances or Savings Plans
- Set up cost anomaly detection alerts

#### Forgetting to Stop/Terminate Unused Instances

**Problem**: Development, testing, or POC instances left running 24/7 accumulate significant costs.

**Fix**:
- Implement comprehensive tagging strategy (owner, environment, purpose, expiration)
- Use AWS Instance Scheduler for dev/test environments (auto-stop nights/weekends)
- Set up cost alerts and budget notifications
- Use AWS Cost Explorer to identify unused or idle resources
- Implement auto-shutdown policies for non-production environments
- Regular cost review meetings to identify optimization opportunities

#### Not Leveraging Commitment Discounts

**Problem**: 53% of organizations use no commitment discounts, leaving significant savings (up to 72%) on the table.

**Fix**:
- Analyze workload patterns using AWS Cost Explorer
- Purchase Savings Plans or Reserved Instances for predictable workloads
- Start conservative (cover 60-70% of baseline usage)
- Mix pricing models: Savings Plans (flexibility) + RIs (specific workloads) + Spot (fault-tolerant)
- Review and adjust quarterly as usage patterns change
- Use Consolidated Billing to apply commitments across multiple accounts

#### Ignoring Graviton Instances

**Problem**: Not evaluating Graviton instances for Linux workloads misses 40% better price-performance opportunity.

**Fix**:
- Evaluate Graviton instances for all new Linux workloads
- Test ARM64 compatibility for existing applications
- Build multi-architecture container images (ARM64 + AMD64)
- Start with development/testing environments to validate compatibility
- Migrate production workloads after validation

### Availability and Reliability Issues

#### Single Availability Zone Deployments

**Problem**: Deploying in a single AZ creates single point of failure. AZ outages are rare but happen.

**Fix**:
- Always deploy across at least two Availability Zones
- Use Auto Scaling Groups with multi-AZ distribution
- Configure load balancers across multiple AZs
- Use Route 53 health checks for DNS failover
- Test failover procedures regularly

#### Shallow Health Checks

**Problem**: Health checks that only verify instance responsiveness don't detect dependency failures (database down, API unavailable). Load balancer routes traffic to instances that return errors.

**Fix**:
- Implement deep health checks that verify critical dependencies
- Don't just check if instance responds; verify application health
- Health check endpoint should test database connectivity, cache availability, API dependencies
- Return 200 OK only if all critical dependencies are healthy
- Ensure health checks detect gray failures (partial functionality)

#### Not Backing Up EBS Volumes

**Problem**: Without backups, data loss from instance termination, volume corruption, or accidental deletion is permanent.

**Fix**:
- Automate EBS snapshots using AWS Backup or Data Lifecycle Manager
- Define retention policies aligned with recovery objectives
- Create AMIs from instances to save entire configurations
- Test restore procedures regularly (backups you can't restore are useless)
- Use cross-region snapshot copying for disaster recovery
- Tag snapshots with metadata for easier management

### Monitoring and Operations Gaps

#### Neglecting Patch Management

**Problem**: Unpatched systems are vulnerable to known exploits. Manual patching is inconsistent and error-prone.

**Fix**:
- Use AWS Systems Manager Patch Manager for automated patching
- Define maintenance windows for updates
- Test patches in non-production environments first
- Track patch compliance across instances
- Subscribe to AWS security bulletins for critical updates
- Replace instances regularly using golden AMI pipelines

#### Insufficient Monitoring

**Problem**: Not monitoring key metrics means you don't know when performance degrades, costs spike, or failures occur until users complain.

**Fix**:
- Monitor CPU, memory, network, and disk metrics in CloudWatch
- Set CloudWatch alarms for anomalies and threshold breaches
- Enable detailed monitoring (1-minute intervals) for critical workloads
- Use CloudWatch Logs for centralized log aggregation
- Implement distributed tracing (AWS X-Ray) for microservices
- Create dashboards for real-time visibility

#### Lack of Cost Visibility

**Problem**: Without granular cost tracking, you can't identify which applications, teams, or environments drive costs.

**Fix**:
- Implement comprehensive tagging strategy (application, environment, owner, cost-center)
- Enable Cost Allocation Tags in billing settings
- Use AWS Cost Explorer for analysis and trends
- Enable AWS Cost Anomaly Detection for unexpected spikes
- Create budget alerts for proactive notifications
- Regular cost review meetings with stakeholders
- Implement showback or chargeback for accountability

## Key Takeaways

**1. Instance selection drives cost and performance**: Choose the right instance family based on workload characteristics (general purpose, compute optimized, memory optimized, storage optimized, accelerated computing). Use Graviton for 40% better price-performance on Linux workloads. Test with representative workloads before committing.

**2. AWS Nitro System provides the foundation**: All modern EC2 instances are built on Nitro, delivering near-zero virtualization overhead, hardware-based security, and high-performance networking. Leverage Nitro Enclaves for processing highly sensitive data with cryptographic attestation.

**3. Cost optimization requires layered strategy**: Mix Savings Plans (flexibility), Reserved Instances (predictable workloads), and Spot Instances (fault-tolerant workloads) to maximize savings (up to 72% for commitments, up to 90% for Spot). Right-size using Compute Optimizer before committing. 53% of organizations leave money on the table by not using commitments.

**4. Security starts with IMDSv2**: Enforce IMDSv2 and disable IMDSv1 to prevent SSRF attacks on instance metadata. Use IAM roles instead of long-term access keys. Apply least privilege permissions. Restrict credential usage to specific VPCs/IPs. Layer security groups (instance-level) with NACLs (subnet-level).

**5. High availability requires multi-AZ architecture**: Deploy across at least two Availability Zones. Use Auto Scaling Groups for every instance, even single instances (free monitoring and automatic replacement). Integrate with load balancers using deep health checks. Launch templates are now mandatory (launch configurations deprecated for new accounts).

**6. Choose the right compute service**: EC2 for full control and long-running workloads, Lambda for event-driven intermittent workloads under 15 minutes, containers (ECS for simplicity, EKS for Kubernetes) for microservices and portability. Many architectures use multiple compute services, selecting the best fit for each component.

**7. Storage depends on use case and access patterns**: EBS for persistent single-instance high-performance (databases, boot volumes), Instance Store for temporary ultra-low-latency (caches, HPC), EFS for shared multi-instance file access (web content, development environments). Choose based on persistence needs, latency requirements, and concurrent access patterns.

**8. Avoid common pitfalls**: Use Infrastructure as Code (not ClickOps). Monitor costs and metrics continuously. Implement comprehensive tagging. Right-size continuously. Automate patching. Use ASGs everywhere. Encrypt data at rest and in transit. Never store secrets in plain text. Implement deep health checks.

**9. Integration amplifies capabilities**: Leverage IAM roles for secure service access, VPC segmentation for network isolation, CloudWatch for monitoring and alerting, Systems Manager for automation and compliance, Route 53 for DNS failover, and load balancer health checks for robust architectures.

**10. Testing is cost-effective with per-second billing**: Test instance types, configurations, and architectures with real workloads before committing to long-term purchases. The ability to experiment cheaply is one of EC2's greatest advantages; use it to find optimal configurations.
