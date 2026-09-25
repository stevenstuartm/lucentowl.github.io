# Site Search — Feature Record

Full-text search across guides, posts, resources, and case studies, so a reader can find a concept buried inside a guide body rather than surfaced in its title or tags.

**Background research lives in [`SEARCH-FEATURE-RESEARCH.md`](SEARCH-FEATURE-RESEARCH.md)** (why Pagefind over Lunr.js or a metadata-only index). How the feature works and what to maintain is in CLAUDE.md's **Site Search** section. This file records what was decided and why.

## Status

Initial release built on 2026-09-25: 480 pages indexed (383 guides, 31 posts, 56 resources, 10 case studies). It was built in stages, each gating the next: indexing on a 94-guide sample, then the UI on that sample, then all content types.

## Goals (met)

- A term that appears only in a guide body is found in one query ("outbox", "RPO").
- A result for a long guide links to the matching section, not the top of the page.
- No authoring tax: the index is generated from rendered HTML, and new content is indexed because of its layout.
- No cost on pages that don't search: the Pagefind runtime loads on the first query.
- No per-reader state and no query tracking.

## Non-goals

- AI or natural-language answers: they need a backend.
- Replacing `content-filter.js` on the listing pages: filtering a listing and searching the corpus are different jobs.
- Search analytics, including a GA4 zero-result event: it would send query text to Google, which crosses the no-tracking line.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Engine | Pagefind 1.5.2, pinned, run with `npx` in the deploy workflow | Chunked index fetched per query; runner ships Node, so no setup step |
| Where search lives | Header button + panel only (`/` opens it) | A `/search.html` page was built for the prototype and then removed at the user's request |
| UI | Custom renderer on the Pagefind JS API | Results match the listing-card style; the Default UI proved indexing in Stage 1 only |
| Scope | `data-pagefind-body` on the four content layouts | Everything else (listings, radar, home, about, authors) is excluded without markup |
| Figures | SVG content ignored; title and summary indexed | Label fragments match many queries and explain none |
| Facets | Content-type tabs with counts; All stays relevance-ranked | Grouping by type would sink the best post or resource below a long guide block; category (20 values) and tags are too many for a control |
| Result density | Title, type, and meta on one line; at most 2 sections, each clamped to 2 lines | About 5 results per desktop screen instead of 2 |
| Minimum query | 2 characters | One character only ever matches prefix noise |
| Ranking | `metaWeights: { title: 20 }` | Pages that repeat a term in code outranked the page about it ("s3", "ec2") |
| Deploy guard | Fail the build below 450 indexed pages | A layout that loses `data-pagefind-body` drops out silently with exit code 0 |

## Pagefind behavior found in testing

- **The site header's `<h1>` became every title.** Pagefind takes the first `<h1>` on the page, even outside the indexed body. Every layout tags its own title with `data-pagefind-meta="title"`.
- **Prefix fallback.** A word with no match falls back to shorter prefixes: "kanban" matched a lone "k", and "outbx" matched every "out". There is no option to disable it. The script keeps a result only if a highlighted word resembles a query word. Because Pagefind ranks closer matches first, the first stray result ends the list. Typos still work: "idempotant" → idempotent, "kubernets" → Kubernetes.
- **Filter counts need `pagefind.filters()` first.** Until the filter index loads, search responses carry empty counts.
- **Spaced product names.** "route53" missed the guide that writes "Route 53". Words of 3+ letters followed by digits also run as the spaced form, restricted to exact-phrase matches but ranked by the loose search. A loose "base 64" matched 66 pages against 7, and an exact phrase alone ranked the Route 53 guide outside its top 3.
- **Headless Chrome.** `--dump-dom` and `--screenshot` don't wait for Pagefind's fetches, so results look missing. Test over the DevTools protocol with a real wait.

## Query checks (full index, 480 pages)

| Query | Top result |
|---|---|
| outbox | Reporting and Production Make Terrible Roommates (post), then Messaging Patterns |
| RPO | Disaster Recovery on AWS |
| kanban | Kanban Methodology |
| idempotency | Reliability Patterns |
| route53 | AWS Route 53 for System Architects |
| s3 | Amazon S3 for System Architects |
| ec2 | Choosing AWS Compute: EC2, … then EC2 for System Architects |
| outbx, qqqqqq | No results |

## Possible follow-ups

- Re-run a broader query log now that all content types are indexed, especially ambiguous terms ("latency", "cache").
- Resource excerpts that land in tables or code show raw pipes and `---`. That is the matched text, not a rendering bug.
