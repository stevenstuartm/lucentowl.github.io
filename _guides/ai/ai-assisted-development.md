---
title: "AI-Assisted Development"
layout: guide
category: AI & Machine Learning
subcategory: Generative AI
description: "Practical strategies for effective AI-assisted coding: staying in control, verification workflows, context management, and avoiding common pitfalls."
tags: [ai, generative-ai, llm, development, practical, devops]
---

## The Right Mindset

### You Are the Architect

AI code generators are powerful tools, but they work best when you treat them as skilled assistants rather than autonomous developers. You bring domain knowledge, architectural vision, and accountability. The AI brings speed, pattern recognition, and tireless implementation capacity.

**What this means in practice**:
- You decide *what* to build and *why*; AI helps with *how*
- You review every change before it ships
- You understand the code that goes into your codebase
- You take responsibility for the output

### Write the Code You Can

If you can write something quickly and correctly, just write it. AI assistance has overhead: prompting, reviewing, correcting. For straightforward code you know well, that overhead exceeds the benefit.

**Use AI when**:
- The task involves boilerplate or repetitive patterns
- You're working in an unfamiliar language or framework
- You need to explore multiple approaches quickly
- The code requires synthesizing information from multiple sources

**Write it yourself when**:
- You can type it faster than you can explain it
- The logic is simple and you know exactly what you want
- The code involves critical security or business logic you need to deeply understand

### Don't Be Silly

Rushing leads to poor outcomes. Accepting code without reading it leads to bugs you don't understand. Asking AI to do something you couldn't verify leads to false confidence.

Common "silly" mistakes:
- Accepting large diffs without reviewing each change
- Letting AI modify files unrelated to your task
- Continuing to prompt when you don't understand the output
- Using AI-generated code you couldn't debug or explain
- Prompting for the same thing repeatedly expecting different results

---

## Workflow Strategies

### Plan Before You Code

Use planning modes (like Claude Code's plan mode) before jumping into implementation. Planning first:
- Forces you to articulate what you actually want
- Reveals ambiguities before they become bugs
- Creates a shared understanding between you and the AI
- Produces a reviewable approach before any code exists

**The pattern**:
1. Describe the goal and constraints
2. Let AI propose an approach
3. Review and refine the plan
4. Only then move to implementation

Planning prevents the frustrating cycle of generating code, finding it wrong, regenerating, finding it still wrong.

### Small, Focused Tasks

AI performs better on focused tasks than sprawling ones. A prompt asking to "refactor the authentication system" will produce worse results than a sequence of focused requests.

**Break work into**:
- Single-responsibility changes (one file, one concern)
- Clear inputs and outputs
- Verifiable steps

**Example decomposition**:
```
❌ "Add user authentication to the app"

✅ Sequential focused tasks:
1. "Create the User model with email and password hash fields"
2. "Add the login endpoint that validates credentials"
3. "Implement JWT token generation for authenticated users"
4. "Add middleware to protect routes requiring authentication"
```

### Iterate, Don't Expect Perfection

First outputs are drafts. Treat them as starting points for refinement, not finished products.

**Effective iteration**:
- Review the output and identify specific issues
- Provide targeted feedback: "The error handling is missing for the null case"
- Ask for explanations: "Why did you use a dictionary here instead of a class?"
- Request alternatives: "Show me a different approach using async/await"

### Commit Frequently

AI can make sweeping changes quickly. Frequent commits create restore points.

**Discipline**:
- Commit before asking AI to make significant changes
- Commit after each verified, working increment
- Use descriptive commit messages (AI can help write these)
- Don't let multiple AI-assisted changes pile up uncommitted

---

## Context Management

### Explicit Over Implicit

AI cannot read your mind or your codebase's history. State your constraints, conventions, and expectations explicitly.

**Be explicit about**:
- Language version and framework conventions
- Error handling patterns used in the codebase
- Naming conventions
- Dependencies that are or aren't available
- Performance requirements

**Example**:
```
❌ "Add a caching layer"

✅ "Add a caching layer using IMemoryCache (already in our DI container).
   Follow our existing pattern in UserService.cs for cache key naming.
   Cache entries should expire after 5 minutes.
   Log cache hits/misses using our ILogger pattern."
```

### Share Relevant Context

AI assistants work better with more context, but irrelevant context adds noise. Share what's relevant.

**High-value context**:
- The file(s) being modified
- Related interfaces or contracts
- Test files showing expected behavior
- Error messages and stack traces
- Examples of similar implementations in your codebase

**Low-value context**:
- Entire codebases "just in case"
- Unrelated configuration files
- Historical context that doesn't affect current implementation

### Use MCP Servers for Persistent Context

Model Context Protocol (MCP) servers provide AI tools with access to external data sources, documentation, and services. This creates persistent, up-to-date context without manual copying.

**Common MCP integrations**:
- Database schemas and documentation
- API specifications
- Internal wikis and documentation
- Issue trackers and project management tools

**Benefits**:
- AI can query current state rather than relying on stale information
- Reduces prompt length by providing context on-demand
- Enables AI to verify assumptions against real data

---

## Verification Strategies

### Trust But Verify

AI-generated code can look correct and be subtly wrong. Verification isn't optional.

**Verification layers**:
1. **Read the code**: Understand what it does before running it
2. **Static analysis**: Let linters catch obvious issues
3. **Tests**: Prove the code does what you expect
4. **Runtime observation**: See the code actually work

### Use Linting and Static Analysis

Configure your linter strictly. Let tooling catch issues before you even read the output.

**Why this works**:
- Catches syntax errors, type mismatches, unused variables
- Enforces coding standards automatically
- Provides immediate feedback on AI output
- Frees your review time for logic and design issues

**Practical setup**:
- Run linting on save or in a pre-commit hook
- Treat warnings as errors during development
- Share your linting config with the AI so it generates conformant code

### Test-Driven Development with AI

TDD pairs powerfully with AI assistance. Write the test first, then let AI implement to pass the test.

**The pattern**:
1. Write a failing test that specifies the behavior you want
2. Ask AI to implement code that passes the test
3. Run the test to verify
4. Refactor with confidence (tests catch regressions)

**Example workflow**:
```
You: "Here's my failing test. Implement the CalculateDiscount method to pass it."

[paste test]

AI: [implements method]

You: [runs test - passes]

You: "Good. Now add test cases for edge cases: zero quantity, negative price,
     discount exceeding 100%"

AI: [adds tests - some fail]

You: "Update the implementation to handle these edge cases"
```

### Debug Logging Strategy

One of the most powerful AI-assisted workflows: have AI add debug logging, run the code, then share the output back with AI to diagnose issues. This collaborative loop can save hours of manual troubleshooting.

**The workflow**:
1. Describe the issue or unexpected behavior
2. Ask AI to add debug logging at key points
3. Run the code with test data
4. Share the log output back with AI
5. AI analyzes the actual data and state to identify the problem

**Why this works**: Instead of you manually reading logs and reasoning about what went wrong, AI sees the actual data flowing through the system. It can quickly spot where values diverge from expectations, where null references sneak in, or where transformations produce unexpected results.

**Example conversation**:
```
You: "Orders with multiple line items are calculating tax incorrectly.
      Add debug logging to trace the tax calculation flow."

AI: [adds logging showing inputs, intermediate calculations, and outputs]

You: [runs code, pastes log output]
     "Here's what I see for order #1234..."

AI: "The issue is on line 47. The tax rate is being applied per-item
     before the discount, but the discount is applied to the subtotal.
     The log shows: subtotal=$100, discount=$10, but tax was calculated
     on $100 instead of $90. Here's the fix..."
```

After resolving the issue, remove or gate the debug logging behind a flag.

### Run the Code, Observe the Data

Don't just read AI-generated code; execute it. Observe real inputs and outputs.

**Practices**:
- Run with representative test data
- Check edge cases explicitly
- Compare output to expected results
- Use debuggers to step through complex logic

This is where AI can save days of work. Instead of reasoning about what code *might* do, you see what it *actually* does.

---

## Anti-Patterns

### Accepting Changes You Don't Understand

If you can't explain what the code does, you can't debug it when it breaks. And it will break.

**Signs you're in trouble**:
- You're copy-pasting without reading
- You can't explain why a particular approach was chosen
- You don't know what would happen if inputs changed
- You couldn't modify the code without AI help

**Recovery**: Ask the AI to explain. Step through with a debugger. Rewrite simpler if needed.

### Letting AI Change Unrelated Code

AI assistants sometimes "helpfully" modify code beyond what you asked. This creates unexpected changes that break things in surprising ways.

**Prevention**:
- Be explicit about scope: "Only modify the AuthService class"
- Review diffs carefully before accepting
- Use version control to identify unexpected changes
- Reject changes that touch unrelated files

### Prompting Without Direction

Vague prompts produce vague results. "Make it better" teaches you nothing and wastes cycles.

**Instead of vague prompts**:
```
❌ "Fix the bug"
✅ "The login fails when email contains a plus sign.
    The error is 'invalid email format' from line 47 of AuthValidator.cs"

❌ "Optimize this"
✅ "This query takes 3 seconds on 10k rows.
    Profile shows full table scan. Add appropriate indexes
    or restructure to use the existing user_id index."
```

### Continuing When Stuck

If you've prompted the same thing multiple ways and keep getting wrong results, stop. The AI either lacks necessary context or the task isn't suitable for AI assistance.

**When to stop**:
- Same error after 3+ attempts with different prompts
- AI keeps misunderstanding a core requirement
- Outputs are getting worse, not better
- You're spending more time prompting than coding would take

**Recovery options**:
- Add more context (examples, constraints, related code)
- Break the task into smaller pieces
- Write this part yourself and use AI for the next task
- Research the problem independently, then return with better understanding

---

## Quick Reference

### Before You Prompt

| Check | Why |
|-------|-----|
| Can I write this faster myself? | Avoid overhead for simple tasks |
| Is my request focused and specific? | Broad requests produce poor results |
| Have I committed recent changes? | Create a restore point |
| Do I have verification ready? | Tests, linting, debug environment |

### Effective Prompting Checklist

- State the goal explicitly
- Include relevant context (files, constraints, patterns)
- Specify what NOT to change
- Mention conventions to follow
- Include examples if the pattern isn't obvious

### Verification Checklist

- [ ] Read and understand the generated code
- [ ] Linting passes with no warnings
- [ ] Tests pass (or new tests added and passing)
- [ ] Ran with realistic test data
- [ ] Checked edge cases
- [ ] Diff shows only expected changes

### Red Flags

| Warning Sign | Action |
|--------------|--------|
| Large diff you haven't fully read | Stop and review every line |
| Changes to files you didn't mention | Reject and re-prompt with explicit scope |
| Code you couldn't explain to a colleague | Ask AI to explain or rewrite simpler |
| Same error after 3 attempts | Step back, add context, or do it manually |
| "It works but I don't know why" | Understand before committing |
