---
title: "AWS CodeDeploy for System Architects"
layout: guide
category: AWS
subcategory: Developer Tools & CI/CD
description: "Comprehensive guide to AWS CodeDeploy covering deployment strategies, blue/green deployments, canary releases, rollback mechanisms, integration with EC2/Lambda/ECS, and deployment automation best practices"
tags: [aws, deployment, codedeploy, blue-green, canary, cicd, automation, devops, fundamentals]
---

## What Problems CodeDeploy Solves

AWS CodeDeploy automates application deployments to EC2, Lambda, and ECS:

**Eliminate deployment downtime**: Manual deployments require stopping all instances, deploying code, and restarting. Users experience downtime. CodeDeploy performs rolling deployments, deploying to one instance at a time while others serve traffic. Zero downtime for users.

**Reduce deployment risk**: Deploying to 100 instances simultaneously means bugs affect all users immediately. CodeDeploy enables gradual rollouts: deploy to 10% of fleet, monitor for errors, then proceed or rollback. Limits blast radius of bad deployments.

**Automate rollback**: Bad deployment reaches production. Engineers scramble to identify the issue and manually revert. Takes 30 minutes. CodeDeploy monitors CloudWatch alarms during deployment, automatically rolls back when thresholds breach. Recovery in under 5 minutes.

**Standardize deployment process**: Each team has different deployment scripts and procedures. Knowledge silos form. CodeDeploy provides consistent deployment mechanism across teams and applications. New team members deploy confidently on day one.

**Blue/green deployments without complexity**: Setting up blue/green manually requires provisioning duplicate infrastructure, routing traffic with load balancers, and cleaning up old resources. CodeDeploy orchestrates the entire process: provisions green environment, shifts traffic, terminates blue environment.

**Canary testing in production**: Deploying risky changes to all users is dangerous. Deploying only to staging misses production-specific issues. CodeDeploy routes 10% of traffic to new version, monitors metrics, then proceeds or reverts. Safe production testing.

**Coordinate multi-instance deployments**: Deploying to 100 instances requires ensuring deployment succeeds on all instances, handling failures gracefully, and maintaining minimum healthy instance count. CodeDeploy orchestrates deployments, respects health constraints, and handles partial failures.

## Service Fundamentals

### CodeDeploy Core Concepts

**Application**: Container for deployment groups and revisions (e.g., "MyWebApp")

**Deployment group**: Set of instances or Lambda functions targeted for deployment (e.g., "Production-Fleet")

**Revision**: Specific version of application code (S3 location, GitHub commit, or Lambda function version)

**AppSpec file**: YAML/JSON file defining deployment steps (hooks, file locations, permissions)

**Deployment configuration**: Rules for deployment (traffic shifting strategy, minimum healthy hosts)

**Lifecycle event hooks**: Scripts executed at specific points during deployment (BeforeInstall, AfterInstall, ApplicationStart, ValidateService)

### Supported Compute Platforms

**EC2/On-Premises**: Deploy to EC2 instances or on-premises servers
**AWS Lambda**: Deploy new Lambda function versions
**Amazon ECS**: Deploy new ECS task definitions

Each platform has different deployment capabilities and configurations.

### How CodeDeploy Works

**Deployment flow**:
1. Create application and deployment group
2. Upload revision (application files + AppSpec) to S3 or GitHub
3. Trigger deployment (CodeDeploy or integrated with CodePipeline)
4. CodeDeploy pulls revision, distributes to target instances/functions
5. CodeDeploy Agent (EC2/on-premises) or service (Lambda/ECS) executes AppSpec hooks
6. CodeDeploy monitors deployment, tracks success/failure
7. If deployment fails or alarms trigger, CodeDeploy initiates rollback

**Agent-based (EC2/on-premises)**: CodeDeploy Agent polls CodeDeploy service for deployment instructions, downloads revisions, executes lifecycle hooks.

**Service-based (Lambda/ECS)**: CodeDeploy integrates directly with Lambda and ECS services to shift traffic and deploy new versions.

## Deployment Strategies

<div class="callout callout--note">
<p class="callout__title">Deployment Strategy Selection</p>
<p>Start with in-place deployments for development and staging. Use blue/green for production applications requiring zero downtime and instant rollback capability.</p>
</div>

### In-Place Deployment

Deploy to existing instances without provisioning new infrastructure:

**Process**:
1. Stop application on instance
2. Download new revision
3. Install new version
4. Start application

**Use cases**:
- Development and staging environments
- Applications where brief downtime acceptable
- Cost-conscious deployments (no duplicate infrastructure)

**Limitations**:
- Brief downtime during instance updates
- Rollback requires redeployment (slower than blue/green)
- Cannot test new version before routing traffic

### Blue/Green Deployment

Provision new instances (green), route traffic from old instances (blue):

**Process**:
1. Provision replacement instances (green fleet)
2. Deploy new version to green fleet
3. Route load balancer traffic from blue to green
4. Monitor green fleet
5. Terminate blue fleet (or keep for rollback)

**Use cases**:
- Zero-downtime deployments
- Production applications requiring high availability
- When testing new version with production traffic needed

**Benefits**:
- Instant rollback (shift traffic back to blue)
- Test green environment before routing traffic
- Zero downtime

**Limitations**:
- Higher cost (duplicate infrastructure during deployment)
- Requires load balancer
- Longer deployment time (provisioning instances)

### Rolling Deployment

Deploy to batches of instances sequentially:

**Process**:
1. Deploy to first batch (e.g., 25% of instances)
2. Verify deployment success
3. Deploy to next batch
4. Repeat until all instances updated

**Configurations**:
- **AllAtOnce**: Deploy to all instances simultaneously (fastest, highest risk)
- **HalfAtATime**: Deploy to 50% of instances, then remaining 50%
- **OneAtATime**: Deploy to one instance at a time (slowest, safest)
- **Custom**: Define specific number or percentage per batch

**Use cases**:
- Balance between speed and risk
- Gradual rollout to detect issues early
- Applications without load balancer (OneAtATime with health checks)

## EC2/On-Premises Deployments

### CodeDeploy Agent

The CodeDeploy Agent runs on instances to execute deployments:

**Installation** (Amazon Linux 2):
```bash
sudo yum install ruby wget -y
cd /home/ec2-user
wget https://aws-codedeploy-us-east-1.s3.us-east-1.amazonaws.com/latest/install
chmod +x ./install
sudo ./install auto
sudo service codedeploy-agent start
```

**Agent responsibilities**:
- Poll CodeDeploy service for deployment instructions
- Download revision from S3
- Execute AppSpec lifecycle hooks
- Report deployment status

**Agent configuration**: `/etc/codedeploy-agent/conf/codedeployagent.yml`

### AppSpec File (EC2)

AppSpec.yml defines deployment behavior:

**Example**:
```yaml
version: 0.0
os: linux

files:
  - source: /
    destination: /var/www/html

permissions:
  - object: /var/www/html
    owner: apache
    group: apache
    mode: 755
    type:
      - directory

hooks:
  BeforeInstall:
    - location: scripts/stop_server.sh
      timeout: 300
      runas: root

  AfterInstall:
    - location: scripts/install_dependencies.sh
      timeout: 600
      runas: root

  ApplicationStart:
    - location: scripts/start_server.sh
      timeout: 300
      runas: root

  ValidateService:
    - location: scripts/validate_service.sh
      timeout: 300
      runas: root
```

**Sections**:
- `files`: Source and destination for application files
- `permissions`: File/directory permissions
- `hooks`: Scripts to execute at lifecycle events

### Lifecycle Event Hooks

**Hook execution order**:
1. **ApplicationStop**: Stop the application (previous deployment only, skipped on first deployment)
2. **DownloadBundle**: CodeDeploy downloads revision (automatic, not customizable)
3. **BeforeInstall**: Prepare for installation (decrypt files, backup existing version)
4. **Install**: CodeDeploy copies files to destination (automatic, based on `files` section)
5. **AfterInstall**: Post-installation tasks (change permissions, install dependencies)
6. **ApplicationStart**: Start application (start web server, run application)
7. **ValidateService**: Verify application is running correctly (health check requests, smoke tests)

**Hook scripts** (Bash, PowerShell, etc.):
```bash
#!/bin/bash
# scripts/validate_service.sh

# Test application health endpoint
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health)

if [ "$STATUS" -eq 200 ]; then
  echo "Service is healthy"
  exit 0
else
  echo "Service health check failed with status $STATUS"
  exit 1
fi
```

Hook failure (non-zero exit code) stops deployment and triggers rollback.

### Deployment Groups

Deployment group defines target instances:

**Instance selection**:
- **EC2 instance tags**: Target instances with specific tags (e.g., `Environment=Production`, `Role=WebServer`)
- **Auto Scaling groups**: Target all instances in ASG (automatically includes new instances)
- **On-premises instance tags**: Target on-premises servers registered with CodeDeploy

**Configuration**:
```yaml
DeploymentGroup:
  Ec2TagFilters:
    - Type: KEY_AND_VALUE
      Key: Environment
      Value: Production
    - Type: KEY_AND_VALUE
      Key: Role
      Value: WebServer

  LoadBalancerInfo:
    TargetGroupInfoList:
      - Name: my-target-group

  DeploymentConfigName: CodeDeployDefault.OneAtATime
```

**Deployment configuration**:
- `CodeDeployDefault.AllAtOnce`: Deploy to all instances simultaneously
- `CodeDeployDefault.HalfAtATime`: Deploy to 50% at a time
- `CodeDeployDefault.OneAtATime`: Deploy to one instance at a time
- Custom configuration: Define minimum healthy hosts percentage or count

### Load Balancer Integration

CodeDeploy integrates with Application Load Balancer (ALB) and Classic Load Balancer:

**Deregistration**: CodeDeploy deregisters instance from load balancer before deployment
**Deployment**: Application updated while instance not receiving traffic
**Registration**: After successful deployment, instance registered back to load balancer
**Health checks**: Load balancer health checks verify instance health before routing traffic

**Connection draining**: ALB waits for in-flight requests to complete before deregistering instance (default 300 seconds).

## Lambda Deployments

### Lambda Deployment Types

CodeDeploy shifts traffic between Lambda function versions:

**Canary**: Shift percentage of traffic to new version, wait, then shift remaining traffic
**Linear**: Shift traffic in equal increments over time
**All-at-once**: Shift all traffic immediately to new version

### Lambda AppSpec File

AppSpec defines traffic shifting:

**Example**:
```yaml
version: 0.0
Resources:
  - MyFunction:
      Type: AWS::Lambda::Function
      Properties:
        Name: my-function
        Alias: live
        CurrentVersion: 1
        TargetVersion: 2
Hooks:
  - BeforeAllowTraffic: !Ref PreTrafficHook
  - AfterAllowTraffic: !Ref PostTrafficHook
```

**Components**:
- `Resources`: Lambda function and alias
- `CurrentVersion`: Current function version serving traffic
- `TargetVersion`: New function version to deploy
- `Hooks`: Lambda functions to execute before/after traffic shift

### Lambda Hooks

Lambda hooks validate deployment:

**PreTraffic hook** (runs before traffic shift):
```javascript
exports.handler = async (event, context) => {
  // Run tests against new Lambda version
  const newVersion = event.DeploymentId;

  // Invoke new version with test payload
  const result = await lambda.invoke({
    FunctionName: `my-function:${event.TargetVersion}`,
    Payload: JSON.stringify({ test: true })
  }).promise();

  if (result.StatusCode === 200 && result.Payload.includes('success')) {
    // Validation succeeded, allow deployment to proceed
    await codedeploy.putLifecycleEventHookExecutionStatus({
      deploymentId: event.DeploymentId,
      lifecycleEventHookExecutionId: event.LifecycleEventHookExecutionId,
      status: 'Succeeded'
    }).promise();
  } else {
    // Validation failed, abort deployment
    await codedeploy.putLifecycleEventHookExecutionStatus({
      deploymentId: event.DeploymentId,
      lifecycleEventHookExecutionId: event.LifecycleEventHookExecutionId,
      status: 'Failed'
    }).promise();
  }
};
```

**AfterTraffic hook**: Runs after traffic shift completes (cleanup, notifications, metrics)

### Lambda Deployment Configurations

**Canary**:
- `CodeDeployDefault.LambdaCanary10Percent5Minutes`: 10% traffic for 5 minutes, then 100%
- `CodeDeployDefault.LambdaCanary10Percent10Minutes`: 10% traffic for 10 minutes, then 100%
- `CodeDeployDefault.LambdaCanary10Percent15Minutes`: 10% traffic for 15 minutes, then 100%

**Linear**:
- `CodeDeployDefault.LambdaLinear10PercentEvery1Minute`: 10% every 1 minute (10 minutes total)
- `CodeDeployDefault.LambdaLinear10PercentEvery2Minutes`: 10% every 2 minutes (20 minutes total)
- `CodeDeployDefault.LambdaLinear10PercentEvery3Minutes`: 10% every 3 minutes (30 minutes total)

**All-at-once**:
- `CodeDeployDefault.LambdaAllAtOnce`: Immediate 100% traffic shift

## ECS Deployments

### ECS Deployment Types

CodeDeploy shifts traffic between ECS task sets:

**Blue/Green**: Route traffic from old task set (blue) to new task set (green)

**Process**:
1. Create new task set with new task definition (green)
2. Register green tasks to load balancer target group
3. Shift traffic from blue to green (canary, linear, or all-at-once)
4. Monitor CloudWatch alarms
5. If successful, terminate blue task set; if failed, rollback to blue

### ECS AppSpec File

**Example**:
```yaml
version: 0.0
Resources:
  - TargetService:
      Type: AWS::ECS::Service
      Properties:
        TaskDefinition: arn:aws:ecs:us-east-1:123456789012:task-definition/my-app:2
        LoadBalancerInfo:
          ContainerName: my-container
          ContainerPort: 8080
        PlatformVersion: LATEST
Hooks:
  - BeforeInstall: !Ref PreInstallHook
  - AfterInstall: !Ref PostInstallHook
  - AfterAllowTestTraffic: !Ref TestTrafficHook
  - BeforeAllowTraffic: !Ref PreTrafficHook
  - AfterAllowTraffic: !Ref PostTrafficHook
```

### ECS Deployment Configurations

**Canary**:
- `CodeDeployDefault.ECSCanary10Percent5Minutes`
- `CodeDeployDefault.ECSCanary10Percent15Minutes`

**Linear**:
- `CodeDeployDefault.ECSLinear10PercentEvery1Minutes`
- `CodeDeployDefault.ECSLinear10PercentEvery3Minutes`

**All-at-once**:
- `CodeDeployDefault.ECSAllAtOnce`

### ECS Test Traffic

CodeDeploy can route test traffic to green task set before production traffic:

**Use case**: Run integration tests against green task set using test load balancer listener before routing production traffic.

**Configuration**:
- **Production traffic**: Port 80 (blue task set)
- **Test traffic**: Port 8080 (green task set)

**Flow**:
1. Deploy green task set
2. Route test traffic (port 8080) to green
3. Run tests via AfterAllowTestTraffic hook
4. If tests pass, shift production traffic (port 80) to green
5. If tests fail, rollback (delete green task set)

## Blue/Green Deployments

### Blue/Green for EC2

**Provision replacement instances**:
- Create new Auto Scaling group or launch replacement instances
- Deploy application to green instances
- Register green instances to load balancer
- Deregister blue instances from load balancer
- Terminate blue instances

**CodeDeploy automation**:
- **Automatically copy Auto Scaling group**: CodeDeploy clones ASG configuration, launches green instances
- **Manually provision instances**: You create green instances, CodeDeploy deploys and manages traffic shift

**Traffic rerouting**:
- Deployment group specifies load balancer (ALB or Classic LB)
- CodeDeploy shifts traffic by registering/deregistering instances from target groups

### Blue/Green for Lambda

Lambda blue/green uses aliases and weighted routing:

**Lambda alias**: Pointer to specific function version with optional weighted routing to multiple versions

**Example**:
```
Alias: live
  Version 1: 90% traffic
  Version 2: 10% traffic
```

**CodeDeploy shifts weights** according to deployment configuration:
- Start: Version 1 (100%)
- Canary 10%: Version 1 (90%), Version 2 (10%)
- After 5 minutes: Version 1 (0%), Version 2 (100%)

### Blue/Green for ECS

ECS blue/green deploys new task set to same cluster:

**Task sets**: Logical grouping of tasks within an ECS service

**Deployment**:
- **Blue task set**: Current tasks running old task definition
- **Green task set**: New tasks running new task definition

**Traffic shifting**: Load balancer shifts traffic from blue target group to green target group

**Termination**: After successful deployment, CodeDeploy terminates blue task set

## Canary and Linear Deployments

### Canary Deployments

Deploy to small percentage of fleet, validate, then deploy to remaining fleet:

**Example: Canary10Percent15Minutes**
- 0 minutes: 10% traffic to new version
- 0-15 minutes: Monitor CloudWatch alarms
- 15 minutes: If healthy, shift remaining 90% to new version
- If alarms trigger during 0-15 minutes: Rollback to old version

**Use case**: Deploy risky changes to 10% of users, monitor error rates, proceed if healthy.

### Linear Deployments

Gradually shift traffic in equal increments:

**Example: Linear10PercentEvery3Minutes**
- 0 minutes: 10% traffic
- 3 minutes: 20% traffic
- 6 minutes: 30% traffic
- ...
- 27 minutes: 100% traffic

**At each increment**: Monitor CloudWatch alarms. If alarm triggers, rollback.

**Use case**: Gradual rollout with monitoring at each stage.

### Custom Traffic Configurations

Create custom deployment configurations:

**Example**: Canary 5% for 30 minutes, then 100%
```json
{
  "deploymentConfigName": "Custom5Percent30Minutes",
  "trafficRoutingConfig": {
    "type": "TimeBasedCanary",
    "timeBasedCanary": {
      "canaryPercentage": 5,
      "canaryInterval": 30
    }
  }
}
```

**Example**: Linear 25% every 5 minutes
```json
{
  "deploymentConfigName": "CustomLinear25Percent5Minutes",
  "trafficRoutingConfig": {
    "type": "TimeBasedLinear",
    "timeBasedLinear": {
      "linearPercentage": 25,
      "linearInterval": 5
    }
  }
}
```

## Rollback Mechanisms

### Automatic Rollback

CodeDeploy monitors CloudWatch alarms during deployment and rolls back automatically:

**Configuration**:
```yaml
AutoRollbackConfiguration:
  Enabled: true
  Events:
    - DEPLOYMENT_FAILURE
    - DEPLOYMENT_STOP_ON_ALARM
```

**Rollback triggers**:
- **DEPLOYMENT_FAILURE**: Deployment fails (lifecycle hook failure, instance health check failure)
- **DEPLOYMENT_STOP_ON_ALARM**: CloudWatch alarm breaches threshold during deployment
- **DEPLOYMENT_STOP_ON_REQUEST**: Manual stop requested

**CloudWatch alarm integration**:
```yaml
AlarmConfiguration:
  Enabled: true
  Alarms:
    - Name: HighErrorRate
    - Name: HighLatency
  IgnorePollAlarmFailure: false
```

During deployment, if `HighErrorRate` or `HighLatency` alarm triggers, CodeDeploy stops deployment and rolls back.

### Manual Rollback

Trigger rollback manually:

**Via console**: Stop deployment → Rollback option
**Via CLI**: `aws deploy stop-deployment --deployment-id d-XXXXXX --auto-rollback-enabled`

**Rollback process**:
- **In-place deployment**: Redeploy previous revision
- **Blue/green deployment**: Shift traffic back to blue environment

### Rollback Speed

**Blue/green**: Instant rollback (shift traffic back to blue)
**In-place**: Slower rollback (redeploy previous revision to all instances)

**Production recommendation**: Use blue/green for critical applications requiring fast rollback.

## Integration Patterns

### CodePipeline Integration

CodeDeploy integrates seamlessly with CodePipeline:

**Pipeline structure**:
```
Source (GitHub) → Build (CodeBuild) → Deploy (CodeDeploy)
```

**Deploy stage action**:
```yaml
ActionTypeId:
  Category: Deploy
  Owner: AWS
  Provider: CodeDeploy
  Version: '1'
Configuration:
  ApplicationName: my-app
  DeploymentGroupName: production
InputArtifacts:
  - Name: BuildOutput
```

**Artifact**: CodePipeline passes build artifact (ZIP file with application code + AppSpec) to CodeDeploy.

### CloudWatch Alarms

Monitor application health with CloudWatch alarms:

**Deployment-linked alarms**:
```yaml
AlarmConfiguration:
  Enabled: true
  Alarms:
    - Name: ApiGateway5XXErrors
    - Name: LambdaDuration
    - Name: ECSCPUUtilization
```

**Alarm triggers rollback**: If alarm enters ALARM state during deployment, CodeDeploy automatically rolls back.

**Common alarms**:
- Error rate (5XX errors, Lambda errors)
- Latency (API Gateway latency, Lambda duration)
- Resource utilization (CPU, memory)

### SNS Notifications

Receive notifications for deployment events:

**Configuration**:
```yaml
TriggerConfigurations:
  - TriggerName: DeploymentNotifications
    TriggerTargetArn: arn:aws:sns:us-east-1:123456789012:deployments
    TriggerEvents:
      - DeploymentStart
      - DeploymentSuccess
      - DeploymentFailure
      - DeploymentRollback
```

**SNS → Lambda → Slack**: Lambda function receives SNS notification, posts to Slack channel.

### Auto Scaling Group Integration

CodeDeploy integrates with Auto Scaling groups:

**Automatic instance registration**: New instances launched by ASG automatically receive deployments.

**Deployment during scale-out**:
- ASG launches new instance
- Instance registers with CodeDeploy (via tag or ASG association)
- CodeDeploy deploys latest revision to new instance
- New instance joins deployment group

**Blue/green with ASG**: CodeDeploy creates new ASG (green), deploys application, shifts traffic, terminates old ASG (blue).

## Performance Optimization

### Parallel Deployments

Deploy to multiple instances simultaneously:

**Configuration**: Set minimum healthy hosts to percentage (e.g., 75%)
- Total instances: 100
- Minimum healthy: 75
- Simultaneous deployment: 25 instances

**Trade-off**: Faster deployment vs increased blast radius if deployment fails.

### Artifact Optimization

**Reduce artifact size**:
- Exclude development dependencies
- Compress files
- Use `.deployignore` to exclude unnecessary files

**Example** (Node.js):
```
node_modules/
.git/
.env
*.log
tests/
```

**Benefit**: Smaller artifacts download faster from S3, reducing deployment time.

### Instance Provisioning

**For blue/green deployments**:
- Use AMIs with dependencies pre-installed
- Reduce UserData script execution time
- Use larger instance types for faster startup (if cost acceptable)

**Cold start reduction**:
- Pre-warm instances by running application during AMI build
- Cache frequently accessed data in instance store or EBS volumes

## Cost Optimization Strategies

### CodeDeploy Pricing

**CodeDeploy is free for:**
- EC2 deployments
- Lambda deployments
- ECS deployments

**Cost factors**:
- EC2 instance hours (blue/green duplicate infrastructure)
- S3 storage for revisions
- Data transfer (downloading revisions from S3)
- CloudWatch alarms (monitoring deployment health)

### Blue/Green Cost Optimization

**Minimize green fleet lifetime**:
- Shift traffic quickly after validation
- Terminate blue fleet immediately after successful deployment
- Don't keep blue fleet running "just in case"

**Example**:
- Blue fleet: 10 m5.large instances ($0.096/hour × 10 = $0.96/hour)
- Deployment time: 30 minutes with traditional blue/green = $0.48
- Optimized deployment: 10 minutes = $0.16
- Savings: $0.32 per deployment × 100 deployments/month = $32/month

**Rightsize green fleet**: Don't overprovision green instances "to be safe." Match blue fleet size.

### Revision Storage

**S3 lifecycle policies**: Delete old revisions after 90 days
**Compress revisions**: ZIP files reduce storage costs
**Single source of truth**: Don't duplicate revisions across regions unnecessarily

**Cost**: 1 GB revision × 100 versions × $0.023/GB/month = $2.30/month
**Optimized**: 1 GB revision × 10 versions (90-day retention) = $0.23/month

### Minimize Deployment Frequency

**Batch changes**: Deploy once per day instead of per commit (if acceptable)
**Off-hours deployments**: Deploy during low-traffic periods to minimize instance hours

**Trade-off**: Longer deployment cycles vs deployment costs. Balance based on organization needs.

## Security Best Practices

### IAM Permissions

**CodeDeploy service role**:
```json
{
  "Effect": "Allow",
  "Action": [
    "ec2:DescribeInstances",
    "ec2:DescribeInstanceStatus",
    "ec2:CreateTags",
    "autoscaling:CompleteLifecycleAction",
    "autoscaling:DeleteLifecycleHook",
    "autoscaling:DescribeAutoScalingGroups",
    "autoscaling:DescribeLifecycleHooks",
    "autoscaling:PutLifecycleHook",
    "autoscaling:RecordLifecycleActionHeartbeat",
    "elasticloadbalancing:DescribeTargetGroups",
    "elasticloadbalancing:DescribeTargetHealth",
    "elasticloadbalancing:RegisterTargets",
    "elasticloadbalancing:DeregisterTargets"
  ],
  "Resource": "*"
}
```

**EC2 instance role** (for CodeDeploy Agent):
```json
{
  "Effect": "Allow",
  "Action": [
    "s3:GetObject",
    "s3:ListBucket"
  ],
  "Resource": [
    "arn:aws:s3:::my-codedeploy-bucket/*",
    "arn:aws:s3:::my-codedeploy-bucket"
  ]
}
```

### Revision Security

**Encrypt revisions in S3**: Use SSE-S3 or SSE-KMS encryption
**Restrict bucket access**: Only CodeDeploy service role and CI/CD pipeline can write to bucket
**Versioning**: Enable S3 versioning for revision history and recovery

### Lifecycle Hook Security

**Avoid hardcoded secrets**: Use Systems Manager Parameter Store or Secrets Manager
**Validate hook scripts**: Review scripts for security vulnerabilities before deployment
**Restrict script permissions**: Run hooks with least-privilege user (not root unless necessary)

**Example** (using Parameter Store in hook):
```bash
#!/bin/bash
# Retrieve database password from Parameter Store
DB_PASSWORD=$(aws ssm get-parameter --name /myapp/prod/db-password --with-decryption --query 'Parameter.Value' --output text)

# Use password to configure application
echo "DB_PASSWORD=$DB_PASSWORD" >> /etc/myapp/config
```

### Network Security

**VPC endpoints for S3**: CodeDeploy Agent downloads revisions from S3 via VPC endpoint (no internet access required)
**Security groups**: Restrict inbound traffic to application ports only
**Instance metadata service**: Use IMDSv2 to prevent SSRF attacks

## When to Use CodeDeploy vs Alternatives

### CodeDeploy Strengths

**Use CodeDeploy when**:
- Deploying to EC2, Lambda, or ECS
- Blue/green or canary deployments needed
- Automated rollback based on CloudWatch alarms required
- AWS-native integration desired (CodePipeline, CloudWatch, Auto Scaling)
- Budget-conscious (CodeDeploy is free)
- Gradual traffic shifting with health monitoring

### Kubernetes (EKS) Deployments

**Use Kubernetes native deployments when**:
- Running on EKS and prefer Kubernetes-native tools
- Using Helm charts for application packaging
- Advanced Kubernetes features needed (StatefulSets, DaemonSets, Jobs)
- GitOps workflows with ArgoCD or Flux

**CodeDeploy limitations on EKS**: CodeDeploy doesn't support EKS directly (only ECS). Use Kubernetes rolling updates, blue/green with Flagger, or canary with Argo Rollouts.

### Terraform/CloudFormation

**Use IaC tools when**:
- Deploying infrastructure and application together
- Infrastructure changes require deployment (scaling, changing instance types)
- Declarative infrastructure preferred

**CodeDeploy focus**: Application deployment only. Use with CloudFormation/Terraform for infrastructure provisioning.

### Spinnaker

**Use Spinnaker when**:
- Multi-cloud deployments (AWS, GCP, Azure, Kubernetes)
- Advanced deployment pipelines (multi-stage, manual judgments, complex conditionals)
- Sophisticated rollback strategies
- Large-scale organizations with dedicated platform teams

**Trade-off**: Spinnaker requires operational overhead (self-hosted or Managed service). CodeDeploy is fully managed.

### GitHub Actions

**Use GitHub Actions when**:
- GitHub-centric workflows
- Simple deployments (copy files to S3, update Lambda function)
- Multi-cloud or non-AWS deployments

**Hybrid approach**: GitHub Actions for build/test, CodeDeploy for AWS deployment.

## Common Pitfalls

<div class="callout callout--warning">
<p class="callout__title">Test Your Rollback Procedure</p>
<p>Deployment rolls back automatically when needed, but if the rollback mechanism itself fails, your application ends up in a broken state. Periodically test rollbacks to verify they complete successfully.</p>
</div>

### Lifecycle Hook Failures

**Problem**: `ApplicationStart` hook fails, deployment aborted, but debugging information unclear.

**Cause**: Hook script exits with non-zero code. stdout/stderr not captured.

**Solution**:
- Redirect script output to log file: `script.sh > /var/log/deploy.log 2>&1`
- View logs in `/opt/codedeploy-agent/deployment-root/[deployment-id]/logs/scripts.log`
- Test hooks locally before deployment

### Missing Permissions

**Problem**: CodeDeploy fails to download revision from S3 with "Access Denied."

**Cause**: EC2 instance role lacks S3 GetObject permission.

**Solution**: Add S3 permissions to instance role:
```json
{
  "Effect": "Allow",
  "Action": "s3:GetObject",
  "Resource": "arn:aws:s3:::my-deployment-bucket/*"
}
```

### Agent Not Running

**Problem**: Deployment stuck at "In Progress" indefinitely.

**Cause**: CodeDeploy Agent not running on instance.

**Solution**:
- Verify agent running: `sudo service codedeploy-agent status`
- Start agent: `sudo service codedeploy-agent start`
- Enable agent auto-start: `sudo systemctl enable codedeploy-agent`

### Blue/Green Terminating Healthy Blue Instances

**Problem**: CodeDeploy terminates blue fleet, but traffic still routed to blue (users experience errors).

**Cause**: Load balancer deregistration delay not respected. Traffic sent to terminating instances.

**Solution**: Configure termination wait time to exceed load balancer deregistration delay (default 300 seconds). Set wait time to 600 seconds.

### Insufficient Minimum Healthy Hosts

**Problem**: Deployment fails with "Minimum healthy hosts not met."

**Cause**: Minimum healthy hosts set to 100%, but deployment requires stopping instances.

**Solution**: Lower minimum healthy hosts to allow deployments (e.g., 75%). Accept that 25% of instances will be updating at any time.

### Large Artifact Download Timeout

**Problem**: Deployment fails during DownloadBundle with timeout error.

**Cause**: Artifact is 5 GB, downloading from S3 to instance times out (default 15 minutes).

**Solution**:
- Reduce artifact size (exclude unnecessary files)
- Increase timeout in deployment configuration
- Use smaller instances with better network performance

### Not Testing Rollback

**Problem**: Deployment rolls back automatically, but rollback fails, leaving application in broken state.

**Cause**: Rollback mechanism not tested.

**Solution**: Periodically test rollback:
1. Deploy new version
2. Trigger alarm (or manually stop deployment)
3. Verify rollback completes successfully
4. Verify application healthy after rollback

### Ignoring CloudWatch Alarms During Deployment

**Problem**: Deployment completes despite error rate spiking to 50%.

**Cause**: CloudWatch alarms not configured in deployment group.

**Solution**: Configure alarms for error rate, latency, and health metrics. Enable automatic rollback on alarm.

## Key Takeaways

**CodeDeploy automates deployments with zero downtime**: Blue/green deployments shift traffic from old version to new version without service interruption. Rolling deployments update instances gradually while maintaining availability.

**Automated rollback protects production**: CloudWatch alarm integration triggers automatic rollback when error rates, latency, or resource utilization breach thresholds during deployment.

**Canary and linear deployments limit blast radius**: Deploy to 10% of fleet first, monitor metrics, then proceed to remaining 90%. If issues detected early, only 10% of users affected.

**AppSpec file defines deployment behavior**: Lifecycle hooks (BeforeInstall, ApplicationStart, ValidateService) execute custom scripts at specific deployment stages, enabling application-specific deployment logic.

**CodeDeploy Agent handles EC2 deployments**: Agent runs on instances, polls CodeDeploy service, downloads revisions, executes hooks. Agent must be installed and running for deployments to succeed.

**Blue/green provides instant rollback**: Shift traffic back to blue environment in seconds if green deployment fails. In-place rollback requires redeploying previous revision (slower).

**Integration with Auto Scaling groups automates instance deployment**: New instances launched by ASG automatically receive latest application revision, ensuring all instances run same version.

**CodeDeploy is free, costs are infrastructure-related**: No charge for CodeDeploy service. Costs arise from duplicate infrastructure (blue/green), S3 storage, data transfer, and CloudWatch alarms.

**Gradual traffic shifting enables safe production testing**: Canary deployments route small percentage of traffic to new version, validating with real production traffic before full rollout.

**Lambda and ECS deployments use traffic shifting**: CodeDeploy shifts traffic between Lambda versions or ECS task sets, enabling blue/green deployments without managing instance lifecycle.

**Lifecycle hook validation prevents bad deployments**: ValidateService hook tests application health after deployment. Hook failure stops deployment and triggers rollback before traffic routed to unhealthy instances.

**CodeDeploy complements CI/CD pipelines**: Integrates with CodePipeline, GitHub Actions, Jenkins, etc., as the deployment stage. Receives build artifacts, orchestrates deployment, reports status.

**Security requires proper IAM permissions and secret management**: CodeDeploy service role needs EC2, ASG, and ELB permissions. Instance role needs S3 GetObject permissions. Use Parameter Store/Secrets Manager for secrets in hooks.
