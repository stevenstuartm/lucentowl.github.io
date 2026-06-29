---
title: "IaC Governance and Compliance"
layout: guide
category: Infrastructure & Cloud
subcategory: Infrastructure as Code
description: "Enforcing tagging standards, automated drift detection, compliance monitoring, and governance at scale using AWS Config, Organizations, and automation."
tags: [infrastructure, iac, governance, compliance, security, practical]
---

## Overview

**Goal:** Ensure infrastructure remains compliant, properly tagged, and doesn't drift from IaC definitions.

**Key challenges:**
- Developers creating resources without required tags
- Manual changes causing drift from IaC templates
- Lack of visibility into compliance violations
- Reactive rather than proactive governance

**AWS tools for governance:**
- **AWS Config**: Continuous compliance monitoring and drift detection
- **AWS Organizations + Tag Policies**: Enforce tagging standards across accounts
- **Service Control Policies (SCPs)**: Prevent non-compliant resource creation
- **EventBridge + Lambda**: Automated remediation
- **CloudFormation Hooks**: Block non-compliant stack operations

---

## Tag Enforcement

Ensure all resources have required tags (environment, layer, domain) using AWS Organizations and preventive controls.

<div class="callout callout--tip">
<p class="callout__title">Tagging Strategy</p>
<p>Start with 3-5 required tags: environment, layer, and owner are universally useful. Add domain, cost-center, or compliance tags as organizational needs dictate. Too many required tags create friction.</p>
</div>

### Tag Policies (AWS Organizations)

**What they do:** Define required tags and allowed values at the organization level.

**How they work:**
- Create tag policies in AWS Organizations
- Attach to organization root, OUs, or accounts
- Resources created without required tags are **tagged automatically** or **blocked**

**Create a tag policy:**

```json
{
  "tags": {
    "environment": {
      "tag_key": {
        "@@assign": "environment"
      },
      "tag_value": {
        "@@assign": ["prod", "dev", "staging"]
      },
      "enforced_for": {
        "@@assign": [
          "ec2:instance",
          "rds:db",
          "s3:bucket",
          "lambda:function"
        ]
      }
    },
    "layer": {
      "tag_key": {
        "@@assign": "layer"
      },
      "tag_value": {
        "@@assign": ["foundation", "platform", "devops", "application"]
      },
      "enforced_for": {
        "@@assign": [
          "ec2:instance",
          "rds:db",
          "s3:bucket"
        ]
      }
    },
    "domain": {
      "tag_key": {
        "@@assign": "domain"
      },
      "enforced_for": {
        "@@assign": [
          "ec2:instance",
          "rds:db",
          "s3:bucket"
        ]
      }
    }
  }
}
```

**Attach tag policy to organization:**

Create and attach tag policies using [AWS Organizations](https://aws.amazon.com/organizations/){:target="_blank" rel="noopener noreferrer"} console or APIs. Attach policies to your organization root (applies to all accounts), organizational units (OUs), or specific accounts depending on scope needs.

### AWS Config Rules for Tag Compliance

[AWS Config](https://aws.amazon.com/config/){:target="_blank" rel="noopener noreferrer"} continuously checks resources for required tags and reports violations.

**Enable required-tags config rule:**

Use the AWS-managed `REQUIRED_TAGS` config rule to check for presence of specific tags. Configure the rule with:
- Tag keys to require (e.g., environment, layer, domain)
- Resource types to check (EC2, RDS, S3, Lambda, etc.)
- Compliance scope (all resources or specific types)

Deploy Config rules via IaC (CloudFormation, Terraform) for consistency across accounts.

**Query non-compliant resources:**

Use AWS Config console or APIs to:
- View compliance summary by rule
- List non-compliant resources
- Export compliance reports
- Trigger remediation for violations

### Tag on Create (EventBridge + Lambda)

**What it does:** Automatically tag resources when created if tags are missing.

**EventBridge rule:**

```yaml
TagOnCreateRule:
  Type: AWS::Events::Rule
  Properties:
    Description: Auto-tag resources on creation
    EventPattern:
      source:
        - aws.ec2
        - aws.rds
        - aws.s3
      detail-type:
        - AWS API Call via CloudTrail
      detail:
        eventName:
          - RunInstances
          - CreateDBInstance
          - CreateBucket
    State: ENABLED
    Targets:
      - Arn: !GetAtt AutoTagFunction.Arn
        Id: AutoTagLambda
```

**Lambda function (example):**

```csharp
// Auto-tag resources with default values if missing
public async Task HandleEvent(CloudWatchEvent<dynamic> evt)
{
    var resourceArn = evt.Detail.responseElements.resourceArn;

    var existingTags = await GetResourceTags(resourceArn);

    var requiredTags = new Dictionary<string, string>
    {
        { "environment", "dev" },  // Default to dev
        { "layer", "application" }, // Default to application
        { "domain", "unknown" }     // Flag for review
    };

    var tagsToAdd = requiredTags
        .Where(rt => !existingTags.ContainsKey(rt.Key))
        .ToList();

    if (tagsToAdd.Any())
    {
        await AddResourceTags(resourceArn, tagsToAdd);
        await SendNotification($"Auto-tagged {resourceArn} - Review required");
    }
}
```

---

## Automated Drift Detection

Continuously monitor for drift between IaC definitions and actual resource state.

### AWS Config for Drift Detection

**What it does:** Tracks resource configuration changes and compares against desired state.

**Enable AWS Config:**

```bash
# Create configuration recorder
aws configservice put-configuration-recorder \
  --configuration-recorder name=default,roleARN=arn:aws:iam::123456789012:role/config-role \
  --recording-group allSupported=true,includeGlobalResourceTypes=true

# Create delivery channel
aws configservice put-delivery-channel \
  --delivery-channel name=default,s3BucketName=config-bucket,snsTopicARN=arn:aws:sns:us-east-1:123456789012:config-topic

# Start recording
aws configservice start-configuration-recorder \
  --configuration-recorder-name default
```

### CloudFormation Drift Detection Schedule

**What it does:** Run drift detection on all stacks on a schedule.

**EventBridge scheduled rule:**

```yaml
DriftDetectionSchedule:
  Type: AWS::Events::Rule
  Properties:
    Description: Run drift detection daily
    ScheduleExpression: rate(1 day)
    State: ENABLED
    Targets:
      - Arn: !GetAtt DriftDetectionFunction.Arn
        Id: DriftDetection
```

**Lambda function:**

```csharp
public async Task RunDriftDetection()
{
    var stacksResponse = await _cloudFormation.ListStacksAsync(new ListStacksRequest
    {
        StackStatusFilter = new List<string>
        {
            "CREATE_COMPLETE",
            "UPDATE_COMPLETE"
        }
    });

    foreach (var stack in stacksResponse.StackSummaries)
    {
        try
        {
            var driftResponse = await _cloudFormation.DetectStackDriftAsync(
                new DetectStackDriftRequest
                {
                    StackName = stack.StackName
                });

            // Check drift status after detection completes
            var driftStatus = await WaitForDriftDetection(driftResponse.StackDriftDetectionId);

            if (driftStatus.StackDriftStatus == StackDriftStatus.DRIFTED)
            {
                await NotifyDrift(stack.StackName);
                await GetDriftDetails(stack.StackName);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError($"Drift detection failed for {stack.StackName}: {ex.Message}");
        }
    }
}
```

### AWS Config Conformance Packs

**What they are:** Pre-built compliance rule sets for common standards.

**Deploy conformance pack:**

```bash
# Deploy operational best practices pack
aws configservice put-conformance-pack \
  --conformance-pack-name operational-best-practices \
  --template-s3-uri s3://aws-config-conformance-packs/Operational-Best-Practices-for-AWS-CloudFormation.yaml
```

**Custom conformance pack for IaC governance:**

```yaml
# conformance-pack.yaml
Resources:
  CloudFormationStackDriftDetectionCheck:
    Type: AWS::Config::ConfigRule
    Properties:
      ConfigRuleName: cloudformation-stack-drift-detection-check
      Source:
        Owner: AWS
        SourceIdentifier: CLOUDFORMATION_STACK_DRIFT_DETECTION_CHECK
      MaximumExecutionFrequency: One_Hour

  CloudFormationStackNotificationCheck:
    Type: AWS::Config::ConfigRule
    Properties:
      ConfigRuleName: cloudformation-stack-notification-check
      Source:
        Owner: AWS
        SourceIdentifier: CLOUDFORMATION_STACK_NOTIFICATION_CHECK
```

---

## Compliance Monitoring

Continuously monitor infrastructure for security and compliance violations.

### AWS Config Rules for IaC Compliance

**Common rules for IaC governance:**

```yaml
# Ensure all resources are managed by CloudFormation
ResourcesManagedByCloudFormation:
  Type: AWS::Config::ConfigRule
  Properties:
    ConfigRuleName: resources-managed-by-cloudformation
    Source:
      Owner: CUSTOM_LAMBDA
      SourceIdentifier: !GetAtt CheckCFManagementFunction.Arn
    Scope:
      ComplianceResourceTypes:
        - AWS::EC2::Instance
        - AWS::RDS::DBInstance
        - AWS::S3::Bucket

# Ensure stacks have termination protection
StackTerminationProtection:
  Type: AWS::Config::ConfigRule
  Properties:
    ConfigRuleName: stack-termination-protection
    Source:
      Owner: AWS
      SourceIdentifier: CLOUDFORMATION_STACK_NOTIFICATION_CHECK
```

**Lambda for custom rule (check if resource managed by CFN):**

```csharp
public async Task<ComplianceType> EvaluateCompliance(string resourceId, string resourceType)
{
    // Query CloudFormation to see if resource is in any stack
    var stacksResponse = await _cloudFormation.ListStacksAsync(new ListStacksRequest());

    foreach (var stack in stacksResponse.StackSummaries)
    {
        var resourcesResponse = await _cloudFormation.ListStackResourcesAsync(
            new ListStackResourcesRequest { StackName = stack.StackName });

        var managedResource = resourcesResponse.StackResourceSummaries
            .FirstOrDefault(r => r.PhysicalResourceId == resourceId);

        if (managedResource != null)
        {
            return ComplianceType.COMPLIANT;
        }
    }

    // Resource not found in any stack
    return ComplianceType.NON_COMPLIANT;
}
```

### Security Hub Integration

**What it does:** Aggregates compliance findings from Config, GuardDuty, Inspector, and other services.

**Enable Security Hub:**

```bash
aws securityhub enable-security-hub

# Enable AWS Foundational Security Best Practices standard
aws securityhub batch-enable-standards \
  --standards-subscription-requests StandardsArn=arn:aws:securityhub:::ruleset/cis-aws-foundations-benchmark/v/1.2.0
```

**Query Security Hub for IaC-related findings:**

```bash
aws securityhub get-findings \
  --filters '{
    "ProductName": [{"Value": "Config", "Comparison": "EQUALS"}],
    "ComplianceStatus": [{"Value": "FAILED", "Comparison": "EQUALS"}]
  }'
```

### Compliance Dashboard

**What it does:** Central view of all compliance violations.

**Using AWS Config Dashboard:**
1. AWS Console → Config → Dashboard
2. View compliance by rule
3. View non-compliant resources
4. Drill down into specific violations

**Custom dashboard with CloudWatch:**

```yaml
ComplianceDashboard:
  Type: AWS::CloudWatch::Dashboard
  Properties:
    DashboardName: IaC-Governance
    DashboardBody: !Sub |
      {
        "widgets": [
          {
            "type": "metric",
            "properties": {
              "metrics": [
                ["AWS/Config", "ComplianceScore", {"stat": "Average"}]
              ],
              "period": 300,
              "stat": "Average",
              "region": "${AWS::Region}",
              "title": "Overall Compliance Score"
            }
          },
          {
            "type": "log",
            "properties": {
              "query": "fields @timestamp, detail.configRuleName, detail.resourceId | filter detail.newEvaluationResult.complianceType = 'NON_COMPLIANT'",
              "region": "${AWS::Region}",
              "title": "Recent Compliance Violations"
            }
          }
        ]
      }
```

---

## Preventive Controls

Block non-compliant infrastructure changes before they happen.

### Service Control Policies (SCPs)

**What they do:** Prevent resource creation without required tags at the organization level.

**Block EC2 creation without required tags:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyEC2WithoutRequiredTags",
      "Effect": "Deny",
      "Action": [
        "ec2:RunInstances",
        "ec2:CreateVolume"
      ],
      "Resource": [
        "arn:aws:ec2:*:*:instance/*",
        "arn:aws:ec2:*:*:volume/*"
      ],
      "Condition": {
        "StringNotEquals": {
          "aws:RequestTag/environment": ["prod", "dev", "staging"]
        }
      }
    },
    {
      "Sid": "DenyEC2WithoutLayerTag",
      "Effect": "Deny",
      "Action": "ec2:RunInstances",
      "Resource": "arn:aws:ec2:*:*:instance/*",
      "Condition": {
        "Null": {
          "aws:RequestTag/layer": "true"
        }
      }
    }
  ]
}
```

**Attach SCP:**

```bash
# Create SCP
aws organizations create-policy \
  --name RequireTagsSCP \
  --description "Prevent resource creation without tags" \
  --content file://require-tags-scp.json \
  --type SERVICE_CONTROL_POLICY

# Attach to OU or account
aws organizations attach-policy \
  --policy-id p-xxxxxxxxx \
  --target-id ou-xxxx-xxxxxxxx
```

### CloudFormation Hooks

**What they do:** Validate CloudFormation templates before deployment and block non-compliant stacks.

**Enable hooks:**

```yaml
RequireTagsHook:
  Type: AWS::CloudFormation::Hook
  Properties:
    TypeName: AWSSamples::RequireTags::Hook
    TargetStacks: ALL
    FailureMode: FAIL
    Properties:
      RequiredTags:
        - environment
        - layer
        - domain
```

**Custom hook (example):**

```csharp
public class RequireTagsHook : ICloudFormationHook
{
    private readonly string[] _requiredTags = { "environment", "layer", "domain" };

    public HookResponse PreCreate(HookContext context)
    {
        var resource = context.TargetModel;
        var tags = resource.Tags ?? new Dictionary<string, string>();

        var missingTags = _requiredTags
            .Where(rt => !tags.ContainsKey(rt))
            .ToList();

        if (missingTags.Any())
        {
            return new HookResponse
            {
                Status = HookStatus.FAILED,
                Message = $"Missing required tags: {string.Join(", ", missingTags)}"
            };
        }

        return new HookResponse { Status = HookStatus.SUCCESS };
    }
}
```

### IAM Permission Boundaries

**What they do:** Limit permissions even for administrators to prevent bypass of governance.

**Permission boundary requiring tags:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowWithTags",
      "Effect": "Allow",
      "Action": "*",
      "Resource": "*"
    },
    {
      "Sid": "DenyCreateWithoutTags",
      "Effect": "Deny",
      "Action": [
        "ec2:RunInstances",
        "rds:CreateDBInstance",
        "s3:CreateBucket"
      ],
      "Resource": "*",
      "Condition": {
        "StringNotEquals": {
          "aws:RequestTag/environment": ["prod", "dev", "staging"]
        }
      }
    }
  ]
}
```

---

## Automated Remediation

Automatically fix compliance violations and drift.

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Detective Controls</h4>
<ul>
<li><strong>Timing:</strong> After the violation occurs</li>
<li><strong>Tools:</strong> AWS Config, drift detection</li>
<li><strong>Response:</strong> Alert and remediate</li>
<li><strong>Risk:</strong> Window of exposure exists</li>
<li><strong>Use:</strong> Monitoring and visibility</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Preventive Controls</h4>
<ul>
<li><strong>Timing:</strong> Before the violation occurs</li>
<li><strong>Tools:</strong> SCPs, IAM boundaries, hooks</li>
<li><strong>Response:</strong> Block the change</li>
<li><strong>Risk:</strong> No exposure window</li>
<li><strong>Use:</strong> Enforce critical requirements</li>
</ul>
</div>
</div>

### AWS Config Remediation Actions

**What they do:** Automatically run SSM documents or Lambda functions to fix non-compliance.

**Auto-remediate missing tags:**

```yaml
RemediateRequiredTags:
  Type: AWS::Config::RemediationConfiguration
  Properties:
    ConfigRuleName: !Ref RequiredTagsRule
    TargetType: SSM_DOCUMENT
    TargetIdentifier: AWS-PublishSNSNotification
    Parameters:
      AutomationAssumeRole:
        StaticValue:
          Values:
            - !GetAtt RemediationRole.Arn
      TopicArn:
        StaticValue:
          Values:
            - !Ref ComplianceNotificationTopic
      Message:
        StaticValue:
          Values:
            - Resource missing required tags
    Automatic: true
    MaximumAutomaticAttempts: 3
    RetryAttemptSeconds: 60
```

**Custom remediation with Lambda:**

```csharp
public async Task RemediateMissingTags(ConfigRuleEvaluationEvent evt)
{
    var resourceArn = evt.ConfigRuleInvokingEvent.ConfigurationItem.Arn;
    var resourceType = evt.ConfigRuleInvokingEvent.ConfigurationItem.ResourceType;

    // Add default tags
    var defaultTags = new Dictionary<string, string>
    {
        { "environment", "dev" },
        { "layer", "application" },
        { "domain", "unassigned-needs-review" }
    };

    await _tagClient.TagResourcesAsync(new TagResourcesRequest
    {
        ResourceARNList = new List<string> { resourceArn },
        Tags = defaultTags
    });

    // Notify for manual review
    await _sns.PublishAsync(new PublishRequest
    {
        TopicArn = _notificationTopicArn,
        Subject = "Auto-remediation: Missing tags added",
        Message = $"Resource {resourceArn} was auto-tagged. Please review and update."
    });
}
```

### Auto-remediate CloudFormation Drift

**What it does:** Detect drift and automatically update resources to match template.

**EventBridge rule:**

```yaml
DriftRemediationRule:
  Type: AWS::Events::Rule
  Properties:
    Description: Auto-remediate drift
    EventPattern:
      source:
        - aws.cloudformation
      detail-type:
        - CloudFormation Drift Detection Status Change
      detail:
        status-details:
          stack-drift-status:
            - DRIFTED
    State: ENABLED
    Targets:
      - Arn: !GetAtt DriftRemediationFunction.Arn
        Id: RemediateDrift
```

**Remediation options:**

```csharp
public async Task HandleDrift(CloudFormationDriftEvent evt)
{
    var stackName = evt.Detail.StackId;

    // Option 1: Update stack to fix drift
    await _cloudFormation.UpdateStackAsync(new UpdateStackRequest
    {
        StackName = stackName,
        UsePreviousTemplate = true,
        Capabilities = new List<string> { "CAPABILITY_IAM" }
    });

    // Option 2: Notify and require manual intervention
    await _sns.PublishAsync(new PublishRequest
    {
        TopicArn = _notificationTopicArn,
        Subject = $"Drift detected: {stackName}",
        Message = "Manual review required. Template may need updating."
    });
}
```

---

## Governance at Scale

Manage governance across multiple accounts and regions.

### AWS Organizations + StackSets

**What it does:** Deploy governance controls to all accounts in your organization.

**Deploy Config rules organization-wide:**

```yaml
OrganizationConfigRule:
  Type: AWS::Config::OrganizationConfigRule
  Properties:
    OrganizationConfigRuleName: org-required-tags
    OrganizationManagedRuleMetadata:
      RuleIdentifier: REQUIRED_TAGS
      InputParameters: |
        {
          "tag1Key": "environment",
          "tag2Key": "layer",
          "tag3Key": "domain"
        }
      ResourceTypesScope:
        - AWS::EC2::Instance
        - AWS::RDS::DBInstance
        - AWS::S3::Bucket
```

**Deploy via StackSets:**

```bash
aws cloudformation create-stack-set \
  --stack-set-name governance-controls \
  --template-body file://governance.yaml \
  --capabilities CAPABILITY_IAM \
  --permission-model SERVICE_MANAGED \
  --auto-deployment Enabled=true,RetainStacksOnAccountRemoval=false

# Deploy to all accounts in organization
aws cloudformation create-stack-instances \
  --stack-set-name governance-controls \
  --deployment-targets OrganizationalUnitIds=r-xxxx \
  --regions us-east-1 us-west-2
```

### Centralized Compliance Reporting

**AWS Config Aggregator:**

```yaml
ConfigAggregator:
  Type: AWS::Config::ConfigurationAggregator
  Properties:
    ConfigurationAggregatorName: organization-aggregator
    OrganizationAggregationSource:
      RoleArn: !GetAtt AggregatorRole.Arn
      AllAwsRegions: true
```

**Query compliance across organization:**

```bash
# Get compliance summary across all accounts
aws configservice describe-aggregate-compliance-by-config-rules \
  --configuration-aggregator-name organization-aggregator

# Get non-compliant resources across organization
aws configservice get-aggregate-compliance-details-by-config-rule \
  --configuration-aggregator-name organization-aggregator \
  --config-rule-name required-tags \
  --compliance-type NON_COMPLIANT
```

### Governance Metrics

**Track governance effectiveness:**

```yaml
GovernanceMetrics:
  Type: AWS::CloudWatch::Dashboard
  Properties:
    DashboardName: Governance-Metrics
    DashboardBody: !Sub |
      {
        "widgets": [
          {
            "type": "metric",
            "properties": {
              "metrics": [
                ["CustomMetrics", "ResourcesWithoutTags", {"stat": "Sum"}],
                ["CustomMetrics", "DriftedStacks", {"stat": "Sum"}],
                ["CustomMetrics", "NonCompliantResources", {"stat": "Sum"}]
              ],
              "period": 3600,
              "stat": "Sum",
              "region": "${AWS::Region}",
              "title": "Governance Health"
            }
          }
        ]
      }
```

**Publish custom metrics:**

```csharp
public async Task PublishGovernanceMetrics()
{
    // Count resources without tags
    var untaggedCount = await CountUntaggedResources();

    // Count drifted stacks
    var driftedCount = await CountDriftedStacks();

    // Count non-compliant resources
    var nonCompliantCount = await CountNonCompliantResources();

    await _cloudWatch.PutMetricDataAsync(new PutMetricDataRequest
    {
        Namespace = "CustomMetrics",
        MetricData = new List<MetricDatum>
        {
            new MetricDatum
            {
                MetricName = "ResourcesWithoutTags",
                Value = untaggedCount,
                Timestamp = DateTime.UtcNow
            },
            new MetricDatum
            {
                MetricName = "DriftedStacks",
                Value = driftedCount,
                Timestamp = DateTime.UtcNow
            },
            new MetricDatum
            {
                MetricName = "NonCompliantResources",
                Value = nonCompliantCount,
                Timestamp = DateTime.UtcNow
            }
        }
    });
}
```

---
