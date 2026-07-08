# Content Search — Feature Research

Research into adding full-text search/discovery across guides, posts, and resources, prompted by a recurring problem: recalling *that* something useful exists on the site without remembering *where*.

---

## The Problem

The site has real depth (381 guides at ~1.2M words, 30 posts, a growing resource library) but no way to search it. Key topics, rules, and guidelines are often buried inside a guide's body rather than surfaced in its title or tags. `content-filter.js` (used on the guides/blog/resources listing pages) only matches against title, category, and tags already rendered on the page — it cannot see into guide bodies. The only way to find a buried topic today is to already remember which guide contains it.

A previously considered alternative — a hand-curated "key concepts" index, manually tagged per guide — was rejected: it reintroduces an ongoing authoring tax (tagging every rule/law as you write or retrofit) that's likely to be abandoned within a few months, unlike a generated index that costs nothing to maintain as content grows.

---

## Recommendation: Pagefind

[Pagefind](https://pagefind.app) — a static-site search tool purpose-built for exactly this case (Jekyll/Hugo/11ty sites with no backend).

**Why it fits:**

- **Indexes real content, not curated metadata.** Runs against the *rendered HTML* in `_site/` after `jekyll build`, so it searches actual guide/post body text — no manual tagging required to find something "buried."
- **No load-performance drag.** Ships a small JS runtime and loads index data in on-demand chunks per query (via range requests) rather than shipping one large prebuilt index to the browser upfront. Nothing loads on any page unless that page embeds the search widget — consistent with how `radar.js` and `content-filter.js` are already scoped to single pages.
- **Faceted search included.** Supports `data-pagefind-filter` / `data-pagefind-meta` attributes, so full-text search can be combined with filters by content type (guide/post/resource) or tag — effectively delivering the "central index" idea without a separately maintained index file.
- **Fits the existing deploy model.** The site already builds via a custom GitHub Actions workflow ([jekyll.yml](.github/workflows/jekyll.yml)), not GitHub's classic auto-build, so adding a post-build indexing step (`npx pagefind --site _site`, run after `jekyll build` and before `upload-pages-artifact`) is straightforward.

**Rejected alternative — Lunr.js:** would require shipping one large prebuilt JSON index to the browser in full on the search page. At this content volume (~1.2M words across guides alone), that index would be sizable and front-loaded rather than fetched incrementally, unlike Pagefind's chunked approach.

**Rejected alternative — metadata-only custom index (title/description/tags, no body):** small and simple, but doesn't solve the actual problem — it can't find a rule or concept mentioned mid-guide, only what's already in the front matter.

---

## Trade-Offs and Risks

1. **New toolchain in the build.** The pipeline is pure Ruby/Jekyll today. Pagefind requires adding Node.js to CI solely to run the indexing step — a second toolchain that can fail a deploy (version bump, registry issue) where none existed before.

2. **Scoping requires care.** Needs `data-pagefind-body` on the main content wrapper and `data-pagefind-ignore` on nav/header/footer. The blog/guides/resources *listing* pages and the tech-radar visualization should likely be excluded from indexing entirely (aggregators/visualizations, not content) — misconfiguration here produces noisy results (nav text, duplicate listing snippets) or silently omits a page that should have been indexed.

3. **Relevance tuning at this corpus size.** With 381 guides and significant topical overlap (many architecture guides touch the same patterns), out-of-the-box keyword ranking may surface the closest textual match rather than the most useful guide. `data-pagefind-weight` can boost headings/titles over body text, but good results likely take a round of tuning against real queries, not a one-shot config.

4. **Index staleness matches existing publish lag.** The index only reflects content as of the last successful deploy — editing a guide doesn't update search until the next push/rebuild. Not Pagefind-specific; consistent with how every other page on the site already behaves.

5. **No usage insight out of the box.** Pagefind doesn't report what people searched for and found nothing — the exact signal that would reveal which topics need better cross-linking or a dedicated resource. GA4 is already loaded site-wide, so this is solvable by firing a custom event on search input, but it's additional work, not included.

6. **WASM dependency (negligible).** Requires WASM support in-browser — effectively universal on any browser this audience would use.

---

## Status

Research only — no implementation started. Next step, if pursued: prototype the Pagefind build step plus a `/search` page against real content to validate relevance quality before committing to the approach.
