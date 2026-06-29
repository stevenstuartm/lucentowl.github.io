---
title: "AWS CDK for System Architects"
layout: guide
category: AWS
subcategory: Developer Tools & CI/CD
description: "Comprehensive guide to AWS Cloud Development Kit (CDK) covering infrastructure as code with programming languages, constructs, stacks, comparison with CloudFormation, integration patterns, and best practices for TypeScript, Python, and other supported languages"
tags: [aws, cdk, infrastructure-as-code, cloudformation, typescript, python, iac, automation, fundamentals]
---

## What Problems CDK Solves

AWS CDK allows you to define cloud infrastructure using familiar programming languages instead of JSON/YAML:

**Eliminate YAML/JSON verbosity**: CloudFormation template for VPC with subnets, route tables, and NAT gateways: 500+ lines of YAML. CDK TypeScript equivalent: 20 lines with `new ec2.Vpc(this, 'MyVpc', { maxAzs: 3 })`. CDK abstracts low-level details.

**Enable code reuse and abstraction**: CloudFormation requires copying/pasting resource definitions or using nested stacks (complex). CDK uses classes, functions, and loops. Create `DatabaseStack` class, instantiate for dev/staging/production with different parameters.

**Provide type safety and IDE support**: CloudFormation YAML has no compile-time validation. Typos discovered at deployment (30 minutes later). CDK TypeScript/Python provides autocomplete, type checking, and inline documentation in IDE. Catch errors before `cdk deploy`.

**Simplify complex logic**: CloudFormation conditionals and mappings are verbose and limited. CDK uses native language constructs like if/else, for loops, and functions. Define 10 S3 buckets with a for loop, not 10 copy-pasted resource definitions.

**Generate CloudFormation best practices automatically**: CDK constructs encode AWS best practices. `new ec2.Vpc()` creates VPC with public/private subnets across availability zones, route tables, internet gateway, and NAT gateways, all properly configured. Manual CloudFormation would take hours and is error-prone.

**Support multi-stack deployments**: Large applications span multiple CloudFormation stacks (networking, databases, applications). CDK manages dependencies between stacks automatically via cross-stack references. CloudFormation requires manual export/import parameters.

**Enable testing infrastructure code**: CloudFormation has no testing framework. CDK supports unit tests (Jest, pytest) and integration tests. Test that S3 bucket has encryption enabled, Lambda has correct environment variables, or VPC has expected number of subnets before deployment.

## Service Fundamentals

### What is AWS CDK

AWS Cloud Development Kit (CDK) is an open-source framework for defining cloud infrastructure using programming languages:

**Supported languages**:
- TypeScript (most popular, best documented)
- Python
- Java
- C# (.NET)
- Go (developer preview as of 2024)

**How CDK works**:
1. Write infrastructure code in TypeScript/Python/etc.
2. CDK synthesizes code to CloudFormation template
3. CDK deploys template via CloudFormation
4. CloudFormation provisions AWS resources

**CDK CLI**: Command-line tool for managing CDK apps (`cdk init`, `cdk synth`, `cdk deploy`, `cdk diff`)

### CDK Components

**Constructs**: Reusable cloud components (from low-level like `CfnBucket` to high-level like `ApplicationLoadBalancedFargateService`)

**Stacks**: Unit of deployment, maps to one CloudFormation stack

**Apps**: Container for stacks, defined in `cdk.json` or `app.py`

**Constructs Library**: Pre-built constructs for AWS services (EC2, Lambda, S3, RDS, etc.)

**CDK Toolkit (CLI)**: Command-line interface for CDK operations

### CDK Levels of Abstraction

**L1 Constructs (CloudFormation resources)**:
- Direct mapping to CloudFormation resources
- Name prefix: `Cfn` (e.g., `CfnBucket`, `CfnFunction`)
- Require specifying all properties manually
- Use when L2/L3 don't exist or need full control

Example:
```typescript
new s3.CfnBucket(this, 'MyBucket', {
  bucketName: 'my-bucket-name',
  versioningConfiguration: {
    status: 'Enabled'
  }
});
```

**L2 Constructs (Curated resources)**:
- AWS-curated constructs with sensible defaults
- Provide helper methods and properties
- Encode best practices

Example:
```typescript
new s3.Bucket(this, 'MyBucket', {
  versioned: true,  // Simpler than L1
  encryption: s3.BucketEncryption.S3_MANAGED,  // Best practice default
  removalPolicy: RemovalPolicy.RETAIN
});
```

**L3 Constructs (Patterns)**:
- High-level abstractions combining multiple resources
- Represent common architecture patterns
- Examples: `ApplicationLoadBalancedFargateService`, `LambdaRestApi`

Example:
```typescript
new patterns.ApplicationLoadBalancedFargateService(this, 'Service', {
  cluster,
  taskImageOptions: {
    image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample')
  }
});
```

This creates an ECS Fargate service, ALB, target group, security groups, and IAM roles, all with one construct.

## CDK vs CloudFormation

<div class="callout callout--note">
<p class="callout__title">CDK Generates CloudFormation</p>
<p>CDK synthesizes to CloudFormation templates under the hood. There's no lock-in to a proprietary format. You can always inspect, export, and manage the generated templates through CloudFormation console.</p>
</div>

### CloudFormation Template

**VPC with public and private subnets** (abbreviated for space):

```yaml
Resources:
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
      EnableDnsHostnames: true
      EnableDnsSupport: true

  PublicSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.0.0/24
      AvailabilityZone: !Select [0, !GetAZs '']
      MapPublicIpOnLaunch: true

  PublicSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.1.0/24
      AvailabilityZone: !Select [1, !GetAZs '']
      MapPublicIpOnLaunch: true

  PrivateSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.128.0/24
      AvailabilityZone: !Select [0, !GetAZs '']

  PrivateSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.129.0/24
      AvailabilityZone: !Select [1, !GetAZs '']

  InternetGateway:
    Type: AWS::EC2::InternetGateway

  AttachGateway:
    Type: AWS::EC2::VPCGatewayAttachment
    Properties:
      VpcId: !Ref VPC
      InternetGatewayId: !Ref InternetGateway

  # ... 20+ more resources for route tables, NAT gateways, routes, etc.
```

Total: ~150 lines for basic VPC

### CDK Equivalent (TypeScript)

```typescript
import * as ec2 from 'aws-cdk-lib/aws-ec2';

const vpc = new ec2.Vpc(this, 'MyVpc', {
  maxAzs: 2,
  natGateways: 1
});
```

Total: 5 lines for same VPC (generates 40+ CloudFormation resources)

### Benefits Over CloudFormation

<div class="comparison">
<div class="content-card content-card--accent">
<h4>CDK Advantages</h4>
<ul>
<li><strong>Conciseness</strong>: 5 lines vs 150 lines</li>
<li><strong>Abstraction</strong>: Don't specify CIDR blocks, route tables, NAT gateway placement</li>
<li><strong>Best practices</strong>: VPC includes public/private subnets, gateways automatically</li>
<li><strong>Type safety</strong>: IDE autocomplete, compiler errors on typos</li>
<li><strong>Testable</strong>: Unit tests for infrastructure configuration</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>CloudFormation Strengths</h4>
<ul>
<li><strong>Direct control</strong>: Full access to all CloudFormation features</li>
<li><strong>Declarative</strong>: Simple for small infrastructure</li>
<li><strong>No build step</strong>: YAML/JSON used directly</li>
<li><strong>Existing tooling</strong>: Wide ecosystem support</li>
<li><strong>Learning curve</strong>: No programming knowledge required</li>
</ul>
</div>
</div>

## Constructs

### Using Built-in Constructs

**S3 Bucket with encryption and lifecycle**:

```typescript
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';

const bucket = new s3.Bucket(this, 'MyBucket', {
  encryption: s3.BucketEncryption.S3_MANAGED,
  versioned: true,
  lifecycleRules: [{
    transitions: [{
      storageClass: s3.StorageClass.INFREQUENT_ACCESS,
      transitionAfter: Duration.days(30)
    }, {
      storageClass: s3.StorageClass.GLACIER,
      transitionAfter: Duration.days(90)
    }],
    expiration: Duration.days(365)
  }],
  removalPolicy: RemovalPolicy.RETAIN
});
```

**Lambda function with environment variables**:

```typescript
import * as lambda from 'aws-cdk-lib/aws-lambda';

const fn = new lambda.Function(this, 'MyFunction', {
  runtime: lambda.Runtime.NODEJS_18_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset('lambda'),
  environment: {
    BUCKET_NAME: bucket.bucketName,
    TABLE_NAME: table.tableName
  },
  timeout: Duration.seconds(30),
  memorySize: 512
});

// Grant Lambda permission to read from bucket
bucket.grantRead(fn);
```

### Creating Custom Constructs

Reusable components for your organization:

```typescript
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';

export interface WebServerFleetProps {
  vpc: ec2.IVpc;
  instanceType?: ec2.InstanceType;
  minCapacity?: number;
  maxCapacity?: number;
}

export class WebServerFleet extends Construct {
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;

  constructor(scope: Construct, id: string, props: WebServerFleetProps) {
    super(scope, id);

    const asg = new autoscaling.AutoScalingGroup(this, 'ASG', {
      vpc: props.vpc,
      instanceType: props.instanceType || ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: new ec2.AmazonLinuxImage(),
      minCapacity: props.minCapacity || 2,
      maxCapacity: props.maxCapacity || 10
    });

    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'LB', {
      vpc: props.vpc,
      internetFacing: true
    });

    const listener = this.loadBalancer.addListener('Listener', {
      port: 80
    });

    listener.addTargets('Target', {
      port: 80,
      targets: [asg]
    });
  }
}
```

**Usage**:
```typescript
const fleet = new WebServerFleet(this, 'MyFleet', {
  vpc,
  minCapacity: 3,
  maxCapacity: 20
});
```

Reuse across multiple stacks/apps without copying code.

### Construct Composition

Combine constructs to build complex architectures:

```typescript
// Three-tier application
export class ThreeTierApp extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Network tier
    const vpc = new ec2.Vpc(this, 'VPC', { maxAzs: 3 });

    // Data tier
    const database = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_14
      }),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED }
    });

    // Application tier
    const cluster = new ecs.Cluster(this, 'Cluster', { vpc });

    const taskDef = new ecs.FargateTaskDefinition(this, 'TaskDef');
    taskDef.addContainer('App', {
      image: ecs.ContainerImage.fromRegistry('my-app'),
      environment: {
        DB_HOST: database.dbInstanceEndpointAddress
      }
    });

    // Web tier
    const service = new patterns.ApplicationLoadBalancedFargateService(this, 'Service', {
      cluster,
      taskDefinition: taskDef
    });

    // Grant application access to database
    database.connections.allowFrom(service.service, ec2.Port.tcp(5432));
  }
}
```

## Stacks and Apps

### Defining Stacks

Stack = CloudFormation stack:

```typescript
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Define resources here
    new s3.Bucket(this, 'MyBucket');
  }
}
```

### Apps with Multiple Stacks

**app.ts**:
```typescript
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from './network-stack';
import { DatabaseStack } from './database-stack';
import { ApplicationStack } from './application-stack';

const app = new cdk.App();

const networkStack = new NetworkStack(app, 'NetworkStack', {
  env: { region: 'us-east-1' }
});

const databaseStack = new DatabaseStack(app, 'DatabaseStack', {
  vpc: networkStack.vpc,
  env: { region: 'us-east-1' }
});

const appStack = new ApplicationStack(app, 'ApplicationStack', {
  vpc: networkStack.vpc,
  database: databaseStack.database,
  env: { region: 'us-east-1' }
});

app.synth();
```

**Deploy order**: CDK automatically determines deploy order based on dependencies (NetworkStack → DatabaseStack → ApplicationStack).

### Cross-Stack References

Pass resources between stacks:

**NetworkStack**:
```typescript
export class NetworkStack extends Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    this.vpc = new ec2.Vpc(this, 'VPC');
  }
}
```

**ApplicationStack**:
```typescript
export interface ApplicationStackProps extends StackProps {
  vpc: ec2.IVpc;
}

export class ApplicationStack extends Stack {
  constructor(scope: Construct, id: string, props: ApplicationStackProps) {
    super(scope, id, props);

    // Use VPC from NetworkStack
    const asg = new autoscaling.AutoScalingGroup(this, 'ASG', {
      vpc: props.vpc,
      // ...
    });
  }
}
```

CDK creates CloudFormation exports/imports automatically.

### Stack Environments

Specify AWS account and region:

```typescript
new MyStack(app, 'DevStack', {
  env: {
    account: '111111111111',
    region: 'us-east-1'
  }
});

new MyStack(app, 'ProdStack', {
  env: {
    account: '222222222222',
    region: 'us-west-2'
  }
});
```

Or use environment variables:
```typescript
env: {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION
}
```

## CDK Development Workflow

### Initialize Project

```bash
mkdir my-cdk-app
cd my-cdk-app
cdk init app --language typescript
```

Creates:
- `bin/my-cdk-app.ts`: Entry point (app definition)
- `lib/my-cdk-app-stack.ts`: Stack definition
- `package.json`: Dependencies
- `cdk.json`: CDK configuration
- `tsconfig.json`: TypeScript configuration

### Development Cycle

**1. Write code**:
```typescript
// lib/my-stack.ts
new s3.Bucket(this, 'MyBucket', {
  versioned: true
});
```

**2. Synthesize CloudFormation**:
```bash
cdk synth
```

Outputs CloudFormation template to `cdk.out/MyStack.template.json`. Review template before deploying.

**3. Diff against deployed stack**:
```bash
cdk diff
```

Shows what will change if you deploy (new resources, modified resources, deleted resources).

**4. Deploy**:
```bash
cdk deploy
```

Deploys to AWS via CloudFormation.

**5. Destroy** (when done):
```bash
cdk destroy
```

Deletes all resources in stack.

### Bootstrap

CDK requires bootstrapping AWS environment (once per account/region):

```bash
cdk bootstrap aws://123456789012/us-east-1
```

Creates:
- S3 bucket for storing assets (Lambda code, Docker images)
- IAM roles for CloudFormation
- ECR repository for container images

## Common Patterns

### Environment-Specific Configuration

```typescript
export interface AppConfig {
  instanceType: ec2.InstanceType;
  minCapacity: number;
  maxCapacity: number;
  databaseSize: string;
}

const devConfig: AppConfig = {
  instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
  minCapacity: 1,
  maxCapacity: 2,
  databaseSize: 'db.t3.micro'
};

const prodConfig: AppConfig = {
  instanceType: ec2.InstanceType.of(ec2.InstanceClass.M5, ec2.InstanceSize.LARGE),
  minCapacity: 3,
  maxCapacity: 20,
  databaseSize: 'db.r5.xlarge'
};

const config = process.env.ENVIRONMENT === 'prod' ? prodConfig : devConfig;

new MyStack(app, 'Stack', { config });
```

### Importing Existing Resources

Reference resources created outside CDK:

```typescript
// Import VPC by ID
const vpc = ec2.Vpc.fromLookup(this, 'VPC', {
  vpcId: 'vpc-12345678'
});

// Import security group by ID
const sg = ec2.SecurityGroup.fromSecurityGroupId(this, 'SG', 'sg-12345678');

// Use imported resources
new ec2.Instance(this, 'Instance', {
  vpc,
  securityGroup: sg,
  // ...
});
```

### Tagging Resources

Apply tags to all resources in stack:

```typescript
import { Tags } from 'aws-cdk-lib';

const stack = new MyStack(app, 'Stack');

Tags.of(stack).add('Environment', 'Production');
Tags.of(stack).add('Project', 'MyProject');
Tags.of(stack).add('CostCenter', '12345');
```

### Conditional Resources

Create resources conditionally based on parameters:

```typescript
const enableBackups = this.node.tryGetContext('enableBackups') === 'true';

if (enableBackups) {
  new backup.BackupPlan(this, 'BackupPlan', {
    backupVault: vault,
    backupPlanRules: [
      backup.BackupPlanRule.daily(vault)
    ]
  });
}
```

Deploy with context:
```bash
cdk deploy --context enableBackups=true
```

## Testing CDK Code

### Unit Tests

Test that infrastructure code generates expected CloudFormation:

```typescript
import { Template } from 'aws-cdk-lib/assertions';
import { MyStack } from '../lib/my-stack';
import * as cdk from 'aws-cdk-lib';

test('S3 Bucket Created', () => {
  const app = new cdk.App();
  const stack = new MyStack(app, 'TestStack');
  const template = Template.fromStack(stack);

  // Assert bucket exists
  template.resourceCountIs('AWS::S3::Bucket', 1);

  // Assert bucket has encryption enabled
  template.hasResourceProperties('AWS::S3::Bucket', {
    BucketEncryption: {
      ServerSideEncryptionConfiguration: [{
        ServerSideEncryptionByDefault: {
          SSEAlgorithm: 'AES256'
        }
      }]
    }
  });
});

test('Lambda Has Correct Environment Variables', () => {
  const app = new cdk.App();
  const stack = new MyStack(app, 'TestStack');
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::Lambda::Function', {
    Environment: {
      Variables: {
        BUCKET_NAME: { Ref: 'MyBucket' },
        TABLE_NAME: { Ref: 'MyTable' }
      }
    }
  });
});
```

Run tests:
```bash
npm test
```

### Snapshot Tests

Capture entire CloudFormation template and compare on changes:

```typescript
test('Stack Matches Snapshot', () => {
  const app = new cdk.App();
  const stack = new MyStack(app, 'TestStack');
  const template = Template.fromStack(stack);

  expect(template.toJSON()).toMatchSnapshot();
});
```

First run creates snapshot. Subsequent runs compare against snapshot. If template changes, test fails unless snapshot updated.

### Integration Tests

Deploy stack to AWS and validate:

```typescript
test('Application Responds to HTTP Requests', async () => {
  // Deploy stack
  await deployStack('IntegrationTestStack');

  // Get ALB DNS from stack outputs
  const albDns = await getStackOutput('IntegrationTestStack', 'AlbDns');

  // Make HTTP request
  const response = await fetch(`http://${albDns}`);

  // Assert response
  expect(response.status).toBe(200);
  expect(await response.text()).toContain('Hello World');

  // Clean up
  await destroyStack('IntegrationTestStack');
});
```

## Integration Patterns

### CI/CD with CDK

**CodePipeline deploying CDK app**:

```typescript
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import { CodeBuildStep, CodePipeline } from 'aws-cdk-lib/pipelines';

const pipeline = new CodePipeline(this, 'Pipeline', {
  pipelineName: 'MyPipeline',
  synth: new CodeBuildStep('Synth', {
    input: CodePipelineSource.gitHub('my-org/my-repo', 'main'),
    commands: [
      'npm ci',
      'npm run build',
      'npx cdk synth'
    ]
  })
});

// Add deployment stages
pipeline.addStage(new MyApplicationStage(this, 'Dev', {
  env: { account: '111111111111', region: 'us-east-1' }
}));

pipeline.addStage(new MyApplicationStage(this, 'Prod', {
  env: { account: '222222222222', region: 'us-west-2' }
}));
```

Pipeline automatically updates when code changes (self-mutating pipeline).

### CDK with Existing CloudFormation

Migrate incrementally from CloudFormation to CDK:

**Import existing CloudFormation stack**:
```typescript
const cfnInclude = new CfnInclude(this, 'ExistingStack', {
  templateFile: 'existing-stack.yaml'
});

// Reference resources from template
const bucket = cfnInclude.getResource('MyBucket') as s3.CfnBucket;

// Add new CDK resources that reference imported resources
new lambda.Function(this, 'NewFunction', {
  environment: {
    BUCKET_NAME: bucket.ref
  }
});
```

### CDK with Terraform

Use CDK for Terraform (`cdktf`):

```typescript
import { TerraformStack } from 'cdktf';
import { AwsProvider, s3 } from '@cdktf/provider-aws';

class MyStack extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new AwsProvider(this, 'aws', {
      region: 'us-east-1'
    });

    new s3.S3Bucket(this, 'bucket', {
      bucket: 'my-bucket'
    });
  }
}
```

Same CDK programming model, generates Terraform instead of CloudFormation.

## Cost Optimization Strategies

### CDK is Free

No charge for CDK itself. Costs are for AWS resources deployed.

### Right-Sizing with Code

Easier to adjust instance types, database sizes, etc. with code:

```typescript
const config = {
  dev: { instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO) },
  prod: { instanceType: ec2.InstanceType.of(ec2.InstanceClass.M5, ec2.InstanceSize.LARGE) }
};
```

Change `dev` to `t3.micro` globally instead of updating 20 CloudFormation templates.

### Automated Resource Cleanup

Tag stacks for automated deletion:

```typescript
Tags.of(stack).add('AutoDelete', 'true');
Tags.of(stack).add('ExpirationDate', '2025-12-31');
```

Lambda function deletes stacks based on tags (cost savings for temporary/dev environments).

### Reusable Constructs Reduce Duplication

Custom constructs ensure consistent, cost-optimized configurations across organization (S3 lifecycle policies, RDS instance sizes, Lambda memory allocation).

## Security Best Practices

### Least-Privilege IAM

CDK generates least-privilege IAM policies automatically:

```typescript
const fn = new lambda.Function(this, 'Function', {
  code: lambda.Code.fromAsset('lambda'),
  handler: 'index.handler',
  runtime: lambda.Runtime.NODEJS_18_X
});

// Grant function read-only access to bucket
bucket.grantRead(fn);
```

Generates IAM policy:
```json
{
  "Effect": "Allow",
  "Action": ["s3:GetObject", "s3:GetObjectVersion"],
  "Resource": "arn:aws:s3:::bucket-name/*"
}
```

No wildcards, no over-permissioning.

### Secrets Management

Use Secrets Manager or Parameter Store:

```typescript
const dbPassword = secretsmanager.Secret.fromSecretNameV2(
  this, 'DBPassword', '/myapp/db-password'
);

new rds.DatabaseInstance(this, 'Database', {
  credentials: rds.Credentials.fromSecret(dbPassword)
});
```

Never hardcode secrets in CDK code.

### Encryption by Default

Enable encryption for all resources:

```typescript
new s3.Bucket(this, 'Bucket', {
  encryption: s3.BucketEncryption.S3_MANAGED
});

new dynamodb.Table(this, 'Table', {
  encryption: dynamodb.TableEncryption.AWS_MANAGED
});

new rds.DatabaseInstance(this, 'Database', {
  storageEncrypted: true
});
```

### Security Scanning

Use `cdk-nag` to check for security issues:

```bash
npm install cdk-nag
```

```typescript
import { AwsSolutionsChecks } from 'cdk-nag';
import { Aspects } from 'aws-cdk-lib';

const app = new cdk.App();
Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
```

`cdk synth` will fail if security issues detected (S3 bucket without encryption, security group allowing 0.0.0.0/0, etc.).

## When to Use CDK vs Alternatives

### CDK Strengths

**Use CDK when**:
- Prefer programming languages over YAML/JSON
- Need code reuse, abstraction, and testability
- Building complex infrastructure with many resources
- Want type safety and IDE support
- Team has strong programming background
- Deploying to AWS exclusively

### CloudFormation

**Use CloudFormation when**:
- Simple infrastructure (< 10 resources)
- Team prefers declarative YAML/JSON
- No need for abstraction or reuse
- Want direct control over CloudFormation features

**CDK generates CloudFormation**, so CDK can do anything CloudFormation can. No feature parity issues.

### Terraform

**Use Terraform when**:
- Multi-cloud (AWS + Azure + GCP)
- Existing Terraform investment
- Prefer HCL over programming languages
- Need Terraform-specific features (state management, workspaces)

**CDK for Terraform (`cdktf`)** allows writing Terraform with CDK, combining benefits.

### Pulumi

**Use Pulumi when**:
- Similar to CDK (infrastructure as code with programming languages)
- Multi-cloud (AWS, Azure, GCP, Kubernetes)
- Want real programming languages (not DSL like HCL)

**CDK vs Pulumi**: Similar capabilities. CDK has stronger AWS integration, Pulumi has better multi-cloud support.

## Common Pitfalls

<div class="callout callout--warning">
<p class="callout__title">Most Common CDK Mistakes</p>
<p>The majority of CDK deployment failures come from forgetting to bootstrap, hardcoding resource names, and not reviewing synthesized CloudFormation before deploying to production.</p>
</div>

### Not Bootstrapping Environment

**Problem**: `cdk deploy` fails with "Policy contains a statement with one or more invalid principals."

**Cause**: CDK environment not bootstrapped.

**Solution**: Run `cdk bootstrap` once per account/region before deploying.

### Hardcoding Resource Names

**Problem**: Stack deployment fails with "Bucket already exists."

**Cause**: Hardcoded bucket name conflicts with existing bucket.

**Solution**: Let CDK generate unique names:
```typescript
// Bad
new s3.Bucket(this, 'Bucket', {
  bucketName: 'my-bucket'  // Hardcoded
});

// Good
new s3.Bucket(this, 'Bucket');  // CDK generates unique name
```

### Circular Dependencies Between Stacks

**Problem**: `cdk synth` fails with "Circular dependency between resources."

**Cause**: Stack A depends on Stack B, Stack B depends on Stack A.

**Solution**: Refactor to remove circular dependency or merge stacks.

### Not Setting Removal Policy

**Problem**: `cdk destroy` fails to delete stack because S3 bucket or RDS database has data.

**Cause**: Default removal policy is `RETAIN` for stateful resources.

**Solution**: Explicitly set removal policy for dev environments:
```typescript
new s3.Bucket(this, 'Bucket', {
  removalPolicy: RemovalPolicy.DESTROY,
  autoDeleteObjects: true  // Required for DESTROY
});
```

Production should use `RETAIN` to prevent accidental deletion.

### Large Lambda Function Assets

**Problem**: `cdk deploy` uploads 500 MB Lambda function zip to S3, times out.

**Cause**: Lambda code includes `node_modules` or unnecessary files.

**Solution**: Use `.dockerignore` or exclude patterns:
```typescript
new lambda.Function(this, 'Function', {
  code: lambda.Code.fromAsset('lambda', {
    exclude: ['node_modules', '*.test.ts', '.git']
  })
});
```

Or use Docker-based Lambda:
```typescript
code: lambda.Code.fromDockerBuild('lambda')
```

### Not Reviewing Synthesized CloudFormation

**Problem**: CDK deploys unexpected resources or configurations.

**Cause**: Didn't review `cdk synth` output before deploying.

**Solution**: Always run `cdk synth` and review `cdk.out/*.template.json` before deploying to production.

### Context Lookup Caching

**Problem**: `ec2.Vpc.fromLookup()` returns stale VPC ID after VPC replaced.

**Cause**: CDK caches context lookups in `cdk.context.json`.

**Solution**: Delete `cdk.context.json` or run `cdk context --clear` to refresh.

## Key Takeaways

**CDK enables infrastructure as code with familiar programming languages**: TypeScript, Python, Java, C#, Go instead of YAML/JSON. Leverage IDE autocomplete, type checking, and refactoring tools.

**Abstraction levels match complexity needs**: L1 for full control, L2 for sensible defaults, L3 for complete patterns. Use highest level that meets requirements.

**CDK synthesizes to CloudFormation**: No lock-in to proprietary format. Review CloudFormation templates with `cdk synth`, deploy with `cdk deploy`, manage with CloudFormation console.

**Constructs enable reusability**: Create custom constructs for organization-specific patterns (three-tier apps, databases with backups, VPCs with standard configuration). Share via npm packages.

**Testing infrastructure prevents errors**: Unit tests validate CloudFormation generation, integration tests verify deployed resources work correctly. Catch configuration errors before production.

**CDK CLI streamlines workflow**: `cdk diff` shows changes before deploy, `cdk deploy` handles CloudFormation complexity, `cdk destroy` cleans up resources.

**Type safety catches errors early**: Compiler errors for typos, incorrect types, missing required properties. Fix before deployment instead of waiting 20 minutes for CloudFormation to fail.

**Cross-stack references simplify dependencies**: Pass resources between stacks via properties, CDK handles CloudFormation exports/imports automatically.

**CDK Pipelines enable self-mutating CI/CD**: Define deployment pipeline in CDK code, pipeline automatically updates itself when code changes.

**Environment-specific configurations use native language constructs**: If/else statements, objects/dictionaries, functions instead of CloudFormation parameters and conditions.

**Bootstrap once per account/region**: Creates S3 bucket for assets, IAM roles for deployments. Required setup before first deployment.

**Custom constructs encode best practices**: Organization standards (encryption, tagging, IAM policies, monitoring) enforced automatically when developers use shared constructs.

**CDK is free, costs are for resources deployed**: No CDK license fees. Standard AWS resource charges apply.
