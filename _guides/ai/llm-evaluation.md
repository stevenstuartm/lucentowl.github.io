---
title: "LLM Evaluation"
layout: guide
category: AI & Machine Learning
subcategory: Building with LLMs
description: "Measuring whether an LLM system actually works, covering test sets, grading methods, LLM-as-judge and the biases it carries, regression testing for prompts and agents, and online feedback signals."
tags: [evals, llm-as-judge, regression-testing, testing, ab-testing, practical]
---

**Evaluation** is how you find out whether a change to an LLM system made it better. Without it, every prompt edit is a guess defended by whichever three examples someone happened to try, and no one can tell an improvement from a regression that happens to look good on the demo. Teams that ship LLM features reliably are rarely the ones with the cleverest prompts. They are the ones who can answer "did that help?" in minutes.

## Why LLM Systems Resist Ordinary Testing

Three properties break the assumptions conventional testing rests on, and each one changes what an eval has to do.

**There is no single correct output.** A summarization system has thousands of acceptable answers and no canonical one, so an assertion comparing output to an expected string fails on a response that is perfectly good. Grading has to measure properties of the output rather than its identity.

**The same input does not give the same output.** Hosted APIs are not deterministic even at temperature 0, so a test that passes once may fail on rerun with nothing changed. A single run is a sample, not a result, which means eval sets need enough cases that the aggregate is stable and a single flipped case is not treated as a regression.

**What changed is usually not code.** A reworded system prompt, a different model snapshot, a new retrieval setting, or a reordered tool list can all shift behavior with no diff a code reviewer would recognize as risky. Anything that goes into the context is a dependency, and the eval suite is the only thing that notices when one moves.

---

## What You Are Actually Evaluating

"The eval failed" means nothing until you say which layer it measured. Each layer needs everything below it held fixed.

| Layer | Question it answers | Hold fixed |
|---|---|---|
| **Model** | Does a different model or snapshot do this task better? | Prompt, data, and every component setting |
| **Prompt** | Does this wording beat the current one? | Model, retrieval, tools, test set |
| **Component** | Does retrieval bring back the right material, or does the tool get called correctly? | Everything downstream of the component |
| **System** | Does the whole thing produce what the user needed? | Nothing; this is the end-to-end number |

Most teams measure only the system layer, then cannot explain a drop. A system-level score falling with no component-level movement points at the prompt or the model. The same drop arriving alongside a retrieval-quality drop points somewhere else entirely. Keeping component evals next to the end-to-end ones is what makes a regression diagnosable rather than merely visible.

---

## Building a Test Set

### Where Cases Come From

Production traffic is the best source, because it carries the distribution your system actually faces rather than the one you imagined. Sample real requests, including the ones that went badly, and turn them into cases with the output you wish had been produced. Complaints, escalations, and thumbs-down events are worth more per case than anything written from scratch, since each one is a known failure someone already noticed.

Before there is traffic, write cases from the specification and from whatever domain experts predict will go wrong. Treat that initial set as a placeholder and replace it as real usage arrives.

### What to Cover

A test set drawn only from typical requests certifies a system that works right up until someone does something slightly unusual. Anthropic's [eval design guidance](https://platform.claude.com/docs/en/test-and-evaluate/develop-tests){:target="_blank" rel="noopener noreferrer"} is direct about this, recommending evals that mirror the real task distribution and explicitly include edge cases: irrelevant or nonexistent input, overly long input, poor or harmful user input, and genuinely ambiguous cases.

Ambiguous cases deserve particular care, because they are where a test set encodes a product decision. If a user asks something the system cannot answer, the right output may be a refusal, a clarifying question, or a best-effort answer with a caveat. Whichever you choose, the test set is where that choice gets written down.

### Size and Held-Out Data

The same guidance makes a counterintuitive trade explicit. More questions with slightly lower-signal automated grading beats fewer questions graded by hand. A thousand cases with an imperfect automatic grader detects a regression that a hundred hand-reviewed cases will miss, because the hundred are too few for a small shift to clear the noise.

Hold out a portion of cases and do not look at them while iterating. Prompts get tuned to whatever set is visible, and a prompt refined against 200 cases over three weeks has memorized their quirks in the same way an overfit model memorizes its training data. The held-out set is the only honest estimate of how a change generalizes.

---

## Grading

### Choosing a Method

Four grading methods cover nearly everything, and cost rises with generality.

| Method | How it works | Suits | Limits |
|---|---|---|---|
| **Programmatic** | Assertions, string or regex match, schema validation, running the generated code | Classification, extraction, structured output, code | Only works where correctness is mechanically checkable |
| **Reference similarity** | Compare against a reference answer with ROUGE, BLEU, or embedding similarity | Summarization and translation with reference outputs | Rewards overlap with one phrasing; a better answer worded differently scores low |
| **LLM-as-judge** | A model grades output against a written rubric | Open-ended quality, tone, helpfulness, faithfulness | Carries the judge's own biases; needs calibration |
| **Human review** | People grade against the same rubric | Establishing ground truth, and anything high-stakes | Slow and expensive; use it to validate the other three |

```
Is correctness mechanically checkable?
├── Yes (a schema, a label, a test that passes)
│     └─► Programmatic. Cheapest, deterministic, no calibration needed
└── No
      ├── Do you have reference answers, and does wording matter little?
      │     └─► Reference similarity, with a judge as a second opinion
      └── Is the quality you care about describable in a rubric?
            ├── Yes ─► LLM-as-judge, calibrated against human labels
            └── No  ─► The property isn't defined well enough to grade yet.
                       Define it before writing the eval
```

Programmatic grading is under-used. A surprising share of what looks like open-ended output has a checkable core somewhere inside it, such as whether the JSON parses, whether the cited document ID exists, whether the extracted date is the right one, or whether the generated SQL runs. Grading that core deterministically is cheaper and more trustworthy than asking a model for an opinion about the whole response.

### LLM-as-Judge

Using a model to grade output is what makes open-ended evaluation affordable, and it works better than its reputation suggests. The [MT-Bench paper](https://arxiv.org/abs/2306.05685){:target="_blank" rel="noopener noreferrer"} (Zheng et al., NeurIPS 2023) found strong LLM judges agreed with human preferences more than 80% of the time, which matches the rate at which humans agree with each other. That sets the ceiling. A judge cannot be more consistent than the people whose judgment it is approximating.

The same paper names the biases that come with it, and each has a countermeasure:

| Bias | What happens | Countermeasure |
|---|---|---|
| **Position** | In a pairwise comparison, the judge favors one slot regardless of content | Run each comparison in both orders and keep only agreeing verdicts |
| **Verbosity** | Longer answers score higher without being better | Score length as its own criterion, or cap length before grading |
| **Self-enhancement** | A judge prefers text produced by itself or its own family | Use a different model family as judge than the one under test |
| **Limited reasoning** | Grades on math and logic are unreliable, since the judge has the same weaknesses | Grade those tasks programmatically against the correct answer |

Rubric design does more for judge quality than model choice. A rubric asking "rate the helpfulness of this response from 1 to 10" produces numbers with no stable meaning across runs. A rubric naming concrete, checkable properties produces grades you can act on. Prefer binary criteria ("does the response cite a source for every factual claim?") or a short ordinal scale with each level described, over a broad numeric scale nobody can apply consistently. Have the judge state its reasoning before its verdict, since a grade produced after an explanation is better than one produced before.

Calibrate before trusting. Have people grade a sample by the same rubric, compare against the judge, and measure how often they agree. Disagreement usually means the rubric is ambiguous rather than the judge being incapable, and fixing the rubric improves human consistency too. Recalibrate whenever the rubric or the judge model changes, because a judge is itself an LLM system, and a new snapshot underneath it is an unversioned dependency change.

### Grading Generated Output

Most quality rubrics for generated text reduce to three properties, each answering a different question about the same response.

| Property | What it measures | Fails when |
|---|---|---|
| **Groundedness** | Every claim traces to the material supplied in context | The model adds true-sounding detail that appears nowhere in its input |
| **Faithfulness** | The response represents that material accurately | The model reverses a condition, drops a qualifier, or overstates a hedge |
| **Relevance** | The response answers what was actually asked | The model returns accurate, well-grounded text about a different question |

These come apart in practice, so scoring them separately tells you more than one combined number does. A response can be perfectly grounded and useless, or highly relevant and quietly invented. A single "quality" score hides which of the three broke, and therefore hides what to fix.

---

## Regression Testing

Evals earn their keep by running automatically on every change to anything the system reads, not by being run by hand before a launch.

Treat prompts as versioned artifacts and run the suite on each change, the same way tests run on a code change. The suite should also run on a schedule even when nothing changed locally, because the model behind a floating alias can move underneath you. Pinning to a dated snapshot removes that surprise at the cost of having to migrate deliberately, which is the better trade for anything in production.

What to gate on takes some care. A hard pass/fail threshold on an aggregate score produces a suite people learn to bypass, since scores fluctuate for reasons unrelated to the change. Gating on movement works better. Block when an aggregate drops beyond normal run-to-run variation, and block outright when any case in a named critical subset regresses. A small set of cases that must never break, covering safety behavior, refusals, and the handful of flows the business depends on, gives a signal strong enough to stop a deploy on.

Record the whole run, not the headline number. When a score moves, you need to know which cases changed and how, and a stored per-case result answers that while an aggregate does not.

---

## Testing Agents

Agents need everything above plus one more axis, because an agent that reaches the right answer through a wildly wrong path will reach a wrong answer as soon as the task shifts.

| Test type | Purpose | Approach |
|---|---|---|
| **Tool unit tests** | Each tool behaves correctly on its own | Test the tool directly, with no model involved |
| **Tool selection** | The agent picks the right tool with the right arguments | Fixed scenarios with a known correct first call |
| **Trajectory** | The path to the answer is sound | Compare the sequence of calls against an acceptable path, allowing for valid alternatives |
| **Outcome** | The task actually got done | End-to-end scenarios checked against the final state, not the agent's own report |
| **Adversarial** | Unusual input and tool failures are handled | Inject tool errors, empty results, contradictory instructions, oversized inputs |

Outcome tests must check the world rather than the transcript. An agent claiming it sent the email is not evidence that the email was sent, and verifying against actual state is the only way to catch an agent that reports success it did not achieve.

Trajectory grading needs a tolerance for alternatives. Exact-sequence matching flags every acceptable variation as a failure and gets switched off within a week. Grade on properties instead: did it call the required tool at all, did it avoid the forbidden ones, did it finish within the step budget, did it repeat a call with identical arguments.

Cost and step count belong in the eval suite alongside correctness. An agent change that improves the success rate by two points while doubling token spend is a trade someone should make deliberately rather than discover on an invoice.

---

## Online Evaluation

Offline scores measure a system against cases you chose. Production measures it against everything else, and the gap between the two is where most surprises live.

```
   Production traffic
          │
          ▼
   ┌─────────────┐   sample failures,      ┌──────────────┐
   │   Traces    │   complaints, edge  ──► │ Eval dataset │
   │ + feedback  │   cases                 │  (versioned) │
   └──────┬──────┘                         └──────┬───────┘
          │                                       │
          │ implicit + explicit signals           │ runs on every
          │                                       │ prompt/model change
          ▼                                       ▼
   ┌─────────────┐                         ┌──────────────┐
   │ A/B compare │◄────── deploy ──────────│  CI gate     │
   │  variants   │                         └──────────────┘
   └─────────────┘
```

Capture three kinds of signal, each trading precision against volume. Explicit feedback, meaning thumbs and ratings, is precise but rare and skewed toward the annoyed. Implicit signals, such as whether the user accepted the suggestion, edited it heavily, retried the request, or abandoned the session, are noisy individually but plentiful. Downstream outcomes, like whether the ticket was resolved or the generated code survived review, are the closest thing to a ground truth the system has, and they arrive too late to gate a deploy.

A/B testing is the only way to attribute a production change to a variant, and it requires enough traffic for the difference to clear the noise. Where traffic is thin, shadow mode gives a cheaper answer. Run the new variant alongside the current one on live requests, serve only the current one, and compare the outputs offline.

The main job of online evaluation is feeding the offline suite. Every production failure that the eval set did not predict is a gap in the eval set, and adding it closes that gap permanently. A suite built this way converges on the real distribution over time, while a suite written once from imagination drifts away from it.

---

## Common Pitfalls

| Pitfall | What happens | Better approach |
|---|---|---|
| **Vibes-based iteration** | Prompt changes judged on a handful of favorite examples | Any fixed test set beats no test set; start with 20 cases and grow it |
| **Tuning against the whole set** | Scores rise while behavior on unseen requests does not | Hold out cases and never inspect them while iterating |
| **One aggregate score** | A regression in one behavior hides behind gains elsewhere | Track per-category scores and store per-case results |
| **Uncalibrated judge** | Confident grades that do not track what humans would say | Check judge agreement against human labels before trusting it |
| **Judging math and logic with a model** | The judge shares the weakness it is grading | Grade those programmatically against known answers |
| **Only happy-path cases** | The system passes and then breaks on the first unusual request | Build edge cases and past incidents into the set deliberately |
| **Grading the transcript for agents** | An agent that claims success passes | Verify the resulting state with a tool |
| **Evals run by hand before launch** | They stop being run | Wire the suite into CI and run it on a schedule too |
