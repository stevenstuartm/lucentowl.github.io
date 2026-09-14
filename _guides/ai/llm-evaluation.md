---
title: "LLM Evaluation"
layout: guide
category: AI & Machine Learning
subcategory: Building with LLMs
description: "Measuring LLM system quality: test sets, LLM-as-judge, regression testing for prompts and agents, and online feedback signals."
tags: [evals, llm-as-judge, regression-testing, testing, practical]
---

## Evaluating Generated Output

### Generation Metrics

| Metric | What It Measures |
|--------|-----------------|
| **Faithfulness** | Does the response accurately reflect retrieved content? |
| **Relevance** | Does the response answer the question? |
| **Groundedness** | Is every claim supported by retrieved documents? |

### Evaluation Approaches

**Automated**: Use LLMs to judge response quality (faster, scalable)
**Human evaluation**: Manual review (slower, more reliable)
**A/B testing**: Compare RAG variants with real users

### Common Evaluation Tools

- **Ragas**: Open-source RAG evaluation framework
- **LangSmith**: Tracing and evaluation from LangChain
- **TruLens**: Evaluation and observability
- **Custom LLM judges**: Prompt an LLM to score responses

---

## Testing Agents

| Test Type | Purpose | Approach |
|-----------|---------|----------|
| **Unit tests** | Individual tools work | Mock agent, test tool outputs |
| **Integration tests** | Agent uses tools correctly | Controlled scenarios |
| **Scenario tests** | End-to-end task completion | Representative tasks |
| **Adversarial tests** | Handle edge cases | Unusual inputs, failures |
