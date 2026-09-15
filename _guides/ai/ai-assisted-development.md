---
title: "AI-Assisted Development"
layout: guide
category: AI & Machine Learning
subcategory: AI in Engineering Practice
description: "Getting value from a coding assistant, covering what the evidence actually shows about the speedup, deciding what to delegate, supplying context the model cannot infer, verification that catches plausible-looking wrong code, and reviewing generated code for security."
tags: [coding-assistants, code-review, verification, tdd, developer-workflow, practical]
---

A coding assistant shifts where your effort goes rather than removing it. Less time is spent typing and recalling syntax, and more is spent specifying, reviewing, and verifying. Whether that trade comes out ahead depends almost entirely on how disciplined the second half is, which is what this guide is about.

## The Speedup Is Not Automatic

The most useful evidence on this is uncomfortable. METR ran a [randomized controlled trial](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/){:target="_blank" rel="noopener noreferrer"} with 16 experienced open-source developers working on 246 issues drawn from their own large repositories rather than synthetic tasks, randomly assigning whether AI tools were permitted per issue. Developers took **19% longer** on the issues where they used AI. They had predicted a 24% speedup beforehand, and after the slowdown had happened, still believed AI had sped them up by 20%.

METR is careful about what this does and does not show. The participants were experienced contributors working in codebases they knew deeply, which is close to the worst case for assistance, since the model's advantage is largest exactly where your own knowledge is thinnest. It does not show that AI fails to help most developers, and it does not predict how newer tools or more practiced users perform.

The part that generalizes is the perception gap. Developers were wrong about their own speed by roughly 40 percentage points, in the flattering direction. Time spent waiting on generation, reading a diff, and correcting an approach does not feel like work in the way typing does, so it is systematically under-counted. Anyone deciding where to apply assistance on intuition alone is deciding on a signal known to be unreliable.

The practical conclusion is not to avoid the tools. It is that "this feels faster" is not evidence, and that the places assistance helps most are specific rather than universal.

---

## Deciding What to Delegate

Assistance carries overhead: describing the task, reading the result, and correcting it. Where you could type the code faster than you could describe it, that overhead is the whole transaction.

| Favors the assistant | Favors writing it yourself |
|---|---|
| An unfamiliar language, framework, or API | Code you know well in a codebase you know well |
| Boilerplate and mechanical repetition | Logic that is short and precisely known |
| Exploring several approaches quickly | Security-critical or business-critical logic you need to hold in your head |
| Synthesizing scattered documentation into working code | Anything where explaining the constraints is the hard part |
| Writing tests against behavior you can state | Work where the specification is still moving |

The last row on each side is the one that decides most cases. Where you can state precisely what you want, a model is good at producing it. Where stating it is itself the difficulty, prompting turns into a slow way of thinking out loud.

Familiarity cuts the other way from intuition. The instinct is to reach for help on the hard, unfamiliar parts and handle the routine yourself, but the routine parts are where the model is most reliable and the review is cheapest. The unfamiliar parts are where you are least able to tell good output from plausible output.

---

## Working in Small, Verifiable Steps

### Plan Before Implementation

Getting an approach agreed before any code exists catches ambiguity while it is still cheap. Most assistants offer a mode that proposes an approach without editing anything, and the same effect is available anywhere by asking for a plan first.

The value is less in the model's plan than in what producing one forces out of you. A goal vague enough to produce a wrong plan was vague enough to produce wrong code, and a plan is faster to read and reject than a diff.

### Keep Each Task Small

"Add user authentication to the app" produces sprawling output that is hard to review and harder to correct. The same work as four requests, each with a clear input and a checkable result, produces better code and a review you can actually do:

```
1. Create the User model with email and password hash fields
2. Add the login endpoint that validates credentials
3. Implement token generation for authenticated users
4. Add middleware to protect routes requiring authentication
```

Each step ends somewhere you can run something. That matters more than the size of the step, because an increment you cannot verify is one you are accepting on faith no matter how small it is.

### Commit as a Restore Point

An assistant can rewrite a lot of files quickly, and "undo" stops being a meaningful operation several exchanges in. Commit before anything substantial and after each verified increment, so that discarding a bad direction costs nothing and the diff you review is only the change you asked for.

---

## Supplying Context the Model Cannot Infer

### Be Explicit About Constraints

The model sees what you put in front of it. Conventions your team settled three years ago, the caching library already in the container, the error-handling pattern used everywhere else: none of it is visible unless something in the context shows it.

```
❌ "Add a caching layer"

✅ "Add a caching layer using IMemoryCache (already in our DI container).
   Follow the cache key naming in UserService.cs.
   Entries expire after 5 minutes.
   Log hits and misses through our existing ILogger pattern."
```

The most valuable thing you can add is an existing example. "Do this the way `UserService.cs` does it" carries more than a paragraph describing the convention, and it stays accurate as the convention evolves.

Say what not to touch as well as what to do. Scope creep into unrelated files is common, and a stated boundary both reduces it and makes an out-of-scope change obvious in the diff.

### Choose Context Deliberately

More context is not better context. Everything in the window competes for the model's attention and is billed on every subsequent turn, and irrelevant material makes the relevant material harder to find.

High-value context is the files being changed, the interfaces they implement, tests showing expected behavior, the actual error message and stack trace, and one example of the pattern to follow. Low-value context is whole repositories added speculatively, unrelated configuration, and history that does not bear on the change.

Where an assistant can query systems directly, through a Model Context Protocol server or an equivalent integration, it can pull current schemas, specifications, and issue details on demand instead of working from whatever was pasted in an hour ago. That trades a large upfront context for a small one plus the ability to look things up, which is usually the better shape.

---

## Verification

### The Review Burden Moves

Generating code is now cheaper than reviewing it, which inverts the usual constraint. The limiting factor on an AI-assisted change is how much code you can genuinely read, and accepting more than that is the origin of most of the trouble in this section.

Plausibility is the specific hazard. Hand-written wrong code usually looks wrong somewhere, while generated wrong code is fluent, idiomatic, consistently named, and wrong in the middle. Reading for style tells you nothing. Reading for behavior is the only review that counts.

### Let Tooling Review First

Static analysis is the cheapest reviewer available, and it never gets bored on the fortieth diff of the day. Configure linting and type checking strictly, run them automatically on save or in a pre-commit hook, and treat warnings as errors during development. Every issue a tool catches is one your attention does not have to spend, leaving it for logic and design where tooling cannot help.

Put the linter configuration in the model's context too, since output that already conforms needs fewer correction rounds.

### Tests as the Specification

Test-first work pairs unusually well with assistance, because a failing test is an unambiguous specification and an automatic check in one. Write the test that describes the behavior, have the model implement against it, and run it.

Watch for the specific way this goes wrong. A model asked to make a test pass may modify the test. Review test changes at least as carefully as implementation changes, since a weakened assertion removes the verification you were relying on while leaving everything green.

### The Debug Logging Loop

One workflow repays its cost more than any other. Rather than reasoning about why something misbehaves, have the model add logging at the points where values could diverge, run it, and paste the output back.

```
You: "Orders with multiple line items calculate tax incorrectly.
      Add debug logging to trace the tax calculation."

AI:  [adds logging at inputs, intermediate values, and outputs]

You: [runs it, pastes the log]

AI: "Tax is applied per-item before the discount, but the discount
     applies to the subtotal. The log shows subtotal=$100, discount=$10,
     and tax computed on $100 rather than $90."
```

This works because it replaces speculation with observation. The model is reasoning about the values that actually flowed rather than the values the code appears to produce, and that distinction is where most stubborn bugs hide. Remove or flag-gate the logging once the issue is resolved.

### Run It and Look at the Data

Reading generated code tells you what it was meant to do. Running it with representative data, checking the edges deliberately, and comparing output against what you expected tells you what it does. For anything non-trivial, do both, in that order.

---

## Reviewing Generated Code for Security

Generated code carries some risks that hand-written code does not, and they are invisible to a review looking only at logic.

### Hallucinated Dependencies

Models invent package names. A [study of 576,000 generated code samples](https://arxiv.org/abs/2406.10279){:target="_blank" rel="noopener noreferrer"} found non-existent packages recommended at a rate of at least 5.2% for commercial models and 21.7% for open-source ones, across 205,474 unique invented names.

The security consequence is that invented names are predictable and repeatable, so an attacker can register one and wait for the next developer to install it. Verify that every new dependency in a generated diff actually exists, is the package you meant, and is one your project should be pulling in. A lockfile and a dependency allowlist turn this from a per-review judgment into an automated check.

### The Usual Classes, Reached by a New Route

Everything else is conventional, and the point is that generated code does not get a pass on any of it. Check for credentials and tokens inlined as literals, because models reproduce patterns from training data including the bad ones. Check that input reaching a query, a shell, or a deserializer is parameterized. Check that authorization is enforced rather than merely mentioned. Check that the licence of any copied-looking block is compatible with your project.

Run the same security tooling you would on hand-written code, and give the generated portions more attention rather than less. A reviewer who reads a fluent diff quickly is the mechanism by which these reach production.

---

## Knowing When to Stop

Repeating a prompt with variations, hoping for different output, is the most common way to lose an afternoon. Treat a few specific conditions as signals to stop rather than continue:

- The same failure after three attempts with genuinely different phrasings
- The model repeatedly misunderstanding a core requirement
- Output getting worse across attempts rather than better
- More time spent prompting than writing it yourself would have taken
- Not understanding the current state of the code well enough to describe what is wrong with it

Each has a different recovery. A missing-context problem is fixed by adding the example or the constraint that was absent. A too-large-task problem is fixed by decomposition. Anything else is fixed by writing this part yourself, which is a normal outcome and not a failure of the approach.

The last condition deserves its own treatment, because continuing past it is how a codebase accumulates code nobody can maintain. If you cannot explain what a change does, you cannot debug it when it breaks. Revert it, or have it explained until you can, before committing.

---

## Common Pitfalls

| Pitfall | What happens | Better approach |
|---|---|---|
| **Accepting a diff larger than you read** | Bugs enter the codebase with no one who understands them | Cap the change size at what you will genuinely review |
| **Judging speed by feel** | Assistance gets applied where it slows you down | Reserve it for work where the model has an edge, and check outcomes |
| **Reaching for help on the least familiar code** | Exactly where you cannot distinguish correct from plausible | Use it most where review is cheap, and slow down where it is not |
| **Letting the model touch unrelated files** | Surprising breakage far from the change | State the scope, and reject diffs that exceed it |
| **Letting tests be modified to pass** | Green suite, lost verification | Review test changes at least as carefully as implementation |
| **Trusting new dependencies** | Invented package names are a live supply-chain attack | Verify every added dependency exists and belongs |
| **Prompting without specifics** | Vague requests produce vague code and waste cycles | Name the symptom, the file, the error, and the constraint |
| **Continuing when stuck** | Attempts get worse and time disappears | Stop at three, then add context, decompose, or write it yourself |
| **Committing code you cannot explain** | Unmaintainable code with no owner who understands it | Understand it, simplify it, or revert it |

### Before Committing an AI-Assisted Change

- [ ] You can explain what every changed line does and why
- [ ] The diff touches only what you asked for
- [ ] Linting and type checking pass clean
- [ ] Tests pass, and any modified test still asserts what it did before
- [ ] It has been run with realistic data, edge cases included
- [ ] New dependencies have been verified to exist and to belong
- [ ] No credentials, tokens, or connection strings appear as literals
