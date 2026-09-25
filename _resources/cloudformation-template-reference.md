---
title: "CloudFormation Template Reference"
layout: resource
type: cheatsheet
category: "AWS"
description: "CloudFormation intrinsic functions (including cross-stack references), parameter types and constraints, mappings, conditions, rules, dynamic references, and pseudo parameters, each with a YAML example."
last_updated: 2026-09-25
tags: [cloudformation, intrinsic-functions, yaml, iac, templates]
related_guides:
  - /study-guides/infrastructure/aws/cloudformation-fundamentals.html
  - /study-guides/infrastructure/aws/cloudformation-advanced.html
---
{% raw %}

## Intrinsic Functions

Functions CloudFormation evaluates while it deploys the stack. Each has a short YAML form (`!Ref`) and a full form (`Ref:` or `Fn::GetAtt:`).

### Ref

A parameter's value, or a resource's main identifier (which one depends on the type, such as an instance ID or a queue URL).

```yaml
Resources:
  WebServer:
    Type: AWS::EC2::Instance
    Properties:
      InstanceType: !Ref InstanceType   # parameter value
      SubnetId: !Ref PublicSubnet       # subnet ID
```

Full form: `Ref: LogicalName`.

### GetAtt

Another attribute of a resource. Each type's reference page lists its attributes.

```yaml
Outputs:
  QueueArn:
    Value: !GetAtt OrdersQueue.Arn
  DatabaseEndpoint:
    Value: !GetAtt Database.Endpoint.Address
```

Full form: `Fn::GetAtt: [LogicalName, AttributeName]`.

### Sub

A string with `${...}` values substituted from parameters, resource IDs, attributes, and pseudo parameters.

```yaml
Tags:
  - Key: Name
    Value: !Sub ${Environment}-web-${AWS::Region}

# With explicit variables
Value: !Sub
  - 'arn:${AWS::Partition}:s3:::${BucketName}/*'
  - BucketName: !Ref ArchiveBucket
```

### Join and Split

Join a list into one string, or split a string into a list.

```yaml
!Join [',', [!Ref SubnetA, !Ref SubnetB]]   # "subnet-1,subnet-2"
!Split [',', 'subnet-1,subnet-2']            # [subnet-1, subnet-2]
```

### Select, GetAZs, and Cidr

Pick an element from a list, list the Region's Availability Zones, or carve a CIDR block into subnets.

```yaml
AvailabilityZone: !Select [0, !GetAZs '']            # first AZ in this Region
CidrBlock: !Select [0, !Cidr [!GetAtt VPC.CidrBlock, 6, 8]]
# !Cidr [base, count, host bits]: 6 blocks with 8 host bits (/24s from a /16)
```

### FindInMap

A value from the `Mappings` section, by top-level key and second-level key.

```yaml
InstanceType: !FindInMap [EnvironmentConfig, !Ref Environment, InstanceType]
```

### ImportValue

A value another stack in the same account and Region exported from its `Outputs`.

```yaml
# Exporting stack
Outputs:
  VpcId:
    Value: !Ref VPC
    Export:
      Name: !Sub ${AWS::StackName}-VpcId

# Importing stack
Properties:
  VpcId: !ImportValue network-prod-VpcId
```

### GetStackOutput

An output of another stack, read directly without an export, in the same or another account and Region (since May 2026). The reference is weak, so the producer can still change or delete the output.

```yaml
SubnetId:
  Fn::GetStackOutput:
    StackName: network-prod
    OutputName: PrivateSubnetA
    Region: us-west-2                                             # optional
    RoleArn: arn:aws:iam::111111111111:role/ReadNetworkOutputs    # optional, for another account
```

Use the full `Fn::GetStackOutput:` form whenever a parameter value uses another short form such as `!Ref`.

### If

One of two values depending on a condition. `AWS::NoValue` removes the property instead.

```yaml
MultiAZ: !If [IsProd, true, false]
SnapshotIdentifier: !If [RestoreFromSnapshot, !Ref SnapshotId, !Ref AWS::NoValue]
```

### Base64

Base64-encodes a string, as EC2 user data requires.

```yaml
UserData:
  Fn::Base64: !Sub |
    #!/bin/bash
    echo "Environment: ${Environment}" > /etc/app-environment
```

### Language Extensions

The `AWS::LanguageExtensions` transform adds `Fn::ForEach` (repeat a resource for each item in a list), `Fn::Length`, `Fn::ToJsonString`, and a default value for `Fn::FindInMap`. These functions have no short YAML forms, so write `Fn::Length:`, not `!Length`.

```yaml
Transform: AWS::LanguageExtensions
Resources:
  Fn::ForEach::Topics:
    - TopicName
    - [Orders, Payments, Refunds]
    - ${TopicName}Topic:
        Type: AWS::SNS::Topic
```

---

## Parameters

Values supplied at deployment. The type determines what's accepted and how the console prompts for it.

| Type | Accepts |
|---|---|
| `String`, `Number` | Plain values |
| `CommaDelimitedList`, `List<Number>` | Lists |
| `AWS::EC2::VPC::Id`, `AWS::EC2::Subnet::Id`, `List<AWS::EC2::Subnet::Id>`, `AWS::EC2::SecurityGroup::Id`, and similar | Existing resource IDs, validated against the account |
| `AWS::SSM::Parameter::Value<String>`, `AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>`, and similar | The name of a Parameter Store parameter, whose current value is read at deployment |

```yaml
Parameters:
  Environment:
    Type: String
    AllowedValues: [dev, staging, prod]
    Default: dev

  InstanceCount:
    Type: Number
    Default: 2
    MinValue: 1
    MaxValue: 10

  LatestAmiId:   # always the latest Amazon Linux 2023 AMI for this Region
    Type: AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>
    Default: /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64

  VpcCidr:
    Type: String
    Default: 10.0.0.0/16
    AllowedPattern: ^(\d{1,3}\.){3}\d{1,3}/\d{1,2}$
    ConstraintDescription: Must be a CIDR block such as 10.0.0.0/16
```

`NoEcho: true` masks a parameter's value in the console and API output, but the value can still appear elsewhere, so pass secrets with a dynamic reference instead (below).

### Parameter Groups

How the console groups and labels parameters, set in `Metadata`.

```yaml
Metadata:
  AWS::CloudFormation::Interface:
    ParameterGroups:
      - Label:
          default: Network
        Parameters: [VpcCidr]
      - Label:
          default: Compute
        Parameters: [InstanceCount, LatestAmiId]
    ParameterLabels:
      VpcCidr:
        default: VPC CIDR block
```

---

## Mappings

Fixed lookup tables, two levels deep, read with `!FindInMap`.

```yaml
Mappings:
  EnvironmentConfig:
    dev:
      InstanceType: t4g.small
      MinSize: 1
    prod:
      InstanceType: m7g.large
      MinSize: 3
```

---

## Conditions

Named true-or-false expressions, built from `!Equals`, `!And`, `!Or`, `!Not`, and references to other conditions, with `!Ref` and `!FindInMap` usable inside them.

```yaml
Conditions:
  IsProd: !Equals [!Ref Environment, prod]
  IsNotDev: !Not [!Equals [!Ref Environment, dev]]
  NeedsReplica: !And
    - Condition: IsProd
    - !Equals [!Ref CreateReplica, 'true']
```

Conditions apply to whole resources, to individual properties through `!If`, and to outputs.

```yaml
Resources:
  ReadReplica:
    Type: AWS::RDS::DBInstance
    Condition: NeedsReplica
    Properties:
      SourceDBInstanceIdentifier: !Ref Database
      DBInstanceClass: db.r8g.large

  Database:
    Type: AWS::RDS::DBInstance
    Properties:
      MultiAZ: !If [IsProd, true, false]
      BackupRetentionPeriod: !If [IsProd, 30, 7]

Outputs:
  ReplicaEndpoint:
    Condition: NeedsReplica
    Value: !GetAtt ReadReplica.Endpoint.Address
```

---

## Rules

Checks on parameter values that run before CloudFormation touches any resource, failing the operation with a message. Rule-specific functions such as `Fn::Contains` have no short YAML form.

```yaml
Rules:
  ProdUsesLargeInstances:
    RuleCondition: !Equals [!Ref Environment, prod]
    Assertions:
      - Assert:
          Fn::Contains: [[m7g.large, m7g.xlarge], !Ref InstanceType]
        AssertDescription: Production needs m7g.large or m7g.xlarge
```

---

## Dynamic References

Values CloudFormation reads from Parameter Store or Secrets Manager at deployment, without them appearing in the template or in parameter values. A template can hold 60, and they can't be used in EC2 `UserData` or `AWS::CloudFormation::Init`.

```yaml
# Parameter Store String or StringList (a specific version with :version)
QueueUrl: '{{resolve:ssm:/orders/prod/queue-url}}'

# Parameter Store SecureString (only on a short list of properties, such as RDS MasterUserPassword)
MasterUserPassword: '{{resolve:ssm-secure:/orders/prod/db-password}}'

# Secrets Manager (secret, then SecretString and a JSON key), usable on any property
MasterUserPassword: '{{resolve:secretsmanager:prod/db:SecretString:password}}'
```

---

## Pseudo Parameters

Values CloudFormation always provides, used with `!Ref` or inside `!Sub`.

| Pseudo parameter | Value |
|---|---|
| `AWS::AccountId` | The account ID |
| `AWS::Region` | The Region, such as `us-east-1` |
| `AWS::Partition` | The partition, such as `aws`, `aws-cn`, or `aws-us-gov`, for building ARNs that work in every partition |
| `AWS::URLSuffix` | The domain suffix, usually `amazonaws.com` |
| `AWS::StackName`, `AWS::StackId` | The stack's name and ID |
| `AWS::NotificationARNs` | The stack's SNS notification topics |
| `AWS::NoValue` | Removes a property when returned by `!If` |

```yaml
BucketName: !Sub archive-${AWS::AccountId}-${AWS::Region}
Resource: !Sub arn:${AWS::Partition}:s3:::${ArchiveBucket}/*
```
{% endraw %}
