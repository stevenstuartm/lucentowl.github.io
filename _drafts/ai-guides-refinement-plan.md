# AI & Machine Learning Study Guides Consolidation and Refinement Plan

Tracks the consolidation and review-and-refine pass over all guides in `_guides/ai/` (the "AI & Machine Learning" category in `assets/data/study_guides_config.json`). Unlike a plain refinement pass, this one starts by questioning the set itself. Guides can be merged, split, removed, moved out, or newly written before any per-guide refinement begins. After consolidation, guides are consumed sequentially in the new config order. That order encodes the fundamentals-to-advanced learning path, so no guide should add its own prerequisite framing or cross-links to siblings in scope.

**The checklist, the process rules, and the cross-domain gotchas live in [`.claude/content/guide-refinement-standard.md`](../.claude/content/guide-refinement-standard.md).** Read it first. This document carries what is specific to this pass: the consolidation phase, sources, domain notes, and tracking.

The pass has two phases:

| Phase | What happens | Stops for approval |
| --- | --- | --- |
| **0. Consolidation** | Audit the whole set, decide what the category should contain, restructure files and config to match | Once, at the gate, before any file is touched |
| **1. Refinement** | The standard checklist, one guide at a time, in the new config order, including finishing the new guides | Never |

**Current position: Phase 0 is complete. Phase 1 starts at row 1.**

---

## Phase 0: Consolidation

Kept as the record of the method, since the closing step asks whether to promote it into the standard.

### Why it runs first

Refining a guide that's about to be merged away wastes the work. It also hides the structural problem, the same way polished prose hides a weak argument in a blog draft. Phase 1 has to run on the final file set, so every structural decision is made and carried out before row 1 starts.

### What earns a guide its place

Apply these tests to every existing guide and every candidate gap. A guide that fails one gets a disposition other than **Keep**.

1. **One reader question.** State in one sentence what a reader comes to this guide to learn. If two guides give the same answer, merge them. If one guide needs two unrelated sentences, split it.
2. **Learning content, not lookup.** Apply the Lookup Test from [`resource-guide.md`](../.claude/content/resource-guide.md). Material a reader consults rather than learns from, such as templates, worked pipelines, and selection tables, moves to `_resources/`.
3. **Durable substance.** A guide whose core is a list of products, tools, model names, or hardware specs will go stale faster than anyone updates it. Keep its durable reasoning and fold that into a concept guide. Drop the list.
4. **Right category.** A topic another category already owns stays there. AI guides may link to those guides, because the sibling-link rule covers only this pass's scope, but they don't re-teach them.
5. **Gap test.** A candidate new guide qualifies only if a practitioner working with LLM or ML systems would expect the category to cover it, no existing guide owns it, and folding it into an existing guide would break that guide's one-reader-question test. Judge at study-guide altitude, not doc-completeness.
6. **Subcategory shape.** Avoid single-guide subcategories. The subcategory split should follow a real difference in reader intent, not just group guides into topic buckets.

### Disposition vocabulary

| Disposition | Meaning |
| --- | --- |
| **Keep** | Survives as its own guide; scope may be tightened by the ownership map |
| **Merge into `<file>`** | Unique content moves into the named survivor; this file is deleted |
| **Split into `<files>`** | Named sections move to other files; this file survives with the rest |
| **Move to resource** | Lookup material leaves the guide for `_resources/` |
| **Move out** | Belongs to another category; content goes to that category's guide and this file is deleted |
| **Remove** | No unique content worth keeping; deleted outright |
| **New** | A gap that passed the gap test. Created in Phase 0 as a seed containing the sections the ownership map moves into it, added to config then, and finished during Phase 1 at its row |

**Never rename a file.** A merged guide keeps the survivor's filename, and only the `title:` changes.

### Steps

1. Read everything in scope, plus the boundary material the audit must not duplicate.
2. Build the topic ownership map.
3. Fill a disposition table for every existing guide and candidate gap, with a one-sentence reader question each. Propose subcategories and reading order.
4. **Gate:** present the proposal; nothing is edited before approval.
5. Execute: merges, splits, and New seeds (content moved wholesale, unpolished); moves to resource (diff first, carry over anything missing); removals; config and front matter; inbound links; the organization table in `study-guide-guide.md`.
6. Validate without a build: config parses, every config path exists, no inbound links to deleted files.
7. Close: build the Progress table, rewrite pre-flags by row number, delete the disposition table, keep the ownership map.

### Structure and reading order

Three subcategories, split by reader intent: learning classical ML, building LLM systems, and using AI tools inside an engineering organization.

| Subcategory | Guides, in reading order |
| --- | --- |
| **Machine Learning** | `machine-learning.md`, `mlops.md` |
| **Building with LLMs** | `core-ai-concepts.md`, `prompt-engineering.md`, `tool-calling.md`, `model-context-protocol.md`, `rag-retrieval-augmented-generation.md`, `llm-fine-tuning.md`, `ai-agents.md`, `llm-evaluation.md`, `llm-application-security.md`, `running-llms-in-production.md` |
| **AI in Engineering Practice** | `ai-assisted-development.md`, `scaling-ai-workflows.md`, `ai-security-for-organizations.md` |

Order rationale inside Building with LLMs:
- Tool calling comes before MCP and agents, since both assume it.
- Fine-tuning follows RAG because it owns the three-way prompting/RAG/fine-tuning decision.
- Agents follow tools, MCP, and RAG, since agents compose them.
- Evaluation, application security, and production operations close the subcategory as cross-cutting concerns.

### Topic ownership map

Stays for the life of the pass; Phase 1 rows consult it. "Clause" means a non-owner defines the concept in a clause where it's used, or omits it, and doesn't link to the owner.

| Concept | Owner | Non-owners treat it as |
|---|---|---|
| What ML is; features, labels, training, over/underfitting | machine-learning | llm-fine-tuning: clause |
| Neural networks and deep learning | machine-learning | core-ai-concepts: clause before transformers |
| MLOps: model registry, feature store, drift, deployment patterns (canary, shadow), model governance | mlops | Azure ML / SageMaker guides are out of scope and stay as they are |
| Transformer architecture and autoregressive generation | core-ai-concepts | — |
| Tokens, context windows, sampling parameters | core-ai-concepts | all others: clause |
| Context accumulation (every call resends the history) | core-ai-concepts | ai-agents applies it to data exposure; scaling-ai-workflows applies it to batch cost; neither re-explains the mechanism |
| Embeddings as a concept and similarity measures | core-ai-concepts | rag: clause; rag owns choosing an embedding model for retrieval |
| Vector database internals (ANN, HNSW, IVF, product comparisons) | `_guides/data/vector-databases.md` (out of scope) | core-ai-concepts and rag drop their product tables and link to it |
| Hosted vs self-hosted models, model size, memory math, quantization | core-ai-concepts | llm-fine-tuning owns quantization only as QLoRA uses it |
| Hallucination and knowledge cutoff | core-ai-concepts | rag: clause |
| Prompting techniques (zero/few-shot, CoT, ToT, self-consistency, personas) and system prompts | prompt-engineering | ai-agents keeps agent-specific planning only; the lookup table lives in the technique-selection resource |
| Tool calling mechanics, native-capability-vs-tool decision, tool design | tool-calling | ai-agents, model-context-protocol, ai-assisted-development: clause |
| MCP protocol, primitives, transports, authorization | model-context-protocol | ai-agents, ai-assisted-development: clause |
| Chunking, retrieval strategies, reranking, retrieval metrics, index freshness | rag | — |
| Prompting vs RAG vs fine-tuning decision | llm-fine-tuning | rag: one sentence |
| Agent loop, planning, memory, multi-agent patterns, loop guardrails (step and cost limits) | ai-agents | scaling-ai-workflows applies orchestration to batch work without re-teaching the patterns |
| Local-execution / remote-inference data flow | ai-agents | ai-security-for-organizations: clause; owns the controls |
| Evaluation method: test sets, LLM-as-judge, regression testing, online feedback | llm-evaluation | rag keeps retrieval metrics; llm-fine-tuning keeps training-loss monitoring and base-vs-tuned comparison |
| Prompt injection, excessive agency, insecure output handling, human approval gates | llm-application-security | model-context-protocol keeps protocol trust boundaries; ai-agents keeps the data-level risks |
| Organizational AI data controls: classification, DLP, tool governance | ai-security-for-organizations | — |
| Cost and latency levers: caching, model routing, streaming, rate limits, fallbacks | running-llms-in-production | scaling-ai-workflows keeps batch-specific model tiering |
| Coding-assistant workflow and verification | ai-assisted-development | — |
| The batch-pipeline worked example | `_resources/ai-batch-generation-pipeline-template.md` | scaling-ai-workflows teaches the patterns in prose only |

---

## Phase 1: Refinement

Per row, run the standard's nine-item checklist, apply the fixes, run `/refine-prose`, set status to Complete, and move to the next row. Don't stop between rows. No Jekyll build.

Two additions for this pass:

- **New guide rows (2, 5, 10, 11, 12).** The seed holds only moved sections, unpolished and in some cases uncoordinated. Write the rest of the guide around them, following [`study-guide-guide.md`](../.claude/content/study-guide-guide.md) and the scope the ownership map assigns. Then run the full checklist on it. **Item 1 applies to freshly written prose with no discount.** A new guide is exactly the plausible-reading, unverified text that item 1 exists to catch.
- **Item 2 runs across guides.** Beyond within-file redundancy, check each guide against the ownership map. If this guide doesn't own a concept, don't re-teach it. Either define it in a clause where it's used or omit it. Don't add a sibling link to the owner.

### Closing the pass

After the last row: re-run the sibling-link grep (`grep -rn 'href="/study-guides/ai/\|](/study-guides/ai/' _guides/ai/`), confirm no concept is re-taught against the ownership map, and ask whether the Phase 0 method should be promoted into `guide-refinement-standard.md` as a reusable consolidation step.

---

## Sources

- **Protocols and APIs:** the vendors' own API documentation (Anthropic, OpenAI, Google) for vendor-specific behavior, model limits, and pricing. The [MCP specification](https://modelcontextprotocol.io/specification) for MCP, citing the dated spec revision checked.
- **Techniques:** the original papers (arXiv or the proceedings) for claims about transformers, LoRA, QLoRA, RAG, Self-RAG, chain-of-thought, tree-of-thought, ReAct, and long-context retrieval behavior.
- **Libraries:** Hugging Face docs for `transformers`, PEFT, and TRL. Official docs for any named framework or vector store. scikit-learn's docs for classical ML definitions.
- **Security and governance:** OWASP GenAI Security Project (Top 10 for LLM Applications, current edition), NIST AI RMF and its Generative AI Profile (NIST AI 600-1).
- **Data handling terms:** each vendor's current commercial terms and data-usage policy pages, not summaries of them.
- **Off-limits for asserted facts:** launch blogs and marketing pages for figures, benchmark leaderboards for capability claims, secondary explainers (Medium, newsletters, listicles), and answers generated by an LLM.

## Domain notes

**Item 1 (factual correctness)** in this domain is dominated by decay rather than error. Model names, context window sizes, per-token prices, and "the leading model for X" claims go stale within months. The policy:
- Prefer framing that doesn't decay, such as ranges, orders of magnitude, and the reasoning behind a number, over a specific figure.
- Keep a specific figure only when it's load-bearing, and source it from the vendor's model page.
- Remove year-stamped sections ("Trends (2025)") or reframe them as durable forces.
- Verify technique claims against the paper that introduced the technique, not a secondary account of it.

**Item 7 (hierarchy and scope clarity)** has no single containment tree here, but several scope ladders that guides leave implicit:
- **MCP:** host → client (one per server connection) → server → primitives
- **Agents:** orchestrator → subagent → tool call, including whose context window each step consumes
- **Model identity:** provider → model family → versioned snapshot or alias
- **Context:** system prompt / conversation / tool results / retrieved chunks, all competing for one window
- **RAG:** corpus → document → chunk → embedding → index
- **Memory:** within one context window, across a session, or persistent across sessions

The canonical tell is "memory" or "state" used without saying which of those three scopes it means.

**Item 9 (tag audit)** was measured across the front matter of the 11 original guides before the pass:
- `ai` appears on 11 of 11 guides; drop it, since it restates the category.
- `generative-ai` (9) and `llm` (9) are the filler tags to replace with real content signal.
- `tools` (3) and `modern` (1) are also filler.
- Skill level: `practical` 9, `fundamentals` 2, `advanced` 0. Check whether any guide actually warrants `advanced`. The five seeds were given `practical` as a placeholder.
- Reach for the specific nouns a reader would search: `rag`, `mcp`, `lora`, `qlora`, `embeddings`, `vector-search`, `prompt-injection`, `chain-of-thought`, `tool-calling`, `evals`, `quantization`, `mlops`.

**Code samples.** C# is the site default, but fine-tuning is Python-native, and a Python sample is correct there. MCP has an official C# SDK, so MCP samples should use it unless the point is protocol-level. Verify all samples as claims (standing gotcha).

## Domain gotchas

- **A naive tag grep over-counts `scaling-ai-workflows.md` and the batch-pipeline resource.** Their embedded examples contain their own front matter, so `grep '^tags:'` and `grep '^category:'` pick up values like `distributed-systems` and `Consistency` that aren't real front matter. Measure from the first front-matter block only.
- **No Liquid hazards today, but new content invites them.** No AI guide currently contains `{{` or `{%`. Prompt templates, MCP config examples, and agent instruction files commonly use mustache syntax. Any guide that gains one needs the whole-document `{% raw %}` wrap described in CLAUDE.md.
- **"Skills" is a colliding term.** The native-capability idea now in `tool-calling.md` is called "skills." The term now also names a vendor feature (packaged agent instructions), so a reader searching for that feature lands on the wrong concept. Rename it.
- **The guides are CRLF in the working tree** (`core.autocrlf=true`), and `ai-agents.md` had one bare-LF line. Any script that edits by line number must normalize line endings before splitting and write CRLF back, or it either misnumbers lines or produces a whole-file diff.
- **Vendor doc domains moved.** `docs.anthropic.com` and `docs.claude.com` redirect to `platform.claude.com/docs/...`; `platform.openai.com/docs` redirects to `developers.openai.com/api/docs/...`; Google Cloud architecture docs moved to `docs.cloud.google.com`. WebFetch doesn't follow cross-host redirects, so re-request the redirect target. `help.openai.com` returns 403 to WebFetch; search for the quoted text instead. Links in guides should use the new hosts.

## Cross-guide facts in force

Verified during earlier rows; applies to every remaining guide that touches the topic.

- **EU AI Act dates** (European Commission AI Act policy page, checked row 2): in force 1 August 2024; prohibited practices apply from 2 February 2025; general-purpose AI obligations from 2 August 2025. The 2026 digital omnibus amendment deferred high-risk obligations: Annex III (sensitive-area) systems from 2 December 2027, Annex I (product-embedded) systems from 2 August 2028. Four risk levels: unacceptable, high, transparency, minimal. Any guide citing 2 August 2026 as the high-risk date is stale.
- **"87% / 80% of ML projects never reach production"** traces to a remark on a 2019 VentureBeat Transform panel, republished in a sponsored article. It is not a citable statistic; don't assert it.
- **Statistical parity is demographic parity** (Fairlearn). A list naming both as separate fairness metrics is wrong.
- **Token-to-word ratio** (checked row 3): the common English rule of thumb is ~4 characters or ~¾ of a word per token (100 tokens ≈ 75 words). It varies by tokenizer: Anthropic's model overview says 1M tokens ≈ 750k words on its earlier tokenizer but ≈ 555k words on the tokenizer introduced with Claude Opus 4.7. Across languages, tokenized length of the same text can differ up to 15× (Petrov et al., NeurIPS 2023). "0.75 tokens per word" is inverted.
- **Temperature 0 is not deterministic** on hosted APIs (Anthropic and OpenAI both say so). OpenAI's `seed` is best-effort reproducibility. Both providers recommend adjusting temperature or top_p, not both.
- **APIs are stateless per request.** Server-side conversation state doesn't change billing: OpenAI's conversation state guide says all previous input tokens in a `previous_response_id` chain are billed as input. The context window covers input, output, and reasoning tokens.
- **Thinking tokens are billed as output** and count toward `max_tokens` (Anthropic extended thinking docs). Claude Opus 4.5 and models 4.6+ keep prior turns' thinking blocks in context and bill them as input. Manual `thinking.type: "enabled"` with `budget_tokens` is deprecated on 4.6 and rejected on 4.7+; adaptive thinking steered by `effort` replaces it.
- **Current Claude lineup** (platform.claude.com models overview, September 2026): Fable 5.1, Opus 5, Sonnet 5 at 1M context / 128K max output; Haiku 4.5 at 200K / 64K. Every Claude model ID is a pinned snapshot, including dateless IDs from 4.6 on. Batch API is 50% off; cache reads are 10% of base input price. Use for framing only; don't hard-code into guides.
- **Local model memory math:** weights GB ≈ params (B) × bits per weight ÷ 8. llama.cpp `Q8_0` ≈ 8.5 bpw, `Q4_K_M` ≈ 4.8 bpw, so a 70B model at Q4_K_M needs ~42 GB before KV cache. Mixture-of-experts models load all parameters but compute with the active ones (DeepSeek-V3: 671B total, 37B active).
- **"Lost in the middle"** (Liu et al., arXiv 2307.03172): performance is highest with relevant information at the beginning or end of the context, and degrades in the middle even for explicitly long-context models.
- **OpenAI embeddings:** `text-embedding-3-small` 1,536 dims, `-large` 3,072 by default; `dimensions` parameter shortens them; vectors are normalized to length 1, so cosine similarity equals dot product and matches Euclidean ranking.
- **Prefill is retired on current Claude models.** Prefilled final assistant turns are unsupported starting with Claude 4.6 models; Anthropic points to structured outputs, direct instructions, or tools instead. Any guide teaching prefill as a format-forcing technique for Claude is stale.
- **Structured outputs are GA on Anthropic** (constrained decoding; `output_config.format` for JSON responses, `strict: true` on tools; beta header no longer required). Unsupported JSON Schema features include recursive schemas, numeric `minimum`/`maximum`, and string `minLength`/`maxLength`. OpenAI `strict: true` requires `additionalProperties: false` on every object and every property in `required`, with optional fields as nullable types.
- **Reasoning models don't need chain-of-thought prompts.** OpenAI's reasoning best practices say to avoid "think step by step" prompts and try zero-shot before few-shot; developer messages replace system messages from `o1-2024-12-17`. Anthropic: general "think thoroughly" instructions often beat prescriptive step lists.
- **Personas don't improve factual accuracy** (Zheng et al., Findings of EMNLP 2024: 162 roles, 4 model families, 2,410 factual questions). Tree of Thoughts is multi-call search, not a single prompt (Yao et al. 2023: Game of 24, GPT-4 CoT 4% vs ToT 74%). Self-consistency is majority vote over sampled reasoning paths (Wang et al. 2022). Few-shot results are sensitive to example choice and order, with majority-label and recency bias (Zhao et al., ICML 2021).
- **Tool calling mechanics** (Anthropic tool use overview, OpenAI function calling guide, checked row 5): the model returns calls and the application executes them, except provider-run server tools. Tool choice: auto / required (OpenAI) or any (Anthropic) / a specific tool / none, plus OpenAI allowed-tools subsets. Parallel calls disable via `parallel_tool_calls: false` (OpenAI) or `disable_parallel_tool_use` (Anthropic). Tool definitions are billed as input tokens; Anthropic adds a tool-use system prompt of roughly 300-800 tokens depending on model. OpenAI: aim for fewer than 20 functions available at the start of a turn; both offer tool search for large catalogs. Models may infer a plausible value for a missing required parameter instead of asking.
- **MCP current revision is 2026-07-28** (previous 2025-11-25). It makes MCP stateless: no `initialize` handshake, no protocol sessions or `Mcp-Session-Id`; every request carries protocol version and client capabilities in `_meta`; servers MUST implement `server/discover`; `subscriptions/listen` replaces the HTTP GET stream and `resources/subscribe`; Multi Round-Trip Requests (`InputRequiredResult`, retry with `inputResponses`) replace server-initiated requests like `sampling/createMessage`, `elicitation/create`, `roots/list`; SSE resumability removed; tasks moved to an official extension. **Deprecated:** Roots, Sampling, Logging, the HTTP+SSE transport (deprecated since 2025-03-26), and Dynamic Client Registration (in favor of Client ID Metadata Documents). Cross-call state uses server-minted handles passed as tool arguments.
- **MCP transports:** stdio (newline-delimited JSON-RPC to a client-launched subprocess) and Streamable HTTP (each message an HTTP POST to one endpoint; replies as JSON or a request-scoped SSE stream). Any guide teaching "HTTP/SSE transport" as current is stale.
- **MCP authorization** (optional; HTTP transports SHOULD follow it, stdio SHOULD NOT and uses environment credentials): MCP server is an OAuth 2.1 resource server; servers MUST publish Protected Resource Metadata (RFC 9728) and clients MUST use it for discovery; authorization servers expose RFC 8414 or OIDC discovery; clients SHOULD support Client ID Metadata Documents, MAY use DCR (deprecated); PKCE; clients MUST send RFC 8707 `resource` indicators; servers MUST validate token audience and MUST NOT accept or pass through tokens issued for other resources (token passthrough is forbidden). Clients MUST validate `iss` when present (RFC 9207). Security best practices cover confused deputy, token passthrough, SSRF during discovery, state handle hijacking, local server compromise, authorization URL validation, and scope minimization.
- **MCP tools spec:** fields `name`, `title`, `description`, `inputSchema`, `outputSchema`, `annotations`; results carry `content` and optional `structuredContent`; tool execution errors return `isError: true` (model can self-correct) versus JSON-RPC protocol errors; clients MUST treat tool annotations as untrusted unless the server is trusted; there SHOULD always be a human able to deny tool invocations. Elicitation has form mode and URL mode; form mode MUST NOT request secrets.
- **MCP ecosystem:** official SDKs are TypeScript, Python, C#, Go, Rust (Tier 1), Java, Ruby (Tier 2), Swift, PHP, Kotlin (Tier 3). The reference servers repo now holds only Everything, Fetch, Filesystem, Git, Memory, Sequential Thinking, and Time, described as educational, not production-ready; GitHub, GitLab, Slack, PostgreSQL, SQLite-era, Puppeteer, Google Drive, Brave Search, Redis, Sentry and others are archived. The MCP Registry (registry.modelcontextprotocol.io) lists published servers. Anthropic donated MCP to the Linux Foundation's Agentic AI Foundation on 9 December 2025.
- **RAG findings** (checked row 7): Anthropic's contextual retrieval cut top-20 retrieval failure rate by 35% (contextual embeddings), 49% (+ contextual BM25), 67% (+ reranking); knowledge bases under ~200,000 tokens (~500 pages) can go straight into the prompt; top-20 chunks beat top-10 and top-5 in their tests. Azure AI Search suggests starting chunks at 512 tokens with 25% overlap; `text-embedding-3-small` input limit is 8,191 tokens. Reciprocal rank fusion (Cormack, Clarke, Büttcher, SIGIR 2009) sums 1/(k + rank), k conventionally 60. Self-RAG (Asai et al. 2023) requires training the model to emit reflection tokens. GraphRAG (Edge et al. 2024) targets global sensemaking questions via entity graphs and community summaries. HyDE (Gao et al. 2022) embeds a model-written hypothetical document; no relevance labels. MTEB (Muennighoff et al.): no embedding method dominates across all tasks. Cross-encoders are more accurate but produce no embeddings; retrieve-then-rerank (Sentence Transformers docs).
- **Fine-tuning findings** (checked row 8): mixed-precision Adam needs ~16 bytes/param for model state (ZeRO accounting), so full fine-tuning a 7B model needs ~112 GB before activations. LoRA (Hu et al. 2021): 10,000× fewer trainable params and 3× less GPU memory than full fine-tuning on GPT-3 175B; merged adapters add no inference latency. QLoRA (Dettmers et al. 2023): NF4, double quantization, paged optimizers; 65B on one 48 GB GPU while preserving 16-bit fine-tuning performance. PEFT `LoraConfig` defaults r=8, lora_alpha=8; `use_rslora` scales by alpha/√r; `merge_and_unload()` is not in-place. "LoRA learns less and forgets less" (Biderman et al. 2024). RAG beat unsupervised fine-tuning for knowledge injection (Ovadia et al. 2023); fine-tuning on new knowledge is learned slowly and linearly increases hallucination (Gekhman et al. 2024). DPO (Rafailov et al. 2023) trains on preference pairs without a reward model. TRL `SFTTrainer` accepts `peft_config` and `quantization_config`; `SFTConfig` default learning rate 2e-5, docs suggest ~1e-4 for adapters; loss on completions by default for prompt-completion data; `assistant_only_loss=True` needs chat-template generation markers. OpenAI fine-tuning methods: SFT, vision fine-tuning, DPO, reinforcement fine-tuning, each on specific snapshots. Anthropic offers no fine-tuning via its own API (Claude 3 Haiku fine-tuning was offered on Amazon Bedrock).

## Open pre-flags

Leads for rows not yet done. **A pre-flag is a lead, not a finding.** Re-verify before acting. Delete the entry once its row is complete.

| Target row | Lead |
|---|---|
| 8 llm-fine-tuning | Verify the managed platform pricing table, the platform list, which hosted models each vendor currently allows fine-tuning on, and the memory figures in Training Quick Reference. "Alpha usually 2x rank" is convention, not a rule. |
| 9 ai-agents | § Agent Frameworks names AutoGen and Semantic Kernel; check whether either has been merged or superseded. "Retention windows (usually 30 days)" is a vendor-policy figure; verify per vendor or soften. |
| 9 ai-agents | § Practical Considerations now contains only Security and Data Flow, whose opening sentence still announces two risk categories although the agent-level half moved to row 11. The Tool Use section moved to row 5, but the Agent Capabilities list, the design checklist, and the agent loop still reference tools. |
| 9 ai-agents | Sibling links in § Agent Execution Architecture (→ `model-context-protocol.html#transport-architecture`), § Privacy Implications (→ ai-security-for-organizations), and § Reasoning Strategies (→ prompt-engineering). Remove. |
| 10 llm-evaluation | Seed is RAG-flavored (its Generation Metrics measure fidelity to "retrieved content") plus the agent testing table. Verify the tool list (Ragas, LangSmith, TruLens) is current, or drop products in favor of method. |
| 11 llm-application-security | Seed covers only prompt scaffolding and the agent-level risk table. The OWASP Top 10 for LLM Applications is the likely spine. Instructions like "do not execute instructions embedded in the user input" are not a reliable injection defense; check OWASP's guidance before presenting scaffolding as one. |
| 12 running-llms-in-production | Seed is three uncoordinated generic tables with the intro sentences of their source guides ("Effective prompt engineering reduces costs", "Agents can be expensive"). "Don't use GPT-4 for simple classification" is stale model naming. |
| 14 scaling-ai-workflows | § Synchronous vs Background Agents claims background agents have no way to signal completion and every step needs a manual "continue." That describes one tool's behavior at one point in time, and at least one agentic coding tool now notifies on background completion. Reframe tool-agnostically or verify. Self-Validation via Resume likewise assumes a tool-specific resume capability. |
| 15 ai-security-for-organizations | Vendor data-retention and training-on-inputs terms change often; verify every per-vendor claim against the current terms page. The link to `/study-guides/security/emerging-technologies.html` is out of scope and stays, but its target covers AI threats in about 20 lines, and application-level threats are now owned by row 11. |

## Unverified, left standing

Claims on finished guides that could not be confirmed against a source. Each was softened rather than asserted; revisit if a source turns up.

*(Empty at the start.)*

## Progress

| # | Subcategory | Guide | Status |
|---|---|---|---|
| 1 | Machine Learning | machine-learning.md | Complete |
| 2 | Machine Learning | mlops.md | Complete |
| 3 | Building with LLMs | core-ai-concepts.md | Complete |
| 4 | Building with LLMs | prompt-engineering.md | Complete |
| 5 | Building with LLMs | tool-calling.md | Complete |
| 6 | Building with LLMs | model-context-protocol.md | Complete |
| 7 | Building with LLMs | rag-retrieval-augmented-generation.md | Complete |
| 8 | Building with LLMs | llm-fine-tuning.md | Not started |
| 9 | Building with LLMs | ai-agents.md | Not started |
| 10 | Building with LLMs | llm-evaluation.md | Not started |
| 11 | Building with LLMs | llm-application-security.md | Not started |
| 12 | Building with LLMs | running-llms-in-production.md | Not started |
| 13 | AI in Engineering Practice | ai-assisted-development.md | Not started |
| 14 | AI in Engineering Practice | scaling-ai-workflows.md | Not started |
| 15 | AI in Engineering Practice | ai-security-for-organizations.md | Not started |
