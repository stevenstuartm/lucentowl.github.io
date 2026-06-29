---
title: "AWS Systems Manager for System Architects"
layout: guide
category: AWS
subcategory: Management & Governance
description: "Comprehensive guide to AWS Systems Manager covering Session Manager, Patch Manager, Parameter Store, Run Command, State Manager, automation, fleet management, and operational best practices"
tags: [aws, systems-manager, automation, infrastructure, patch-management, configuration, secrets, fundamentals]
---

## What Problems Systems Manager Solves

AWS Systems Manager is a unified operations hub for managing AWS and on-premises infrastructure at scale:

**Eliminate SSH key management**: Your security team mandates no SSH keys stored on laptops and no bastion hosts with public IPs. Session Manager provides browser-based terminal access without SSH keys, reducing attack surface and simplifying access management.

**Patch 500 EC2 instances without manual intervention**: Before patching, you SSH into instances individually or write custom scripts. Patch Manager automates OS patching across hundreds of instances, schedules maintenance windows, and generates compliance reports showing which instances need updates.

**Centralized secrets and configuration management**: Application configuration scattered across environment variables, config files, and hard-coded values. Parameter Store provides centralized, versioned, encrypted storage for database connection strings, API keys, and feature flags. Change one parameter and all instances get the updated value.

**Enforce desired configuration state**: An engineer manually modifies firewall rules on 10 instances for testing and forgets to revert changes. State Manager automatically detects configuration drift and remediates it, ensuring instances match the desired state.

**Run commands across instance fleet**: You need to restart services on 200 instances after deploying new configuration. Run Command executes commands simultaneously across instances, with progress tracking and error handling. What took hours of SSHing into instances now takes 5 minutes.

**Inventory and compliance at scale**: Auditors ask "Which instances are running OpenSSL 1.0.2?" Inventory automatically collects software, configuration, and metadata from all instances. You query the inventory and get the answer in seconds instead of manually checking hundreds of servers.

**Automate operational runbooks**: Incident response requires 12 manual steps across multiple services (stop instance, create snapshot, modify security group, restart). Systems Manager Automation executes these steps automatically with approval gates and rollback on failure.

## Service Fundamentals

### What is Systems Manager

Systems Manager is a suite of operational tools organized into capabilities:

**Operations Management**:
- Explorer: Aggregated view of operational data and issues
- OpsCenter: Centralized location for managing operational work items
- Incident Manager: Incident response and post-incident analysis

**Application Management**:
- Application Manager: Manage applications and resources
- AppConfig: Deploy application configuration safely
- Parameter Store: Secure hierarchical storage for configuration and secrets

**Actions & Change**:
- Automation: Execute operational runbooks
- Change Calendar: Block/allow changes during specific times
- Maintenance Windows: Schedule operations tasks
- Change Manager: Request, approve, and track infrastructure changes

**Instances & Nodes**:
- Fleet Manager: Unified UI for managing instances
- Session Manager: Secure shell access without SSH keys
- Run Command: Execute commands on instances remotely
- State Manager: Maintain consistent instance configuration
- Patch Manager: Automate OS patching
- Inventory: Collect metadata from instances
- Compliance: View compliance status across fleet

**Shared Resources**:
- Documents: Runbooks and scripts for automation

### Managed Instances

For Systems Manager to manage an instance or server, it must be a **managed instance**:

**Requirements**:
1. **SSM Agent installed**: Pre-installed on Amazon Linux 2, Ubuntu 16.04+, Windows Server 2016+
2. **IAM instance profile**: EC2 instance must have IAM role with `AmazonSSMManagedInstanceCore` policy
3. **Network connectivity**: Instance can reach Systems Manager endpoints (via internet gateway, NAT gateway, or VPC endpoints)

<div class="callout callout--tip">
<p class="callout__title">On-Premises Servers</p>
<p>Can be managed instances using hybrid activation (generates activation code and ID, install SSM Agent with activation credentials).</p>
</div>

**Container instances**: ECS container instances running SSM Agent can be managed instances.

### SSM Agent

The SSM Agent runs on instances and communicates with Systems Manager:

**Agent responsibilities**:
- Process requests from Systems Manager (run commands, apply patches)
- Report instance metadata and inventory
- Send logs to CloudWatch Logs
- Establish Session Manager connections

**Agent updates**: SSM Agent can update itself automatically. Configure update frequency in State Manager.

**Platforms**: Linux (Amazon Linux, Ubuntu, RHEL, SUSE, Debian), Windows Server, macOS.

## Session Manager

Session Manager provides browser-based shell access without SSH keys or bastion hosts.

### How Session Manager Works

**Connection flow**:
1. User clicks "Start session" in AWS console or uses AWS CLI
2. Systems Manager validates IAM permissions
3. SSM Agent on instance establishes secure tunnel to Systems Manager
4. User's terminal connects through Systems Manager service
5. All session activity logged to CloudWatch Logs and S3

**No network connectivity required from user to instance**: Session Manager uses Systems Manager endpoints. Instance in private subnet with no public IP is accessible.

### Session Manager Benefits

**No SSH key management**:
- No SSH keys stored on laptops or in source control
- No SSH key rotation or distribution
- Revoke access by removing IAM permissions (immediate effect)

**No bastion hosts**:
- Eliminate bastion host maintenance, patching, and cost
- Reduce attack surface (no publicly accessible SSH endpoints)

**Centralized access control**:
- IAM policies control who can start sessions on which instances
- Grant temporary access without modifying security groups

**Audit and compliance**:
- Every session logged with user identity, timestamp, and commands executed
- S3 logs for long-term retention and compliance
- CloudWatch Logs for real-time monitoring and alerting

### Session Manager Configuration

**Enable session logging**:
```json
{
  "schemaVersion": "1.0",
  "description": "Session Manager Configuration",
  "sessionType": "Standard_Stream",
  "inputs": {
    "s3BucketName": "my-session-logs",
    "s3KeyPrefix": "session-logs/",
    "s3EncryptionEnabled": true,
    "cloudWatchLogGroupName": "/aws/ssm/sessions",
    "cloudWatchEncryptionEnabled": true,
    "kmsKeyId": "alias/session-manager-key"
  }
}
```

**IAM permissions for users**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:StartSession"
      ],
      "Resource": [
        "arn:aws:ec2:*:*:instance/*"
      ],
      "Condition": {
        "StringLike": {
          "ssm:resourceTag/Environment": ["production"]
        }
      }
    },
    {
      "Effect": "Allow",
      "Action": [
        "ssm:TerminateSession",
        "ssm:ResumeSession"
      ],
      "Resource": ["arn:aws:ssm:*:*:session/${aws:username}-*"]
    }
  ]
}
```

This grants access to production instances only and allows users to terminate their own sessions.

### Session Manager Use Cases

**Troubleshooting production issues**: Engineer needs to check logs on instance during incident. Session Manager provides immediate access without SSH keys or VPN.

**Temporary contractor access**: Grant IAM permissions for contractor to access specific instances for 2 weeks. Revoke IAM permissions when contract ends; no SSH keys to rotate.

**Compliance and audit**: Security audit requires proof that all instance access is logged. Session Manager logs every session with full command history to S3.

**Port forwarding**: Forward traffic from local machine to application running on private instance (e.g., database GUI connecting to RDS through EC2 bastion).

**Interactive scripts**: Run interactive scripts that require user input (Session Manager supports stdin/stdout).

## Run Command

Run Command executes commands on instances remotely without SSH.

### How Run Command Works

**Execution flow**:
1. User specifies command document and target instances
2. Systems Manager sends command to SSM Agent on instances
3. SSM Agent executes command and captures stdout/stderr
4. Results streamed back to Systems Manager
5. User views output in console or retrieves via API

**Command documents**: Pre-defined scripts for common tasks (AWS-provided or custom).

### Built-in Command Documents

AWS provides 100+ command documents:

**Shell scripts**:
- `AWS-RunShellScript` (Linux): Execute bash/shell commands
- `AWS-RunPowerShellScript` (Windows): Execute PowerShell commands

**Software installation**:
- `AWS-ConfigureAWSPackage`: Install/uninstall AWS packages (CloudWatch Agent, SSM Agent, Inspector Agent)

**Docker**:
- `AWS-RunDockerAction`: Execute Docker commands

**Patching**:
- `AWS-RunPatchBaseline`: Apply patches immediately

**Configuration**:
- `AWS-ConfigureCloudWatch`: Configure CloudWatch Agent
- `AWS-ConfigureAWSCli`: Install and configure AWS CLI

### Custom Command Documents

Create custom documents for organization-specific tasks:

**Example**: Restart application service
```yaml
schemaVersion: '2.2'
description: 'Restart application service'
parameters:
  serviceName:
    type: String
    description: 'Service name to restart'
    default: 'myapp'
mainSteps:
  - action: 'aws:runShellScript'
    name: 'restartService'
    inputs:
      runCommand:
        - 'sudo systemctl restart {{serviceName}}'
        - 'sudo systemctl status {{serviceName}}'
```

**Document sharing**: Share documents across accounts or publish to AWS public documents.

### Targeting Instances

**Target methods**:
- **Instance IDs**: Specify specific instances
- **Tags**: Target instances with specific tags (e.g., `Environment=Production`)
- **Resource groups**: Target instances in resource group
- **All managed instances**: Run command on entire fleet

**Example**: Restart web service on all production web servers
```bash
aws ssm send-command \
  --document-name "RestartWebService" \
  --targets "Key=tag:Role,Values=WebServer" "Key=tag:Environment,Values=Production" \
  --parameters "serviceName=nginx"
```

### Output and Logging

**Command output**:
- View in console (limited to 2,500 characters)
- Store in S3 for complete output
- Stream to CloudWatch Logs

**Status tracking**:
- Overall command status (InProgress, Success, Failed, Timed out)
- Per-instance status
- Error messages and exit codes

**Rate control**:
- **Concurrency**: Max instances executing simultaneously (absolute number or percentage)
- **Error threshold**: Stop execution if too many instances fail

Example: Run command on 1,000 instances with max 50 concurrent executions, stop if more than 10% fail.

## Patch Manager

Patch Manager automates OS and software patching across instances.

### Patch Baselines

Patch baselines define which patches to install:

**AWS-provided baselines**:
- `AWS-AmazonLinux2DefaultPatchBaseline`: Amazon Linux 2 patches
- `AWS-UbuntuDefaultPatchBaseline`: Ubuntu patches
- `AWS-WindowsDefaultPatchBaseline`: Windows patches

**Baseline rules**:
- **Auto-approve**: Patches auto-approved X days after release
- **Severity**: Critical, Important, Medium, Low
- **Classification**: Security updates, bug fixes, feature updates

**Example baseline**:
```
Auto-approve critical and important security patches 7 days after release
Auto-approve non-security patches 14 days after release
Explicitly approve patches for specific CVEs
Explicitly reject known problematic patches
```

### Patch Groups

Patch groups organize instances for staged patching:

**Pattern**: Dev → Staging → Production

1. **Dev instances** (tag `PatchGroup=Development`): Patch every Tuesday
2. **Staging instances** (tag `PatchGroup=Staging`): Patch every Wednesday
3. **Production instances** (tag `PatchGroup=Production`): Patch every Thursday

This allows testing patches in dev before applying to production.

### Maintenance Windows

Maintenance windows define when patching occurs:

**Window configuration**:
- **Schedule**: Cron expression (e.g., `cron(0 2 ? * TUE *)` = 2 AM every Tuesday)
- **Duration**: How long window stays open (e.g., 4 hours)
- **Cutoff**: Stop starting new tasks X hours before window closes
- **Timezone**: Window schedule in specific timezone

**Window tasks**:
- Run patch baseline on specific patch group
- Run custom command documents
- Execute Lambda functions
- Run Step Functions workflows
- Execute Automation documents

**Example**: Production patching window
```
Schedule: Every Sunday at 2 AM UTC
Duration: 4 hours
Cutoff: 1 hour before window closes
Tasks:
  1. Take snapshots of instances (EBS snapshots)
  2. Apply patch baseline to Production patch group
  3. Reboot if required
  4. Run smoke tests
  5. Send SNS notification with results
```

### Patching Workflow

**Scan phase**: Determine which patches are missing
**Install phase**: Download and install approved patches
**Reboot**: Reboot if patches require it (configurable)
**Reporting**: Generate compliance report

**Patch compliance**:
- Compliant: All approved patches installed
- Non-compliant: Missing approved patches
- Unspecified: Patches not covered by baseline

### Patch Manager Use Cases

**Monthly patching cycle**: Automatically patch all instances on first Sunday of each month, staged across dev/staging/production.

**Emergency patching**: Critical CVE announced. Create patch baseline targeting specific CVE, run immediately on all instances.

**Compliance reporting**: Generate report showing patch compliance across fleet for audit.

**Application-specific patching**: Custom patch baselines for applications (MySQL, Apache, custom software packages).

## Parameter Store

Parameter Store provides hierarchical storage for configuration data and secrets.

### Parameter Types

**String**: Plain text values
**StringList**: Comma-separated list
**SecureString**: Encrypted values (encrypted with KMS)

**Example parameters**:
```
/myapp/dev/database/connection-string (SecureString)
/myapp/dev/api/endpoint (String)
/myapp/prod/database/connection-string (SecureString)
/myapp/prod/feature-flags/new-checkout (String) = "enabled"
```

### Parameter Tiers

**Standard tier** (free):
- Max 10,000 parameters per account per region
- Max parameter value size: 4 KB
- No parameter policies

**Advanced tier** ($0.05 per parameter per month):
- Max 100,000 parameters per account per region
- Max parameter value size: 8 KB
- Parameter policies (expiration, change notifications)

### Hierarchical Organization

Organize parameters by application, environment, and configuration type:

```
/myapp/
  dev/
    database/
      host
      port
      username
      password (SecureString)
    api/
      endpoint
      timeout
  prod/
    database/
      host
      port
      username
      password (SecureString)
    api/
      endpoint
      timeout
```

**Benefits**:
- Get all parameters for environment: `GetParametersByPath("/myapp/prod")`
- Separate IAM permissions by environment
- Easy to find related parameters

### Versioning

Parameter Store versions parameters automatically:

**Version history**: View previous parameter values with timestamps
**Rollback**: Revert to previous version
**Labels**: Assign labels to versions (e.g., `live`, `previous`, `canary`)

**Use case**: Deploy new configuration to production. If issues arise, revert to labeled `previous` version.

### Parameter Policies (Advanced Tier)

**Expiration**: Automatically delete parameter after specified date
**Change notification**: Send EventBridge event when parameter changes
**No-change notification**: Alert if parameter hasn't changed in X days (detect stale parameters)

**Example policy**:
```json
{
  "Type": "Expiration",
  "Version": "1.0",
  "Attributes": {
    "Timestamp": "2025-12-31T23:59:59.000Z"
  }
}
```

### Using Parameter Store

**AWS CLI**:
```bash
# Put parameter
aws ssm put-parameter \
  --name "/myapp/prod/database/password" \
  --value "MySecurePassword123" \
  --type SecureString \
  --key-id alias/myapp-key

# Get parameter
aws ssm get-parameter \
  --name "/myapp/prod/database/password" \
  --with-decryption

# Get parameters by path
aws ssm get-parameters-by-path \
  --path "/myapp/prod" \
  --recursive \
  --with-decryption
```

**Application code** (Node.js):
```javascript
const AWS = require('aws-sdk');
const ssm = new AWS.SSM();

const params = {
  Name: '/myapp/prod/database/password',
  WithDecryption: true
};

const result = await ssm.getParameter(params).promise();
const password = result.Parameter.Value;
```

**CloudFormation dynamic references**:
```yaml
Resources:
  MyInstance:
    Type: AWS::EC2::Instance
    Properties:
      ImageId: ami-12345678
      UserData:
        Fn::Base64: !Sub |
          #!/bin/bash
          DB_PASSWORD={% raw %}{{resolve:ssm-secure:/myapp/prod/database/password}}{% endraw %}
```

### Parameter Store vs Secrets Manager

**Parameter Store strengths**:
- Free for standard tier (10,000 parameters, 4 KB each)
- Integrated with Systems Manager and other AWS services
- Hierarchical organization
- Simple key-value storage

**Secrets Manager strengths**:
- Automatic secret rotation (Lambda function rotates secrets)
- Generate random secrets
- Cross-region replication
- JSON secret structure with multiple key-value pairs

**When to use**:
- **Parameter Store**: Application configuration, feature flags, non-rotated secrets, cost-sensitive
- **Secrets Manager**: Database credentials requiring rotation, multi-region secrets, RDS/Redshift/DocumentDB integration

**Cost comparison**:
- Parameter Store: Free (standard), $0.05/parameter/month (advanced)
- Secrets Manager: $0.40/secret/month + $0.05 per 10,000 API calls

## State Manager

State Manager maintains consistent configuration on instances.

### Associations

Associations define desired state for instances:

**Association components**:
- **Document**: What to execute (command document, Automation document)
- **Targets**: Which instances to manage
- **Schedule**: How often to run (rate or cron expression)
- **Parameters**: Input parameters for document

**Example association**: Ensure CloudWatch Agent is installed and configured
```yaml
Document: AWS-ConfigureAWSPackage
Targets: tag:Environment=Production
Schedule: rate(30 days)
Parameters:
  action: Install
  name: AmazonCloudWatchAgent
  version: latest
```

State Manager checks every 30 days. If agent missing or outdated, it installs/updates.

### Association Schedules

**Rate expressions**: `rate(30 minutes)`, `rate(1 day)`, `rate(7 days)`
**Cron expressions**: `cron(0 2 * * ? *)` = 2 AM daily

**Schedule considerations**:
- More frequent = faster drift detection but higher costs
- Less frequent = lower costs but drift persists longer
- Balance based on criticality (security configs = frequent, software versions = infrequent)

### Use Cases

**Enforce security baseline**: Ensure all instances have specific security configuration (firewall rules, SELinux settings, antivirus).

**Keep software updated**: Ensure SSM Agent, CloudWatch Agent, and monitoring tools are latest versions.

**Configuration compliance**: Enforce company policies (no root login, specific password policies, audit logging enabled).

**Automatic remediation**: Detect configuration drift and automatically fix it without manual intervention.

## Automation

Systems Manager Automation executes operational runbooks at scale.

### Automation Documents

Automation documents define multi-step workflows:

**Document structure**:
```yaml
schemaVersion: '0.3'
description: 'Create AMI and update Auto Scaling launch template'
parameters:
  InstanceId:
    type: String
    description: 'Instance ID to create AMI from'
mainSteps:
  - name: createImage
    action: 'aws:createImage'
    inputs:
      InstanceId: {% raw %}'{{InstanceId}}'{% endraw %}
      ImageName: {% raw %}'MyApp-{{automation:EXECUTION_ID}}'{% endraw %}
      NoReboot: true
    outputs:
      - Name: ImageId
        Selector: '$.ImageId'
        Type: String

  - name: waitForImage
    action: 'aws:waitForAwsResourceProperty'
    inputs:
      Service: ec2
      Api: DescribeImages
      ImageIds:
        - '{{createImage.ImageId}}'
      PropertySelector: '$.Images[0].State'
      DesiredValues:
        - available

  - name: updateLaunchTemplate
    action: 'aws:executeAwsApi'
    inputs:
      Service: ec2
      Api: CreateLaunchTemplateVersion
      LaunchTemplateId: 'lt-1234567890abcdef0'
      SourceVersion: '$Latest'
      LaunchTemplateData:
        ImageId: '{{createImage.ImageId}}'

  - name: sendNotification
    action: 'aws:executeAwsApi'
    inputs:
      Service: sns
      Api: Publish
      TopicArn: 'arn:aws:sns:us-east-1:123456789012:deployments'
      Message: 'New AMI created: {{createImage.ImageId}}'
```

### Action Types

**AWS API actions**: `aws:executeAwsApi` calls any AWS API
**Create resources**: `aws:createImage`, `aws:createStack`, `aws:createTags`
**Run commands**: `aws:runCommand` executes Run Command on instances
**Wait**: `aws:waitForAwsResourceProperty`, `aws:sleep`
**Approval**: `aws:approve` pauses automation for manual approval
**Branching**: `aws:branch` implements conditional logic
**Lambda**: `aws:invokeLambdaFunction` invokes Lambda functions
**Step Functions**: `aws:executeStateMachine` triggers Step Functions workflows

### Automation Use Cases

**Automated AMI creation**: Nightly automation creates AMIs of production instances, tags them with date, and deletes AMIs older than 30 days.

**Instance replacement**: Automation detects unhealthy instance, terminates it, creates new instance from latest AMI, attaches to load balancer.

**Disaster recovery failover**: Multi-step automation promotes read replica to master, updates DNS, notifies team.

**Security remediation**: EventBridge rule detects S3 bucket made public, triggers automation to revert permissions and notify security team.

**Change management**: Automation with approval gate; reviewer approves before automation applies database schema change.

### Automation Triggers

**Manual**: User starts automation from console or CLI
**EventBridge**: Event triggers automation (e.g., EC2 state change, security finding)
**Scheduled**: CloudWatch Events/EventBridge runs automation on schedule
**Maintenance window**: Automation runs during maintenance window
**State Manager**: Association executes automation document

## Inventory and Compliance

### Inventory Collection

Inventory collects metadata from managed instances:

**Collected data**:
- **Applications**: Installed software and versions
- **AWS components**: SSM Agent, CloudWatch Agent, Inspector Agent versions
- **Network**: IP addresses, MAC addresses, DNS, gateway
- **Windows updates**: Installed Windows updates and KB numbers
- **Instance details**: CPU, memory, disks
- **Services**: Running services (Windows services, systemd units)
- **Custom inventory**: User-defined inventory (license keys, asset tags)

**Collection frequency**: Configure via State Manager association (e.g., every 30 minutes, daily, weekly).

**Storage**: Inventory data stored in S3 bucket (optional), queryable via Inventory API or Athena.

### Compliance

Compliance dashboard shows which instances violate policies:

**Compliance types**:
- **Patch compliance**: Instances missing approved patches
- **Association compliance**: Instances not in desired state
- **Custom compliance**: User-defined compliance rules

**Compliance reporting**:
- Overall compliance percentage
- Non-compliant instances by severity
- Detailed compliance status per instance
- Exportable reports for audits

**Use case**: Security audit requires proof that all production instances have latest security patches. Compliance dashboard shows 95% compliant, identifies 10 non-compliant instances with specific missing patches.

## Fleet Manager

Fleet Manager provides unified interface for managing instances:

**Capabilities**:
- View all managed instances in one place
- File system browser (browse files, upload/download)
- Performance monitoring (CPU, memory, disk, network)
- Log viewer (view instance logs without SSM or CloudWatch)
- Windows registry editor
- User management (create/delete OS users)

**Use case**: During incident, quickly check disk usage across 50 instances, identify instance at 95% capacity, connect via Session Manager, and free up space.

## Integration Patterns

### CloudWatch Integration

**CloudWatch Alarms → Systems Manager Automation**:
- Alarm detects high CPU → trigger automation to add instances to Auto Scaling group
- Alarm detects disk full → trigger automation to clean up old logs

**Systems Manager → CloudWatch Logs**:
- Session Manager sessions logged to CloudWatch Logs
- Run Command output streamed to CloudWatch Logs
- Patch Manager results sent to CloudWatch Logs

### EventBridge Integration

**EventBridge rules trigger Systems Manager actions**:

Example: Auto-remediate non-compliant instances
```json
{
  "source": ["aws.ssm"],
  "detail-type": ["Configuration Compliance State Change"],
  "detail": {
    "compliance-status": ["NON_COMPLIANT"],
    "resource-type": ["ManagedInstance"]
  }
}
```

Trigger: Run Command document that fixes compliance issue

### Lambda Integration

**Automation documents invoke Lambda**:
- Custom logic not supported by built-in actions
- Integration with third-party systems
- Complex data transformation

**Lambda triggers Systems Manager**:
- Lambda receives webhook from external system
- Lambda starts Automation execution
- Results sent back to external system

### CI/CD Integration

**CodePipeline → Systems Manager**:
- Deployment stage uses Run Command to deploy application
- Run Command executes deployment script on instances
- Automation updates Auto Scaling launch template with new AMI

**GitHub Actions → Systems Manager**:
- GitHub workflow triggers Automation document
- Automation creates AMI from instance
- GitHub workflow polls automation status

## Cost Optimization Strategies

### Pricing Model

**Systems Manager core features are free**:
- Session Manager
- Run Command
- State Manager
- Patch Manager
- Inventory
- Fleet Manager
- Automation (first 100,000 steps/month free)

**Paid features**:
- **Automation**: $0.002 per step after 100,000 steps/month
- **Advanced Parameter Store**: $0.05 per parameter per month
- **OpsCenter**: $0.10 per OpsItem per month
- **Incident Manager**: Varies by features used

**Associated costs**:
- CloudWatch Logs storage for session logs, Run Command output
- S3 storage for logs and inventory data
- Data transfer (SSM Agent → Systems Manager endpoints)

### Cost Optimization

**Use VPC endpoints**: Avoid NAT gateway data transfer costs. SSM Agent communicates with Systems Manager via VPC endpoints instead of internet.

VPC endpoints needed:
- `com.amazonaws.region.ssm`
- `com.amazonaws.region.ssmmessages` (Session Manager)
- `com.amazonaws.region.ec2messages`

**Optimize inventory collection frequency**: Collecting inventory every 5 minutes generates significant CloudWatch Logs costs. Collect daily unless real-time inventory required.

**Limit session logging detail**: Log session IDs and metadata, not full command transcripts (unless compliance requires it).

**Use standard Parameter Store tier**: Unless you need >10,000 parameters or parameter policies, standard tier is free.

**Automation step optimization**: Combine multiple API calls into single step where possible to reduce step count.

## Security Best Practices

### IAM Permissions

**Principle of least privilege**:

Run Command:
```json
{
  "Effect": "Allow",
  "Action": [
    "ssm:SendCommand"
  ],
  "Resource": [
    "arn:aws:ssm:*:*:document/AWS-RunShellScript"
  ]
},
{
  "Effect": "Allow",
  "Action": [
    "ssm:SendCommand"
  ],
  "Resource": [
    "arn:aws:ec2:*:*:instance/*"
  ],
  "Condition": {
    "StringEquals": {
      "ssm:resourceTag/Environment": "Production"
    }
  }
}
```

Allows running shell scripts only on production instances.

**Instance role** (instances need this):
```json
{
  "Effect": "Allow",
  "Action": [
    "ssm:UpdateInstanceInformation",
    "ssmmessages:CreateControlChannel",
    "ssmmessages:CreateDataChannel",
    "ssmmessages:OpenControlChannel",
    "ssmmessages:OpenDataChannel",
    "s3:GetObject"
  ],
  "Resource": "*"
}
```

### Session Manager Security

**Disable port forwarding** (if not needed):
```json
{
  "schemaVersion": "1.0",
  "description": "Session Manager Configuration",
  "sessionType": "Standard_Stream",
  "inputs": {
    "runAsEnabled": false,
    "runAsDefaultUser": ""
  }
}
```

**Require MFA for Session Manager**:
```json
{
  "Effect": "Allow",
  "Action": "ssm:StartSession",
  "Resource": "*",
  "Condition": {
    "BoolIfExists": {
      "aws:MultiFactorAuthPresent": "true"
    }
  }
}
```

**Session timeout**: Configure session timeout to automatically terminate idle sessions.

### Parameter Store Security

**Encrypt sensitive parameters**: Always use SecureString with customer-managed KMS keys for secrets.

**Restrict parameter access by path**:
```json
{
  "Effect": "Allow",
  "Action": [
    "ssm:GetParameter",
    "ssm:GetParameters",
    "ssm:GetParametersByPath"
  ],
  "Resource": "arn:aws:ssm:*:*:parameter/myapp/prod/*"
}
```

Developers access `/myapp/dev/*`, operations team accesses `/myapp/prod/*`.

**Enable parameter encryption in transit**: Always use `WithDecryption` parameter when retrieving SecureString parameters.

### Audit and Compliance

**CloudTrail logging**: All Systems Manager API calls logged to CloudTrail (who ran what command on which instance).

**Session Manager logging**: Enable session logging to S3 and CloudWatch Logs for audit trail.

**Compliance monitoring**: Use Compliance dashboard to track patch compliance, configuration compliance.

**Tag-based access control**: Use resource tags and IAM condition keys to restrict access by environment, application, or team.

## When to Use Systems Manager vs Alternatives

### Systems Manager Strengths

**Use Systems Manager when**:
- Managing AWS EC2 instances and on-premises servers
- Need unified management console for operations tasks
- Want AWS-native integration (CloudWatch, EventBridge, Lambda)
- Cost-conscious (core features free)
- Serverless operations (no infrastructure to manage)
- Compliance and audit requirements (built-in logging and reporting)

### Configuration Management Tools

**Consider Ansible, Chef, Puppet, SaltStack when**:
- Complex configuration management with extensive modules
- Multi-cloud or cloud-agnostic infrastructure
- Existing investment in configuration management codebase
- Advanced templating and abstraction requirements
- Large community and ecosystem

**Trade-offs**:
- Configuration management tools require infrastructure (control nodes, masters)
- More complex setup and learning curve
- Additional licensing costs (Chef, Puppet commercial versions)
- Systems Manager is simpler for AWS-centric environments

**Hybrid approach**: Use Systems Manager for AWS-specific tasks (Run Command, Session Manager) and Ansible for application configuration management.

### Infrastructure as Code Tools

**Terraform, CloudFormation vs Systems Manager**:
- **IaC tools**: Define infrastructure declaratively, track state, plan/apply changes
- **Systems Manager**: Operational tasks on existing infrastructure (patching, command execution, configuration drift)

**Complementary**: Use CloudFormation/Terraform to provision infrastructure, Systems Manager to operate and maintain it.

### Secrets Management

**HashiCorp Vault vs Parameter Store/Secrets Manager**:

**Vault strengths**:
- Dynamic secrets (generate database credentials on-demand)
- Secret leasing and revocation
- Multi-cloud and on-premises
- Extensive secret engines (PKI, SSH, databases, cloud providers)

**Parameter Store/Secrets Manager strengths**:
- AWS-native integration (no additional infrastructure)
- Lower operational overhead (managed service)
- Cost-effective for moderate secret volumes

**When to use Vault**: Multi-cloud environments, dynamic secret generation, existing Vault deployment, advanced secret workflows.

**When to use Parameter Store**: AWS-only environment, simple key-value secrets, cost-sensitive, minimal operational complexity.

## Common Pitfalls

### SSM Agent Not Running or Outdated

**Problem**: Instance appears in EC2 console but not in Systems Manager managed instances.

**Causes**:
- SSM Agent not installed (older AMIs)
- SSM Agent not running
- Instance has no IAM instance profile with SSM permissions
- Network connectivity issues (no route to Systems Manager endpoints)

**Solution**:
- Verify SSM Agent installed and running: `sudo systemctl status amazon-ssm-agent`
- Check IAM instance profile includes `AmazonSSMManagedInstanceCore` policy
- Verify security groups allow outbound HTTPS (port 443)
- Use VPC endpoints if instances in private subnets with no NAT gateway

### Missing IAM Permissions

**Problem**: User can see instances in Fleet Manager but can't start Session Manager sessions or run commands.

**Cause**: IAM permissions grant EC2 read permissions but not Systems Manager action permissions.

**Solution**: Grant IAM permissions for `ssm:StartSession`, `ssm:SendCommand`, etc., with resource-level restrictions.

### Parameter Store Performance Issues

**Problem**: Application startup slow due to retrieving 100 parameters individually.

**Cause**: Application calls `GetParameter` 100 times sequentially.

**Solution**: Use `GetParametersByPath` to retrieve all parameters under path in one API call. Reduces latency from 100 API calls to 1.

### Patch Manager Breaking Production

**Problem**: Automated patching installed kernel update that broke application compatibility. Production down for 4 hours.

**Cause**: No staged patching. Applied patches to production without testing in dev/staging first.

**Solution**:
- Use patch groups to stage patching (Dev → Staging → Production)
- Create maintenance windows with different schedules
- Test patches in non-production environments first
- Configure reboot behavior (NoReboot for immediate patches, RebootIfNeeded for maintenance windows)

### Over-Permissive Run Command Access

**Problem**: Developer accidentally ran command on production instances instead of dev instances. Restarted critical services during business hours.

**Cause**: IAM policy allowed Run Command on all instances.

**Solution**: Use tag-based access control. Developers can run commands only on instances tagged `Environment=Dev`.

### Session Manager Logs Not Configured

**Problem**: Security audit requires proof of instance access. No session logs available.

**Cause**: Session Manager logging not enabled (not configured by default).

**Solution**: Configure session logging to S3 and CloudWatch Logs from day one. Enable encryption with KMS. Set S3 lifecycle policy for log retention.

### Automation Documents Without Error Handling

**Problem**: Automation failed on step 5 of 10. First 4 steps completed (created resources), but automation didn't clean up.

**Cause**: Automation document has no error handling or rollback steps.

**Solution**:
- Use `onFailure` handlers in automation steps
- Implement rollback steps that undo changes
- Use `aws:branch` action for conditional logic based on step success/failure
- Test automation in non-production environments

### Inventory Data Not Used

**Problem**: Organization pays for S3 storage of inventory data but never queries it.

**Missed opportunity**: Inventory shows which instances have outdated software, but nobody uses it for compliance.

**Solution**: Integrate inventory with Compliance dashboard, create automated reports, query with Athena for security audits.

## Key Takeaways

**Systems Manager eliminates SSH key management**: Session Manager provides browser-based shell access without SSH keys, bastion hosts, or public IPs. Reduce attack surface and simplify access management.

**Run Command executes tasks at scale**: Run scripts on hundreds of instances simultaneously with progress tracking and error handling. What took hours of manual work now takes minutes.

**Patch Manager automates OS patching**: Define patch baselines, schedule maintenance windows, and generate compliance reports. Staged patching (dev → staging → production) ensures patches are tested before production deployment.

**Parameter Store centralizes configuration**: Store database connection strings, API keys, and feature flags in hierarchical, versioned, encrypted storage. Applications retrieve parameters at runtime instead of hardcoding configuration.

**State Manager enforces desired configuration**: Automatically detect and remediate configuration drift. Ensure instances maintain security baselines, software versions, and compliance requirements.

**Automation executes operational runbooks**: Multi-step workflows automate AMI creation, disaster recovery, security remediation, and change management with approval gates and error handling.

**Inventory and Compliance provide visibility**: Automatically collect metadata about installed software, network configuration, and OS patches. Compliance dashboard shows which instances violate policies.

**Systems Manager is free for core features**: Session Manager, Run Command, Patch Manager, State Manager, and Inventory have no additional cost. Only pay for associated services (CloudWatch Logs, S3, data transfer).

**VPC endpoints reduce costs**: Use VPC endpoints for Systems Manager to avoid NAT gateway data transfer charges. Essential for private subnet instances.

**Tag-based access control enables governance**: Use resource tags and IAM condition keys to restrict who can access which instances. Developers access dev instances, operations team accesses production.

**Integrate with CloudWatch and EventBridge**: CloudWatch alarms trigger automation for auto-remediation. EventBridge rules start automation based on compliance state changes or security findings.

**Systems Manager complements IaC tools**: CloudFormation/Terraform provision infrastructure, Systems Manager operates and maintains it. Use both for complete infrastructure lifecycle management.
