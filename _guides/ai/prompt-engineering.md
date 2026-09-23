---
title: "Prompt Engineering"
layout: guide
category: AI & Machine Learning
subcategory: Building with LLMs
description: "Writing prompts that get reliable results: structuring system prompts and inputs, examples and their biases, output formats and structured outputs, chain-of-thought and when reasoning models make it unnecessary, self-consistency, tree of thoughts, and prompt chaining."
tags: [prompt-engineering, chain-of-thought, few-shot, structured-outputs, reasoning-models, practical]
---

Prompt engineering is the practice of designing a model's input so it reliably produces the output you need. It's less about clever wording than about removing ambiguity. A model can only act on what's in its context, so most prompt problems come down to the model lacking information the author assumed it had, or receiving instructions that allow more than one reasonable reading.

## What a Prompt Is Made Of

### System Prompt and Messages

A request to a chat model is a structured list of messages, not a single block of text.

| Part | Holds | Typically written by |
|---|---|---|
| **System prompt** (called the developer message on some APIs) | Standing instructions: the model's role, rules, output conventions, and background that applies to every turn | The application developer |
| **User messages** | The request for this turn, plus any documents or data it concerns | The end user, or the application on the user's behalf |
| **Assistant messages** | The model's earlier replies, sent back as conversation history | The model |

Put what should hold for the whole conversation in the system prompt and what's specific to this request in the user message. Everything in both still consumes context window and is resent on each request.

### Separating Instructions From Material

A prompt that mixes instructions, reference documents, examples, and user input in undifferentiated prose invites the model to confuse one for another. It might follow an instruction that appears inside a pasted email, or treat an example as the input to process. Delimiters make the boundaries explicit. Both [Anthropic](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices){:target="_blank" rel="noopener noreferrer"} and [OpenAI](https://developers.openai.com/api/docs/guides/reasoning-best-practices){:target="_blank" rel="noopener noreferrer"} recommend markdown headings, section titles, or XML-style tags for this:

```
<instructions>
Summarize the customer's complaint in two sentences, then classify it as
billing, shipping, product defect, or other.
</instructions>

<email>
[the customer's email text]
</email>
```

Delimiters improve clarity, but they don't stop a model from acting on instructions embedded in the material. Treat untrusted input as a security concern, not a formatting one.

Placement matters for long inputs. Anthropic's guidance is to put long documents near the top of the prompt, above the instructions and question, and reports that putting the query at the end improved response quality by up to 30 percent in its tests with complex, multi-document inputs.

---

## Principles That Hold Across Models

James Phoenix and Mike Taylor's *Prompt Engineering for Generative AI* (O'Reilly, 2024) organizes prompting around five principles: give direction, specify format, provide examples, evaluate quality, and divide labor. The sections below follow the same ground.

### Be Specific About the Task, the Audience, and the Reason

Write the prompt as a brief for a capable colleague who knows nothing about your situation. "Summarize this report" leaves length, audience, focus, and format to chance. "Summarize this incident report in five bullet points for the engineering director, focusing on root cause and the follow-up actions still open" doesn't.

Explaining why an instruction exists helps too. "Never use ellipses" is a rule the model has to guess the boundaries of. "This output will be read aloud by a text-to-speech engine, so avoid ellipses because it can't pronounce them" lets the model generalize to other things a speech engine would stumble on. Anthropic's guidance notes that providing the motivation behind instructions helps the model deliver more targeted responses.

### Say What to Do, Not Only What to Avoid

Instructions phrased as prohibitions leave the model to infer the desired behavior. "Don't use markdown" tells it what's wrong, while "Write in plain paragraphs of flowing prose" tells it what's right. The style of the prompt also leaks into the output. A prompt written as a wall of bullet points tends to get bullet points back.

### Specify the Output Format

Describe the structure you need, including sections, length, ordering, and the exact labels allowed. For output a program will parse, describing JSON in prose only makes a correct result likely. **Structured outputs**, offered by major providers, constrain generation so the response has to match a supplied JSON schema. Anthropic's [structured outputs documentation](https://platform.claude.com/docs/en/build-with-claude/structured-outputs){:target="_blank" rel="noopener noreferrer"} describes this as constrained decoding that guarantees schema-compliant responses, with some JSON Schema features, such as numeric ranges and string length limits, unsupported. A schema guarantees the shape of the output, not the correctness of the values inside it.

Techniques that forced a format by writing the start of the model's reply (prefilling) are being retired on some platforms. Anthropic no longer supports prefilled final assistant turns starting with its 4.6-generation models and points to structured outputs instead.

### Show Examples

**Few-shot prompting** includes worked examples of inputs and desired outputs. Examples convey tone, format, and judgment calls faster and less ambiguously than description, which is why vendor guidance calls them one of the most reliable ways to steer output.

```
Classify each support ticket's urgency as low, medium, or high.

<example>
Ticket: "The export button is slightly misaligned on the settings page."
Urgency: low
</example>

<example>
Ticket: "Checkout fails for every customer paying by card since 9am."
Urgency: high
</example>

<example>
Ticket: "Two users say password reset emails take about ten minutes to arrive."
Urgency: medium
</example>

Ticket: "[new ticket text]"
Urgency:
```

Examples also carry bias. [Zhao et al., "Calibrate Before Use" (ICML 2021)](https://arxiv.org/abs/2102.09690){:target="_blank" rel="noopener noreferrer"} found that the choice of examples, their format, and even their order could swing accuracy from near chance to near state of the art. Models leaned toward labels that appeared more often in the examples and toward the label of the last example. Keep examples diverse, cover the edge cases that matter, balance the labels, and vary the order. Examples that all share an incidental trait, like being the same length, teach that trait too.

### Test the Prompt Against Many Inputs

A prompt that works on the three inputs its author tried hasn't been shown to work. Outputs vary between runs, and a wording change that fixes one case can break another. Build a set of representative and difficult inputs, run the prompt against all of them whenever it changes, and compare results. Prompts deserve version control and regression testing like any other code that affects production behavior.

---

## Reasoning Techniques

### Chain-of-Thought

**Chain-of-thought (CoT) prompting** gets the model to write out intermediate reasoning before its answer. Because each generated token becomes input for the next, reasoning written into the output gives the model working space that a direct answer doesn't have.

[Wei et al. (2022)](https://arxiv.org/abs/2201.11903){:target="_blank" rel="noopener noreferrer"} introduced it with few-shot examples that show step-by-step reasoning, and found the benefit emerged in sufficiently large models. [Kojima et al. (2022)](https://arxiv.org/abs/2205.11916){:target="_blank" rel="noopener noreferrer"} then showed a zero-shot version. Adding "Let's think step by step" raised one model's accuracy on the MultiArith benchmark from 17.7% to 78.7% and on GSM8K from 10.4% to 40.7%, with no examples at all.

```
A store takes 25% off an item, then another 10% off the discounted price.
What is the total discount on a $100 item? Work through it step by step,
then give the final answer on its own line.
```

When a program consumes the result, separate the reasoning from the answer, for example by asking for the answer inside a tag, so the reasoning can be discarded or logged.

### Reasoning Models Change the Advice

Reasoning models are trained to think before answering, and they do it without being asked. OpenAI's [reasoning best practices](https://developers.openai.com/api/docs/guides/reasoning-best-practices){:target="_blank" rel="noopener noreferrer"} say to avoid chain-of-thought prompts for them, since prompting them to "think step by step" or "explain your reasoning" is unnecessary, and to try zero-shot before adding examples. Anthropic's guidance for its thinking-enabled models is similar. It finds that a general instruction like "think thoroughly" often produces better reasoning than a hand-written step-by-step plan.

So explicit chain-of-thought prompting is most useful with models that don't reason on their own, or with reasoning disabled. With reasoning models, spend the effort on a clear statement of the goal, the constraints, and what a good answer looks like.

### Self-Consistency

A single reasoning chain can go wrong at one step and carry the error to the end. **Self-consistency** ([Wang et al., 2022](https://arxiv.org/abs/2203.11171){:target="_blank" rel="noopener noreferrer"}) samples several independent reasoning paths for the same question instead of taking only the single most likely one, then selects the answer the paths agree on most. It works best for questions with one checkable final answer, like a number or a category, where the answers from different paths can be compared. The cost scales with the number of samples, so it suits high-stakes questions more than routine ones.

### Tree of Thoughts

**Tree of Thoughts** ([Yao et al., 2023](https://arxiv.org/abs/2305.10601){:target="_blank" rel="noopener noreferrer"}) treats problem solving as search. The model proposes several candidate next steps, evaluates how promising each is, explores the best ones further, and backtracks from dead ends. It's a program that orchestrates many model calls, not a single prompt. On the Game of 24 puzzle, the authors report GPT-4 with chain-of-thought prompting solved 4% of tasks while their Tree of Thoughts method solved 74%.

{% include figure.html id="llm-reasoning-structures" %}

| Aspect | Chain-of-thought | Self-consistency | Tree of Thoughts |
|---|---|---|---|
| **Structure** | One linear reasoning path | Several independent paths, then a vote | A search tree of partial solutions, with evaluation at each step |
| **Error recovery** | None; an early mistake carries through | Outvoted if most paths avoid it | Weak branches are abandoned and alternatives explored |
| **Model calls** | One | One per sampled path | Many, driven by a search algorithm |
| **Suited to** | Multi-step problems with a clear path | Questions with one checkable answer | Planning and puzzles where early choices constrain later ones |

A single prompt asking the model to "consider three approaches, evaluate each, and pick the best" borrows the idea and can help, but it isn't the search method the paper describes, and the model can't truly backtrack within one generation.

---

## Structuring Larger Tasks

### Chain Prompts for Tasks You Need to Inspect

A task with distinct stages, such as extracting facts from documents, analyzing them, and then drafting a report, can run as one large prompt or as a chain of smaller requests where each one's output feeds the next. Chaining gives each step a focused prompt, lets you validate or correct intermediate results before they propagate, and makes it clear which stage failed when output is wrong. The cost is more requests and more orchestration code.

Current models handle much more multi-step work within a single request than earlier ones did. Anthropic's guidance notes that explicit chaining remains useful when you need to inspect intermediate outputs or enforce a specific pipeline structure, which is a reasonable test for when to use it.

### Personas Shape Style, Not Accuracy

Assigning a role, such as "You are a senior security engineer reviewing this design," reliably changes tone, vocabulary, and the depth of explanation, and a role that describes the audience ("explain this to a hospital administrator") helps pitch the response correctly. It shouldn't be relied on to make answers more correct. [Zheng et al. (Findings of EMNLP 2024)](https://arxiv.org/abs/2311.10054){:target="_blank" rel="noopener noreferrer"} tested 162 roles across four model families on 2,410 factual questions and found that adding personas to system prompts didn't improve performance. Spend the words on the task's actual requirements instead.

---

## Choosing a Technique

```
Is the task simple and well-defined?
├── Yes ─► Clear, specific instructions (zero-shot)
└── No
    ├── Must the output follow a particular format, style, or labeling judgment?
    │     └── Yes ─► Add diverse, balanced examples
    │               └── Parsed by a program? ─► Also use structured outputs
    ├── Does it require multi-step reasoning?
    │     ├── Reasoning model ─► State the goal and constraints; let it think
    │     └── Other model     ─► Chain-of-thought
    │           └── Is a wrong answer costly and the answer checkable?
    │                 └── Yes ─► Self-consistency
    ├── Does it require exploring and abandoning alternatives?
    │     └── Yes ─► A reasoning model, or a search over multiple calls
    │               (tree of thoughts)
    └── Does it have distinct stages whose output you need to check?
          └── Yes ─► Chain prompts
```

---

## Common Pitfalls

| Pitfall | What happens | Better approach |
|---|---|---|
| **Testing on a handful of inputs** | The prompt breaks on the first unusual real input | Maintain a test set and re-run it on every change |
| **Unbalanced or uniform examples** | The model copies the majority label or an incidental trait | Balance labels, vary order and length, include edge cases |
| **Instructions buried after long material** | The question gets less attention than the documents | Put long documents first and the instructions and question last |
| **Prohibitions without the desired behavior** | The model avoids one mistake and picks another | State what to do, and why |
| **Asking for JSON in prose when code parses it** | Occasional malformed output breaks the pipeline | Use structured outputs where available |
| **Chain-of-thought prompts on reasoning models** | Extra tokens and latency, with no gain or worse results | Give a clear goal and let the model reason |
| **Relying on a persona for correctness** | Confident tone without better answers | Supply the information and constraints the task needs |
| **Reusing a prompt on a new model untested** | Behavior shifts silently | Re-run the test set whenever the model or its version changes |
