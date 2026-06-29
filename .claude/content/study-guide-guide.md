# Study Guide Guide

This guide covers format requirements, tagging, organization, and quality standards for study guides. Always also read [writing-standards.md](writing-standards.md) — the universal rules apply to all guide content.

---

## Format Requirements

**File location**: Place in `_guides/` organized by category subdirectory (e.g., `_guides/architecture/`, `_guides/dsa/`).

**Required front matter**:
```yaml
---
title: "Guide Title"
layout: guide
category: Main Category
subcategory: Subcategory
description: "Brief description of the guide content"
tags: [tag1, tag2, tag3, tag4]
---
```

**Important**: Tables in Markdown must have a blank line before them to render correctly in Jekyll/Kramdown.

---

## CRITICAL: Update the Configuration File

When adding or removing study guide files, ALWAYS update `assets/data/study_guides_config.json`. This file controls which guides appear on the study guides listing page. A guide that exists in `_guides/` but isn't listed in this file will not be discoverable on the website.

**Standard procedure for adding a new study guide**:
1. Create the markdown file in `_guides/` (organized by category subdirectory)
2. Include proper YAML front matter with category, subcategory, description, and tags
3. **Immediately update** `assets/data/study_guides_config.json`:
   - Add new subcategory if needed (with name and description)
   - Add the guide filename to the appropriate subcategory's `guides` array
4. Test locally to verify the guide appears on the study guides page

**Example configuration entry**:
```json
{
  "name": "Business & Economics",
  "description": "Cost analysis, ROI, and financial aspects of architecture",
  "guides": [
    "tco-roi.md"
  ]
}
```

Always modify both the guide file and the config file together.

---

## Tagging System

**CRITICAL**: All study guides must include 4-8 tags for discoverability and filtering.

**Tag format**:
- Lowercase, hyphenated (e.g., `decision-making`, `cost-analysis`)
- 4-8 tags per guide (target average: 5-6)
- Tags appear in YAML front matter as an array: `tags: [tag1, tag2, tag3]`

**Tag vocabulary**:

| Category | Tags |
| --- | --- |
| Core Disciplines | `architecture`, `algorithms`, `data-structures`, `security`, `design-patterns`, `distributed-systems`, `infrastructure`, `cloud-computing`, `databases`, `networking`, `testing`, `devops` |
| Skill Levels | `fundamentals`, `advanced`, `practical` |
| Application Contexts | `performance`, `scalability`, `reliability`, `maintainability`, `observability` |
| Specific Technologies | `aws`, `microservices`, `kubernetes`, `oop`, `functional-programming`, `cicd`, `terraform`, `cloudformation` |
| Business & Process | `cost-analysis`, `decision-making`, `governance`, `leadership`, `collaboration`, `sdlc`, `agile`, `modeling`, `threat-modeling` |
| Common Concepts | `statistics`, `analytics`, `hypothesis-testing`, `messaging`, `consistency`, `resilience`, `legacy-systems`, `modernization`, `risk-management`, `workflow`, `transactions`, `caching`, `rate-limiting`, `deployment`, `consensus`, `coordination`, `integration`, `automation`, `documentation`, `complexity-analysis` |

**Tagging guidelines**:
- Choose tags that reflect core concepts covered in the guide
- Include tags for related disciplines to enable cross-category discovery
- Add skill level tags (`fundamentals`, `advanced`, `practical`) to help users navigate learning paths
- Include technology-specific tags when applicable
- Prioritize tags that enable cross-cutting discovery (e.g., all guides about "decision-making" regardless of category)

**Standard procedure for tagging a new guide**:
1. Read the guide content to understand core concepts
2. Select 4-8 tags from the vocabulary above
3. Add the tags field to YAML front matter
4. Ensure tags align with similar guides in the same or related categories

**Example tags by guide type**:
- Architecture pattern guide: `architecture`, `design-patterns`, `distributed-systems`, `microservices`, `practical`
- DSA guide: `algorithms`, `data-structures`, `complexity-analysis`, `fundamentals`, `interview-prep`
- OOP guide: `oop`, `design-patterns`, `solid`, `maintainability`, `practical`
- Security guide: `security`, `threats`, `vulnerabilities`, `defense`, `practical`
- SDLC guide: `sdlc`, `methodology`, `collaboration`, `stakeholder-management`, `practical`

---

## Content Philosophy

**Focus on actionable knowledge over reference material**:
- Avoid generic "Further Reading" sections with book lists and external links
- Avoid template sections with fill-in-the-blank structures (readers can create their own)
- Avoid extensive checklists that become reference cards rather than learning material
- DO NOT add "Resources" sections unless explicitly requested by the user
- DO NOT add "Next Steps" sections — study guides should be self-contained
- Links to tools/frameworks should be inline where mentioned, not collected in a separate section

**Do include**:
- Core concepts, definitions, and formulas
- Decision frameworks and comparison models
- Real-world examples that demonstrate practical application
- Common pitfalls and how to avoid them
- Best practices derived from experience
- Key takeaways that summarize actionable insights
- Inline links using `{:target="_blank" rel="noopener noreferrer"}` for external resources when mentioned

Readers should learn things they didn't know and understand what they can do with that knowledge, without being overwhelmed by supplementary reference material. Study guides must be effective on their own.

---

## Content Quality Standards

**Explain before prescribing**:
- Always provide substantive explanations of what concepts, frameworks, and tools actually ARE before describing when/how to use them
- Don't jump straight to "When to use" without first explaining the fundamentals
- Readers need to understand the subject matter before they can make informed decisions about applying it
- When documenting a framework, explain its structure, components, and how it works BEFORE listing use cases

**Link inline, not in separate sections**:
- If you reference a specific tool, framework, organization, website, or resource in the content, provide an inline link where it's mentioned
- Use descriptive link text so readers know what they're clicking on
- Format: `[Tool Name](https://example.com){:target="_blank" rel="noopener noreferrer"}`
- Do NOT create separate "Resources" or "Further Reading" sections

**Concepts over code syntax**:
- Unless the guide's topic is directly coupled to code, remain conceptual
- Avoid CLI examples, API syntax, or implementation code that rapidly becomes outdated
- Focus on the WHY and WHEN, not the exact HOW
- Describe operations conceptually (e.g., "use the CLI to create a change set")
- Link to official documentation inline where relevant for current syntax
- Exception: Include code when the guide teaches coding concepts (algorithms, design patterns, language features)

---

## Architecture Terminology Standards

When writing about software architecture, use correct terminology:

**Architectural Characteristics (NOT "Non-Functional Requirements")**:
- Correct term: **Architectural Characteristics**
- Also acceptable: Quality attributes, "-ilities"
- ❌ Avoid: "Non-functional requirements" (outdated term)
- Reference: [Architecture Foundations](/study-guides/architecture/ArchitectureFoundations.html#architecture-characteristics)

**Selection process**:
1. Identify 7 characteristics critical to the project's success
2. Prioritize the top 3 — these drive architecture style selection
3. Use structured worksheets: [Developer to Architect Worksheets](https://developertoarchitect.com/downloads/worksheets.html){:target="_blank" rel="noopener noreferrer"}

**Characteristics must meet three criteria**:
- Specify non-domain consideration
- Influence structural design
- Be critical to success

**Common categories**:

| Category | Examples |
| --- | --- |
| Operational | Availability, Performance, Scalability, Reliability, Recoverability |
| Structural | Maintainability, Extensibility, Portability, Upgradeability |
| Cross-Cutting | Security, Privacy, Supportability, Accessibility |

**When writing AAA Phase 2 (Agree) content**:
- List "Architectural Characteristics" as the FIRST design decision
- Emphasize that the top 3 characteristics drive the architecture style choice
- Reference the worksheets for systematic evaluation
- Link to Architecture Foundations guide for detailed explanations

---

## Organization Patterns

**Existing category structure**:

| Category | Subcategories |
| --- | --- |
| Architecture | Foundations, Styles, Leadership, Design, Patterns, Data & Infrastructure, Business & Economics |
| Data Structures & Algorithms | Fundamentals, Linear Data Structures, Trees & Heaps, Graphs, Hash Tables & Algorithms |
| Object-Oriented Programming | OOP Foundations, Design Patterns |
| Security | Security Fundamentals, Threats & Defense, Application Security, Governance & Response |
| Software Development Lifecycle | SDLC & Modeling |
| AI & Machine Learning | Machine Learning |
| Data & Analytics | Analytics |
| Observability | Monitoring & Observability |
| Networking | Network Fundamentals |
| Web Development | SEO & Web |

**File organization conventions**:
- Architecture guides: `_guides/architecture/`
- DSA guides: `_guides/dsa/`
- OOP guides: `_guides/oop/`
- Security guides: `_guides/security/`
- SDLC guides: `_guides/sdlc/`
- AI & ML guides: `_guides/ai/`
- Top-level guides (observability, networking, etc.): `_guides/`

**When to create new subcategories**:
- Group related guides under a coherent theme
- Subcategory should have a clear, descriptive name and purpose
- Include a helpful description that explains the content scope
- Consider whether the subcategory will have multiple guides (avoid single-guide subcategories unless it's a starting point for planned expansion)
