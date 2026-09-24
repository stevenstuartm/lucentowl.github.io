# Infrastructure & Cloud Study Guides Refinement Plan

Tracks the consolidation and review-and-refine pass over the 9 guides in the "Infrastructure & Cloud" category of `assets/data/study_guides_config.json`, all at the top level of `_guides/infrastructure/`. The `aws/` and `azure/` subdirectories belong to the AWS and Azure categories and are out of scope, so measure and grep this pass from the config list rather than the directory.

Guides are consumed sequentially in config order. That order encodes the fundamentals-to-advanced learning path, so no guide should add its own prerequisite framing or cross-links to siblings in scope.

**The process rules live in [`.claude/content/guide-refinement-standard.md`](../.claude/content/guide-refinement-standard.md); the checklist and cross-domain gotchas live in [`.claude/content/study-guide-guide.md`](../.claude/content/study-guide-guide.md).** Read both first. This document carries only what is specific to this pass.

---

## Phase 0: Consolidation (complete)

Two subcategories, unchanged. Infrastructure as Code answers how to define and operate infrastructure through code; Cloud Operations answers how to release and recover what runs on it.

Order rationale: state management precedes implementation patterns because layering and cross-layer references depend on remote state. Governance closes IaC because it combines testing's pre-deploy policy checks with the runtime controls that follow deployment.

Rows 4, 5, 6, and 7 received sections moved wholesale in Phase 0. Expect seams: row 4 has env-lifecycle's layering (now `### Layering by Change Frequency`, a duplicate of its own layer list to reconcile) and a pasted `## Circular Dependency Resolution`; row 7 has implementation-patterns' guardrail section and Cloud Custodian, pasted above `## Automated Remediation`. Row 5's Key Takeaways still mention layering and circular dependencies.

## Topic ownership map

"Clause" means a non-owner defines the concept in a clause where it's used, or omits it, and doesn't link to the owner.

| Concept | Owner | Non-owners treat it as |
|---|---|---|
| Declarative vs imperative, idempotency, immutable infrastructure, drift as a concept | iac-fundamentals | all: clause |
| Secrets in templates (don't hardcode, resolve dynamically) | iac-fundamentals | general secrets management stays with `sdlc/devsecops.md` |
| Tool selection, including service-managed vs self-managed state as a factor | iac-tools-comparison | fundamentals, state-management: clause |
| State files, backends, locking, state secrets, import/moved/removed refactoring | iac-state-management | implementation-patterns, env-lifecycle: clause |
| Modules, layering, environment separation, repo ownership, circular dependencies, PR plan/apply workflow, GitOps | iac-implementation-patterns | env-lifecycle, state-management, testing: clause |
| Stable references via indirection, dev and ephemeral environment strategies | iac-environment-lifecycle | — |
| IaC test levels, static and security scanning, pre-deploy policy checks (OPA, Conftest, Guard, Checkov, Sentinel), which test runs at which stage | iac-testing | governance, implementation-patterns: clause; policy as code as a general practice stays with `sdlc/devsecops.md` |
| Control placement (preventive, detective, corrective), org guardrails, tagging strategy, drift response, exceptions | iac-governance | implementation-patterns, testing: clause; AWS and Azure service mechanics stay with `aws/aws-organizations-control-tower.md`, `aws/aws-cloudtrail-config.md`, `azure/azure-policy-governance.md` |
| Rolling, blue-green, canary, A/B, feature flags as release control | deployment-strategies | testing: clause; `architecture/legacy-modernization-strategies.md` keeps expand/contract (parallel change) |
| Chaos engineering | `architecture/testing-strategy-architecture.md` (out of scope) | deployment-strategies, disaster-recovery-patterns: clause |
| RTO/RPO, business impact analysis, the four DR strategies, testing recovery | disaster-recovery-patterns | `aws/disaster-recovery.md`, `azure/disaster-recovery-azure.md` keep platform implementation |

---

## Phase 1: Refinement

Per row: content items (1, 3, 7, and 2 against the ownership map), then the presentation pass, `/refine-prose`, and at most two independent review rounds with findings applied. Then Complete. Don't stop between rows. No Jekyll build.

### Closing the pass

After the last row, re-run the sibling-link grep over the in-scope files:

```bash
grep -nE '(\]\(|href=")/study-guides/infrastructure/[a-z-]+\.html' _guides/infrastructure/*.md
```

Then confirm no concept is re-taught against the ownership map, and add one What's New entry for the pass.

## Sources

- **Terraform:** developer.hashicorp.com (language, backends, CLI, `terraform test`, import/moved/removed blocks), the Terraform registry docs for provider resources.
- **OpenTofu:** opentofu.org docs.
- **Pulumi:** pulumi.com/docs.
- **AWS:** docs.aws.amazon.com for CloudFormation, CDK, Config, Organizations (SCPs, tag policies, RCPs), CloudFormation Hooks and Guard; the AWS whitepaper *Disaster Recovery of Workloads on AWS* for DR strategy definitions.
- **Azure:** learn.microsoft.com for ARM, Bicep, deployment stacks, Azure Policy.
- **GCP:** cloud.google.com docs for Deployment Manager and Infrastructure Manager.
- **Ansible, Chef, Puppet:** vendor docs.
- **Scanners:** Checkov, Trivy (tfsec's successor), cfn-lint, cfn_nag, KICS, OPA, Conftest project docs and repos.
- **GitOps:** opengitops.dev principles; Argo CD and Flux docs.
- **Deployment:** Kubernetes docs (Deployment strategies), Martin Fowler's bliki (BlueGreenDeployment, CanaryRelease, FeatureToggle), Argo Rollouts and Flagger docs.
- **DR:** NIST SP 800-34 for contingency planning terms, AWS DR whitepaper, Azure reliability docs.
- Off-limits: vendor marketing blogs as the sole source for a number; unsourced "typical" percentages.

## Domain notes

**Item 7 (hierarchy and scope clarity)** in this domain means the scope at which a control or artifact applies: a state file per root module/workspace, a stack per region and account, a policy at org root vs OU vs account (AWS) or management group vs subscription vs resource group (Azure), a lock per state object. State the scope where a guide introduces the thing.

**Item 9 (tag audit)** — measured across the 9 guides before the pass: `infrastructure` 9, `practical` 8, `iac` 7, `reliability` 2, `automation` 2, everything else 1. So for this category: drop `infrastructure` (restates the category). `iac` restates the subcategory in 7 of 7 IaC guides and carries no signal inside it; keep it only where cross-category discovery benefits (fundamentals) and replace elsewhere with specific nouns (terraform, opentofu, pulumi, cloudformation, policy-as-code, gitops). Drop non-signal tags `best-practices`, `reference`, `tools`, `comparison`, `lifecycle`, `validation`.

## Domain gotchas

*(Empty at the start.)*

## Cross-guide facts in force

Verified during earlier rows; applies to every remaining guide that touches the topic.

- **Refresh behavior by tool:** Terraform and OpenTofu refresh live state on every plan. Pulumi previews compare with last recorded state unless `--refresh`/`pulumi refresh`; default backend is Pulumi Cloud. CloudFormation change sets compare templates and ignore drift unless a drift-aware change set (`--deployment-mode REVERT_DRIFT`, Nov 2025) or drift detection is used. Bicep what-if reads live resources and has no state record.
- **ARM/Bicep deletion:** default incremental mode leaves resources removed from the template; complete mode deletes them but "will be gradually deprecated"; Microsoft recommends deployment stacks for deletes. ARM never replaces: changing location or type fails the deployment.
- **Replacement order:** Terraform/OpenTofu delete-then-create unless `create_before_destroy`; Pulumi create-first unless `deleteBeforeReplace`; CloudFormation create-first (custom-named resources cannot be replaced).
- **Deletion guards:** Terraform `prevent_destroy` stops protecting once the resource block is removed; Pulumi `protect` blocks deletion for any reason; CloudFormation `DeletionPolicy`/`UpdateReplacePolicy` (Retain, Snapshot); Azure resource locks.
- **Terraform secrets:** `sensitive` values are still written to state and saved plan files; ephemeral values (1.10+) and write-only arguments (1.11+) keep values out of both.
- **Drift example trap:** hand-added security group rules are only visible to Terraform when rules are inline on `aws_security_group`; the provider recommends separate `aws_vpc_security_group_ingress_rule` resources, under which a console-added rule is invisible.
- **Tool landscape (Sep 2026):** HCP Terraform (formerly Terraform Cloud, renamed Apr 2024); Terraform BSL since Aug 2023, HashiCorp part of IBM; OpenTofu MPL 2.0, CNCF sandbox Apr 2025, state encryption since 1.7; CDKTF archived Dec 2025; GCP Deployment Manager out of support 2026, shutdown mid-2027, Infrastructure Manager runs Terraform up to 1.5.7; Pulumi runs HCL (GA 2026) and Pulumi Cloud hosts Terraform/OpenTofu state; Terraform supports bulk import (`terraform query`, `-generate-config-out`); CloudFormation bills only third-party types and custom hooks.
- **State locking:** S3 backend locks with `use_lockfile` (GA in Terraform 1.11); `dynamodb_table` is deprecated and slated for removal. azurerm and gcs lock natively. Pulumi self-managed backends lock by default. Any S3 backend example should use `use_lockfile`.
- **State refactoring:** `moved` (1.1), `import` (1.5), `removed` (1.7). A bare `removed` block destroys in Terraform (`destroy` defaults true) but only forgets in OpenTofu. `-generate-config-out` is still marked experimental. Terraform backend blocks can't use variables; OpenTofu's can if resolvable at init.
- **GitOps:** OpenGitOps's four principles are declarative, versioned and immutable, pulled automatically, continuously reconciled. CI pipelines and Atlantis are push-based, not GitOps by that definition. Argo CD corrects manual changes only with automated sync plus `selfHeal`; Flux Kustomizations re-apply every interval. With Crossplane/ACK/ASO the operator, not the GitOps agent, holds cloud credentials.
- **Delivery workflow:** Terraform refuses a stale saved plan; passing a saved plan to apply counts as approval. HCP Terraform runs speculative (unappliable) plans on PRs and a merge run waits for confirmation unless auto-apply. Atlantis locks dir+workspace from plan until merge/close and applies before merge. Plans run provider code with pipeline credentials, so fork PRs are a credential risk.
- **Modules and environments:** `version` is registry-only (Git sources pin by `ref`); the lock file covers providers only and should be committed. HashiCorp: no thin single-resource wrappers, keep the module tree flat. CLI workspaces share one backend and credentials, so HashiCorp calls them unsuitable for isolating environments.
- **Recreated identifiers:** an RDS endpoint is the same after delete-and-recreate with the same identifier (only the generated DNS names and IDs change: ELB DNS names, instance/SG/VPC IDs, ALB and Secrets Manager ARNs carry generated suffixes). S3 names are unique per partition; S3's account regional namespace (`<prefix>-<account>-<region>-an`) is AWS's recommended alternative to random suffixes.
- **Teardown:** `force_destroy`, `skip_final_snapshot`, and deletion protection must be applied into state before a destroy honours them. A stopped RDS instance auto-starts after 7 days.
- **Figures:** this category's figures use the `infra-` id prefix and belong to `_resources/infrastructure-diagrams.md`.

## Open pre-flags

Leads for rows not yet done. **A pre-flag is a lead, not a finding** — re-verify before acting. Delete the entry once its row is complete.

| Target row | Lead |
|---|---|
| 6 iac-testing | 70/20/9/1 pyramid split looks invented; "unit tests" defined as deploying to cloud; `terraform test` (native) absent; tfsec merged into Trivy; kitchen-terraform and Terrascan status |
| 7 iac-governance | `ICloudFormationHook`/`HookResponse` C# look invented; `AWSSamples::RequireTags::Hook` type; "resources created without required tags are tagged automatically or blocked" by tag policies; CIS v1.2.0 labelled as Foundational Security Best Practices; stack-termination-protection rule uses notification-check identifier |
| 8 deployment-strategies | "Blue-green is the only strategy that truly guarantees zero downtime"; resource `_resources/deployment-strategy-comparison.md` has `category: "Infrastructure"`, which matches no config category |
| 9 disaster-recovery-patterns | RTO/RPO ranges per strategy don't match the AWS DR whitepaper; "Multi-Site Hot-Site" naming |

## Unverified, left standing

Claims on finished guides that could not be confirmed against a source. Each was softened rather than asserted; revisit if a source turns up.

*(Empty at the start.)*

## Progress

| # | Subcategory | Guide | Status |
|---|---|---|---|
| 1 | Infrastructure as Code | iac-fundamentals.md | Complete |
| 2 | Infrastructure as Code | iac-tools-comparison.md | Complete |
| 3 | Infrastructure as Code | iac-state-management.md | Complete |
| 4 | Infrastructure as Code | iac-implementation-patterns.md | Complete |
| 5 | Infrastructure as Code | iac-environment-lifecycle.md | Complete |
| 6 | Infrastructure as Code | iac-testing.md | In progress |
| 7 | Infrastructure as Code | iac-governance.md | Not started |
| 8 | Cloud Operations | deployment-strategies.md | Not started |
| 9 | Cloud Operations | disaster-recovery-patterns.md | Not started |
