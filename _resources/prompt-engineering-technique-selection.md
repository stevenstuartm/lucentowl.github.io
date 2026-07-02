---
title: "Prompt Engineering Technique Selection Guide"
layout: resource
type: reference
category: "AI & Machine Learning"
description: "Prompting technique definitions, a task-to-technique selection table, and common pitfalls to avoid."
last_updated: 2026-07-02
tags: [ai, generative-ai, llm, prompt-engineering, decision-making]
related_guides:
  - /study-guides/ai/prompt-engineering.html
---

## Technique Reference

| Technique | Definition | When to Use |
| --- | --- | --- |
| Zero-shot | Clear, direct instructions with no examples | Simple, well-defined tasks where the model has strong baseline knowledge |
| Few-shot | Examples included in the prompt to guide format, tone, or style | Tasks requiring specific formatting or evaluation criteria not obvious from instructions alone |
| Chain-of-Thought (CoT) | Model articulates its reasoning step-by-step along a single path | Math problems, logical reasoning, multi-step analysis, debugging |
| Tree-of-Thought (ToT) | Model explores multiple reasoning paths in parallel, evaluates each, and can backtrack from dead ends | Planning problems, creative tasks with competing constraints, comparing alternatives |
| Persona-based | Assigns a role to shape vocabulary, depth, and assumed audience knowledge | Domain expertise, audience-specific explanations |
| Task decomposition | Breaks a complex task into smaller, ordered subtasks | Any task difficult to accomplish well in a single prompt |
| Self-consistency | Samples multiple outputs or reasoning paths and selects the most common answer | High-stakes decisions, complex reasoning where a single response might be wrong |
| Prompt scaffolding | Wraps user input in a structured template with explicit constraints | Defending against adversarial or off-topic input |

## Task Type to Technique

| Task Type | Recommended Technique |
| --- | --- |
| Simple, well-defined | Zero-shot with clear instructions |
| Specific format or style | Few-shot with examples |
| Complex reasoning | Chain-of-thought |
| Multiple valid approaches | Tree-of-thought |
| Domain expertise | Persona-based + RAG |
| Multi-step workflow | Task decomposition |
| High-stakes decisions | Self-consistency |

## Common Pitfalls

| Pitfall | Solution |
| --- | --- |
| Vague instructions | Be explicit about what you want |
| Too many constraints | Prioritize the most important requirements |
| No examples for complex formats | Add 2-3 diverse examples |
| Assuming model knowledge | Provide necessary context |
| Single-shot for complex tasks | Break into steps or use chain-of-thought |
