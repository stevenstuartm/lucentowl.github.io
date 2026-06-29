---
title: "CloudFormation Advanced Features"
layout: guide
category: AWS
subcategory: Infrastructure as Code
description: "Change sets, nested stacks, StackSets, custom resources, drift detection, and best practices for production CloudFormation deployments."
tags: [infrastructure, iac, aws, cloudformation, advanced, practical]
---

## Change Sets

**Change Sets** preview proposed changes before executing a stack update.

### Creating Change Sets

```bash
# Create change set
aws cloudformation create-change-set \
  --stack-name my-stack \
  --change-set-name my-updates \
  --template-body file://template-updated.yaml \
  --parameters ParameterKey=InstanceType,ParameterValue=t2.medium
```

### Reviewing Change Sets

```bash
# Describe change set
aws cloudformation describe-change-set \
  --stack-name my-stack \
  --change-set-name my-updates
```

**Change types:**
- `Add` - New resource will be created
- `Modify` - Resource properties will be updated
- `Remove` - Resource will be deleted
- `Dynamic` - Change determined at execution time

**Replacement:**
- `True` - Resource will be replaced
- `False` - Resource will be updated in place
- `Conditional` - Depends on other changes

### Executing Change Sets

```bash
# Execute change set
aws cloudformation execute-change-set \
  --stack-name my-stack \
  --change-set-name my-updates
```

### Best Practices

- Always use change sets for production
- Review changes thoroughly
- Get approval before execution
- Document changes in change set name

---

## Nested Stacks

**Nested stacks** are stacks created as part of other stacks for organizing and reusing templates.

### Why Use Nested Stacks

- Overcome template size limits (51,200 bytes)
- Reuse common templates
- Organize complex infrastructure
- Separate concerns (network, compute, storage)
- Update components independently

### Creating Nested Stacks

**Parent template:**
```yaml
Resources:
  NetworkStack:
    Type: AWS::CloudFormation::Stack
    Properties:
      TemplateURL: https://s3.amazonaws.com/my-bucket/network.yaml
      Parameters:
        VpcCIDR: 10.0.0.0/16
      TimeoutInMinutes: 30

  ComputeStack:
    Type: AWS::CloudFormation::Stack
    Properties:
      TemplateURL: https://s3.amazonaws.com/my-bucket/compute.yaml
      Parameters:
        VpcId: !GetAtt NetworkStack.Outputs.VPCId
        SubnetIds: !GetAtt NetworkStack.Outputs.PublicSubnets
      TimeoutInMinutes: 30
```

**Child template (network.yaml):**
```yaml
Parameters:
  VpcCIDR:
    Type: String

Resources:
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: !Ref VpcCIDR

  PublicSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: !Select [0, !Cidr [!Ref VpcCIDR, 6, 8]]

Outputs:
  VPCId:
    Value: !Ref VPC
  PublicSubnets:
    Value: !Join [',', [!Ref PublicSubnet1, !Ref PublicSubnet2]]
```

### Organization Pattern

```
templates/
├── main.yaml              # Parent template
├── network/
│   └── vpc.yaml          # Network nested stack
├── compute/
│   ├── asg.yaml          # Compute nested stack
│   └── launch-template.yaml
└── storage/
    └── s3.yaml           # Storage nested stack
```

---

## StackSets

**StackSets** create, update, or delete stacks across multiple AWS accounts and regions.

### Use Cases

- Deploy baseline security across all accounts
- Create standard networking in multiple regions
- Enforce compliance policies organization-wide
- Manage multi-region applications

### Creating StackSets

```bash
# Create StackSet
aws cloudformation create-stack-set \
  --stack-set-name baseline-security \
  --template-body file://security-baseline.yaml \
  --capabilities CAPABILITY_NAMED_IAM

# Create stack instances
aws cloudformation create-stack-instances \
  --stack-set-name baseline-security \
  --accounts 111122223333 444455556666 \
  --regions us-east-1 us-west-2 \
  --operation-preferences \
    MaxConcurrentCount=2,FailureToleranceCount=1
```

### Deployment Options

```yaml
OperationPreferences:
  RegionConcurrencyType: PARALLEL  # Or SEQUENTIAL
  RegionOrder:
    - us-east-1
    - us-west-2
    - eu-west-1
  FailureToleranceCount: 1
  MaxConcurrentCount: 3
```

### Organizational StackSets

```bash
# Create StackSet for entire organization
aws cloudformation create-stack-set \
  --stack-set-name org-wide-logging \
  --template-body file://logging.yaml \
  --permission-model SERVICE_MANAGED \
  --auto-deployment Enabled=true,RetainStacksOnAccountRemoval=false

# Deploy to organization
aws cloudformation create-stack-instances \
  --stack-set-name org-wide-logging \
  --deployment-targets OrganizationalUnitIds=ou-xxxx-yyyyyyyy \
  --regions us-east-1
```

---

## Custom Resources

**Custom resources** enable custom provisioning logic for resources not supported by CloudFormation.

### Lambda-Backed Custom Resource

```yaml
Resources:
  CustomResourceFunction:
    Type: AWS::Lambda::Function
    Properties:
      Runtime: python3.9
      Handler: index.handler
      Code:
        ZipFile: |
          import cfnresponse
          import boto3

          def handler(event, context):
              try:
                  if event['RequestType'] == 'Create':
                      # Custom create logic
                      response_data = {'Result': 'Created'}
                      cfnresponse.send(event, context, cfnresponse.SUCCESS, response_data)
                  elif event['RequestType'] == 'Delete':
                      # Custom delete logic
                      cfnresponse.send(event, context, cfnresponse.SUCCESS, {})
                  else:
                      cfnresponse.send(event, context, cfnresponse.SUCCESS, {})
              except Exception as e:
                  cfnresponse.send(event, context, cfnresponse.FAILED, {'Error': str(e)})
      Role: !GetAtt LambdaExecutionRole.Arn

  CustomResource:
    Type: Custom::MyCustomResource
    Properties:
      ServiceToken: !GetAtt CustomResourceFunction.Arn
      CustomProperty: CustomValue
```

### Use Cases

- Provision resources not supported by CloudFormation
- Call external APIs
- Perform custom validation
- Clean up or transform data

---

## Drift Detection

**Drift** occurs when resources are modified outside CloudFormation.

### Detect Drift

```bash
# Start drift detection
aws cloudformation detect-stack-drift \
  --stack-name my-stack

# Check status
aws cloudformation describe-stack-drift-detection-status \
  --stack-drift-detection-id <id>

# View drift results
aws cloudformation describe-stack-resource-drifts \
  --stack-name my-stack
```

### Drift Statuses

- `IN_SYNC` - Resource matches template
- `MODIFIED` - Resource differs from template
- `DELETED` - Resource deleted outside CloudFormation
- `NOT_CHECKED` - Resource type doesn't support drift detection

### Handling Drift

- Update template to match current state
- Revert manual changes
- Import changed resources

---

## Best Practices

### Template Organization

**Consistent Structure:**
```
infrastructure/
├── README.md
├── templates/
│   ├── network.yaml
│   ├── compute.yaml
│   └── storage.yaml
├── parameters/
│   ├── dev.json
│   ├── staging.json
│   └── prod.json
└── policies/
    └── stack-policy.json
```

**Naming Conventions:**
```yaml
# Stack names: <env>-<app>-<component>
# Example: prod-webapp-network

# Resource names: <env>-<component>-<resource>
resource "aws_s3_bucket" "data" {
  bucket = "myapp-prod-s3-data"
}
```

### Security

**Least Privilege IAM:**
```yaml
Resources:
  EC2Role:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: ec2.amazonaws.com
            Action: sts:AssumeRole
      Policies:
        - PolicyName: S3Access
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - s3:GetObject
                  - s3:PutObject
                Resource: !Sub ${DataBucket.Arn}/*
```

**Encryption:**
```yaml
Resources:
  DataBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketEncryption:
        ServerSideEncryptionConfiguration:
          - ServerSideEncryptionByDefault:
              SSEAlgorithm: AES256

  Database:
    Type: AWS::RDS::DBInstance
    Properties:
      StorageEncrypted: true
      KmsKeyId: !Ref DatabaseKey
```

**Secrets:**
```yaml
# Use Secrets Manager
Resources:
  DBSecret:
    Type: AWS::SecretsManager::Secret
    Properties:
      GenerateSecretString:
        SecretStringTemplate: '{"username": "admin"}'
        GenerateStringKey: password
        PasswordLength: 32

  Database:
    Type: AWS::RDS::DBInstance
    Properties:
      MasterUsername: !Sub '{% raw %}{{resolve:secretsmanager:${DBSecret}:SecretString:username}}{% endraw %}'
      MasterUserPassword: !Sub '{% raw %}{{resolve:secretsmanager:${DBSecret}:SecretString:password}}{% endraw %}'
```

### Tagging

```yaml
Resources:
  WebServer:
    Type: AWS::EC2::Instance
    Properties:
      Tags:
        - Key: Name
          Value: !Sub ${EnvironmentName}-web-server
        - Key: Environment
          Value: !Ref EnvironmentName
        - Key: Application
          Value: !Ref ApplicationName
        - Key: Owner
          Value: !Ref OwnerEmail
        - Key: CostCenter
          Value: !Ref CostCenter
        - Key: ManagedBy
          Value: CloudFormation
```

### Version Control

**.gitignore:**
```
# Sensitive files
*-secrets.yaml
*-secrets.json
*.key
*.pem

# IDE files
.idea/
.vscode/

# Temp files
*.swp
*.tmp
```

### Testing

**Validation Pipeline:**
```yaml
# GitHub Actions
name: CloudFormation CI/CD
on: [push]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Validate template
        run: |
          aws cloudformation validate-template \
            --template-body file://template.yaml

      - name: Lint
        run: |
          pip install cfn-lint
          cfn-lint template.yaml

      - name: Security scan
        run: |
          gem install cfn-nag
          cfn_nag_scan --input-path template.yaml

  deploy-test:
    needs: validate
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to test
        run: |
          aws cloudformation deploy \
            --template-file template.yaml \
            --stack-name test-stack \
            --parameter-overrides EnvironmentName=test
```

---

## Troubleshooting

### Common Errors

**Resource creation failed:**
```
CREATE_FAILED: The security group 'sg-xxxxx' does not exist
```
**Solution:** Check dependencies, ensure resources created in correct order.

**Circular dependency:**
```
Circular dependency between resources
```
**Solution:** Review Ref and GetAtt relationships, break circular references.

**Insufficient permissions:**
```
User is not authorized to perform: ec2:CreateVpc
```
**Solution:** Grant required IAM permissions to CloudFormation execution role.

### Stack Rollback

**Preventing rollback for debugging:**
```bash
aws cloudformation create-stack \
  --stack-name my-stack \
  --template-body file://template.yaml \
  --on-failure DO_NOTHING  # Keep resources for debugging
```

**Manual rollback:**
```bash
# Cancel update and roll back
aws cloudformation cancel-update-stack \
  --stack-name my-stack

# Continue rollback if stuck
aws cloudformation continue-update-rollback \
  --stack-name my-stack
```

### Viewing Logs

```bash
# View stack events
aws cloudformation describe-stack-events \
  --stack-name my-stack

# Watch events in real-time
aws cloudformation describe-stack-events \
  --stack-name my-stack \
  --query 'StackEvents[*].[Timestamp,ResourceStatus,ResourceType,LogicalResourceId,ResourceStatusReason]' \
  --output table
```

### Debugging Tips

1. **Use Change Sets**: Preview changes before applying
2. **Start Small**: Test with minimal template first
3. **Check Dependencies**: Review implicit dependencies
4. **Validate Templates**: Use `validate-template` and `cfn-lint`
5. **Enable Termination Protection**: Prevent accidental deletion

```bash
# Enable termination protection
aws cloudformation update-termination-protection \
  --enable-termination-protection \
  --stack-name production-stack
```

---

