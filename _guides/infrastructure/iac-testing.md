---
title: "IaC Testing Strategies"
layout: guide
category: Infrastructure & Cloud
subcategory: Infrastructure as Code
description: "Static analysis, unit testing, integration testing, and compliance testing strategies for infrastructure code."
tags: [infrastructure, iac, testing, validation, practical, automation]
---

## Why Test Infrastructure

**Catch errors early:**
- Syntax errors before deployment
- Logic errors before production
- Security misconfigurations before breaches
- Policy violations before non-compliance

**Confidence in changes:**
- Safe refactoring
- Prevent regressions
- Validate assumptions
- Speed up deployments

**Documentation:**
- Tests document expected behavior
- Serve as examples
- Capture business requirements

---

## Testing Levels

```
        /\
       /E2E\          ← Few, slow, expensive
      /─────\
     / Integ \        ← More, faster, cheaper
    /────────\
   /  Unit   \       ← Many, fast, inexpensive
  /───────────\
 / Static Ana \      ← Most, instant, free
/─────────────\
```

**Static Analysis (70%):**
- Syntax validation
- Linting
- Security scanning
- Policy checking
- Run on every commit

**Unit Tests (20%):**
- Test individual modules
- Mock dependencies
- Fast execution
- Run on every commit

**Integration Tests (9%):**
- Test full stacks
- Real cloud resources
- Slower execution
- Run before merge

**End-to-End Tests (1%):**
- Complete workflows
- Production-like environment
- Very slow
- Run before production

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Static Analysis (70%)</h4>
<ul>
<li><strong>Speed:</strong> Instant (seconds)</li>
<li><strong>Cost:</strong> Free</li>
<li><strong>Coverage:</strong> Syntax, security, policy</li>
<li><strong>When:</strong> Every commit</li>
<li><strong>Value:</strong> Catch most issues immediately</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Integration Tests (9%)</h4>
<ul>
<li><strong>Speed:</strong> Slow (minutes to hours)</li>
<li><strong>Cost:</strong> Real cloud costs</li>
<li><strong>Coverage:</strong> End-to-end functionality</li>
<li><strong>When:</strong> Before merge/deploy</li>
<li><strong>Value:</strong> Validate actual behavior</li>
</ul>
</div>
</div>

---

## Static Analysis

**What it is:** Analyze code without executing it.

<div class="callout callout--tip">
<p class="callout__title">Fast Feedback Loop</p>
<p>Static analysis is the fastest and cheapest testing layer. Run it on every commit. Catch 70% of issues before any deployment happens. Tools like tflint, cfn-lint, and Checkov should be mandatory in your CI pipeline.</p>
</div>

### Tools

**For Terraform:**
- Validate syntax and configuration
- Lint code for best practices with [tflint](https://github.com/terraform-linters/tflint){:target="_blank" rel="noopener noreferrer"}
- Scan for security issues with [Checkov](https://www.checkov.io/){:target="_blank" rel="noopener noreferrer"}, [tfsec](https://aquasecurity.github.io/tfsec/){:target="_blank" rel="noopener noreferrer"}, or [Terrascan](https://runterrascan.io/){:target="_blank" rel="noopener noreferrer"}
- Check code formatting

**For CloudFormation:**
- Validate template syntax
- Lint templates with [cfn-lint](https://github.com/aws-cloudformation/cfn-lint){:target="_blank" rel="noopener noreferrer"}
- Scan for security issues with [cfn_nag](https://github.com/stelligent/cfn_nag){:target="_blank" rel="noopener noreferrer"}

### What Static Analysis Catches

- Syntax errors
- Deprecated syntax
- Security issues (open security groups, unencrypted storage)
- Best practice violations
- Policy compliance issues
- Resource naming violations

### CI/CD Integration

Run static analysis automatically on every commit or pull request:

**What to run:**
1. Format check (ensure consistent code style)
2. Syntax validation
3. Linting for best practices
4. Security scanning with multiple tools
5. Policy compliance checks

**When to run:**
- On every push to feature branches
- On every pull request
- Before merging to main branch
- Optionally as pre-commit hooks locally

**Fail builds** when critical issues are found (syntax errors, security violations, policy breaches).

---

## Unit Testing

**What it is:** Test individual modules in isolation by deploying them to a test environment and validating behavior.

### Testing Frameworks

**[Terratest](https://terratest.gruntwork.io/){:target="_blank" rel="noopener noreferrer"} (Go):**
- Framework for testing infrastructure code
- Deploy modules to real cloud environments
- Assert on outputs and resource properties
- Automatic cleanup after tests

**Python + Cloud SDKs:**
- Use pytest or unittest frameworks
- Deploy with subprocess calls to IaC tools
- Validate using cloud provider SDKs (boto3, Azure SDK, etc.)
- Test fixtures handle setup/teardown

**[Kitchen-Terraform](https://newcontext-oss.github.io/kitchen-terraform/){:target="_blank" rel="noopener noreferrer"}:**
- Test Kitchen integration for Terraform
- InSpec for validation
- Supports multiple platforms

### What Unit Tests Validate

- Module inputs and outputs work as expected
- Resources are created with correct configuration
- Dependencies between resources are properly defined
- Error handling behaves correctly
- Module reusability across different scenarios

---

## Integration Testing

**What it is:** Test complete infrastructure stacks in isolated environments to validate end-to-end functionality.

### Approach

1. **Deploy** infrastructure to dedicated test environment
2. **Validate** resources were created with correct configuration
3. **Test** connectivity, functionality, and interactions between components
4. **Cleanup** by destroying test infrastructure

### What to Test

**Resource verification:**
- All expected resources exist
- Resources have correct configuration
- Tags and metadata are applied properly

**Connectivity testing:**
- Network connectivity between components
- Security groups allow expected traffic
- DNS resolution works correctly

**Functionality testing:**
- Load balancers route traffic correctly
- Auto-scaling responds to triggers
- Databases accept connections
- Applications respond to requests

**Dependency validation:**
- Resources can find and connect to dependencies
- Service discovery mechanisms work
- Configuration values propagate correctly

### Testing Tools

**Script-based testing:**
- Shell scripts that deploy, test, and cleanup
- Use cloud provider CLIs to validate resources
- Curl or HTTP clients to test endpoints
- Custom validation logic

**Kitchen-Terraform:**
- Test Kitchen integration for Terraform
- Deploy and test in ephemeral environments
- InSpec-based validation
- Automatic cleanup

**Terratest:**
- Can also handle full stack integration tests
- Go-based test assertions
- Built-in retry and polling logic

---

## Compliance Testing

**What it is:** Validate infrastructure against organizational policies and regulatory requirements using policy-as-code.

### Policy-as-Code Tools

**[Open Policy Agent (OPA)](https://www.openpolicyagent.org/){:target="_blank" rel="noopener noreferrer"}:**
- General-purpose policy engine
- Rego policy language
- Validates Terraform plans, Kubernetes manifests, and more
- Open source and vendor-neutral

**[HashiCorp Sentinel](https://www.hashicorp.com/sentinel){:target="_blank" rel="noopener noreferrer"}:**
- Policy-as-code framework from HashiCorp
- Integrates with Terraform Cloud/Enterprise
- Enforce policies before infrastructure changes apply
- Supports advisory, soft mandatory, and hard mandatory enforcement levels

**[Cloud Custodian](https://cloudcustodian.io/){:target="_blank" rel="noopener noreferrer"}:**
- Cloud governance and compliance tool
- YAML-based policy definitions
- Real-time compliance enforcement
- Automated remediation actions

**[Conftest](https://www.conftest.dev/){:target="_blank" rel="noopener noreferrer"}:**
- Test structured configuration files
- Uses OPA/Rego for policies
- Works with Terraform, Kubernetes, Dockerfiles, and more

### What Compliance Tests Validate

**Security policies:**
- Encryption requirements (at rest and in transit)
- Network exposure (no 0.0.0.0/0 on sensitive ports)
- IAM permissions follow least privilege
- Secrets management requirements

**Compliance requirements:**
- HIPAA, PCI-DSS, SOC 2, ISO 27001 controls
- Data residency requirements
- Audit logging enabled
- Backup and retention policies

**Organizational standards:**
- Naming conventions
- Required tagging (environment, cost center, owner)
- Cost controls and budget limits
- Approved resource types and sizes

---

## Testing Strategy

### Pre-Commit (Local Development)

Run fast checks before committing code:
- Format code to ensure consistency
- Validate syntax
- Run linting tools
- Quick security scans

**Optionally enforce with Git hooks** to prevent committing non-compliant code.

### Pull Request (Continuous Integration)

Automated testing on every PR:

**Static analysis:**
- Format checking
- Syntax validation
- Linting
- Security scanning (multiple tools)
- Policy compliance checks

**Unit tests:**
- Test individual modules
- Validate inputs/outputs
- Check resource configuration

**Planning:**
- Generate plan for review
- Show what will change
- Estimate cost impact

**Results:**
- Comment plan output on PR
- Block merge if critical issues found
- Require manual review for policy violations

### Pre-Merge (Integration Testing)

After PR approval, before merging:
- Deploy to ephemeral test environment
- Run full integration test suite
- Validate end-to-end functionality
- Cleanup test environment
- Only merge if all tests pass

### Pre-Production (Staging Validation)

Deploy to staging environment:
- Smoke tests (basic functionality works)
- Performance validation (meets SLAs)
- Security validation (no new vulnerabilities)
- Manual review and approval
- Soak testing (run for hours/days)

### Production Deployment

Safe rollout to production:
- Gradual rollout (canary, blue-green)
- Continuous monitoring and alerting
- Automated health checks
- Automated rollback on failure
- Post-deployment validation

---

