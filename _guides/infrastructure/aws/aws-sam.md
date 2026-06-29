---
title: "AWS SAM - Serverless Application Model"
layout: guide
category: AWS
subcategory: Serverless Architecture
description: "AWS SAM templates, local testing, deployment pipelines, and comparison with AWS CDK for serverless infrastructure as code"
tags: [aws, serverless, infrastructure-as-code, sam, deployment, automation]
---

## What Problem This Solves

**The Serverless IaC Challenge**:
Deploying serverless applications involves managing Lambda functions, API Gateway routes, DynamoDB tables, IAM roles, and event sources. Using raw CloudFormation for serverless is verbose and error-prone. Organizations need a simpler way to define, test locally, and deploy serverless applications.

**What AWS SAM Provides**:
AWS Serverless Application Model (SAM) is an open-source framework that simplifies serverless development:
- **Simplified syntax**: Shorter templates compared to CloudFormation
- **Local testing**: Test Lambda functions and APIs locally before deployment
- **Built-in best practices**: Automatic IAM policies, API Gateway configurations
- **CLI tools**: `sam build`, `sam local`, `sam deploy` for the full development lifecycle
- **AWS integration**: Extends CloudFormation (SAM templates are valid CloudFormation)

---

## SAM vs CloudFormation vs CDK

### Comparison

<div class="comparison">
<div class="content-card content-card--accent">
<h4>AWS SAM</h4>
<ul>
<li><strong>Syntax:</strong> YAML/JSON (simplified)</li>
<li><strong>Learning curve:</strong> Low</li>
<li><strong>Serverless focus:</strong> Optimized for serverless</li>
<li><strong>Local testing:</strong> Built-in (sam local)</li>
<li><strong>Best for:</strong> Pure serverless apps</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>AWS CDK</h4>
<ul>
<li><strong>Syntax:</strong> Programming languages (TypeScript, Python, etc.)</li>
<li><strong>Learning curve:</strong> High</li>
<li><strong>Serverless focus:</strong> Generic (good support)</li>
<li><strong>Local testing:</strong> Requires SAM</li>
<li><strong>Best for:</strong> Complex infra with logic</li>
</ul>
</div>
</div>

| Feature | SAM | CloudFormation | AWS CDK |
|---------|-----|----------------|---------|
| **Syntax** | YAML/JSON (simplified) | YAML/JSON (verbose) | TypeScript, Python, Java, etc. (programming language) |
| **Learning curve** | Low | Medium | High |
| **Serverless focus** | ✅ Yes (optimized) | ⚠️ Generic | ⚠️ Generic (but good support) |
| **Local testing** | ✅ Built-in (`sam local`) | ❌ No | ❌ No (requires SAM) |
| **Lines of code** | 50 lines | 200 lines | 30 lines |
| **Best for** | Pure serverless apps | Multi-service AWS apps | Complex infra with logic |

### Example: Same API in All Three

**SAM Template** (50 lines):
```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Resources:
  HelloWorldFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: hello-world/
      Handler: app.handler
      Runtime: python3.9
      Events:
        HelloWorld:
          Type: Api
          Properties:
            Path: /hello
            Method: get
```

**CloudFormation** (200+ lines):
```yaml
Resources:
  HelloWorldFunction:
    Type: AWS::Lambda::Function
    Properties:
      Code:
        S3Bucket: my-deployment-bucket
        S3Key: lambda-code.zip
      Handler: app.handler
      Runtime: python3.9
      Role: !GetAtt LambdaExecutionRole.Arn

  LambdaExecutionRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: lambda.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

  ApiGateway:
    Type: AWS::ApiGatewayV2::Api
    Properties:
      Name: HelloWorldApi
      ProtocolType: HTTP

  ApiGatewayIntegration:
    Type: AWS::ApiGatewayV2::Integration
    Properties:
      ApiId: !Ref ApiGateway
      IntegrationType: AWS_PROXY
      IntegrationUri: !Sub arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:${HelloWorldFunction}
      PayloadFormatVersion: '2.0'

  ApiGatewayRoute:
    Type: AWS::ApiGatewayV2::Route
    Properties:
      ApiId: !Ref ApiGateway
      RouteKey: 'GET /hello'
      Target: !Sub integrations/${ApiGatewayIntegration}

  ApiGatewayStage:
    Type: AWS::ApiGatewayV2::Stage
    Properties:
      ApiId: !Ref ApiGateway
      StageName: prod
      AutoDeploy: true

  LambdaPermission:
    Type: AWS::Lambda::Permission
    Properties:
      FunctionName: !Ref HelloWorldFunction
      Action: lambda:InvokeFunction
      Principal: apigateway.amazonaws.com
      SourceArn: !Sub arn:aws:execute-api:${AWS::Region}:${AWS::AccountId}:${ApiGateway}/*/*

# ... more resources (LogGroup, Alarms, etc.)
```

**AWS CDK** (30 lines, TypeScript):
```typescript
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';

export class HelloWorldStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const helloFunction = new lambda.Function(this, 'HelloWorldFunction', {
      runtime: lambda.Runtime.PYTHON_3_9,
      code: lambda.Code.fromAsset('hello-world'),
      handler: 'app.handler',
    });

    const api = new apigateway.RestApi(this, 'HelloWorldApi');
    const helloResource = api.root.addResource('hello');
    helloResource.addMethod('GET', new apigateway.LambdaIntegration(helloFunction));
  }
}
```

<div class="callout callout--note">
<p class="callout__title">When to Choose Each Tool</p>
<ul>
<li><strong>Use SAM</strong> for pure serverless applications (Lambda + API Gateway + DynamoDB + EventBridge)</li>
<li><strong>Use CDK</strong> for complex infrastructure requiring programming logic and multi-service apps</li>
<li><strong>Use CloudFormation</strong> for legacy systems or specific AWS features not yet in SAM/CDK</li>
</ul>
</div>

---

## SAM Template Basics

### Minimal SAM Template

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31  # Required for SAM

Description: Simple serverless API

Globals:
  Function:
    Timeout: 30
    MemorySize: 512
    Runtime: python3.9
    Environment:
      Variables:
        ENVIRONMENT: production

Resources:
  # Lambda function with API Gateway trigger
  GetUserFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: functions/get-user/
      Handler: app.lambda_handler
      Events:
        Api:
          Type: Api
          Properties:
            Path: /users/{id}
            Method: GET

  # DynamoDB table
  UsersTable:
    Type: AWS::Serverless::SimpleTable
    Properties:
      PrimaryKey:
        Name: user_id
        Type: String
      ProvisionedThroughput:
        ReadCapacityUnits: 5
        WriteCapacityUnits: 5

Outputs:
  ApiUrl:
    Description: API Gateway endpoint URL
    Value: !Sub 'https://${ServerlessRestApi}.execute-api.${AWS::Region}.amazonaws.com/Prod/'
```

### Resource Types

**1. AWS::Serverless::Function**

```yaml
CreateOrderFunction:
  Type: AWS::Serverless::Function
  Properties:
    CodeUri: functions/create-order/
    Handler: app.lambda_handler
    Runtime: python3.9
    Timeout: 60
    MemorySize: 1024
    Environment:
      Variables:
        ORDERS_TABLE: !Ref OrdersTable
    Policies:
      - DynamoDBCrudPolicy:
          TableName: !Ref OrdersTable
      - SNSPublishMessagePolicy:
          TopicName: !GetAtt OrderCreatedTopic.TopicName
    Events:
      ApiPost:
        Type: Api
        Properties:
          Path: /orders
          Method: POST
      ScheduledEvent:
        Type: Schedule
        Properties:
          Schedule: cron(0 12 * * ? *)  # Daily at noon UTC
      SQSTrigger:
        Type: SQS
        Properties:
          Queue: !GetAtt OrderQueue.Arn
          BatchSize: 10
```

**2. AWS::Serverless::Api**

```yaml
MyApi:
  Type: AWS::Serverless::Api
  Properties:
    StageName: prod
    Cors:
      AllowOrigin: "'*'"
      AllowHeaders: "'Content-Type,Authorization'"
      AllowMethods: "'GET,POST,PUT,DELETE'"
    Auth:
      DefaultAuthorizer: MyCognitoAuthorizer
      Authorizers:
        MyCognitoAuthorizer:
          UserPoolArn: !GetAtt UserPool.Arn
    AccessLogSetting:
      DestinationArn: !GetAtt ApiAccessLogs.Arn
      Format: '$context.requestId $context.error.message $context.error.messageString'
    MethodSettings:
      - ResourcePath: '/*'
        HttpMethod: '*'
        LoggingLevel: INFO
        DataTraceEnabled: true
        MetricsEnabled: true
```

**3. AWS::Serverless::SimpleTable (DynamoDB)**

```yaml
OrdersTable:
  Type: AWS::Serverless::SimpleTable
  Properties:
    PrimaryKey:
      Name: order_id
      Type: String
    ProvisionedThroughput:
      ReadCapacityUnits: 10
      WriteCapacityUnits: 5
    Tags:
      Department: Sales
```

**4. AWS::Serverless::StateMachine (Step Functions)**

```yaml
OrderProcessingStateMachine:
  Type: AWS::Serverless::StateMachine
  Properties:
    DefinitionUri: statemachines/order-processing.asl.json
    Role: !GetAtt StateMachineRole.Arn
    Events:
      OrderCreated:
        Type: EventBridgeRule
        Properties:
          Pattern:
            source:
              - order.service
            detail-type:
              - OrderCreated
```

---

## SAM CLI Workflow

### 1. Initialize Project

```bash
# Create new SAM application from template
sam init

# Interactive prompts:
# 1. Choose template: AWS Quick Start Templates
# 2. Choose runtime: python3.9
# 3. Choose template: Hello World Example
# 4. Project name: my-serverless-app

# Project structure created:
# my-serverless-app/
#   ├── hello-world/
#   │   ├── app.py
#   │   └── requirements.txt
#   ├── events/
#   │   └── event.json
#   ├── template.yaml
#   └── README.md
```

### 2. Build Application

```bash
cd my-serverless-app

# Build Lambda function(s) and dependencies
sam build

# Output:
# Building codeuri: hello-world/ runtime: python3.9 metadata: {} architecture: x86_64 functions: HelloWorldFunction
# Running PythonPipBuilder:ResolveDependencies
# Running PythonPipBuilder:CopySource

# Build artifacts in .aws-sam/build/
```

**What `sam build` does**:
- Resolves dependencies (pip install for Python, npm install for Node.js)
- Packages Lambda functions into deployment-ready artifacts
- Validates SAM template syntax
- Creates `.aws-sam/build/` directory with built artifacts

### 3. Test Locally

**Invoke function locally**:
```bash
# Invoke function with test event
sam local invoke HelloWorldFunction -e events/event.json

# Output:
# Invoking app.lambda_handler (python3.9)
# Skip pulling image and use local one: public.ecr.aws/sam/emulation-python3.9:rapid-1.53.0-x86_64.
#
# Mounting /path/to/.aws-sam/build/HelloWorldFunction as /var/task:ro,delegated inside runtime container
# START RequestId: 12345678-1234-1234-1234-123456789012 Version: $LATEST
# END RequestId: 12345678-1234-1234-1234-123456789012
# REPORT RequestId: 12345678-1234-1234-1234-123456789012  Duration: 150.00 ms     Billed Duration: 150 ms Memory Size: 512 MB     Max Memory Used: 50 MB
#
# {"statusCode": 200, "body": "{\"message\": \"hello world\"}"}
```

**Start local API Gateway**:
```bash
# Start API Gateway locally (http://localhost:3000)
sam local start-api

# Test API
curl http://localhost:3000/hello

# Output:
# {"message": "hello world"}
```

**Generate sample events**:
```bash
# Generate S3 event
sam local generate-event s3 put > events/s3-event.json

# Generate API Gateway event
sam local generate-event apigateway aws-proxy > events/api-event.json

# Generate SQS event
sam local generate-event sqs receive-message > events/sqs-event.json
```

### 4. Deploy Application

**Guided deployment (first time)**:
```bash
sam deploy --guided

# Interactive prompts:
# Stack Name [my-serverless-app]: my-serverless-app
# AWS Region [us-east-1]: us-east-1
# Confirm changes before deploy [Y/n]: Y
# Allow SAM CLI IAM role creation [Y/n]: Y
# Disable rollback [y/N]: N
# HelloWorldFunction may not have authorization defined, Is this okay? [y/N]: y
# Save arguments to configuration file [Y/n]: Y
# SAM configuration file [samconfig.toml]: samconfig.toml
# SAM configuration environment [default]: default

# Deployment proceeds:
# - Creates CloudFormation changeset
# - Shows proposed changes
# - Confirms deployment
# - Uploads artifacts to S3
# - Executes CloudFormation stack

# Output:
# CloudFormation outputs from deployed stack
# -------------------------------------------------------------------------------------------------
# Outputs
# -------------------------------------------------------------------------------------------------
# Key                 HelloWorldFunctionIamRole
# Description         Implicit IAM Role created for Hello World function
# Value               arn:aws:iam::123456789012:role/my-serverless-app-HelloWorldFunctionRole-ABC123

# Key                 HelloWorldApi
# Description         API Gateway endpoint URL for Prod stage
# Value               https://abc123def4.execute-api.us-east-1.amazonaws.com/Prod/hello/

# Key                 HelloWorldFunction
# Description         Hello World Lambda Function ARN
# Value               arn:aws:lambda:us-east-1:123456789012:function:my-serverless-app-HelloWorldFunction-XYZ789
# -------------------------------------------------------------------------------------------------
```

**Subsequent deployments** (uses saved config):
```bash
sam deploy

# Reads from samconfig.toml, deploys without prompts
```

### 5. Monitor and Debug

```bash
# Tail CloudWatch logs
sam logs -n HelloWorldFunction --tail

# Tail logs with filter
sam logs -n HelloWorldFunction --tail --filter ERROR

# Sync local changes to AWS (live development)
sam sync --watch

# Watches for file changes and automatically deploys
```

---

## Real-World Example: E-Commerce API

### Project Structure

```
ecommerce-api/
├── functions/
│   ├── create-order/
│   │   ├── app.py
│   │   └── requirements.txt
│   ├── get-order/
│   │   ├── app.py
│   │   └── requirements.txt
│   └── list-orders/
│       ├── app.py
│       └── requirements.txt
├── layers/
│   └── common-libs/
│       └── python/
│           └── lib/
│               └── utils.py
├── events/
│   ├── create-order-event.json
│   └── get-order-event.json
├── template.yaml
├── samconfig.toml
└── README.md
```

### SAM Template

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Description: E-Commerce API with SAM

Globals:
  Function:
    Timeout: 30
    MemorySize: 512
    Runtime: python3.9
    Environment:
      Variables:
        ORDERS_TABLE: !Ref OrdersTable
        ENVIRONMENT: !Ref Environment
    Layers:
      - !Ref CommonLibsLayer

Parameters:
  Environment:
    Type: String
    Default: dev
    AllowedValues:
      - dev
      - staging
      - production

Resources:
  # Lambda Layer for shared code
  CommonLibsLayer:
    Type: AWS::Serverless::LayerVersion
    Properties:
      LayerName: common-libs
      Description: Shared utilities and dependencies
      ContentUri: layers/common-libs/
      CompatibleRuntimes:
        - python3.9
      RetentionPolicy: Retain

  # API Gateway
  ECommerceApi:
    Type: AWS::Serverless::Api
    Properties:
      StageName: !Ref Environment
      Cors:
        AllowOrigin: "'*'"
        AllowHeaders: "'Content-Type,Authorization'"
      Auth:
        ApiKeyRequired: true  # Require API key

  # Lambda: Create Order
  CreateOrderFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: functions/create-order/
      Handler: app.lambda_handler
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref OrdersTable
        - SNSPublishMessagePolicy:
            TopicName: !GetAtt OrderCreatedTopic.TopicName
      Events:
        CreateOrderApi:
          Type: Api
          Properties:
            RestApiId: !Ref ECommerceApi
            Path: /orders
            Method: POST

  # Lambda: Get Order
  GetOrderFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: functions/get-order/
      Handler: app.lambda_handler
      Policies:
        - DynamoDBReadPolicy:
            TableName: !Ref OrdersTable
      Events:
        GetOrderApi:
          Type: Api
          Properties:
            RestApiId: !Ref ECommerceApi
            Path: /orders/{orderId}
            Method: GET

  # Lambda: List Orders
  ListOrdersFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: functions/list-orders/
      Handler: app.lambda_handler
      Policies:
        - DynamoDBReadPolicy:
            TableName: !Ref OrdersTable
      Events:
        ListOrdersApi:
          Type: Api
          Properties:
            RestApiId: !Ref ECommerceApi
            Path: /orders
            Method: GET

  # DynamoDB Table
  OrdersTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: !Sub ${Environment}-Orders
      BillingMode: PAY_PER_REQUEST  # On-Demand
      AttributeDefinitions:
        - AttributeName: order_id
          AttributeType: S
        - AttributeName: customer_id
          AttributeType: S
        - AttributeName: created_at
          AttributeType: N
      KeySchema:
        - AttributeName: order_id
          KeyType: HASH
      GlobalSecondaryIndexes:
        - IndexName: customer-index
          KeySchema:
            - AttributeName: customer_id
              KeyType: HASH
            - AttributeName: created_at
              KeyType: RANGE
          Projection:
            ProjectionType: ALL
      StreamSpecification:
        StreamViewType: NEW_AND_OLD_IMAGES

  # SNS Topic for order events
  OrderCreatedTopic:
    Type: AWS::SNS::Topic
    Properties:
      DisplayName: Order Created Notifications

Outputs:
  ApiUrl:
    Description: API Gateway endpoint URL
    Value: !Sub 'https://${ECommerceApi}.execute-api.${AWS::Region}.amazonaws.com/${Environment}/'

  OrdersTableName:
    Description: DynamoDB table name
    Value: !Ref OrdersTable

  OrderCreatedTopicArn:
    Description: SNS topic ARN for order events
    Value: !Ref OrderCreatedTopic
```

### Function Code (create-order)

```python
# functions/create-order/app.py

import json
import boto3
import os
import uuid
from datetime import datetime

dynamodb = boto3.resource('dynamodb')
sns = boto3.client('sns')

table = dynamodb.Table(os.environ['ORDERS_TABLE'])
topic_arn = os.environ['ORDER_CREATED_TOPIC_ARN']

def lambda_handler(event, context):
    """Create new order"""

    # Parse request body
    body = json.loads(event['body'])

    # Validate input
    if 'customer_id' not in body or 'items' not in body:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'Missing required fields'})
        }

    # Create order
    order_id = str(uuid.uuid4())
    order = {
        'order_id': order_id,
        'customer_id': body['customer_id'],
        'items': body['items'],
        'total': sum(item['price'] * item['quantity'] for item in body['items']),
        'status': 'pending',
        'created_at': int(datetime.utcnow().timestamp())
    }

    # Save to DynamoDB
    table.put_item(Item=order)

    # Publish event to SNS
    sns.publish(
        TopicArn=topic_arn,
        Subject='Order Created',
        Message=json.dumps({'order_id': order_id, 'customer_id': body['customer_id']})
    )

    return {
        'statusCode': 201,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({'order_id': order_id, 'status': 'created'})
    }
```

### Deployment

```bash
# Build
sam build

# Test locally
sam local start-api

# Test endpoint
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "cust-123",
    "items": [
      {"product_id": "prod-1", "quantity": 2, "price": 29.99},
      {"product_id": "prod-2", "quantity": 1, "price": 49.99}
    ]
  }'

# Deploy to dev
sam deploy --parameter-overrides Environment=dev

# Deploy to production
sam deploy --parameter-overrides Environment=production
```

---

## CI/CD Pipeline with SAM

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml

name: Deploy Serverless App

on:
  push:
    branches: [main]

env:
  AWS_REGION: us-east-1

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.9'

      - name: Install SAM CLI
        run: |
          pip install aws-sam-cli

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: SAM Build
        run: sam build

      - name: SAM Deploy
        run: |
          sam deploy \
            --no-confirm-changeset \
            --no-fail-on-empty-changeset \
            --stack-name my-serverless-app \
            --s3-bucket my-sam-deployment-bucket \
            --capabilities CAPABILITY_IAM \
            --region ${{ env.AWS_REGION }}
```

### AWS CodePipeline

```yaml
# samconfig.toml with CodePipeline integration

version = 0.1

[default.deploy.parameters]
stack_name = "my-serverless-app"
s3_bucket = "my-sam-deployment-bucket"
s3_prefix = "my-serverless-app"
region = "us-east-1"
capabilities = "CAPABILITY_IAM"
parameter_overrides = "Environment=production"
image_repositories = []

[default.pipeline.bootstrap.parameters]
pipeline_user = "arn:aws:iam::123456789012:user/aws-sam-cli-managed-pipeline-user"
```

**Bootstrap pipeline**:
```bash
# Create pipeline infrastructure
sam pipeline init --bootstrap

# Deploy pipeline
sam pipeline bootstrap \
  --stage production \
  --pipeline-user arn:aws:iam::123456789012:user/aws-sam-cli-managed-pipeline-user

# Result: Creates CodePipeline with Source (GitHub) → Build (CodeBuild) → Deploy (CloudFormation)
```

---

## SAM Policy Templates

**Built-in IAM policies** for common use cases:

```yaml
MyFunction:
  Type: AWS::Serverless::Function
  Properties:
    CodeUri: my-function/
    Handler: app.handler
    Policies:
      # DynamoDB policies
      - DynamoDBCrudPolicy:
          TableName: !Ref MyTable
      - DynamoDBReadPolicy:
          TableName: !Ref MyTable

      # S3 policies
      - S3ReadPolicy:
          BucketName: my-bucket
      - S3WritePolicy:
          BucketName: my-bucket
      - S3CrudPolicy:
          BucketName: my-bucket

      # SQS policies
      - SQSSendMessagePolicy:
          QueueName: !GetAtt MyQueue.QueueName
      - SQSPollerPolicy:
          QueueName: !GetAtt MyQueue.QueueName

      # SNS policies
      - SNSPublishMessagePolicy:
          TopicName: !GetAtt MyTopic.TopicName

      # Secrets Manager
      - SecretsManagerReadWrite:
          SecretArn: !Ref MySecret

      # Step Functions
      - StepFunctionsExecutionPolicy:
          StateMachineName: !GetAtt MyStateMachine.Name

      # Custom inline policy
      - Statement:
          - Effect: Allow
            Action:
              - logs:CreateLogGroup
              - logs:CreateLogStream
              - logs:PutLogEvents
            Resource: '*'
```

---

## Comparison: SAM vs CDK

### When to Use SAM

**Pros**:
- ✅ Simpler syntax for serverless-only applications
- ✅ Built-in local testing (`sam local`)
- ✅ Faster deployment (no synth step)
- ✅ Lower learning curve (YAML-based)
- ✅ Policy templates for common IAM patterns

**Cons**:
- ❌ Limited to serverless resources (Lambda, API Gateway, DynamoDB, etc.)
- ❌ No programming logic (can't use loops, conditionals)
- ❌ Less flexibility for complex infrastructure

**Use SAM for**:
- Pure serverless applications (Lambda + API Gateway + DynamoDB)
- Teams without programming background (DevOps, SysAdmins)
- Quick prototypes and proof-of-concepts

### When to Use CDK

**Pros**:
- ✅ Full programming language (TypeScript, Python, Java, etc.)
- ✅ Reusable constructs and libraries
- ✅ Supports all AWS services (not just serverless)
- ✅ Type safety and IDE autocomplete
- ✅ Conditional logic and loops

**Cons**:
- ❌ Steeper learning curve
- ❌ Requires programming knowledge
- ❌ No built-in local testing (must use SAM CLI)
- ❌ Longer deployment (synth CloudFormation → deploy)

**Use CDK for**:
- Complex infrastructure requiring logic
- Multi-service applications (EC2, RDS, ECS, Lambda)
- Teams with strong programming skills
- Reusable infrastructure patterns

---

## Common Pitfalls

### Pitfall 1: Not Using `sam build` Before Deploy

**Problem**: Deploy fails because dependencies not packaged.

```bash
# ❌ BAD: Deploy without building
sam deploy  # Fails: "Unable to upload artifact"

# ✅ GOOD: Build then deploy
sam build
sam deploy
```

### Pitfall 2: Forgetting `Transform: AWS::Serverless-2016-10-31`

**Problem**: SAM resources not recognized.

```yaml
# ❌ BAD: Missing Transform
AWSTemplateFormatVersion: '2010-09-09'

Resources:
  MyFunction:
    Type: AWS::Serverless::Function  # Error: Unrecognized resource type

# ✅ GOOD: Include Transform
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31  # Required for SAM

Resources:
  MyFunction:
    Type: AWS::Serverless::Function  # Works
```

### Pitfall 3: Not Setting IAM Permissions for Functions

**Problem**: Lambda functions can't access DynamoDB, S3, etc.

```yaml
# ❌ BAD: No IAM policies
MyFunction:
  Type: AWS::Serverless::Function
  Properties:
    CodeUri: my-function/
    Handler: app.handler
    # Function tries to access DynamoDB but has no permissions → AccessDeniedException

# ✅ GOOD: Explicit IAM policies
MyFunction:
  Type: AWS::Serverless::Function
  Properties:
    CodeUri: my-function/
    Handler: app.handler
    Policies:
      - DynamoDBCrudPolicy:
          TableName: !Ref MyTable
```

### Pitfall 4: Using Wrong Event Source Mapping

**Problem**: DynamoDB Stream trigger doesn't work.

```yaml
# ❌ BAD: Using wrong event type for DynamoDB Streams
MyFunction:
  Type: AWS::Serverless::Function
  Properties:
    Events:
      Stream:
        Type: DynamoDB  # Wrong type
        Properties:
          Stream: !GetAtt MyTable.StreamArn

# ✅ GOOD: Use correct event type
MyFunction:
  Type: AWS::Serverless::Function
  Properties:
    Events:
      Stream:
        Type: DynamoDB
        Properties:
          Stream: !GetAtt MyTable.StreamArn
          StartingPosition: LATEST
          BatchSize: 10
          MaximumRetryAttempts: 3
```

---

## Key Takeaways

**SAM Basics**:
1. **SAM simplifies serverless**: 50 lines (SAM) vs 200 lines (CloudFormation) for same app
2. **Transform required**: Always include `Transform: AWS::Serverless-2016-10-31` in template
3. **Extends CloudFormation**: SAM templates are valid CloudFormation (can mix both)

**SAM CLI Workflow**:
4. **sam init**: Create new project from templates (Python, Node.js, Java, etc.)
5. **sam build**: Package Lambda functions and resolve dependencies
6. **sam local**: Test functions and APIs locally (Docker-based emulation)
7. **sam deploy**: Deploy to AWS (uploads to S3, creates CloudFormation stack)

**SAM Resources**:
8. **AWS::Serverless::Function**: Lambda with automatic IAM role, event sources
9. **AWS::Serverless::Api**: API Gateway with automatic integration to Lambda
10. **AWS::Serverless::SimpleTable**: DynamoDB table with simplified syntax
11. **AWS::Serverless::StateMachine**: Step Functions state machine

**Local Testing**:
12. **sam local invoke**: Test individual functions with JSON events
13. **sam local start-api**: Run API Gateway locally (http://localhost:3000)
14. **sam local generate-event**: Generate sample events (S3, SNS, SQS, API Gateway)

**IAM Policies**:
15. **Policy templates**: Use built-in templates (DynamoDBCrudPolicy, S3ReadPolicy, etc.)
16. **Automatic IAM roles**: SAM creates execution roles automatically
17. **Least privilege**: Only grant permissions function needs

**CI/CD**:
18. **GitHub Actions**: Use `aws-sam-cli` in workflows for automated deployments
19. **AWS CodePipeline**: Use `sam pipeline bootstrap` to create managed pipeline
20. **Multi-environment**: Use `--parameter-overrides` for dev/staging/prod

**SAM vs CDK**:
21. **Use SAM for**: Pure serverless apps, YAML preference, simple use cases
22. **Use CDK for**: Complex infrastructure, programming logic needed, multi-service apps
23. **Can mix both**: Use SAM for Lambda, CDK for other resources (via CloudFormation imports)

**Best Practices**:
24. **Globals section**: Define common function properties once (Runtime, MemorySize, Timeout)
25. **Layers for shared code**: Use Lambda Layers for common dependencies (utils, SDKs)
26. **Environment variables**: Pass resource names via environment variables (not hardcoded)
27. **Outputs for integration**: Export API URLs, ARNs for cross-stack references

AWS SAM simplifies serverless development with concise templates, local testing, and built-in best practices. Use SAM for pure serverless applications and CDK for complex multi-service architectures. Both extend CloudFormation and can be mixed in the same project.
