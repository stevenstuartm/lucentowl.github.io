---
title: "AI Agents"
layout: guide
category: AI & Machine Learning
subcategory: Generative AI
description: "Understanding agentic AI: autonomous task completion, tool use, planning, multi-agent systems, and building reliable agent workflows."
tags: [ai, generative-ai, llm, agents, tools, automation, practical]
---


## What Are AI Agents?

AI agents are systems that use large language models to autonomously accomplish goals. Unlike simple chatbots that respond to single queries, agents can plan multi-step tasks, use tools, observe results, and iterate until they achieve an objective.

**The key distinction**: A chatbot answers questions. An agent completes tasks.

### From Chatbot to Agent

| Capability | Chatbot | Agent |
|------------|---------|-------|
| **Interaction** | Single turn or conversation | Goal-oriented task completion |
| **Planning** | None | Breaks goals into steps |
| **Tool use** | None | Calls external tools and APIs |
| **Feedback loops** | None | Observes results, adjusts approach |
| **Autonomy** | Waits for each prompt | Acts independently toward goal |

### Agent Capabilities

Agents extend LLM capabilities through:

- **Reasoning**: Breaking complex goals into manageable steps
- **Tool use**: Executing code, calling APIs, reading files
- **Memory**: Maintaining context across interactions
- **Observation**: Processing tool outputs and environment state
- **Iteration**: Refining approach based on results

---

## The Agent Loop

Most agents follow a core loop: Observe → Think → Act → Repeat.

### Basic Agent Loop

```
┌─────────────────────────────────────────┐
│                  Goal                    │
└─────────────────┬───────────────────────┘
                  ▼
         ┌───────────────┐
         │    Observe    │◄──────────────┐
         │  (read state) │               │
         └───────┬───────┘               │
                 ▼                       │
         ┌───────────────┐               │
         │     Think     │               │
         │   (reason)    │               │
         └───────┬───────┘               │
                 ▼                       │
         ┌───────────────┐               │
         │      Act      │               │
         │  (use tools)  │───────────────┘
         └───────┬───────┘
                 ▼
         ┌───────────────┐
         │  Goal met?    │
         └───────┬───────┘
                 ▼
              Complete
```

### ReAct Pattern

The ReAct (Reasoning + Acting) pattern formalizes this loop:

1. **Thought**: Agent reasons about what to do next
2. **Action**: Agent selects and invokes a tool
3. **Observation**: Agent receives tool output
4. **Repeat**: Until task is complete

**Example trace**:
```
Goal: Find the latest sales figures and email them to the team

Thought: I need to query the database for recent sales data
Action: query_database("SELECT * FROM sales WHERE date > '2024-01-01'")
Observation: [sales data returned]

Thought: I have the data. Now I need to format it for email
Action: format_report(sales_data, format="summary")
Observation: [formatted report]

Thought: Report ready. Now send the email
Action: send_email(to="team@company.com", subject="Sales Update", body=report)
Observation: Email sent successfully

Thought: Task complete
```

---

## Agent Execution Architecture

The agent loop describes the logical flow of observe-think-act. The execution architecture describes where each of those steps runs physically. In most current AI agent systems, there is a split between local execution and remote inference that has significant implications for data flow and security.

### The Local-Execution / Remote-Inference Split

Most developer-facing AI agents (Claude Code, Cursor, GitHub Copilot, Cline) follow the same architectural pattern: tools execute on the developer's machine while model inference runs on the provider's servers.

```
Developer Workstation                          Provider Cloud
┌──────────────────────────────────────────┐
│                                          │
│  Agent Runtime                           │
│  ┌────────────────────────────────────┐  │
│  │                                    │  │
│  │  ┌──────────┐  ┌──────────────┐   │  │
│  │  │   Tool   │  │     File     │   │  │
│  │  │Execution │  │   System     │   │  │
│  │  │(bash,    │  │  (read,      │   │  │
│  │  │ scripts) │  │   write,     │   │  │
│  │  │          │  │   search)    │   │  │
│  │  └────┬─────┘  └──────┬───────┘   │  │
│  │       │               │           │  │
│  │  ┌────┴───┐   ┌───────┴────────┐  │  │
│  │  │  MCP   │   │ Git, Search,  │  │  │
│  │  │Servers │   │ Grep, etc.    │  │  │
│  │  └────┬───┘   └───────┬────────┘  │  │
│  │       │               │           │  │
│  │       └───────┬───────┘           │  │
│  │               │                   │  │
│  │        Tool results               │  │
│  │               │                   │  │
│  │               ▼                   │  │
│  │      ┌────────────────┐           │  │
│  │      │Context Builder │           │  │      ┌──────────────┐
│  │      │(assembles msg  │───────────┼──┼─────►│  LLM API     │
│  │      │ for LLM API)  │◄──────────┼──┼──────│ (Claude,     │
│  │      └────────────────┘           │  │      │  GPT, etc.)  │
│  │                                    │  │      │              │
│  └────────────────────────────────────┘  │      │ Returns:     │
│                                          │      │ - Text       │
└──────────────────────────────────────────┘      │ - Tool calls │
                                                  └──────────────┘
```

The model never runs locally (unless using a self-hosted model). It receives the full conversation context, including all tool results, and returns either a text response or instructions to call more tools. Those instructions execute locally, and the cycle repeats.

### Agent Session Lifecycle

Each cycle in the agent loop crosses the network boundary. Here is one complete iteration with the boundary marked:

```
  LOCAL EXECUTION                           REMOTE INFERENCE
  ───────────────                           ────────────────

  1. User provides goal
        │
        ▼
  2. Assemble initial context
     (system prompt + user goal)
        │
        ├──────── HTTPS ──────────────► 3. Model reasons about goal
        │                                     │
        │                                     ▼
        │                               4. Model returns tool call
        │                                  (e.g., "read file X")
        │◄─────── HTTPS ───────────────
        │
        ▼
  5. Execute tool locally
     (read file X from disk)
        │
        ▼
  6. Append tool result to context
        │
        ├──────── HTTPS ──────────────► 7. Model sees file contents,
        │                                  reasons about next step
        │                                     │
        │                                     ▼
        │                               8. Returns next tool call
        │◄─────── HTTPS ───────────────    or final response
        │
        ▼
  9. Execute next tool locally
     ...cycle repeats...
```

Every rightward arrow is data leaving the developer's machine. Each inference request sends the entire conversation context to the remote API, which means all previous tool results are included. If the agent read a file in step 5, the contents of that file are sent to the remote API in step 6. If the agent executed a bash command, the output of that command goes with it.

This accumulation matters. By step 20 of an agent session, the inference request may contain the contents of dozens of files, command outputs, and search results, all sent over HTTPS to the model provider.

### What Runs Where

| Operation | Executes Locally | Sent to Remote API as Context |
|-----------|-----------------|-------------------------------|
| **File reads** | File content read from disk | Full file content included in next inference request |
| **Bash commands** | Command executed in local shell | Command output included in next inference request |
| **Git operations** | Executed via local git | Diffs, logs, and status output included |
| **MCP server tools** | Tool runs as local process | Tool results included in next inference request |
| **Web searches** | Varies by implementation | Search results included in next inference request |
| **Model reasoning** | Does not run locally | Happens entirely on provider servers |
| **Tool selection** | Does not run locally | Model decides remotely, sends instructions back |

For a deeper look at how MCP servers handle data flow across these boundaries, see the [Model Context Protocol](/study-guides/ai/model-context-protocol.html#transport-architecture) guide.

### Privacy Implications

The local-execution / remote-inference split means source code, configuration files, and command outputs are sent to the model provider's infrastructure for inference. Enterprise API agreements typically govern how this data is handled, including retention windows (usually 30 days for abuse monitoring) and explicit exclusion from model training. Free-tier usage may permit data retention for model improvement unless the user opts out.

The agent cannot reason about data it has not been sent, so there is no way to get model assistance on a file without that file's contents crossing the network. Context window limits provide a natural ceiling on how much data is in flight at any given time, but over a long session the cumulative data transmitted can be substantial.

For organizational controls around managing this data flow, see the [AI Security for Organizations](/study-guides/ai/ai-security-for-organizations.html) guide.

---

## Tool Use

Tools are the primary way agents interact with the world beyond generating text.

### What Are Tools?

Tools are functions the agent can call. Each tool has:
- **Name**: How the agent references it
- **Description**: What the tool does (critical for agent's decision-making)
- **Parameters**: What inputs it accepts
- **Output**: What it returns

### Common Tool Categories

| Category | Examples | Purpose |
|----------|----------|---------|
| **Information retrieval** | Web search, database query, file read | Get data the agent needs |
| **Computation** | Calculator, code execution | Perform precise calculations |
| **Communication** | Send email, post message | Interact with users or services |
| **State modification** | Write file, update database | Change external state |
| **Specialized** | Image analysis, code linting | Domain-specific operations |

### Tool Definition Example

```json
{
  "name": "search_documentation",
  "description": "Search the product documentation for relevant information. Use this when you need to answer questions about product features, APIs, or troubleshooting steps.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "The search query describing what information you need"
      },
      "max_results": {
        "type": "integer",
        "description": "Maximum number of results to return",
        "default": 5
      }
    },
    "required": ["query"]
  }
}
```

### Tool Selection

Agents choose tools based on their descriptions. Good descriptions are crucial:

**Poor description**:
```
"name": "db_query"
"description": "Queries the database"
```

**Better description**:
```
"name": "query_customer_database"
"description": "Search the customer database by name, email, or account ID.
               Returns customer records including contact info and account status.
               Use this when you need to look up specific customer information."
```

### Tool Design Principles

| Principle | Why It Matters |
|-----------|---------------|
| **Single responsibility** | Easier for agent to understand and use correctly |
| **Clear descriptions** | Agent's only guide for when/how to use |
| **Predictable outputs** | Agent needs to parse and reason about results |
| **Error messages** | Help agent recover from failures |
| **Idempotent when possible** | Safe to retry on failure |

---

## Planning and Reasoning

Effective agents don't just react; they plan.

### Planning Approaches

#### Zero-Shot Planning

Agent receives goal and reasons step-by-step without examples.

```
Goal: Deploy the application to production

Let me think through the steps:
1. First, I should run the tests to ensure code quality
2. Then build the production artifact
3. Then deploy to staging for verification
4. Then deploy to production
5. Finally, verify the deployment succeeded
```

#### Few-Shot Planning

Agent is given examples of similar tasks and their plans.

```
Example 1:
Goal: Add a new API endpoint
Plan: 1. Create route handler 2. Implement business logic 3. Add tests 4. Update docs

Example 2:
Goal: Fix the login bug
Plan: 1. Reproduce issue 2. Identify root cause 3. Implement fix 4. Add regression test

Now plan for:
Goal: Optimize database queries
```

#### Hierarchical Planning

Complex goals are decomposed into subgoals, each with their own plans.

```
Goal: Launch new feature

Subgoal 1: Implement backend
  - Create database schema
  - Build API endpoints
  - Write tests

Subgoal 2: Implement frontend
  - Design components
  - Integrate with API
  - Write tests

Subgoal 3: Deploy and monitor
  - Deploy to staging
  - Run integration tests
  - Deploy to production
```

### Reasoning Strategies

Agents leverage prompting techniques to reason effectively. See the [Prompt Engineering](/study-guides/ai/prompt-engineering.html) guide for detailed coverage of these techniques.

| Technique | Agent Application |
|-----------|-------------------|
| **Chain-of-Thought** | Agent reasons through each step before acting |
| **Tree-of-Thought** | Agent explores multiple approaches before selecting |
| **Self-Consistency** | Agent generates multiple solutions and picks the best |

#### Self-Reflection

Unique to agents: evaluating their own outputs and adjusting approach.

```
Action result: Query returned 0 results

Reflection: The query returned no results. This could mean:
1. The search terms were too specific
2. The data doesn't exist
3. There's a syntax error in my query

Let me try a broader search first...
```

---

## Memory and Context

Agents need memory to work on complex tasks that span multiple interactions.

### Types of Memory

| Type | Duration | Purpose | Example |
|------|----------|---------|---------|
| **Working memory** | Current task | Immediate context | Current conversation, recent tool outputs |
| **Short-term memory** | Session | Recent interactions | What was discussed earlier |
| **Long-term memory** | Persistent | Learned knowledge | User preferences, past decisions |

### Memory Implementations

#### Conversation History

Simplest form: keep recent messages in context.

**Limitation**: Context window limits how much history fits.

#### Summarization

Periodically summarize old context to compress it.

```
Original: [50 messages of detailed conversation]
Summary: "User asked to refactor the authentication module.
         We identified 3 issues and fixed 2. Remaining: session timeout handling."
```

#### Vector-Based Memory

Store memories as embeddings, retrieve relevant ones.

**Flow**:
1. Embed each memory/interaction
2. When context is needed, embed the query
3. Retrieve most similar memories
4. Include in prompt

#### Structured Memory

Store specific facts in structured format.

```json
{
  "user_preferences": {
    "language": "TypeScript",
    "style": "functional",
    "testing_framework": "Jest"
  },
  "project_context": {
    "repo": "acme/widget-service",
    "branch": "feature/new-auth"
  }
}
```

---

## Multi-Agent Systems

Complex tasks can benefit from multiple specialized agents working together.

### Why Multiple Agents?

| Benefit | Description |
|---------|-------------|
| **Specialization** | Each agent optimized for specific tasks |
| **Parallelization** | Multiple agents work simultaneously |
| **Separation of concerns** | Clear boundaries between responsibilities |
| **Checks and balances** | Agents can review each other's work |

### Multi-Agent Patterns

#### Orchestrator-Worker

A central orchestrator agent plans the work and assigns tasks to specialized worker agents that execute independently.

```
┌────────────────┐
│  Orchestrator  │
│   (planning)   │
└───────┬────────┘
        │ assigns tasks
   ┌────┼────┬────────┐
   ▼    ▼    ▼        ▼
┌────┐┌────┐┌────┐┌────────┐
│Code││Test││Docs││Security│
│Agent│Agent│Agent│ Agent  │
└────┘└────┘└────┘└────────┘
```

#### Pipeline

Agents process work sequentially, with each agent handling one stage and passing results to the next.

```
Request → [Intake Agent] → [Analysis Agent] → [Implementation Agent] → [Review Agent] → Result
```

#### Debate/Consensus

Multiple agents propose solutions and critique each other's work, with an arbiter making final decisions.

```
┌──────────┐    ┌──────────┐
│ Agent A  │◄──►│ Agent B  │
│ (propose)│    │(critique)│
└────┬─────┘    └────┬─────┘
     │               │
     └───────┬───────┘
             ▼
      ┌─────────────┐
      │   Arbiter   │
      │  (decides)  │
      └─────────────┘
```

#### Hierarchical

Agents manage other agents in a hierarchy.

```
         ┌─────────────┐
         │   Manager   │
         └──────┬──────┘
      ┌─────────┼─────────┐
      ▼         ▼         ▼
┌──────────┐┌──────────┐┌──────────┐
│Team Lead ││Team Lead ││Team Lead │
│ Backend  ││ Frontend ││   QA     │
└────┬─────┘└────┬─────┘└────┬─────┘
     │           │           │
   workers     workers     workers
```

### Communication Between Agents

| Method | Description | Use Case |
|--------|-------------|----------|
| **Shared memory** | Common context all agents access | Small, tightly coupled teams |
| **Message passing** | Explicit messages between agents | Loosely coupled, async |
| **Blackboard** | Central knowledge store agents read/write | Complex collaboration |

---

## Building Reliable Agents

Agents can fail in unexpected ways. Building reliability requires intentional design.

### Failure Modes

| Failure | Description | Mitigation |
|---------|-------------|------------|
| **Infinite loops** | Agent repeats same action | Step limits, loop detection |
| **Tool errors** | External tools fail | Error handling, retries |
| **Hallucinated actions** | Agent invents non-existent tools | Strict tool validation |
| **Goal drift** | Agent loses track of objective | Regular goal reminder |
| **Context overflow** | Too much state for context window | Summarization, memory management |

### Guardrails

#### Action Limits

```python
max_iterations = 20
max_tool_calls = 50
max_cost = 10.00  # dollars
```

Stop execution if limits exceeded.

#### Human-in-the-Loop

Require human approval for sensitive actions:
- State-modifying operations
- External communications
- High-cost operations
- Irreversible actions

#### Output Validation

Verify agent outputs before using them:
- Schema validation for structured outputs
- Sanity checks on values
- Security scanning for generated code

### Observability

Track agent behavior for debugging and improvement:

| Metric | Why Track |
|--------|-----------|
| **Steps to completion** | Efficiency, potential issues |
| **Tool usage patterns** | Which tools are useful |
| **Error rates** | Reliability issues |
| **Token usage** | Cost management |
| **Time to completion** | Performance |

### Testing Agents

| Test Type | Purpose | Approach |
|-----------|---------|----------|
| **Unit tests** | Individual tools work | Mock agent, test tool outputs |
| **Integration tests** | Agent uses tools correctly | Controlled scenarios |
| **Scenario tests** | End-to-end task completion | Representative tasks |
| **Adversarial tests** | Handle edge cases | Unusual inputs, failures |

---

## Agent Frameworks

Several frameworks simplify building agents.

### Framework Comparison

| Framework | Strengths | Best For |
|-----------|-----------|----------|
| **LangChain/LangGraph** | Extensive tools, composability | Complex workflows |
| **AutoGen** | Multi-agent conversations | Research, multi-agent systems |
| **CrewAI** | Role-based agents | Team simulations |
| **Semantic Kernel** | .NET/enterprise focus | Microsoft ecosystem |
| **Haystack** | RAG + agents | Document-heavy applications |

### When to Use a Framework

**Use a framework when**:
- Building complex multi-agent systems
- Need many pre-built integrations
- Want established patterns
- Team benefits from structure

**Build custom when**:
- Simple, focused agent
- Need full control over behavior
- Framework overhead isn't justified
- Learning how agents work

---

## Practical Considerations

### Cost Management

Agents can be expensive due to multiple LLM calls per task.

| Strategy | Impact |
|----------|--------|
| **Smaller models for simple steps** | Reduce cost per call |
| **Caching** | Avoid redundant calls |
| **Step limits** | Cap maximum cost |
| **Batching** | Reduce API overhead |

### Latency

Multi-step agents have inherent latency from sequential operations.

| Strategy | Impact |
|----------|--------|
| **Parallelization** | Run independent steps concurrently |
| **Streaming** | Show progress during execution |
| **Caching** | Skip redundant operations |
| **Simpler models** | Faster inference |

### Security and Data Flow

Agents with tool access introduce two categories of security risk: agent-level risks around what the agent does, and data-level risks around what information enters the inference pipeline.

**Agent-level risks** are about the agent's behavior. Prompt injection, unauthorized tool calls, and malicious code execution fall into this category. The mitigations are guardrails, sandboxing, and human approval gates.

**Data-level risks** are about what content gets sent to the model provider as context. As described in [Agent Execution Architecture](#agent-execution-architecture), every tool result crosses the network boundary during inference. This creates exposure pathways that are independent of the agent's intent.

| Risk | Category | Mitigation |
|------|----------|------------|
| **Prompt injection** | Agent-level | Sanitize inputs, use guardrails |
| **Unauthorized access** | Agent-level | Principle of least privilege |
| **Malicious code execution** | Agent-level | Sandbox code execution |
| **Data exfiltration** | Agent-level | Monitor outbound actions |
| **Context accumulation** | Data-level | Session limits, context pruning, data classification policies |
| **Credential leakage via context** | Data-level | Exclude sensitive files from AI tool access, use secret scanning |

Context accumulation is worth particular attention. A developer asking an agent to "fix the auth bug" may trigger the agent to read configuration files, environment variables, and log outputs that contain connection strings, API keys, or tokens. None of those reads are malicious; they are the agent doing its job. But those values now exist in the inference context and are sent to the provider's servers, where they are subject to the provider's data retention and access policies.

---

## Quick Reference

### Agent Design Checklist

1. [ ] Clear goal definition
2. [ ] Appropriate tools for the task
3. [ ] Good tool descriptions
4. [ ] Memory strategy for long tasks
5. [ ] Iteration limits and guardrails
6. [ ] Error handling for tool failures
7. [ ] Human approval for sensitive actions
8. [ ] Observability and logging
9. [ ] Cost monitoring

### When to Use Agents

| Scenario | Agent Appropriate? |
|----------|-------------------|
| Single question/answer | No, use direct LLM |
| Multi-step task with tools | Yes |
| Real-time conversation | Maybe, depends on complexity |
| Batch processing | Yes, with supervision |
| High-stakes decisions | Careful, human-in-loop |

### Agent vs. Workflow

| Characteristic | Agent | Workflow |
|----------------|-------|----------|
| **Flexibility** | High, adapts to situation | Fixed, predetermined steps |
| **Predictability** | Lower, emergent behavior | Higher, explicit paths |
| **Debugging** | Harder, reasoning varies | Easier, clear execution |
| **Cost** | Variable, depends on reasoning | Predictable |

Use agents when flexibility matters. Use workflows when predictability matters.
