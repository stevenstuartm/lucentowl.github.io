---
title: "CloudFormation Template Reference"
layout: guide
category: AWS
subcategory: Infrastructure as Code
description: "Complete reference for CloudFormation intrinsic functions, parameters, outputs, mappings, and conditions with practical examples."
tags: [infrastructure, iac, aws, cloudformation, practical, templates]
---

## Intrinsic Functions

**Intrinsic functions** are built-in functions that help manage stacks, evaluated at stack creation/update time.

### Ref

Returns the value of a parameter or resource.

**For parameters:** Returns parameter value
**For resources:** Returns resource ID (varies by type)

```yaml
Parameters:
  KeyName:
    Type: String

Resources:
  WebServer:
    Type: AWS::EC2::Instance
    Properties:
      KeyName: !Ref KeyName  # Returns parameter value
      SubnetId: !Ref PublicSubnet  # Returns subnet ID
```

**Short form:** `!Ref LogicalName`
**Full form:** `Fn::Ref: LogicalName`

### GetAtt

Returns attribute of a resource.

```yaml
Resources:
  WebServer:
    Type: AWS::EC2::Instance
    Properties:
      ImageId: ami-0c55b159cbfafe1f0

Outputs:
  PublicIP:
    Value: !GetAtt WebServer.PublicIp
  PrivateIP:
    Value: !GetAtt WebServer.PrivateIp
  AvailabilityZone:
    Value: !GetAtt WebServer.AvailabilityZone
```

**Short form:** `!GetAtt LogicalName.AttributeName`
**Full form:** `Fn::GetAtt: [LogicalName, AttributeName]`

**Common attributes by resource:**
- EC2 Instance: `PublicIp`, `PrivateIp`, `AvailabilityZone`
- S3 Bucket: `Arn`, `DomainName`, `WebsiteURL`
- RDS: `Endpoint.Address`, `Endpoint.Port`

### Sub

Substitutes variables in a string.

```yaml
Resources:
  WebServer:
    Type: AWS::EC2::Instance
    Properties:
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-WebServer-${AWS::Region}
        - Key: Description
          Value: !Sub |
            Web server for ${EnvironmentName} environment
            Deployed in ${AWS::Region}
```

**Variables:**
- Template parameters: `${ParameterName}`
- Resources: `${LogicalName}`
- Pseudo-parameters: `${AWS::Region}`, `${AWS::AccountId}`, etc.

**With explicit mapping:**
```yaml
!Sub
  - 'arn:aws:ec2:${Region}:${Account}:vpc/${VpcId}'
  - Region: !Ref AWS::Region
    Account: !Ref AWS::AccountId
    VpcId: !Ref VPC
```

### Join

Joins array elements with delimiter.

```yaml
!Join
  - ','
  - - !Ref PublicSubnet1
    - !Ref PublicSubnet2
    - !Ref PublicSubnet3

# Returns: subnet-123,subnet-456,subnet-789
```

### Split

Splits string into array.

```yaml
!Split
  - ','
  - 'subnet-123,subnet-456,subnet-789'

# Returns: [subnet-123, subnet-456, subnet-789]
```

### Select

Returns single element from array.

```yaml
!Select
  - 0  # Index
  - !GetAZs ''  # Array

# Returns first AZ
```

### GetAZs

Returns list of Availability Zones.

```yaml
!GetAZs ''  # Current region
!GetAZs 'us-east-1'  # Specific region

# Returns: [us-east-1a, us-east-1b, us-east-1c, ...]
```

### FindInMap

Returns value from Mappings section.

```yaml
Mappings:
  RegionMap:
    us-east-1:
      AMI: ami-0c55b159cbfafe1f0
    us-west-2:
      AMI: ami-0d1cd67c26f5fca19

Resources:
  WebServer:
    Type: AWS::EC2::Instance
    Properties:
      ImageId: !FindInMap [RegionMap, !Ref 'AWS::Region', AMI]
```

### ImportValue

Returns value exported by another stack.

```yaml
# Stack 1: Export value
Outputs:
  VPCId:
    Value: !Ref VPC
    Export:
      Name: MyVPC-ID

# Stack 2: Import value
Resources:
  WebServer:
    Type: AWS::EC2::Instance
    Properties:
      SubnetId: !ImportValue MyVPC-PublicSubnet
```

### If

Conditional return based on condition evaluation.

```yaml
Conditions:
  IsProduction: !Equals [!Ref EnvironmentName, prod]

Resources:
  WebServer:
    Type: AWS::EC2::Instance
    Properties:
      InstanceType: !If [IsProduction, t2.large, t2.micro]
```

### Cidr

Generates CIDR blocks.

```yaml
!Cidr
  - !GetAtt VPC.CidrBlock  # Base CIDR
  - 6  # Number of subnets
  - 8  # Subnet bits

# For VPC 10.0.0.0/16, returns:
# [10.0.0.0/24, 10.0.1.0/24, 10.0.2.0/24, ...]
```

### Base64

Encodes string to Base64.

```yaml
Resources:
  WebServer:
    Type: AWS::EC2::Instance
    Properties:
      UserData:
        Fn::Base64: !Sub |
          #!/bin/bash
          echo "Environment: ${EnvironmentName}" > /etc/environment
          yum update -y
          yum install -y httpd
          systemctl start httpd
```

---

## Parameters

**Parameters** allow users to input custom values when creating/updating stacks.

### Parameter Types

**String:**
```yaml
Parameters:
  EnvironmentName:
    Type: String
    Default: dev
    Description: Environment name (dev, staging, prod)
```

**Number:**
```yaml
Parameters:
  InstanceCount:
    Type: Number
    Default: 2
    MinValue: 1
    MaxValue: 10
```

**List:**
```yaml
Parameters:
  AvailabilityZones:
    Type: List<AWS::EC2::AvailabilityZone::Name>
    Description: Select at least 2 AZs
```

**CommaDelimitedList:**
```yaml
Parameters:
  SubnetIds:
    Type: CommaDelimitedList
    Description: List of subnet IDs (comma-separated)
```

**AWS-Specific Types:**
```yaml
Parameters:
  KeyName:
    Type: AWS::EC2::KeyPair::KeyName
    Description: EC2 Key Pair for SSH access

  VpcId:
    Type: AWS::EC2::VPC::Id
    Description: VPC for deployment

  SubnetIds:
    Type: List<AWS::EC2::Subnet::Id>
    Description: Subnets for load balancer

  SecurityGroupId:
    Type: AWS::EC2::SecurityGroup::Id
    Description: Security group
```

### Parameter Constraints

```yaml
Parameters:
  InstanceType:
    Type: String
    Default: t2.micro
    AllowedValues:
      - t2.micro
      - t2.small
      - t2.medium
      - t2.large
    Description: EC2 instance type

  DatabasePassword:
    Type: String
    NoEcho: true  # Hide value in console/CLI
    MinLength: 8
    MaxLength: 64
    AllowedPattern: ^[a-zA-Z0-9]*$
    ConstraintDescription: Must be 8-64 alphanumeric characters

  CIDR:
    Type: String
    Default: 10.0.0.0/16
    AllowedPattern: ^(\d{1,3}\.){3}\d{1,3}/\d{1,2}$
    ConstraintDescription: Must be valid CIDR notation
```

### Parameter Groups (Console UI)

```yaml
Metadata:
  AWS::CloudFormation::Interface:
    ParameterGroups:
      - Label:
          default: "Network Configuration"
        Parameters:
          - VpcCIDR
          - PublicSubnet1CIDR
          - PublicSubnet2CIDR
      - Label:
          default: "Instance Configuration"
        Parameters:
          - InstanceType
          - KeyName
          - SSHLocation
    ParameterLabels:
      VpcCIDR:
        default: "VPC CIDR Block"
      InstanceType:
        default: "Instance Type"
```

---

## Outputs

**Outputs** export values that can be viewed or imported by other stacks.

```yaml
Outputs:
  VPCId:
    Description: VPC ID
    Value: !Ref VPC
    Export:
      Name: !Sub ${AWS::StackName}-VPCID

  PublicSubnets:
    Description: Public subnet IDs
    Value: !Join [',', [!Ref PublicSubnet1, !Ref PublicSubnet2]]
    Export:
      Name: !Sub ${AWS::StackName}-PublicSubnets

  WebServerURL:
    Description: URL of web server
    Value: !Sub http://${WebServer.PublicDnsName}

  LoadBalancerDNS:
    Description: Load balancer DNS name
    Value: !GetAtt ApplicationLoadBalancer.DNSName
```

**Using exported values in other stacks:**
```yaml
Resources:
  WebServer:
    Type: AWS::EC2::Instance
    Properties:
      SubnetId: !ImportValue MyNetworkStack-PublicSubnet1
```

---

## Mappings

**Mappings** are fixed lookup tables for values based on keys.

```yaml
Mappings:
  RegionMap:
    us-east-1:
      AMI: ami-0c55b159cbfafe1f0
      InstanceType: t2.micro
    us-west-2:
      AMI: ami-0d1cd67c26f5fca19
      InstanceType: t2.small
    eu-west-1:
      AMI: ami-0ea3405d2d2522162
      InstanceType: t2.micro

  EnvironmentConfig:
    dev:
      InstanceType: t2.micro
      MinSize: 1
      MaxSize: 2
    prod:
      InstanceType: t2.large
      MinSize: 2
      MaxSize: 10

Resources:
  WebServer:
    Type: AWS::EC2::Instance
    Properties:
      ImageId: !FindInMap [RegionMap, !Ref 'AWS::Region', AMI]
      InstanceType: !FindInMap
        - EnvironmentConfig
        - !Ref EnvironmentName
        - InstanceType
```

---

## Conditions

**Conditions** control whether resources are created or properties are defined.

### Defining Conditions

```yaml
Parameters:
  EnvironmentName:
    Type: String
    AllowedValues: [dev, staging, prod]

  CreateBackup:
    Type: String
    Default: 'false'
    AllowedValues: ['true', 'false']

Conditions:
  IsProduction: !Equals [!Ref EnvironmentName, prod]
  IsNotProduction: !Not [!Equals [!Ref EnvironmentName, prod]]
  IsDevelopment: !Equals [!Ref EnvironmentName, dev]

  CreateBackupResources: !And
    - !Equals [!Ref CreateBackup, 'true']
    - !Equals [!Ref EnvironmentName, prod]

  CreateMultiAZ: !Or
    - !Equals [!Ref EnvironmentName, prod]
    - !Equals [!Ref EnvironmentName, staging]
```

### Condition Functions

**Equals:**
```yaml
!Equals [!Ref EnvironmentName, prod]
```

**Not:**
```yaml
!Not [!Equals [!Ref EnvironmentName, dev]]
```

**And:**
```yaml
!And
  - !Equals [!Ref EnvironmentName, prod]
  - !Equals [!Ref CreateBackup, 'true']
```

**Or:**
```yaml
!Or
  - !Equals [!Ref EnvironmentName, prod]
  - !Equals [!Ref EnvironmentName, staging]
```

### Using Conditions

**Conditional resources:**
```yaml
Resources:
  # Only create in production
  BackupVault:
    Type: AWS::Backup::BackupVault
    Condition: IsProduction
    Properties:
      BackupVaultName: ProductionBackup

  # Create in all environments except dev
  ALB:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Condition: IsNotProduction
    Properties:
      Name: MyALB
```

**Conditional properties:**
```yaml
Resources:
  Database:
    Type: AWS::RDS::DBInstance
    Properties:
      Engine: postgres
      MultiAZ: !If [CreateMultiAZ, true, false]
      BackupRetentionPeriod: !If [IsProduction, 30, 7]
      StorageEncrypted: !If [IsProduction, true, false]
```

**Conditional outputs:**
```yaml
Outputs:
  ProductionURL:
    Condition: IsProduction
    Value: !Sub https://prod.example.com
    Description: Production URL
```

---

## Pseudo Parameters

**Pseudo parameters** are predefined by CloudFormation and can be referenced like regular parameters.

```yaml
AWS::AccountId       # AWS account ID
AWS::NotificationARNs  # Notification ARNs
AWS::NoValue         # Removes corresponding property
AWS::Partition       # AWS partition (aws, aws-cn, aws-us-gov)
AWS::Region          # AWS region
AWS::StackId         # Stack ID
AWS::StackName       # Stack name
AWS::URLSuffix       # Domain suffix (amazonaws.com, amazonaws.com.cn)
```

**Examples:**
```yaml
Resources:
  MyBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub data-${AWS::AccountId}-${AWS::Region}
      Tags:
        - Key: StackName
          Value: !Ref AWS::StackName

  MyRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Statement:
          - Effect: Allow
            Principal:
              Service: !Sub ec2.${AWS::URLSuffix}
            Action: sts:AssumeRole
```

---

## Complete Example

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: Multi-environment VPC with web server

Parameters:
  EnvironmentName:
    Type: String
    Default: dev
    AllowedValues: [dev, staging, prod]
    Description: Environment name

  VpcCIDR:
    Type: String
    Default: 10.0.0.0/16
    AllowedPattern: ^(\d{1,3}\.){3}\d{1,3}/\d{1,2}$

Mappings:
  EnvironmentConfig:
    dev:
      InstanceType: t2.micro
      MultiAZ: false
    staging:
      InstanceType: t2.small
      MultiAZ: true
    prod:
      InstanceType: t2.large
      MultiAZ: true

Conditions:
  IsProduction: !Equals [!Ref EnvironmentName, prod]
  CreateMultiAZ: !FindInMap [EnvironmentConfig, !Ref EnvironmentName, MultiAZ]

Resources:
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: !Ref VpcCIDR
      EnableDnsHostnames: true
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-VPC

  PublicSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: !Select [0, !Cidr [!Ref VpcCIDR, 6, 8]]
      AvailabilityZone: !Select [0, !GetAZs '']
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-Public-1

  WebServer:
    Type: AWS::EC2::Instance
    Properties:
      ImageId: ami-0c55b159cbfafe1f0
      InstanceType: !FindInMap [EnvironmentConfig, !Ref EnvironmentName, InstanceType]
      SubnetId: !Ref PublicSubnet1
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-WebServer
        - Key: Environment
          Value: !Ref EnvironmentName

  ProductionAlarm:
    Type: AWS::CloudWatch::Alarm
    Condition: IsProduction
    Properties:
      AlarmName: !Sub ${EnvironmentName}-HighCPU
      MetricName: CPUUtilization
      Namespace: AWS/EC2
      Statistic: Average
      Period: 300
      EvaluationPeriods: 2
      Threshold: 80
      ComparisonOperator: GreaterThanThreshold

Outputs:
  VPCId:
    Description: VPC ID
    Value: !Ref VPC
    Export:
      Name: !Sub ${AWS::StackName}-VPCID

  WebServerIP:
    Description: Web server public IP
    Value: !GetAtt WebServer.PublicIp

  WebServerURL:
    Description: Web server URL
    Value: !Sub http://${WebServer.PublicDnsName}

  EnvironmentInfo:
    Description: Environment information
    Value: !Sub |
      Environment: ${EnvironmentName}
      Region: ${AWS::Region}
      Account: ${AWS::AccountId}
      Stack: ${AWS::StackName}
```

---

