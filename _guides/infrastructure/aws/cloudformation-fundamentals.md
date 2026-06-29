---
title: "AWS CloudFormation: Fundamentals"
layout: guide
category: AWS
subcategory: Infrastructure as Code
description: "Core CloudFormation concepts including stacks, templates, resources, and basic workflow for managing AWS infrastructure as code."
tags: [infrastructure, iac, aws, cloudformation, fundamentals, practical]
---

## What is AWS CloudFormation

**AWS CloudFormation** is a service that gives you an easy way to model, provision, and manage AWS resources by treating infrastructure as code.

### How CloudFormation Works

1. **Write Template:** Define infrastructure in JSON or YAML
2. **Create Stack:** CloudFormation reads template and provisions resources
3. **Manage Stack:** Update, delete, or modify stack as a single unit
4. **Track Changes:** All changes tracked and versioned

### Key Benefits

**Infrastructure as Code:**
- Version control for infrastructure
- Code review process
- Repeatable deployments
- Self-documenting architecture

**Automated Management:**
- Dependency resolution (creates resources in correct order)
- Rollback on failure
- Change preview (change sets)
- Drift detection

**AWS Native:**
- No additional cost (pay only for AWS resources)
- Deep AWS service integration
- AWS-managed service (no servers to maintain)
- Supports all AWS services
- Immediate access to new AWS features

**Consistency:**
- Same template creates identical infrastructure
- Eliminates manual configuration errors
- Standardized deployments across environments

---

## Core Concepts

### Stacks

**Stack:** A collection of AWS resources managed as a single unit.

**Characteristics:**
- Created, updated, and deleted together
- Resources share lifecycle
- Atomic operations (all or nothing)
- Unique stack name per region

**Stack States:**
- `CREATE_IN_PROGRESS` - Stack being created
- `CREATE_COMPLETE` - Successfully created
- `CREATE_FAILED` - Creation failed
- `UPDATE_IN_PROGRESS` - Stack being updated
- `UPDATE_COMPLETE` - Successfully updated
- `UPDATE_ROLLBACK_IN_PROGRESS` - Update failed, rolling back
- `DELETE_IN_PROGRESS` - Stack being deleted
- `DELETE_COMPLETE` - Successfully deleted

### Templates

**Template:** JSON or YAML file describing AWS resources and their configuration.

**Minimal template:**
```yaml
Resources:
  MyBucket:
    Type: AWS::S3::Bucket
```

### Resources

**Resource:** An AWS component (EC2 instance, S3 bucket, etc.) defined in the template.

**Resource syntax:**
```yaml
LogicalID:
  Type: AWS::Service::Resource
  Properties:
    Property1: Value1
    Property2: Value2
```

**Example:**
```yaml
WebServerInstance:
  Type: AWS::EC2::Instance
  Properties:
    ImageId: ami-0c55b159cbfafe1f0
    InstanceType: t2.micro
    Tags:
      - Key: Name
        Value: WebServer
```

### Change Sets

**Change Set:** Preview of proposed changes before executing a stack update.

**Benefits:**
- See exactly what will change
- Prevent unintended modifications
- Review before applying
- No changes until executed

---

## Template Anatomy

### YAML vs. JSON

<div class="callout callout--tip">
<p class="callout__title">Use YAML for CloudFormation Templates</p>
<p>YAML is more readable, supports comments, and is less verbose than JSON. Use YAML unless you have a specific reason to use JSON.</p>
</div>

**YAML (recommended):**
```yaml
Resources:
  MyBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: my-unique-bucket
      VersioningConfiguration:
        Status: Enabled
```

**JSON:**
```json
{
  "Resources": {
    "MyBucket": {
      "Type": "AWS::S3::Bucket",
      "Properties": {
        "BucketName": "my-unique-bucket",
        "VersioningConfiguration": {
          "Status": "Enabled"
        }
      }
    }
  }
}
```

**YAML advantages:**
- More readable
- Comments supported
- Less verbose
- Easier to write

### Template Sections

**Template structure:**
```yaml
AWSTemplateFormatVersion: '2010-09-09'  # Optional
Description: 'Template description'      # Optional

Metadata:                               # Optional
  # Additional information

Parameters:                             # Optional
  # Input values

Mappings:                              # Optional
  # Lookup tables

Conditions:                            # Optional
  # Conditional logic

Transform:                             # Optional
  # Macros (e.g., SAM)

Resources:                             # REQUIRED
  # AWS resources to create

Outputs:                               # Optional
  # Values to export
```

### Resources Section (Required)

```yaml
Resources:
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
      EnableDnsHostnames: true
      EnableDnsSupport: true
      Tags:
        - Key: Name
          Value: MyVPC

  InternetGateway:
    Type: AWS::EC2::InternetGateway
    Properties:
      Tags:
        - Key: Name
          Value: MyIGW

  AttachGateway:
    Type: AWS::EC2::VPCGatewayAttachment
    Properties:
      VpcId: !Ref VPC
      InternetGatewayId: !Ref InternetGateway
```

**Resource anatomy:**
- **Logical ID:** Unique identifier within template (e.g., `VPC`)
- **Type:** AWS resource type (e.g., `AWS::EC2::VPC`)
- **Properties:** Configuration specific to resource type

---

## Working with Stacks

### Creating Stacks

**Via AWS CLI:**

```bash
# Basic create
aws cloudformation create-stack \
  --stack-name my-stack \
  --template-body file://template.yaml

# With parameters
aws cloudformation create-stack \
  --stack-name my-stack \
  --template-body file://template.yaml \
  --parameters \
    ParameterKey=InstanceType,ParameterValue=t2.small \
    ParameterKey=KeyName,ParameterValue=my-key

# From S3
aws cloudformation create-stack \
  --stack-name my-stack \
  --template-url https://s3.amazonaws.com/bucket/template.yaml

# With IAM capabilities (required for IAM resources)
aws cloudformation create-stack \
  --stack-name my-stack \
  --template-body file://template.yaml \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM

# With tags
aws cloudformation create-stack \
  --stack-name my-stack \
  --template-body file://template.yaml \
  --tags Key=Environment,Value=Production Key=Owner,Value=TeamA
```

**Via AWS Console:**
1. Navigate to CloudFormation
2. Click "Create Stack"
3. Upload template or use S3 URL
4. Specify parameters
5. Configure options (tags, permissions, rollback)
6. Review and create

### Updating Stacks

**Direct update:**
```bash
aws cloudformation update-stack \
  --stack-name my-stack \
  --template-body file://template-updated.yaml
```

**Update with change set (recommended):**
```bash
# 1. Create change set
aws cloudformation create-change-set \
  --stack-name my-stack \
  --change-set-name my-changes \
  --template-body file://template-updated.yaml

# 2. Describe change set (review changes)
aws cloudformation describe-change-set \
  --stack-name my-stack \
  --change-set-name my-changes

# 3. Execute change set
aws cloudformation execute-change-set \
  --stack-name my-stack \
  --change-set-name my-changes
```

### Deleting Stacks

```bash
# Delete stack
aws cloudformation delete-stack \
  --stack-name my-stack

# Wait for deletion
aws cloudformation wait stack-delete-complete \
  --stack-name my-stack
```

### Viewing Stack Information

```bash
# Describe stack
aws cloudformation describe-stacks \
  --stack-name my-stack

# List all stacks
aws cloudformation list-stacks

# View stack events
aws cloudformation describe-stack-events \
  --stack-name my-stack

# Get stack outputs
aws cloudformation describe-stacks \
  --stack-name my-stack \
  --query 'Stacks[0].Outputs'
```

### Validating Templates

```bash
# Validate template syntax
aws cloudformation validate-template \
  --template-body file://template.yaml

# Use cfn-lint for advanced validation
pip install cfn-lint
cfn-lint template.yaml
```

---

## Resource Management

### Resource Dependencies

**Implicit dependencies** (automatic):
```yaml
Resources:
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16

  Subnet:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC  # Creates implicit dependency
      CidrBlock: 10.0.1.0/24
```

CloudFormation knows to create VPC before Subnet because Subnet references VPC.

**Explicit dependencies** (when implicit isn't enough):
```yaml
Resources:
  WebServer:
    Type: AWS::EC2::Instance
    DependsOn: GatewayAttachment  # Explicit dependency
    Properties:
      ImageId: ami-0c55b159cbfafe1f0
      InstanceType: t2.micro

  GatewayAttachment:
    Type: AWS::EC2::VPCGatewayAttachment
    Properties:
      VpcId: !Ref VPC
      InternetGatewayId: !Ref InternetGateway
```

**When to use DependsOn:**
- Resource needs to wait for creation to complete (not just ID)
- IAM role needs policy attached before use
- Internet gateway needs attachment before routing

### Deletion Policies

```yaml
Resources:
  MyDB:
    Type: AWS::RDS::DBInstance
    DeletionPolicy: Snapshot  # Create snapshot before deleting
    Properties:
      DBInstanceIdentifier: mydb
      Engine: postgres

  LogsBucket:
    Type: AWS::S3::Bucket
    DeletionPolicy: Retain  # Keep bucket when stack deleted
    Properties:
      BucketName: my-logs-bucket
```

**DeletionPolicy values:**
- `Delete` (default) - Delete resource when stack deleted
- `Retain` - Keep resource after stack deletion
- `Snapshot` - Create snapshot before deletion (RDS, EC2 volumes, Redshift)

### Update Behaviors

Each resource property has an update behavior:

**Update with No Interruption:**
- Property updated without interrupting resource
- Example: EC2 instance tags

**Some Interruption:**
- Brief interruption (restart, etc.)
- Example: RDS instance type change

**Replacement:**
- Resource deleted and recreated
- New physical ID
- Example: EC2 instance type (sometimes), S3 bucket name

---

## Getting Started

### Example: Simple Web Server

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: Simple EC2 web server

Parameters:
  KeyName:
    Type: AWS::EC2::KeyPair::KeyName
    Description: EC2 Key Pair for SSH access

  InstanceType:
    Type: String
    Default: t2.micro
    AllowedValues:
      - t2.micro
      - t2.small
      - t2.medium
    Description: EC2 instance type

Resources:
  SecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Allow HTTP and SSH
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 80
          ToPort: 80
          CidrIp: 0.0.0.0/0
        - IpProtocol: tcp
          FromPort: 22
          ToPort: 22
          CidrIp: 0.0.0.0/0

  WebServer:
    Type: AWS::EC2::Instance
    Properties:
      ImageId: ami-0c55b159cbfafe1f0
      InstanceType: !Ref InstanceType
      KeyName: !Ref KeyName
      SecurityGroups:
        - !Ref SecurityGroup
      UserData:
        Fn::Base64: |
          #!/bin/bash
          yum update -y
          yum install -y httpd
          systemctl start httpd
          systemctl enable httpd
          echo "<h1>Hello from CloudFormation</h1>" > /var/www/html/index.html
      Tags:
        - Key: Name
          Value: WebServer

Outputs:
  WebServerPublicIP:
    Description: Public IP of web server
    Value: !GetAtt WebServer.PublicIp

  WebServerURL:
    Description: URL of web server
    Value: !Sub http://${WebServer.PublicDnsName}
```

### Deploy the Example

```bash
# Create stack
aws cloudformation create-stack \
  --stack-name my-web-server \
  --template-body file://web-server.yaml \
  --parameters \
    ParameterKey=KeyName,ParameterValue=my-key \
    ParameterKey=InstanceType,ParameterValue=t2.micro

# Wait for completion
aws cloudformation wait stack-create-complete \
  --stack-name my-web-server

# Get outputs
aws cloudformation describe-stacks \
  --stack-name my-web-server \
  --query 'Stacks[0].Outputs'
```

---

