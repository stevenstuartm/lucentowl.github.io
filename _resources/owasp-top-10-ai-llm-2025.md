---
title: "OWASP Top 10 for AI/LLM Applications (2025)"
layout: resource
type: reference
category: "Security"
description: "OWASP's top ten security risks specific to Large Language Model applications, with mitigation strategies for each."
last_updated: 2026-07-02
tags: [security, ai-security, owasp, threats, llm]
related_guides:
  - /study-guides/security/frameworks-standards.html
---

| Risk | Description | Mitigation Strategy |
| --- | --- | --- |
| LLM01: Prompt Injection | Manipulating model inputs to alter behavior | Input sanitization, prompt templates, output validation |
| LLM02: Sensitive Information Disclosure | Model leaks training data or secrets | Data sanitization, output filtering, access controls |
| LLM03: Supply Chain | Compromised training data/models | Vendor assessment, model verification, provenance tracking |
| LLM04: Data Poisoning | Malicious training data injection | Data validation, model monitoring, retraining controls |
| LLM05: Improper Output Handling | Unsafe output processing | Output encoding, validation, sandbox execution |
| LLM06: Excessive Agency | Over-privileged AI systems | Least privilege, approval workflows, scope limitations |
| LLM07: System Prompt Leakage | Exposing system instructions | Prompt protection, monitoring, access controls |
| LLM08: Vector Weaknesses | ML model vulnerabilities | Adversarial testing, input validation, model hardening |
| LLM09: Misinformation | AI-generated false information | Fact-checking, source attribution, confidence scoring |
| LLM10: Unbounded Consumption | Resource exhaustion | Rate limiting, cost controls, request validation |
