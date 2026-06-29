---
title: "LLM Fine-Tuning"
layout: guide
category: AI & Machine Learning
subcategory: Generative AI
description: "When and how to fine-tune language models: choosing between prompting, RAG, and fine-tuning, techniques like LoRA and QLoRA, and practical implementation guidance."
tags: [ai, generative-ai, llm, fine-tuning, training, practical]
---

## What Is Fine-Tuning?

Fine-tuning is the process of further training a pre-trained language model on a specific dataset to adapt it for particular tasks, domains, or behaviors. The model learns from examples in your data to modify its weights, changing how it generates outputs.

**The key distinction**: Prompting tells the model what to do. Fine-tuning changes what the model *is*.

### When Fine-Tuning Makes Sense

Fine-tuning is appropriate when you need to change the model's behavior, style, or knowledge in ways that can't be achieved through prompting alone.

| Use Case | Why Fine-Tuning Helps |
|----------|----------------------|
| **Consistent output format** | Learn to always produce specific structure |
| **Domain terminology** | Internalize specialized vocabulary |
| **Style/tone** | Match specific writing style |
| **Behavior patterns** | Follow complex multi-step procedures |
| **Efficiency** | Replace long prompts with learned behavior |

### When Not to Fine-Tune

| Situation | Better Alternative |
|-----------|-------------------|
| Need current information | RAG |
| One-off customization | Prompting |
| Simple format changes | Structured output prompts |
| Access to specific data | RAG |
| Cost is primary concern | Start with prompting |

---

## Decision Framework

### Prompting vs. RAG vs. Fine-Tuning

```
                     ┌─────────────────┐
                     │ What do you need│
                     │   to change?    │
                     └────────┬────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
   │   Knowledge  │   │   Behavior   │   │    Both      │
   │   (what it   │   │   (how it    │   │              │
   │    knows)    │   │    acts)     │   │              │
   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
          │                  │                  │
          ▼                  ▼                  ▼
   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
   │     RAG      │   │  Fine-tuning │   │   RAG +      │
   │              │   │      or      │   │ Fine-tuning  │
   │              │   │   Prompting  │   │              │
   └──────────────┘   └──────────────┘   └──────────────┘
```

### Detailed Comparison

| Aspect | Prompting | RAG | Fine-Tuning |
|--------|-----------|-----|-------------|
| **What changes** | Instructions | Available knowledge | Model weights |
| **Setup effort** | Minimal | Moderate | Significant |
| **Update frequency** | Instant | Easy | Requires retraining |
| **Cost** | Per-token | Infrastructure + per-token | Training + per-token |
| **Knowledge cutoff** | Training date | Real-time | Training date |
| **Behavior change** | Limited | Limited | Significant |
| **Consistency** | Variable | Variable | High |

### The Progression

Start simple, escalate only when needed:

1. **Prompting**: Try clear instructions with examples first
2. **Advanced prompting**: Chain-of-thought, persona, few-shot
3. **RAG**: If knowledge access is the issue
4. **Fine-tuning**: When behavior consistently doesn't match needs

---

## Fine-Tuning Techniques

### Full Fine-Tuning

Update all model parameters with your training data.

**Pros**: Maximum flexibility, can make significant changes
**Cons**: Expensive, requires significant compute, risk of catastrophic forgetting

**Resource requirements**: Full model size × optimizer states × gradients
- 7B model: ~56GB+ GPU memory
- 70B model: Requires multi-GPU clusters

### Parameter-Efficient Fine-Tuning (PEFT)

Update only a small subset of parameters, keeping most frozen.

#### LoRA (Low-Rank Adaptation)

Injects small trainable matrices into model layers while keeping original weights frozen.

**How it works**:
- Original weights W remain frozen
- Add low-rank decomposition: W' = W + BA
- Only train B and A matrices (much smaller)

**Benefits**:
- 10-100x fewer trainable parameters
- Can fit on consumer GPUs
- Fast training
- Easy to swap adapters

**Typical LoRA config**:
```
rank (r): 8-64 (smaller = fewer params, larger = more capacity)
alpha: Usually 2x rank
target modules: Query, Key, Value projections
```

#### QLoRA (Quantized LoRA)

Combines LoRA with 4-bit quantization for even lower memory.

**How it works**:
- Load base model in 4-bit precision
- Add LoRA adapters in higher precision
- Train only the adapters

**Benefits**:
- Fine-tune 65B models on single 48GB GPU
- Minimal quality loss from quantization
- Dramatically lower hardware requirements

**Trade-off**: Slightly slower inference due to dequantization

### Comparison

| Technique | Memory | Quality | Speed | Flexibility |
|-----------|--------|---------|-------|-------------|
| **Full fine-tuning** | Very high | Highest | Slow | Maximum |
| **LoRA** | Low | High | Fast | High |
| **QLoRA** | Very low | High | Medium | High |

---

## Data Preparation

The quality of fine-tuning depends heavily on data quality.

### Dataset Requirements

| Factor | Guidance |
|--------|----------|
| **Size** | Hundreds to thousands of examples (more for complex tasks) |
| **Quality** | Clean, accurate, representative |
| **Diversity** | Cover the range of expected inputs |
| **Format** | Consistent structure matching intended use |

### Data Format

Most fine-tuning uses instruction-following format:

```json
{
  "messages": [
    {"role": "system", "content": "You are a helpful customer service agent."},
    {"role": "user", "content": "I need to return my order"},
    {"role": "assistant", "content": "I'd be happy to help with your return..."}
  ]
}
```

Or simpler prompt-completion pairs:

```json
{
  "prompt": "Summarize this article: [article text]",
  "completion": "The article discusses..."
}
```

### Data Quality Guidelines

**Do**:
- Use real examples from your domain
- Include edge cases and difficult examples
- Maintain consistent formatting
- Have experts validate outputs
- Balance positive and negative examples

**Avoid**:
- Synthetic data without validation
- Biased or unrepresentative samples
- Inconsistent formatting
- Examples with errors
- Duplicates

### Data Quantity Guidelines

| Task Complexity | Minimum Examples | Recommended |
|-----------------|------------------|-------------|
| **Simple format** | 50-100 | 200-500 |
| **Domain adaptation** | 200-500 | 1,000-5,000 |
| **Complex behavior** | 1,000+ | 5,000-10,000+ |

More data generally helps, but quality matters more than quantity.

---

## Training Process

### Training Configuration

Key hyperparameters to consider:

| Parameter | Typical Range | Impact |
|-----------|---------------|--------|
| **Learning rate** | 1e-5 to 5e-4 | Too high = instability, too low = slow |
| **Epochs** | 1-5 | More = overfitting risk |
| **Batch size** | 4-32 | Limited by memory |
| **Warmup steps** | 5-10% of total | Stability early in training |
| **LoRA rank** | 8-64 | Capacity vs. efficiency |

### Training Steps

1. **Prepare data**: Format, clean, split (train/validation)
2. **Choose base model**: Match capability to task
3. **Configure training**: Set hyperparameters
4. **Train**: Monitor loss and validation metrics
5. **Evaluate**: Test on held-out data
6. **Iterate**: Adjust based on results

### Monitoring Training

Watch for:

| Signal | Meaning | Action |
|--------|---------|--------|
| **Loss decreasing** | Model learning | Continue |
| **Validation loss increasing** | Overfitting | Stop early, reduce epochs |
| **Loss stuck** | Learning rate issue | Adjust learning rate |
| **Loss unstable** | Learning rate too high | Reduce learning rate |

### Evaluation

Before deploying, evaluate on:

- **Held-out test set**: Data model hasn't seen
- **Task-specific metrics**: Accuracy, F1, BLEU, etc.
- **Human evaluation**: Quality assessment by domain experts
- **Comparison to base**: Does fine-tuning actually help?

---

## Practical Implementation

### Platform Options

| Platform | Type | Best For |
|----------|------|----------|
| **OpenAI Fine-tuning** | Managed | GPT models, easy API |
| **Together AI** | Managed | Open models, cost-effective |
| **Hugging Face** | Framework | Self-hosted, full control |
| **Axolotl** | Tool | Simplified local training |
| **Unsloth** | Tool | Optimized LoRA/QLoRA |

### Local Fine-Tuning Setup

Minimal setup for LoRA fine-tuning:

**Hardware**: GPU with 16GB+ VRAM (RTX 4090, A100)

**Software stack**:
- transformers (model loading)
- peft (LoRA implementation)
- datasets (data handling)
- accelerate (training optimization)
- bitsandbytes (quantization for QLoRA)

### Typical Workflow

```
1. Load base model (possibly quantized)
2. Apply LoRA configuration
3. Load and preprocess dataset
4. Configure trainer
5. Train
6. Evaluate
7. Merge LoRA weights or deploy adapter
```

### Deployment Options

After training, you can:

**Keep adapter separate**:
- Load base model + adapter at inference
- Easy to swap adapters for different tasks
- Slightly slower inference

**Merge into base model**:
- Create single model with adapter merged
- Faster inference
- Larger storage

---

## Common Challenges

### Catastrophic Forgetting

Model loses general capabilities while learning specific ones.

**Mitigations**:
- Lower learning rate
- Mix in general data
- Use PEFT methods (preserves base weights)
- Regularization techniques

### Overfitting

Model memorizes training data rather than learning patterns.

**Signs**: Low training loss, high validation loss, poor generalization

**Mitigations**:
- More training data
- Early stopping
- Regularization (dropout, weight decay)
- Data augmentation

### Poor Quality Outputs

Fine-tuned model performs worse than expected.

**Diagnose**:
- Check data quality
- Verify format matches base model's training
- Test with more/less training
- Compare to prompting baseline

### Mode Collapse

Model produces same or very similar outputs.

**Mitigations**:
- Temperature adjustment at inference
- More diverse training data
- Check for data imbalance

---

## Cost Considerations

### Training Costs

| Factor | Impact |
|--------|--------|
| **Model size** | Larger = more compute |
| **Dataset size** | More data = longer training |
| **Technique** | Full > LoRA > QLoRA |
| **Platform** | Managed > self-hosted (usually) |

### Managed Platform Pricing (Example)

| Platform | Approximate Cost |
|----------|------------------|
| **OpenAI** | ~$0.008/1K tokens (varies by model) |
| **Together AI** | ~$0.50-2/hour (varies by model) |
| **Self-hosted** | GPU cost + time |

### Break-Even Analysis

Fine-tuning makes economic sense when:
- Reduced prompt length saves token costs over time
- Improved quality reduces retry/correction costs
- Consistency reduces manual review costs

Calculate: Training cost vs. (per-query savings × expected query volume)

---

## Best Practices

### Before Fine-Tuning

1. **Establish baseline**: Measure prompting performance first
2. **Define success criteria**: What improvement justifies the effort?
3. **Collect quality data**: Don't fine-tune until data is ready
4. **Start small**: Test with subset before full training

### During Fine-Tuning

1. **Monitor metrics**: Track loss and validation performance
2. **Save checkpoints**: Enable recovery and comparison
3. **Test incrementally**: Evaluate before training completes
4. **Document everything**: Hyperparameters, data versions, results

### After Fine-Tuning

1. **Comprehensive evaluation**: Test across expected use cases
2. **A/B comparison**: Fine-tuned vs. base with prompting
3. **Monitor in production**: Track quality over time
4. **Plan for updates**: How will you retrain as needs change?

---

## Quick Reference

### Decision Checklist

When to consider fine-tuning:

- [ ] Prompting doesn't achieve needed consistency
- [ ] RAG doesn't solve the problem (it's behavior, not knowledge)
- [ ] Have quality training data (hundreds+ examples)
- [ ] Can afford training compute
- [ ] Have evaluation strategy
- [ ] Justified by use case volume

### Technique Selection

| Situation | Recommended Technique |
|-----------|----------------------|
| Consumer GPU (16-24GB) | QLoRA |
| Cloud GPU (40GB+) | LoRA or full |
| Maximum quality needed | Full fine-tuning |
| Quick iteration | LoRA |
| Very large model (70B+) | QLoRA |

### Training Quick Reference

| Model Size | LoRA Memory | QLoRA Memory | Training Time* |
|------------|-------------|--------------|----------------|
| 7B | ~16GB | ~8GB | Hours |
| 13B | ~32GB | ~12GB | Hours |
| 70B | ~140GB | ~40GB | Days |

*Varies significantly based on dataset size and hardware

### Common Mistakes

| Mistake | Consequence | Prevention |
|---------|-------------|------------|
| Skipping prompting baseline | Don't know if fine-tuning helps | Always compare |
| Low quality data | Poor model performance | Invest in data quality |
| Too few examples | Insufficient learning | Collect more data |
| Too many epochs | Overfitting | Monitor validation loss |
| Ignoring evaluation | Unknown quality | Systematic testing |
