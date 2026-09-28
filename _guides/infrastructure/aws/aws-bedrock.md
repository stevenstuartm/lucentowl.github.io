---
title: "Amazon Bedrock: Building on Foundation Models"
layout: guide
category: AWS
subcategory: Machine Learning & AI
description: "How to build applications on foundation models with Amazon Bedrock: its two endpoints and APIs, inference tiers, batch, and cross-Region inference, data retention settings, grounding answers with Knowledge Bases, running agents on AgentCore, filtering with Guardrails, customizing models, and securing and attributing cost."
tags: [bedrock, foundation-models, knowledge-bases, agentcore, guardrails, rag, practical]
---

## What Bedrock Provides

Amazon Bedrock is a managed service for using foundation models, large pretrained models that follow instructions in natural language, without hosting them. It offers more than 100 models from providers including Amazon (Nova), Anthropic (Claude), OpenAI, DeepSeek, Moonshot AI (Kimi), MiniMax, and xAI (Grok), behind one set of APIs, with AWS identity, networking, logging, and billing.

Bedrock is Regional. Each Region offers its own set of models, quotas apply per account per Region, and a request runs in the Region you call unless you route it across Regions deliberately. Since October 2025, serverless models are enabled in every account by default. Anthropic's models still require a one-time use-case form, which submitted from an organization's management account covers every member account.

Model providers don't receive your prompts or responses. Bedrock runs each provider's model in AWS-operated deployment accounts that providers can't access, and it doesn't use your inputs or outputs to train models. Whether AWS keeps them is a per-Region setting described under Data Retention below, and some models require that AWS may keep and review them.

The rest of Bedrock builds applications around the models:

| Feature | What it adds |
|---|---|
| **Knowledge Bases** | Retrieval of your documents or data at query time, so answers are grounded in it and cite sources |
| **AgentCore** | A platform for running agents, meaning models that plan, call tools, and act over many steps, with memory, tool gateways, identity, and observability |
| **Guardrails** | Configurable filters on inputs and outputs for harmful content, denied topics, personally identifiable information (PII), and ungrounded answers |
| **Model customization** | Fine-tuning and distillation of supported models with your data, and import of your own model weights |
| **Data Automation** | Extraction of structured fields from documents, images, audio, and video |
| **Evaluations** | Comparing models and configurations on your own test sets |

The concepts behind these, such as retrieval-augmented generation, fine-tuning, agents, and evaluating model output, belong to the AI & Machine Learning guides. This guide covers how Bedrock implements them and what that means for building on AWS. Bedrock isn't the only option. A standard task such as transcription or document extraction is often cheaper and more predictable on a prebuilt AI service, and a model outside Bedrock's catalog can be hosted on SageMaker AI.

---

## Calling a Model

Bedrock has two inference endpoints in each Region, which share the same models and per-token prices but not the same features:

| | `bedrock-runtime` (recommended) | `bedrock-mantle` |
|---|---|---|
| **APIs** | Converse, InvokeModel, Anthropic Messages, and OpenAI-compatible Responses and Chat Completions | Anthropic Messages, and OpenAI-compatible Responses and Chat Completions |
| **Only here** | Guardrails, cross-Region inference, intelligent prompt routing, model invocation logging | Server-side and ready-made tools such as web search, background (long-running) Responses requests, Projects and Workspaces for isolating workloads and their cost, and some models |
| **Throughput** | Per-model quotas on requests and tokens per minute | Higher starting limits, with requests sometimes queued briefly |

Start with `bedrock-runtime`, and use `bedrock-mantle` for a capability that exists only there. On `bedrock-runtime`, the API styles are:

| API | Use it when |
|---|---|
| **Converse** | Writing new code that should work across providers. One request and response shape for messages, streaming, tool use, and images, regardless of model |
| **InvokeModel** | You need a provider's native request format or a model-specific parameter |
| **Anthropic Messages API** | Porting code written for Anthropic's SDK, pointed at Bedrock |
| **OpenAI Responses and Chat Completions APIs** | Porting code written for OpenAI's SDK. They're called on the endpoint's `/openai/v1` paths rather than through the AWS SDKs, and Responses requests there are synchronous only |

Requests are authorized with IAM, like any AWS API, or with Bedrock API keys for tools that expect a bearer token. Short-term keys, valid for up to 12 hours, suit production. Long-term keys create an IAM user and are meant for exploration. A minimal call through the AWS SDK for .NET (C# 12 or later) with the Converse API:

```csharp
using Amazon.BedrockRuntime;
using Amazon.BedrockRuntime.Model;

var client = new AmazonBedrockRuntimeClient();
var modelId = "<model or inference profile ID>"; // from the model card; see Cross-Region Inference

var response = await client.ConverseAsync(new ConverseRequest
{
    ModelId = modelId,
    Messages =
    [
        new Message
        {
            Role = ConversationRole.User,
            Content = [ new ContentBlock { Text = "Summarize this support ticket in two sentences: ..." } ]
        }
    ],
    InferenceConfig = new InferenceConfiguration { MaxTokens = 300, Temperature = 0.2f }
});

Console.WriteLine(response.Output.Message.Content[0].Text);
```

With **client-side tool use**, a model asks your code to run a function, such as looking up an order, and then answers with the result. The request declares each tool with a JSON schema, the model returns a tool-use request instead of text, your code runs it and sends the result back, and the model continues. That loop is the core of every agent, whether you run it yourself or on AgentCore.

{% include figure.html id="aws-bedrock-tool-use" %}

On `bedrock-mantle`, some tools such as web search also run server-side, inside Bedrock, starting with a subset of models.

---

## Choosing How Requests Run

### Tiers, batch, and provisioned capacity

On-demand requests are billed per **token**, a unit of text of roughly three-quarters of a word, with separate prices for input and output tokens that vary by model by more than 100 times from the smallest to the largest. Each on-demand request runs in a **service tier** that sets its price and priority, and batch jobs and Provisioned Throughput are separate ways of running work:

| Option | Price relative to Standard | Fits |
|---|---|---|
| **Standard** tier | Base on-demand price | Most interactive traffic |
| **Priority** tier | About 75% more | Latency-critical requests that should be served first when capacity is tight |
| **Flex** tier | About 50% less | Work that tolerates lower priority and longer, less predictable latency, such as background enrichment |
| **Batch** jobs | About 50% less | Large sets of prompts submitted as a file in S3, with results written back to S3, for models that support it |
| **Provisioned Throughput** | Hourly per **model unit**, a fixed block of throughput, with 1- or 6-month commitments for lower rates | Guaranteed throughput for steady high volume, and required for some customized models |

**Prompt caching** cuts the cost of repeated context. When many requests share a long prefix, such as a system prompt, a set of instructions, or a document being discussed, the model can cache it, and later requests read it at a fraction of the normal input price. Caching pays off most in conversations and agents, where the same context is resent on every turn. **Intelligent prompt routing** sends each request to the cheaper or the more capable model in a family depending on how hard the prompt looks.

To see who spends what, create a tagged **application inference profile**, an alias for a model that you call instead of the model itself, for each application, add metadata tags to requests, or break down usage by the IAM principal that made each call. Responses API calls on `bedrock-runtime` support only the IAM principal breakdown, and reject application inference profiles.

### Cross-Region inference

Each model has quotas on tokens and requests per minute, per account and Region, and a single Region's capacity can run short at peak. **Cross-Region inference** routes requests through an **inference profile** that spreads them across several Regions:

| | Geographic profile | Global profile |
|---|---|---|
| **Where requests may run** | Regions within one geography, such as the US, EU, or Asia Pacific | Any supported commercial Region |
| **Price** | Standard | About 10% lower |
| **Fits** | Data that must stay within a geography | Workloads without residency constraints |

There's no routing charge, traffic stays on the AWS network, and CloudTrail records each request in the calling Region with the Region that processed it. Many current models are offered only through geographic or global profiles, so cross-Region routing is often the only way to call them. Three consequences need planning. IAM policies must allow the model in every destination Region of the profile as well as the profile itself. Service control policies that restrict Regions must allow those destinations too, and a global profile needs an SCP exception for requests whose destination Region is unspecified. And a requirement that data stays in one Region rules out global profiles, and possibly geographic ones.

### Data retention

Whether AWS keeps prompts and responses is set by a **data retention mode**, per account per Region:

| Mode | Effect |
|---|---|
| `none` | Nothing is written to durable storage. Models that require retention are unavailable |
| `default` | Each model's own policy applies. AWS may keep data for abuse detection, and the provider doesn't receive it |
| `aws_review` | AWS may keep inputs and outputs for up to 30 days and have people review them, for models whose provider requires human review as a condition of access |

A Region with no setting falls back to each model's default. Some newer models, such as Claude Fable 5 and 5.1, require `aws_review` and return a validation error until it's set. With cross-Region inference, retained data is stored in the Region that processed the request. SCPs can require a mode across the organization, such as `none` for regulated workloads, which also means those workloads can't use models that need review. AgentCore, separately, may use content to improve the service for your own use.

---

## Grounding Answers in Your Data

A model knows what it was trained on, not your product manuals, policies, or tickets. **Retrieval-augmented generation (RAG)** retrieves relevant passages from your data for each question and includes them in the prompt, so the model answers from them and can cite them. **Knowledge Bases** runs that pipeline: ingesting documents, splitting them into chunks, converting chunks to **embeddings** (numeric vectors that place similar meaning close together), storing them in a vector index, and retrieving the closest chunks for each query.

There are two kinds:

| | Managed Knowledge Base | Customer-managed Knowledge Base |
|---|---|---|
| **Who runs storage and retrieval** | Bedrock: parsing, embedding, indexing, reranking (reordering retrieved chunks by relevance with a second model), and scaling | You choose and operate the vector store, such as OpenSearch Serverless, Aurora PostgreSQL, or Neptune Analytics, and configure parsing and chunking |
| **Sources** | Connectors for S3, SharePoint, Confluence, Google Drive, OneDrive, and a web crawler, with smart parsing of PDFs, Office files, scanned pages, images, audio, and video | Your pipeline's sources |
| **Permissions** | Document-level access filtering from the source's access control lists at query time | Your own filtering, usually on metadata |
| **Retrieval** | Standard retrieval, and agentic retrieval that breaks complex questions into sub-queries across knowledge bases | Standard retrieval |
| **Price** | $5 per GB of raw data per month, and $1 per 1,000 standard retrievals ($4 for agentic) | The vector store's own cost, plus embedding tokens |

Applications either call **Retrieve** to get ranked chunks and build their own prompt, or **RetrieveAndGenerate** to have Bedrock retrieve, prompt a model, and return an answer with citations. Knowledge Bases can also answer questions over structured data by generating SQL for Redshift, including data lake tables Redshift can query, and can use graphs in Neptune Analytics for questions that span connected facts.

Answer quality depends mostly on what is retrieved, so test the knowledge base's retrieval results on their own before tuning prompts.

---

## Agents on AgentCore

An **agent** is a model given tools and a goal, which decides step by step what to call and when it's done. **Amazon Bedrock AgentCore** is AWS's platform for running agents built with any framework, such as Strands Agents, LangGraph, CrewAI, or the OpenAI Agents SDK, and any model, in or outside Bedrock. Its services, which work together or separately, include:

| Service | Role |
|---|---|
| **Runtime** | Serverless hosting for agents and tools, with each session isolated in its own microVM and support for long-running asynchronous work |
| **Harness** | A managed agent loop defined by a model, a system prompt, and tools in one API call, for agents that don't need a custom framework |
| **Memory** | Short-term memory within a conversation and long-term memory across sessions |
| **Gateway** | Turns APIs, Lambda functions, and existing services into Model Context Protocol (MCP) tools that agents can discover and call |
| **Identity** | Authenticates agents and lets them act for users with existing identity providers such as Cognito, Okta, or Entra ID |
| **Policy** | Deterministic rules, checked on every tool call through Gateway, on which tools an agent may use and with what arguments |
| **Browser** and **Code Interpreter** | Sandboxed tools for driving web pages and running code |
| **Observability** and **Evaluations** | OpenTelemetry traces of every step, and automated scoring of agent behavior |

Newer services add a **Registry** for publishing and discovering agents and tools across an organization, **Optimization** for testing prompt and tool changes against traces, and **Payments** for agents that pay for APIs.

The original **Bedrock Agents**, now called Agents Classic, closed to new customers on July 30, 2026, and its model catalog is frozen at that date. New agents belong on AgentCore. Existing Classic agents keep running, and Knowledge Bases and Guardrails are unaffected.

On AgentCore, an agent's reach is set by the tools Gateway exposes to it, the IAM role and Identity credentials it runs with, and the Policy rules checked on each call. Keep all three narrow, and put Policy rules in front of any tool that changes data or spends money.

---

## Guardrails

**Guardrails** applies the same safety and privacy rules across models. A guardrail combines filters:

| Filter | Catches |
|---|---|
| **Content filters** | Hate, insults, sexual content, violence, misconduct, and prompt attacks such as jailbreaks and injected instructions, at configurable strengths |
| **Denied topics** | Subjects the application must not discuss, described in plain language |
| **Word filters** | Exact words and phrases, including a profanity list |
| **Sensitive information filters** | PII and custom regex patterns, blocked or masked |
| **Contextual grounding checks** | Answers not supported by the retrieved source, or irrelevant to the question |
| **Automated Reasoning checks** | Answers that contradict a set of formal rules, such as an HR policy encoded as logic |

A guardrail is a Regional resource, attached to a model call by ID and version, or applied on its own with the `ApplyGuardrail` API to any text, including output from models outside Bedrock. **Enforcements**, set through an AWS Organizations Bedrock policy or an account setting, apply a named guardrail automatically to every model call in the organization, an OU, or an account, on top of any guardrail a request names. Guardrails work on `bedrock-runtime` but not `bedrock-mantle`. Most filters bill per 1,000 text units of up to 1,000 characters each, such as $0.15 for content filters and denied topics and $0.10 for sensitive information filters.

Guardrails reduce risk, and they don't remove it. Prompt injection hidden in retrieved documents or tool results is the hardest case, so treat anything a model reads from outside as untrusted and limit what the model can do with it.

---

## Customizing Models

Customization comes after prompting and retrieval, because a trained model has to be retrained whenever you move to a newer base model. On Bedrock it fits a consistent style or format that prompts can't hold, or a smaller, cheaper model that must match a larger one on a narrow task:

- **Supervised fine-tuning** trains on labeled input and output pairs.
- **Reinforcement fine-tuning** improves a model against reward functions you write, often as Lambda functions, rather than fixed answers.
- **Distillation** has a larger teacher model generate responses to your prompts and trains a smaller student model on them.
- **Custom Model Import** brings weights of supported open architectures you trained elsewhere, billed per minute of use plus storage.

Training bills per token processed or per training hour, depending on the model, and reinforcement fine-tuning bills hourly. Customized models add monthly storage, and serving costs that for some models mean Provisioned Throughput while others can run on demand. Compare the total against a larger base model with a better prompt.

---

## Security and Operations

- **Access.** Grant `bedrock:InvokeModel` and related actions on specific model and inference profile ARNs, including the model in each destination Region of a cross-Region profile, so teams can't switch to the most expensive model unnoticed.
- **Network.** Interface VPC endpoints keep calls from private subnets on the AWS network.
- **Logging.** **Model invocation logging** records full prompts and responses to CloudWatch Logs or S3. It's configured per account per Region, covers only calls through `bedrock-runtime`, and is off by default. When on, those logs hold whatever sensitive data users send, so encrypt them and restrict who can read them.
- **Quotas.** Tokens-per-minute and requests-per-minute quotas per model are the usual production bottleneck. Request increases before launch, spread load with cross-Region profiles, and retry throttled calls with backoff.
- **Model lifecycle.** Model versions are retired on a published schedule. Pin model IDs, watch for deprecation notices, and keep an evaluation set to rerun when you switch.

---

## Common Pitfalls

- **Choosing a model by reputation.** The largest model is rarely needed for classification, extraction, or routing. Evaluate two or three candidates on your own examples, and use the smallest that meets the bar.
- **Access denied in another Region.** A cross-Region profile routes to Regions your IAM policy or SCPs don't allow, and calls fail intermittently. Allow the model in every destination Region.
- **A model that "doesn't exist".** The model is offered only through a cross-Region profile, or needs a retention mode the Region isn't set to. Check the model card's availability and the Region's retention mode.
- **Guardrails silently missing.** Calls moved to `bedrock-mantle` for server-side tools lose Guardrails and invocation logging. Keep filtered traffic on `bedrock-runtime`, or filter with `ApplyGuardrail` yourself.
- **RAG without access control.** A knowledge base that indexes everything answers everyone with everything. Filter retrieval by the user's permissions.

---

## Key Takeaways

- Bedrock serves more than 100 foundation models through two Regional endpoints, `bedrock-runtime` for most work and `bedrock-mantle` for server-side tools and long-running requests, with models enabled by default and providers kept out of your prompts and responses.
- Use the Converse API for portable code, or the Anthropic and OpenAI-compatible APIs to reuse existing SDKs.
- Tokens drive cost. Priority, Flex, batch, Provisioned Throughput, prompt caching, and cross-Region profiles trade price against latency, capacity, and data residency, and a per-Region retention mode decides whether AWS keeps prompts and which models you can use.
- Knowledge Bases ground answers in your data, as a managed pipeline with connectors and access filtering or over a vector store you run.
- AgentCore hosts agents from any framework, with memory, tool gateways, identity, policy, and observability. Bedrock Agents Classic is closed to new customers.
- Guardrails filter harmful content, PII, and ungrounded answers across any model, and customization comes after prompting and retrieval have been tried.
