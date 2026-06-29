---
title: "Architecture Governance Frameworks"
layout: guide
category: Architecture
subcategory: Leadership & Governance
description: "Enterprise architecture frameworks and governance approaches - when to use them and why"
tags: [architecture, governance, frameworks, leadership, compliance, standards]
---

## Choosing a Governance Approach

<blockquote class="pull-quote">
<p>Choose based on organization size, complexity, and regulatory requirements, not on what seems comprehensive or impressive.</p>
</blockquote>

Before selecting a framework, understand your governance needs based on organization characteristics.

### Decision Matrix

| Organization Size | Complexity | Regulatory Requirements | Recommended Framework |
|-------------------|------------|-------------------------|-----------------------|
| < 50 engineers | Single product | Low | Lightweight: AWS Well-Architected Framework |
| 50-200 engineers | Multiple products | Medium | Moderate: Well-Architected + ADR process |
| 200+ engineers | Many products/platforms | High | Comprehensive: TOGAF or enterprise framework |
| Any size | Simple apps | High (regulated) | Compliance-focused: Industry-specific framework |

### Key Questions to Ask

**1. What problem are we trying to solve?**

| Problem | Solution |
|---------|----------|
| Inconsistent architecture across teams | Framework with architecture principles and review processes |
| Slow decision-making | Lightweight decision-making framework (ADRs, Well-Architected) |
| Enterprise transformation | Comprehensive framework like TOGAF |
| Multi-cloud strategy | Cloud-agnostic framework or hybrid approach |

**2. What's our current maturity level?**
- **Ad-hoc (Level 1):** Start with AWS Well-Architected Framework and basic review processes
- **Managed (Level 2):** Add formal architecture review boards and decision records
- **Defined (Level 3):** Implement comprehensive framework with defined processes
- **Optimized (Level 4):** Fine-tune framework to organizational needs

<div class="callout callout--tip">
<p class="callout__title">Key Question: What Can We Maintain?</p>
<p>Frameworks require ongoing commitment and cultural adoption. Start small and expand based on demonstrated value. Heavy frameworks like TOGAF need dedicated enterprise architects.</p>
</div>

## Enterprise Architecture Frameworks

### AWS Well-Architected Framework

**What it is:**

AWS Well-Architected Framework is a cloud architecture review methodology built around six foundational pillars:

1. **Operational Excellence:** Running and monitoring systems to deliver business value, continuously improving processes
2. **Security:** Protecting information, systems, and assets through risk assessments and mitigation strategies
3. **Reliability:** Ensuring workloads perform intended functions correctly and consistently, recovering from failures
4. **Performance Efficiency:** Using computing resources efficiently to meet requirements and maintain efficiency as demand changes
5. **Cost Optimization:** Running systems to deliver business value at the lowest price point
6. **Sustainability:** Minimizing environmental impact of cloud workloads

Each pillar contains design principles, best practices, and specific questions to evaluate architectures. The framework includes:
- **Well-Architected Review Tool:** Interactive questionnaire that produces risk assessments and improvement plans
- **Lenses:** Specialized guidance for specific workloads (SaaS, Serverless, Machine Learning, etc.)
- **Pillars Whitepaper:** Detailed documentation of best practices and implementation patterns

The framework operates through iterative review cycles where teams assess current state, identify high-risk areas, and create improvement plans prioritized by business impact.

<div class="comparison">
<div class="content-card content-card--accent">
<h4>When to Use AWS Well-Architected</h4>
<ul>
<li>Building on AWS (any organization size)</li>
<li>Need objective architecture review criteria</li>
<li>Want lightweight process without heavy docs</li>
<li>Conducting quarterly architecture reviews</li>
<li>Starting governance journey</li>
</ul>
</div>
<div class="content-card content-card--accent-secondary">
<h4>When NOT to Use</h4>
<ul>
<li>Need enterprise-wide governance across multiple clouds</li>
<li>Require formal methodology like TOGAF for regulatory compliance</li>
<li>Systems are primarily on-premises</li>
<li>Non-AWS cloud providers</li>
</ul>
</div>
</div>

**Why it works:**
- Free and AWS-supported with extensive documentation
- Built-in review tool provides actionable recommendations
- Custom lenses available for specific workloads (SaaS, serverless, etc.)
- Practical and focused on real issues, not abstract principles

**How to implement:**
1. Conduct initial Well-Architected Review using AWS tool
2. Use pillars as ARB review checklist
3. Create quarterly review cadence
4. Track improvement over time

**Example decision:** Use Well-Architected Review scores to prioritize technical debt remediation. Systems below 70% compliance get mandatory improvement plans.

**Resources:**
- [AWS Well-Architected Framework Homepage](https://aws.amazon.com/architecture/well-architected/){:target="_blank" rel="noopener noreferrer"}
- [Well-Architected Tool (AWS Console)](https://console.aws.amazon.com/wellarchitected/){:target="_blank" rel="noopener noreferrer"}
- [Framework Whitepapers (All Pillars)](https://aws.amazon.com/architecture/well-architected/#Whitepapers){:target="_blank" rel="noopener noreferrer"}
- [Well-Architected Lenses](https://aws.amazon.com/architecture/well-architected/#AWS_Well-Architected_Lenses){:target="_blank" rel="noopener noreferrer"}
- [AWS Architecture Center](https://aws.amazon.com/architecture/){:target="_blank" rel="noopener noreferrer"}

### TOGAF

**What it is:**

The Open Group Architecture Framework (TOGAF) is a comprehensive enterprise architecture framework centered on the Architecture Development Method (ADM), an eight-phase iterative process:

**ADM Phases:**
1. **Preliminary Phase:** Establish architecture capability, define principles, and secure stakeholder buy-in
2. **Phase A (Architecture Vision):** Define scope, identify stakeholders, create high-level vision
3. **Phase B (Business Architecture):** Document business strategy, governance, organization, and key business processes
4. **Phase C (Information Systems Architecture):** Define data architecture and application architecture
5. **Phase D (Technology Architecture):** Define technology infrastructure supporting applications and data
6. **Phase E (Opportunities & Solutions):** Identify delivery vehicles, transition architectures, and implementation approach
7. **Phase F (Migration Planning):** Finalize detailed implementation and migration plan with priorities and costs
8. **Phase G (Implementation Governance):** Provide architectural oversight during implementation
9. **Phase H (Architecture Change Management):** Establish procedures for managing changes to the architecture

**Key TOGAF Components:**

- **Enterprise Continuum:** Classification system ranging from generic Foundation Architectures to organization-specific architectures
- **Architecture Repository:** Structured approach for storing architecture assets including reference models, standards, and governance logs
- **Architecture Content Framework:** Detailed metamodel defining architecture artifacts (catalogs, matrices, diagrams)
- **Architecture Capability Framework:** Guidance on establishing and operating an architecture function

TOGAF emphasizes stakeholder management, requirements management (continuous throughout all phases), and aligning IT architecture with business strategy. It's methodology-heavy, document-intensive, and designed for large-scale enterprise transformation initiatives.

**When to use:**
- Large enterprise (500+ engineers) undergoing transformation
- Regulated industry requiring formal documentation
- Multi-year initiatives needing stakeholder alignment
- Need to align IT strategy with business strategy

**When NOT to use:**
- Small/medium organizations (too heavy)
- Agile teams moving quickly (process overhead)
- Primarily tactical governance needs
- Organization lacks dedicated enterprise architects

**Why it works (when appropriate):**
- Provides common language across large organizations
- Comprehensive coverage of enterprise concerns
- Well-established with training and certifications
- Addresses both technical and business architecture

<div class="callout callout--warning">
<p class="callout__title">Common Mistake</p>
<p>Implementing TOGAF by-the-book creates bureaucracy. Adapt it to your culture and needs. Don't try to use all phases; focus on phases B-D (architecture definition) and H (change management) for governance.</p>
</div>

**How to implement:**
1. Train enterprise architecture team on TOGAF
2. Adapt ADM phases to organization needs (don't follow blindly)
3. Focus on phases B-D (architecture definition) and H (change management) for governance
4. Use TOGAF artifacts as templates, not mandates

**Resources:**
- [The Open Group - TOGAF Standard](https://www.opengroup.org/togaf){:target="_blank" rel="noopener noreferrer"}
- [TOGAF 9.2 Documentation](https://pubs.opengroup.org/architecture/togaf9-doc/arch/){:target="_blank" rel="noopener noreferrer"}
- [TOGAF Certification Program](https://www.opengroup.org/certifications/togaf){:target="_blank" rel="noopener noreferrer"}
- [ArchiMate Modeling Language](https://www.opengroup.org/archimate-forum/archimate-overview){:target="_blank" rel="noopener noreferrer"} (commonly used with TOGAF)
- [TOGAF Library (Members)](https://www.opengroup.org/togaf-library){:target="_blank" rel="noopener noreferrer"}

### Zachman Framework

**What it is:**

The Zachman Framework is an enterprise architecture ontology, a classification scheme for organizing architecture artifacts into a structured taxonomy. It's represented as a 6x6 matrix (36 cells) defining the intersection of:

**Interrogatives (Columns):**
1. **What (Data):** What data/information the enterprise uses
2. **How (Function):** How the enterprise operates (processes, functions)
3. **Where (Network):** Where the enterprise operates (locations, connectivity)
4. **Who (People):** Who operates the enterprise (roles, organizations)
5. **When (Time):** When operations occur (schedules, events, cycles)
6. **Why (Motivation):** Why the enterprise operates (goals, strategies, rules)

**Perspectives (Rows):**
1. **Executive Perspective (Contextual):** Scope and context, business concepts
2. **Business Management Perspective (Conceptual):** Business model, semantic models
3. **Architect Perspective (Logical):** System logic, architectural representations
4. **Engineer Perspective (Physical):** Technology models, detailed specifications
5. **Technician Perspective (Component):** Component assemblies, out-of-context specifications
6. **User Perspective (Operations):** Functioning enterprise, operational instances

**Key Characteristics:**

- **Not a methodology:** Zachman provides no guidance on *how* to create architecture—only *what* architecture artifacts should exist
- **Framework-agnostic:** Can be used alongside TOGAF, Agile, or any other methodology
- **Comprehensive taxonomy:** Every aspect of enterprise architecture has a defined place in the matrix
- **Cell independence:** Each cell represents a unique, atomic view with specific deliverables (though cells are related)

Example cell: "What (Data) × Executive (Contextual)" = list of important business entities; "What (Data) × Engineer (Physical)" = physical data model with tables and relationships.

The framework helps identify gaps in enterprise documentation, ensures comprehensive coverage, and provides common vocabulary across stakeholder groups.

**When to use:**
- Need comprehensive enterprise taxonomy
- Multiple frameworks in use and need integration model
- Large enterprise requiring common vocabulary
- Documentation-heavy regulated environments

**When NOT to use:**
- Need implementation guidance (Zachman is taxonomy, not methodology)
- Small to medium organizations (too comprehensive)
- Agile environments needing rapid adaptation
- Organizations without dedicated EA team

**Why it works (when appropriate):**
- Provides complete enterprise view across all perspectives
- Framework-agnostic (can integrate with TOGAF, Agile, etc.)
- Helps identify gaps in enterprise architecture documentation
- Common language across stakeholders

<div class="callout callout--warning">
<p class="callout__title">Common Mistake</p>
<p>Treating Zachman as implementation methodology. It's a taxonomy for organizing architecture artifacts, not a process for creating them. Use it to classify and organize, not to guide development.</p>
</div>

**How to implement:**
- Use as classification system for existing artifacts
- Don't try to fill every cell in the matrix
- Focus on perspectives relevant to your organization
- Combine with methodologies like TOGAF for process guidance

**Resources:**
- [Zachman International - Official Site](https://www.zachman.com/){:target="_blank" rel="noopener noreferrer"}
- [Zachman Framework Overview](https://www.zachman.com/about-the-zachman-framework){:target="_blank" rel="noopener noreferrer"}
- [Enterprise Architecture Body of Knowledge (EABOK)](https://www.zachman.com/ea-books-by-john-zachman){:target="_blank" rel="noopener noreferrer"} - John Zachman's books
- [Zachman Framework Evolution (PDF)](https://www.zachman.com/images/ZI_PIcs/ZF3.0.pdf){:target="_blank" rel="noopener noreferrer"}

### Other Notable Frameworks

**COBIT (Control Objectives for Information and Related Technology):**
- Focus: IT governance and management
- Best for: Audit, compliance, and IT risk management
- Use when: Need to align IT with business objectives and manage IT risk
- Resources: [ISACA COBIT Framework](https://www.isaca.org/resources/cobit){:target="_blank" rel="noopener noreferrer"}

**ITIL (Information Technology Infrastructure Library):**
- Focus: IT service management
- Best for: Operations and service delivery
- Use when: Need to improve IT service quality and efficiency
- Resources: [Axelos ITIL](https://www.axelos.com/certifications/itil-service-management){:target="_blank" rel="noopener noreferrer"}

**DoDAF (Department of Defense Architecture Framework):**
- Focus: Military and government systems
- Best for: Complex system-of-systems architectures
- Use when: Working on defense or government projects
- Resources: [DoD Architecture Framework](https://dodcio.defense.gov/Library/DoD-Architecture-Framework/){:target="_blank" rel="noopener noreferrer"}

## Key Takeaways

**Framework selection principles:**
- Choose based on organization size, complexity, and regulatory requirements
- Lightweight frameworks (AWS Well-Architected) work for most organizations
- Comprehensive frameworks (TOGAF, Zachman) require dedicated EA teams
- Don't implement frameworks by-the-book - adapt to your needs

**AWS Well-Architected Framework:**
- Best starting point for AWS-based organizations
- Free, practical, and widely adopted
- Six pillars provide comprehensive review criteria
- Use for quarterly architecture reviews and ARB processes
- Custom lenses available for specialized workloads

**TOGAF:**
- Comprehensive methodology for large enterprises
- 8-phase ADM provides structured approach
- Requires significant commitment and training
- Adapt to organizational culture, don't follow rigidly
- Focus on architecture definition and change management phases

**Zachman Framework:**
- Taxonomy for organizing architecture artifacts, not a methodology
- 6x6 matrix provides comprehensive enterprise view
- Framework-agnostic - can integrate with other approaches
- Use to identify gaps and create common vocabulary
- Don't try to fill every cell - focus on relevant perspectives

**Common mistakes to avoid:**
- Implementing heavy frameworks in small/medium organizations
- Following frameworks rigidly without adaptation
- Treating taxonomies (Zachman) as methodologies
- Choosing frameworks before understanding problems
- Lacking dedicated resources to maintain framework adoption

**Success factors:**
- Start with lightweight frameworks and expand as needed
- Secure executive sponsorship and dedicated resources
- Adapt frameworks to organizational culture and maturity
- Focus on providing value, not achieving compliance
- Integrate framework reviews into existing processes
- Track improvements over time to demonstrate ROI
