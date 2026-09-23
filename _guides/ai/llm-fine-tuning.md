---
title: "LLM Fine-Tuning"
layout: guide
category: AI & Machine Learning
subcategory: Building with LLMs
description: "When fine-tuning a language model is worth it and how to do it: choosing between prompting, RAG, and fine-tuning, supervised and preference tuning, full fine-tuning versus LoRA and QLoRA, preparing data, training, evaluating, and deploying adapters."
tags: [fine-tuning, lora, qlora, peft, sft, dpo, practical]
---

**Fine-tuning** continues training a pre-trained language model on your own examples, adjusting its weights so it behaves differently. Where a prompt tells the model what to do on each request, fine-tuning changes the model's default responses so the instructions no longer need repeating. It's powerful, but it's also the most expensive and least reversible way to customize a model, and it's frequently reached for when a better prompt or retrieval would have done the job.

## What Fine-Tuning Changes

### Behavior, Not Knowledge

Fine-tuning is good at shaping how a model responds, such as producing a consistent output format, a house style or tone, a classification scheme, domain-specific phrasing, or a narrow task done reliably with a short prompt. It's poor at teaching facts.

Two studies make the point. [Ovadia et al. (2023)](https://arxiv.org/abs/2312.05934){:target="_blank" rel="noopener noreferrer"} compared unsupervised fine-tuning with retrieval-augmented generation for adding knowledge and found that RAG consistently outperformed fine-tuning, both for information the model had seen before and for entirely new facts, which models struggled to learn through fine-tuning. [Gekhman et al. (2024)](https://arxiv.org/abs/2405.05904){:target="_blank" rel="noopener noreferrer"} found that fine-tuning examples containing new knowledge were learned much more slowly than examples consistent with what the model already knew, and that once learned, they linearly increased the model's tendency to hallucinate. Models acquire knowledge mostly in pre-training. Fine-tuning mostly teaches them how to use it.

Fine-tuned knowledge is also static. When a fact changes, the model has to be retrained, while a retrieval index is updated in minutes.

### Kinds of Fine-Tuning

| Method | Training data | Teaches | Example use |
|---|---|---|---|
| **Supervised fine-tuning (SFT)** | Prompts paired with ideal responses | Imitate the example responses | A fixed output format, a classification scheme, a support tone |
| **Preference tuning** (such as DPO) | Prompts with a preferred and a rejected response | Prefer one kind of response over another | Summaries at the right length, replies with an appropriate tone |
| **Reinforcement fine-tuning** | Prompts plus a grader that scores responses | Produce responses that score well | Domain reasoning tasks with checkable answers |
| **Distillation** | Outputs of a larger model on your tasks | Match a larger model's behavior on a narrow task | Serving a smaller, cheaper model for one high-volume job |

**Direct Preference Optimization** ([Rafailov et al., 2023](https://arxiv.org/abs/2305.18290){:target="_blank" rel="noopener noreferrer"}) made preference tuning practical. The earlier approach, reinforcement learning from human feedback, required training a separate reward model and then optimizing against it with reinforcement learning. DPO trains directly on preference pairs with a simple classification-style loss, and the authors report it matches or exceeds that approach while being substantially simpler to train.

---

## Prompting, RAG, or Fine-Tuning

The three approaches change different things, and they combine rather than compete.

| Aspect | Prompting | RAG | Fine-tuning |
|---|---|---|---|
| **What changes** | The instructions and examples in each request | The information supplied with each request | The model's weights |
| **Best at** | Most tasks, and every starting point | Private, current, or large bodies of knowledge | Consistent behavior, format, and style; shortening long prompts |
| **Time to iterate** | Minutes | Hours to days to build, minutes to update content | Days per training cycle |
| **Updating** | Edit the prompt | Update the index | Retrain |
| **Cost profile** | Per-token, growing with prompt length | Indexing, search infrastructure, plus tokens | Training runs, possibly dedicated hosting, plus tokens |
| **Source attribution** | Only for supplied material | Built in | None |

```
What's wrong with the output?
├── It lacks information: private, recent, or too large to include
│     └─► RAG (or include it in the prompt if it fits)
├── It ignores instructions, format, or style
│     ├── Have you tried clearer instructions, examples, and structured outputs?
│     │     └── No ─► Prompting first
│     └── Yes, and it's still inconsistent at the volume you need
│           └─► Fine-tuning
├── It's correct, but the prompt needed to get there is long and expensive
│     └─► Fine-tuning to internalize the instructions, or distillation to a smaller model
└── Both information and behavior are problems
      └─► RAG for the knowledge, fine-tuning for the behavior
```

Work through them in order. Prompting is fastest to change, so establish how far it gets you, and measure it, before building anything else. Add retrieval when the gap is information. Fine-tune only when a measured gap in behavior remains, and when you have an evaluation set that will show whether fine-tuning closed it.

---

## When Fine-Tuning Pays Off

Fine-tuning tends to earn its cost when:

- **A task runs at high volume** and a fine-tuned smaller model can replace a larger one, or a short prompt can replace a long one, saving on every request.
- **Output must follow a pattern that's hard to specify** in instructions but easy to show in hundreds of examples, like a particular editorial voice or a detailed labeling scheme.
- **Latency matters** and a smaller fine-tuned model is fast enough where a large model with a long prompt isn't.
- **You control an open-weight model** and need it to perform a narrow task reliably inside your own infrastructure.

It tends not to pay off when requirements change often, the task needs current or private knowledge, the volume is low, or there's no reliable way to evaluate the result.

---

## Techniques

### Full Fine-Tuning

Full fine-tuning updates every weight in the model. It can make the largest changes, and it has the highest cost. Training needs memory not just for the weights but for their gradients and the optimizer's state. With the common mixed-precision Adam setup, Microsoft's [ZeRO paper](https://arxiv.org/abs/1910.02054){:target="_blank" rel="noopener noreferrer"} counts about 16 bytes per parameter: 16-bit weights and gradients plus 32-bit master weights and two optimizer moments. A 7-billion-parameter model therefore needs around 112 GB for model state alone, before activations, which means multiple data-center GPUs. Full fine-tuning also produces a complete copy of the model for every variant you train, and it risks **catastrophic forgetting**, where performance on tasks outside the training data degrades.

### LoRA

**Low-Rank Adaptation** ([Hu et al., 2021](https://arxiv.org/abs/2106.09685){:target="_blank" rel="noopener noreferrer"}) freezes the original weights and learns a small update to selected weight matrices. Instead of learning a full update to a matrix W, it learns two small matrices, A and B, whose product has a low rank r, and uses W + BA in their place. Only A and B are trained.

```
                  ┌──► W (frozen, d × k) ─────────────┐
                  │                                   │
  input x (d) ────┤                                  (+)───► output (k)
                  │                                   │
                  └──► A (d × r) ──► B (r × k) ───────┘
                          (trainable, r ≪ d)
```

The rank r is the bottleneck the whole method rests on. Every change the model can learn has to pass through an r-dimensional layer, which is what keeps the update small enough to train cheaply and to store as a separate file. On GPT-3 175B, the authors report reducing trainable parameters by 10,000 times and GPU memory by 3 times compared with full fine-tuning, and because BA can be merged back into W after training, **a merged LoRA model adds no inference latency**.

The trade-off is capacity. [Biderman et al. (2024)](https://arxiv.org/abs/2405.09673){:target="_blank" rel="noopener noreferrer"} found that LoRA "learns less and forgets less." It substantially underperformed full fine-tuning on programming and math training, but better preserved the base model's performance on other tasks. They also found that full fine-tuning learns weight changes with a rank 10 to 100 times higher than typical LoRA settings, which helps explain the gap.

Key settings, using the names in Hugging Face's [PEFT library](https://huggingface.co/docs/peft/package_reference/lora){:target="_blank" rel="noopener noreferrer"}:

| Setting | What it controls | Notes |
|---|---|---|
| **`r` (rank)** | Size of the learned update, and so its capacity | PEFT defaults to 8; higher ranks learn more at more memory cost |
| **`lora_alpha`** | Scaling of the update, applied as alpha ÷ r | PEFT defaults to 8; setting alpha to twice the rank is a common convention, not a rule |
| **`target_modules`** | Which weight matrices get adapters | `"all-linear"` applies adapters to all linear layers; covering more layers usually helps more than raising rank |
| **`use_rslora`** | Scales by alpha ÷ √r instead of alpha ÷ r | Rank-stabilized LoRA, which keeps higher ranks from being under-scaled |

### QLoRA

**QLoRA** ([Dettmers et al., 2023](https://arxiv.org/abs/2305.14314){:target="_blank" rel="noopener noreferrer"}) loads the frozen base model in 4-bit precision and trains LoRA adapters on top of it. It introduced a 4-bit NormalFloat data type suited to the distribution of model weights, double quantization to shrink the quantization constants themselves, and paged optimizers to absorb memory spikes. The authors fine-tuned a 65-billion-parameter model on a single 48 GB GPU while preserving the task performance of full 16-bit fine-tuning. QLoRA trains more slowly than LoRA on a 16-bit base, because weights are dequantized during computation, so it trades speed for fitting larger models on smaller hardware.

### Choosing a Technique

| Situation | Technique |
|---|---|
| The model and budget allow it, and the task needs large changes | Full fine-tuning |
| Most custom behavior, format, and style work | LoRA |
| The base model is too large for your GPUs at 16-bit | QLoRA |
| Many task variants served from one base model | LoRA or QLoRA adapters, swapped per request |
| Preserving general capabilities matters most | LoRA, which forgets less |

---

## Data

### Formats

Most fine-tuning data is either **conversational**, with a list of messages per example, or **prompt-completion**, with an input and the desired output.

```json
{"messages": [
  {"role": "system", "content": "You are Acme's support assistant. Reply in two to four sentences and end with a next step."},
  {"role": "user", "content": "My invoice shows a charge twice for March."},
  {"role": "assistant", "content": "I'm sorry about the duplicate charge. I can see two March charges on your account, and one will be refunded within five business days. You'll receive a confirmation email when it's processed. If it doesn't appear by then, reply here with your invoice number."}
]}
```

Loss should be computed only on the parts the model should learn to produce, the completion or the assistant turns, rather than on the prompt, so the model isn't also trained to generate the inputs. Whether that's the default depends on the library and the dataset format, so check rather than assume. For chat models, format the data with the same chat template the model uses at inference time, or behavior after training will differ from behavior in testing.

### Quality Over Quantity

The model learns whatever the examples consistently show, including their mistakes and quirks.

- **Draw examples from real usage**, and have domain experts write or approve the target responses.
- **Cover the difficult cases**, like ambiguous requests, refusals, and edge cases, not just the easy majority.
- **Keep formatting consistent.** If half the examples end with a next step and half don't, the model learns to do it half the time.
- **Remove duplicates and near-duplicates**, which overweight some behaviors and can leak into evaluation data.
- **Hold out a test set** before training and never train on it.
- **Validate synthetic examples.** Data generated by a larger model is a legitimate way to scale a dataset, but it carries that model's errors unless reviewed.

### How Many Examples

There's no universal number. Narrow formatting tasks can improve with a modest set of consistent examples, while complex behavior needs far more. A practical approach is to start with a small, carefully reviewed set, train, evaluate, and repeat with more data. If doubling the data doesn't improve the held-out results, more of the same data won't help, and the examples need to change instead.

---

## Training

### Key Hyperparameters

| Hyperparameter | Effect | Guidance |
|---|---|---|
| **Learning rate** | Size of each weight update | Adapters are commonly trained at higher rates than full fine-tuning; TRL's documentation suggests about 1e-4 for adapters, against its 2e-5 default |
| **Epochs** | Passes over the dataset | Few passes are typical; watch validation loss for overfitting |
| **Batch size and gradient accumulation** | Examples per update | Accumulate gradients to reach a larger effective batch on limited memory |
| **Warmup** | Gradual increase of the learning rate at the start | Stabilizes early training |
| **Maximum sequence length** | Longest example processed | Examples beyond it are truncated, which can cut off the response being learned |

### Reading the Loss Curves

{% include figure.html id="llm-loss-curves" %}

| Pattern | Likely cause | Response |
|---|---|---|
| Training and validation loss both falling | Learning | Continue |
| Training loss falling, validation loss rising | Overfitting | Stop earlier, use fewer epochs, or add data |
| Loss flat from the start | Learning rate too low, or a data or masking problem | Check that labels cover the responses, then raise the rate |
| Loss spiking or diverging | Learning rate too high | Lower the rate or add warmup |

A falling loss says the model is fitting the data. It doesn't say the model got better at the task, which only an evaluation can show.

### A Minimal Training Run

Hugging Face's [TRL](https://huggingface.co/docs/trl/sft_trainer){:target="_blank" rel="noopener noreferrer"} library wraps supervised fine-tuning, and combines with PEFT for LoRA and with bitsandbytes for 4-bit loading. A QLoRA run on a conversational dataset looks like this:

```python
import torch
from datasets import load_dataset
from peft import LoraConfig
from transformers import BitsAndBytesConfig
from trl import SFTConfig, SFTTrainer

# Each line: {"messages": [{"role": ..., "content": ...}, ...]}
dataset = load_dataset("json", data_files="support_conversations.jsonl", split="train")

trainer = SFTTrainer(
    model="Qwen/Qwen3-0.6B",
    train_dataset=dataset,
    args=SFTConfig(
        output_dir="support-assistant-lora",
        learning_rate=1e-4,
        num_train_epochs=2,
        assistant_only_loss=True,  # learn from assistant turns only
    ),
    peft_config=LoraConfig(r=16, lora_alpha=32, target_modules="all-linear"),
    quantization_config=BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
    ),
)

trainer.train()
trainer.save_model()
```

Training only on assistant turns relies on the model's chat template marking those turns. TRL handles this automatically for some model families, and its documentation lists the requirements for others. Library APIs in this space change frequently, so check the current TRL and PEFT documentation for the version you install.

---

## Evaluating the Result

Compare the fine-tuned model against the best prompted version of the base model, on the same held-out test set, using the metrics that define success for the task. A fine-tuned model that only beats a weak prompt hasn't justified itself.

Also test what fine-tuning might have broken. Run a set of general tasks the application still relies on, like following instructions outside the training distribution, refusing inappropriate requests, and handling unexpected input, and compare those against the base model. Forgetting and new failure patterns show up there, not in the target-task metrics.

---

## Deploying

### Merged Models and Adapters

A LoRA adapter can be merged into the base weights, producing a standalone model with nothing extra to load at inference. In PEFT, `merge_and_unload()` returns the merged model. Alternatively, the adapter can stay separate and be loaded on top of the base model. Keeping adapters separate lets one deployed base model serve many tasks, with a small adapter swapped in per request, and makes rollback as simple as unloading an adapter.

### Managed Fine-Tuning

Hosted providers offer fine-tuning without managing GPUs, but only for specific models. OpenAI's [model optimization guide](https://developers.openai.com/api/docs/guides/model-optimization){:target="_blank" rel="noopener noreferrer"} lists supervised fine-tuning, vision fine-tuning, DPO, and reinforcement fine-tuning, each supported on particular model snapshots, and recommends building evals and iterating on prompts before fine-tuning. Anthropic doesn't offer fine-tuning through its own API, though fine-tuning of an older Claude model has been available through Amazon Bedrock. Check each provider's current list of fine-tunable models, since it changes and is usually narrower than the full model lineup.

### The Maintenance Cost

A fine-tuned model is pinned to the exact base weights it was trained from, and an adapter won't load onto a different snapshot of the same model family. When the provider retires that base model, or a better one is released, the fine-tuning has to be redone, and the evaluation has to be rerun to confirm the new version is at least as good. Keep the base model version alongside the training data, the configuration, and the evaluation set so retraining is a repeatable job rather than a research project.

---

## Common Pitfalls

| Pitfall | What happens | Better approach |
|---|---|---|
| **Fine-tuning to add knowledge** | Facts are learned poorly, hallucination can rise, and updates need retraining | Use retrieval for knowledge |
| **No prompting baseline** | No way to know whether fine-tuning helped | Measure the best prompt on the same test set first |
| **Evaluating on training-adjacent data** | Inflated results from duplicates or leakage | Deduplicate and hold out a test set before training |
| **Inconsistent examples** | The model reproduces the inconsistency | Standardize format and review target responses |
| **Chat template mismatch** | The model behaves differently in production than in testing | Train with the same template used at inference |
| **Checking only the target task** | General capabilities regress unnoticed | Include regression tests on broader behavior |
| **Treating falling loss as success** | The model fits the data without improving the task | Judge by evaluation results, not loss |
| **Forgetting the base model will change** | A retired base model strands the fine-tuned version | Version data, config, and evals so retraining is routine |
