---
title: "CI/CD: Continuous Integration and Continuous Delivery"
layout: guide
category: Software Development Lifecycle
subcategory: DevOps & Delivery
description: "How a change gets from commit to production automatically and safely: what CI and CD actually require, pipeline stages and design principles, where each class of test belongs, and the four properties that decide whether a team trusts its pipeline."
tags: [practical, cicd, continuous-integration, continuous-delivery, pipelines, deployment, testing]
---
{% raw %}

## What is CI/CD

**CI/CD** is a set of practices that automate the integration, testing, and delivery of software changes, enabling teams to ship code faster, more reliably, and with higher quality.

<blockquote class="pull-quote">
<p>The goal of CI/CD is to make deployments boring: routine, repeatable, and reliable.</p>
</blockquote>

### Core Components

**Continuous Integration (CI):**
The practice of frequently merging code changes into a shared repository, with automated builds and tests to catch integration issues early.

**Continuous Delivery (CD):**
The practice of automatically preparing code for release to production, ensuring it's always in a deployable state.

**Continuous Deployment:**
An extension of continuous delivery where every change that passes automated tests is automatically deployed to production.

### Why CI/CD Matters

**Speed and Frequency:**
- Deploy multiple times per day instead of monthly or quarterly
- Reduce time from code commit to production from weeks to hours
- Enable faster feedback loops and iteration

**Quality and Reliability:**
- Catch bugs earlier through automated testing
- Reduce manual errors through automation
- Ensure consistent build and deployment processes
- Enable quick rollbacks when issues occur

**Developer Productivity:**
- Eliminate repetitive manual tasks
- Reduce context switching and deployment friction
- Provide fast feedback on code quality
- Allow developers to focus on building features

**Business Value:**
- Faster time to market for features
- Reduced risk of large, complex releases
- Better responsiveness to market changes
- Lower operational costs through automation

---

## CI/CD and Technical Agreement

A pipeline is a set of agreements written down in a form that executes. That framing explains what a failing build actually tells you.

<blockquote class="pull-quote">
<p>Tests are agreements encoded as executable specifications. When a test fails, an agreement was broken.</p>
</blockquote>

Each stage checks a different kind of agreement. Unit tests check that a component behaves the way its author said it would. Integration tests check that two components still agree about the contract between them. Contract tests check that a service and its consumers agree about an interface neither one owns alone. Security and quality gates check that the code meets standards the team agreed to before any of it was written.

This changes the useful question after a red build. "How do I make it pass" treats the check as an obstacle. "Which agreement broke" treats it as information, and the answer is often about people rather than code. A merge conflict in a file two people rewrote in the same week means they were not aligned on concurrent work. An integration test failing on a contract nobody changed means the contract was never genuinely agreed, only assumed.

---

## Continuous Integration (CI)

**Continuous Integration** is the practice of automatically building and testing code every time a team member commits changes to version control.

### Core CI Principles

**1. Maintain a Single Source Repository**
- All code lives in version control (Git, etc.)
- Include build scripts, tests, and configuration
- Never rely on code that exists only on developer machines

**2. Automate the Build**
- Build should run with a single command
- No manual steps required
- Reproducible on any machine

**3. Make Your Build Self-Testing**
- Automated tests run as part of the build
- Build fails if tests fail
- Tests must be fast enough to run frequently

**4. Everyone Commits to Mainline Every Day**
- Small, frequent commits reduce integration risk
- Keeps branches short-lived (feature flags for incomplete work)
- Reduces merge conflicts and integration hell

**5. Every Commit Triggers a Build**
- Automated build and test on every commit
- Fast feedback to developers (< 10 minutes ideal)
- Clear pass/fail status

**6. Keep the Build Fast**
- Optimize test suite for speed
- Use test parallelization
- Consider splitting into fast and slow test suites

**7. Test in a Clone of Production**
- Build and test in environment matching production
- Use containers or infrastructure-as-code for consistency
- Avoid "works on my machine" problems

**8. Make it Easy to Get Latest Deliverables**
- Latest build artifacts readily available
- Clear versioning and tagging
- Artifact repository for binaries

**9. Everyone Can See Results**
- Build status visible to entire team
- Radiator/dashboard showing build health
- Notifications for failures

**10. Automate Deployment**
- Push-button or automated deployment
- Same deployment process for all environments
- Deployment is part of the CI process

### CI Workflow

```
Developer commits code
       ↓
Trigger CI pipeline
       ↓
Checkout code
       ↓
Install dependencies
       ↓
Build application
       ↓
Run automated tests
       ├─ Unit tests
       ├─ Integration tests
       └─ Linting/static analysis
       ↓
Generate build artifacts
       ↓
Report results to team
```

### Benefits of CI

**Early Bug Detection:**
- Find integration issues within hours, not weeks
- Easier to debug (fewer changes to investigate)
- Cheaper to fix (developer context still fresh)

**Reduced Integration Risk:**
- Small, frequent integrations are less risky than big bang merges
- Merge conflicts caught and resolved quickly
- Always have a working build

**Higher Code Quality:**
- Automated testing enforces quality gates
- Code review integrated into workflow
- Static analysis catches issues automatically

**Better Collaboration:**
- Shared responsibility for build health
- Transparency around code quality
- Faster feedback cycles

---

## Continuous Delivery and Deployment

### Continuous Delivery

**Continuous Delivery** ensures code is always in a deployable state, with automated testing and deployment to staging environments. Deployment to production requires manual approval.

**Key characteristics:**
- Every change passes automated tests
- Code can be deployed to production at any time
- Deployment is a business decision, not a technical constraint
- Manual approval gate before production

**Workflow:**
```
Code commit → CI build → Deploy to staging → Automated tests → Ready for production
                                                                          ↓
                                                                  Manual approval
                                                                          ↓
                                                                Deploy to production
```

### Continuous Deployment

**Continuous Deployment** takes continuous delivery one step further: every change that passes automated tests is automatically deployed to production without manual intervention.

**Key characteristics:**
- Fully automated pipeline from commit to production
- No manual approval gates
- Requires high confidence in automated testing
- Fast feedback from real users

**Workflow:**
```
Code commit → CI build → Automated tests → Deploy to staging → More tests → Auto-deploy to production
```

### CD vs. Continuous Deployment

<div class="comparison">
<div class="content-card content-card--accent">
<h4>Continuous Delivery</h4>
<ul>
<li>Manual approval required for production</li>
<li>Release frequency: as needed (on-demand)</li>
<li>Lower risk tolerance with manual gate</li>
<li>Moderate feedback speed</li>
<li>Moderate maturity required</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>Continuous Deployment</h4>
<ul>
<li>Fully automated production deployment</li>
<li>Release frequency: every successful build</li>
<li>Higher risk tolerance required</li>
<li>Very fast feedback from real users</li>
<li>High maturity required</li>
</ul>
</div>
</div>

### Prerequisites for CD/Continuous Deployment

**Robust Automated Testing:**
- Comprehensive test suite covering critical paths
- High confidence in test accuracy (low false positives/negatives)
- Fast test execution

**Deployment Automation:**
- Infrastructure as Code (IaC)
- Automated provisioning and configuration
- Consistent deployment across environments

**Monitoring and Observability:**
- Real-time monitoring of application health
- Automated alerting on anomalies
- Fast rollback capabilities

**Feature Flags:**
- Decouple deployment from release
- Gradual rollouts and A/B testing
- Quick feature toggles for issues

**Culture of Quality:**
- Shared responsibility for production
- Blameless post-mortems
- Investment in testing and automation

---

## Pipeline Architecture

### Pipeline Stages

A typical CI/CD pipeline consists of multiple stages that code must pass through before reaching production.

**Stage 1: Source**
- Triggered by code commit or pull request
- Fetch code from version control
- Determine what changed

**Stage 2: Build**
- Compile code
- Resolve dependencies
- Create build artifacts
- Run fast validation checks

**Stage 3: Test**
- Unit tests
- Integration tests
- Static analysis and linting
- Code coverage analysis

**Stage 4: Security Scan**
- SAST (Static Application Security Testing)
- Dependency scanning (SCA)
- Secret detection
- License compliance checks

**Stage 5: Package**
- Create deployable artifacts
- Build container images
- Version and tag artifacts
- Push to artifact repository

**Stage 6: Deploy to Staging**
- Deploy to staging environment
- Run smoke tests
- Dynamic security testing (DAST)
- Performance testing

**Stage 7: Deploy to Production**
- Manual approval (Continuous Delivery) or automatic (Continuous Deployment)
- Deployment strategy (blue-green, canary, rolling)
- Production smoke tests
- Monitor for issues

**Stage 8: Post-Deployment**
- Verify deployment success
- Monitor application health
- Collect metrics
- Alert on anomalies

### Pipeline Design Principles

**1. Pipeline as Code**
- Store pipeline definitions in version control
- Use declarative configuration (YAML, JSON)
- Enable code review of pipeline changes
- Version and track pipeline evolution

**2. Fast Feedback**
- Run fastest tests first
- Fail fast on critical issues
- Provide clear error messages
- Notify developers immediately

**3. Idempotent and Reproducible**
- Same inputs produce same outputs
- No manual steps required
- Isolated from external state
- Use fixed versions for dependencies

**4. Environment Parity**
- Consistent environments across pipeline
- Use containers or IaC for reproducibility
- Minimize dev/prod differences

**5. Automated Rollback**
- Quick rollback mechanism
- Tested rollback procedures
- Preserve previous versions
- Automated health checks trigger rollback

**6. Security by Default**
- Security scanning integrated, not optional
- Fail builds on critical vulnerabilities
- Least privilege for pipeline permissions
- Audit all pipeline activities

### Pipeline Patterns

**Sequential Pipeline:**
```
Build → Test → Package → Deploy → Verify
```
- Simple and predictable
- Stages run one after another
- Easy to understand and debug

**Parallel Pipeline:**
```
        ├─ Unit Tests
Build ──├─ Integration Tests
        ├─ Security Scan
        └─ Linting
           ↓
        Package → Deploy
```
- Faster execution
- Independent stages run concurrently
- Requires more resources

**Fan-Out/Fan-In Pipeline:**
```
              ├─ Deploy to Region A
Package  ────├─ Deploy to Region B ───→ Aggregate Results → Verify
              └─ Deploy to Region C
```
- Deploy to multiple targets simultaneously
- Collect and aggregate results
- Useful for multi-region deployments

**Branch-Based Pipeline:**
```
Feature Branch → PR Pipeline (build, test, security scan)
       ↓
Main Branch → Full Pipeline (build, test, scan, deploy to staging)
       ↓
Release Tag → Production Pipeline (deploy to prod)
```
- Different pipeline behavior per branch
- More thorough validation on main branch
- Production deployments from release tags

---

## Automated Testing in Pipelines

### Where Each Test Type Belongs in the Pipeline

The testing pyramid describes the shape a test suite should have: many fast unit tests, fewer integration tests, and a small number of slow end-to-end tests. The proportions often quoted alongside it are a heuristic rather than a measured result, and the shape matters more than any particular split.

What a pipeline adds to that is placement. A test's speed and its blast radius decide which stage it belongs in, and getting this wrong is the most common reason pipelines become slow enough that people route around them.

| Test type | Typical duration | Where it runs | What blocks on it |
| --- | --- | --- | --- |
| Unit | Milliseconds | Every commit, before anything else | The build |
| Integration | Seconds | Every commit, after unit tests pass | The build |
| Contract | Seconds | Every commit for the providing service | The build, and the consumer's build |
| End-to-end | Minutes | After deployment to a test environment | Promotion, not the build |
| Performance | Minutes to hours | Scheduled, or before a release | A release decision, by human judgement |
| Security scanning | Varies by class | Several stages, each class where it can run | Depends on severity policy |

The ordering principle is to fail as early and as cheaply as possible. Anything that can run before a build should, anything that needs an artifact runs after it, and anything that needs a running system runs after deployment to somewhere that is not production.

The other rule is that only fast, reliable checks should gate a merge. A slow test in the commit stage is a tax on every change, and a flaky one in the commit stage teaches the team to re-run rather than to read.

### Test Types in CI/CD

**Unit Tests:**
- Run first in pipeline (fast feedback)
- Should complete in < 5 minutes
- High test coverage (80%+ is common)
- Mock external dependencies

**Integration Tests:**
- Test API contracts
- Database interactions
- Third-party service integrations (with mocking)
- Should complete in < 15 minutes

**Contract Tests:**
- Verify API contracts between services
- Producer and consumer tests
- Tools: Pact, Spring Cloud Contract
- Prevent breaking changes

**Smoke Tests:**
- Quick validation after deployment
- Test critical user paths
- Verify app is running and accessible
- Run in < 5 minutes

**Performance Tests:**
- Load testing
- Stress testing
- Benchmark comparisons
- Run on staging before production

**Security Tests:**
- Static analysis (SAST)
- Dynamic analysis (DAST)
- Dependency scanning (SCA)
- Penetration testing (periodic)

### Test Strategies

**Shift-Left Testing:**
- Run tests as early as possible
- Developers run tests locally before commit
- Fast feedback reduces context switching
- Catch issues before they reach CI

**Parallel Test Execution:**
- Split tests across multiple workers
- Dramatically reduce test execution time
- Tools: Pytest-xdist, Jest parallel, TestNG parallel

<div class="callout callout--warning">
<p class="callout__title">Flaky Test Management</p>
<ul>
<li><strong>Identify and quarantine</strong>: Track which tests fail intermittently</li>
<li><strong>Track trends</strong>: Monitor flaky test rates over time</li>
<li><strong>Fix or remove</strong>: Don't let flaky tests erode confidence</li>
<li><strong>Never ignore</strong>: Flaky tests lead to ignored test suites</li>
</ul>
</div>

**Test Data Management:**
- Use factories/fixtures for test data
- Database seeding for integration tests
- Isolate test data (separate DB per test run)
- Clean up after tests

---

## What Makes a Pipeline Trusted

A pipeline only does its job while people believe it. Everything above is in service of that, and the failures to watch for are the ones that erode belief rather than the ones that break the build.

**Speed.** A commit stage that takes longer than about ten minutes stops being feedback and becomes an interruption, and developers start batching changes to avoid it. Batching larger changes is precisely what continuous integration exists to prevent, so a slow pipeline undoes the practice it implements.

**Determinism.** A pipeline that fails intermittently teaches people to re-run it. Once re-running is the reflex, a genuine failure gets re-run too, and the pipeline has stopped catching anything. Treat flaky tests as outages rather than as annoyances.

**Reproducibility.** The artifact tested should be the artifact deployed. Rebuilding per environment means the thing verified is not the thing shipped, and the difference will eventually matter.

**Reversibility.** The value of deploying often comes from being able to undo it cheaply. A pipeline that can deploy in four minutes and needs two hours to roll back has automated the risky direction only.

A pipeline with those four properties is one teams will put their production changes through. Without them, the pipeline gets worked around, and the workarounds are where the incidents come from.

{% endraw %}
