# Lucent Owl — Rebranding & Repurposing Plan

**Goal**: Transform this site from a personal marketing site (Steven Stuart's portfolio) into a dev-focused tech publishing platform at `lucentowl.com`. The "lucent" identity — clarity, signal over noise — carries over. The name also references the Luna Owl. The audience shifts from employers and hiring managers to software developers and architects.

**Status key**: `[ ]` todo · `[~]` in progress · `[x]` done

---

## Decisions (Resolved)

| # | Question | Decision |
|---|----------|----------|
| 1 | Site name | **Lucent Owl** (two words) |
| 2 | Author attribution | Dedicated author page per author; posts carry a byline with link to that page; author page links out to personal site (stevenstuartm.com). Single author for now; pattern scales to multiple. |
| 3 | Social presence | Social links appear **only on the author template/page**, nowhere else on the site. |
| 4 | Color scheme | Keep overall schema direction; swap green primary → **light blue** to fit the Luna Owl creature theme. Exact values TBD via iteration — CSS is clean enough to experiment. |
| 5 | Philosophy page | **Remove** |
| 6 | Study Routine page | **Remove** |

---

## Phase 1 — Domain & Config

Core config changes that unlock everything else.

- [x] Update `CNAME` file: `stevenstuartm.com` → `lucentowl.com`
- [x] Update `_config.yml`:
  - `url`: `https://lucentowl.com`
  - `title`: `Lucent Owl`
  - `description`: rewrite for dev-publishing positioning
  - `author.name`: keep as `Steven Stuart` (used by author system, not displayed as site identity)
  - `author.github` / `social`: remove from global config — social links move to author data only
- [ ] Update GitHub Pages settings to point to the new domain

---

## Phase 2 — Author System (build before removing personal content)

The author system must exist before the personal about/resume pages are removed, so nothing breaks mid-transition.

### Data

- [x] Create `_data/authors.yml` with Steven Stuart's entry
- [x] Create `_layouts/author.html` — avatar, name, title, bio, social links, "Full profile →" link to personal site, filtered post list
- [x] Create `pages/authors/steven-stuart.md` (`layout: author`, permalink `/authors/steven-stuart.html`)
- [x] Create `_includes/author-byline.html` — compact avatar + name link for post/case-study headers
- [x] Add byline to `_layouts/post.html` and `_layouts/case-study.html`
- [x] Add `author: steven-stuart` default to posts and case_studies in `_config.yml` (all existing content auto-attributed)
- [x] Rewrite `_includes/social-links.html` — now author-scoped; requires `author` param, reads from `_data/authors.yml`
- [x] Remove social links from `_includes/header.html` and `_includes/footer.html`
- [x] Update JSON-LD in post/case-study layouts to use author data; publisher changed to Organization
- [x] Remove hardcoded Person JSON-LD (stevenstuartm.com) from `_layouts/default.html`
- [x] Add author component CSS to `_sass/_main.scss` (byline, author page, avatar, post list)

---

## Phase 3 — Remove Personal Pages & Content ✓

- [x] **Delete `pages/resume.md`**
- [x] **Delete `pages/about.md`**
- [x] **Delete `pages/philosophy.md`**
- [x] **Delete `pages/study-routine.md`**
- [x] Remove nav links for all deleted pages from `_includes/header.html`
- [x] `_includes/linkedin-link.html` — kept; used in `_posts/2025-10-23-the-agile-masquerade.md` to link a third-party LinkedIn (not personal branding)
- [x] Profile photo `assets/img/profile-steven-stuart-1.jpg` — kept as author page avatar

---

## Phase 4 — Header, Footer & Navigation ✓

- [x] `aria-label` → `"Lucent Owl - Home"` and `alt` → `"Lucent Owl logo"` in header
- [x] Removed Philosophy, Study Routine, About, Resume nav links
- [x] Removed personal social links block from header (done in Phase 2)
- [x] Nav restructured: Insights (Blog, Case Studies, Tech Radar) · Learning (Study Guides)
- [x] About link omitted for now — will be added in Phase 5 when page is published
- [x] Footer: `© Lucent Owl`, social links removed (done in Phase 2)

---

## Phase 5 — New & Repurposed Pages

- [x] **New `pages/about.md`** — published from draft; brand positioning notes preserved in `_drafts/about-lucent-owl.md` for reference; author byline wired live
- [x] **Homepage reinvented**:
  - Hero: "Practical Wisdom from Software Scholars" + practitioner-focused subtitle
  - Content-type card descriptions rewritten for scholarly/practitioner voice
  - "Blog" card renamed "Articles" to match Lucent Owl positioning
  - Emoji icons replaced with inline SVGs (article, book, magnifier, radar target)
  - About link added to header nav

---

## Phase 6 — Color Scheme (Luna Owl theme)

- [x] Applied Luna Owl palette to `_sass/_main.scss` CSS variables (green → deep sky blue `#1A5F8A`, cooler background and border)
- [x] Fixed 3 hardcoded legacy green/warm values in SCSS (border fallback, category card color index 0)
- [ ] Run local dev server and iterate visually — colors are a starting point, visual review needed
- [ ] Verify final WCAG AA contrast ratios after any visual adjustments

---

## Phase 7 — Content Audit

> **Handled manually by owner.** Content standards are unchanged; this phase is about removing content that doesn't belong on the platform, not rewriting style. Owner will review each piece and cut what isn't a fit.

- [ ] Owner reviews `_posts/`, `_guides/`, `_case_studies/` — removes anything not right for Lucent Owl
- [ ] `_includes/share-linkedin.html`: audit callers — keep if used in posts for sharing, remove if only on deleted pages

---

## Phase 8 — CLAUDE.md & Tooling Updates

- [x] Update `CLAUDE.md`: site name/URL, author system docs, page structure, color scheme note, removed personal config fields
- [x] `lint_content.py` and `validate_internal_links.py` — no personal strings found; no changes needed
- [x] Update `README.md` to describe Lucent Owl

---

## Phase 9 — SEO & Metadata

- [x] `_layouts/default.html` — clean; all OG/Twitter tags use `site.title` / `site.description` variables
- [x] Open Graph / Twitter card meta — already correct via site config variables
- [x] `jekyll-sitemap` — `url: https://lucentowl.com` already set in `_config.yml`; will generate correctly
- [x] `404.html` — already brand-neutral; no changes needed
- [x] All layouts audited — no hardcoded `stevenstuartm` or `Steven Stuart` strings found
- [x] Fixed `stevenstuartm.com` URL in `.claude/commands/linkedin-post.md`

---

## Execution Order

1. **Phase 1** — config/domain (short, unblocks everything)
2. **Phase 2** — author system (must exist before deletions)
3. **Phase 3 + 4** — remove personal pages + nav cleanup
4. **Phase 5** — new platform pages
5. **Phase 6** — color scheme (can run in parallel with 5)
6. **Phase 7** — content audit (largest effort)
7. **Phase 8 + 9** — tooling + SEO (cleanup, last)

---

*Last updated: 2026-06-29 — Phases 1–5 complete; Phase 6 color applied (visual review pending); Phase 7 owner-led; Phases 8–9 complete; Phase 1 DNS pending (GitHub Pages settings)*
