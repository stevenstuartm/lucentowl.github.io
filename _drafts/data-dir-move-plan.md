# Data Directory Move — Plan

Move the build-only data files out of the published `assets/data/` folder into Jekyll's default `_data/`, and leave the one file the browser needs as a plain static asset.

## Status

Not started. Small change, mostly documentation updates. About an hour including the build check.

## The problem

`_config.yml` sets `data_dir: assets/data`. Jekyll's default is `_data/`. Because `assets/` doesn't start with an underscore, Jekyll uses that folder twice:

1. It reads every file there as `site.data` at build time.
2. It **also copies every file into the published site** as a static file.

So all five data files are live on the public site today:

| File | Read at build time via | Needed in the browser? |
| --- | --- | --- |
| `authors.yml` | `site.data.authors` (9 uses) | No |
| `whats_new.yml` | `site.data.whats_new` (1 use) | No |
| `study_guides_config.json` | `site.data.study_guides_config` (5 uses) | No |
| `resources_config.json` | `site.data.resources_config` (2 uses) | No |
| `radar-data.json` | nothing (no `site.data.radar` anywhere) | **Yes.** `pages/tech-radar.md:89` fetches it at runtime |

Anyone can open `lucentowl.com/assets/data/authors.yml`, `/whats_new.yml`, and the two configs. Nothing in them is sensitive, so this isn't a security issue. It's untidy.

The setting arrived with the site's first commit ("First rough version copied from stevenstuartm repo"). It was most likely a shortcut so the radar JSON could be both Jekyll data and a fetchable file, and the other four files inherited the published location.

## Why the change is worth making

- **Only publish what the browser uses.** Four files ship to production for no reason, and every future data file will too unless someone remembers to exclude it. With `_data/`, the default is not to publish, and publishing becomes a deliberate choice.
- **Match Jekyll's convention.** Anyone who knows Jekyll, including a future Claude session, expects `site.data` to come from `_data/`. Today CLAUDE.md has to carry a warning ("`site.data` reads from `assets/data/`, not `_data/`") because the setup is surprising. The move deletes that trap.
- **Clearer split between build data and runtime assets.** `_data/` holds what Liquid reads, and `assets/` holds what the browser loads. `radar-data.json` sits in `assets/` because the browser loads it.
- **Draft data stays private.** A half-written What's New entry or a reordered config is visible on the live site the moment it's pushed, even before any page renders it. With `_data/`, it stays unpublished until a page shows it.

## The fix

### 1. Config

- In `_config.yml`, delete line 23 (`data_dir: assets/data`). Jekyll falls back to `_data/`.

### 2. Move files (`git mv`, not rename-and-recreate, so history follows)

```bash
mkdir _data
git mv assets/data/authors.yml _data/authors.yml
git mv assets/data/whats_new.yml _data/whats_new.yml
git mv assets/data/study_guides_config.json _data/study_guides_config.json
git mv assets/data/resources_config.json _data/resources_config.json
```

- **Leave `assets/data/radar-data.json` where it is.** It's fetched by URL, and nothing reads it through `site.data`, so it keeps working unchanged as a static file.
- The `site.data.*` names don't change, so no Liquid needs editing.
- These are data files, not content, so the no-rename rule for content doesn't apply. Nothing links to their URLs.

### 3. Update references (15 files, all text)

Replace `assets/data/<file>` with `_data/<file>` for the four moved files. Don't change references to `radar-data.json`.

| File | Refs | Notes |
| --- | --- | --- |
| `CLAUDE.md` | 9 | Rewrite the `_config.yml` bullet in Architecture: drop the "`site.data` reads from `assets/data/`" warning and say data lives in `_data/`, with `radar-data.json` a static asset in `assets/data/`. Also update the Author System, study guide config, resource config, What's New, and Tech Radar sections. Tech Radar keeps `assets/data/radar-data.json`. |
| `.claude/content/study-guide-guide.md` | 3 | `study_guides_config.json` paths |
| `.claude/content/resource-guide.md` | 3 | `resources_config.json` paths |
| `.claude/content/guide-refinement-standard.md` | 3 | config paths |
| `.claude/content/domain-map-guide.md` | 1 | |
| `.claude/content/figure-guide.md` | 1 | |
| `.claude/content/learning-path-guide.md` | 1 | `whats_new.yml` path |
| `_includes/author-card.html` | 1 | comment only |
| `_includes/whats-new-panel.html` | 1 | comment only |
| `_data/whats_new.yml` (after the move) | 1 | its own header comment |
| `_drafts/*-plan.md` (aspnet-core, aws, learning-paths) | 3 | optional; drafts are history |
| `pages/tech-radar.md` | 1 | **no change**: it's the radar fetch |

Find them again at fix time, since the list may have grown:

```bash
grep -rn "assets/data" --exclude-dir=_site --exclude-dir=.git .
```

### 4. Check whether the skill and memory files mention the path

`grep -rn "assets/data" .claude/ ~/.claude/projects/*lucentowl*/memory/` and update any hits.

## Verify

1. `bundle exec jekyll build` with no new warnings.
2. `_site/assets/data/` contains **only** `radar-data.json`, and `_site/_data/` doesn't exist.
3. Spot-check pages that read each file:
   - Study guides listing: categories and order render (`study_guides_config`).
   - Resources listing: cards in config order (`resources_config`).
   - Any guide page: prev/next navigation works (`guide_navigation.html` reads `study_guides_config`).
   - Author page and a post byline: name, avatar, and social links (`authors`).
   - What's New panel: entries render (`whats_new`).
   - Tech radar: the visualization loads (`radar-data.json` fetch).
4. `python .figcheck.py` and `python .pathcheck.py` still pass. Neither reads these files, but confirm.

## Rollback

Revert the commit. Nothing outside the repo depends on the old public URLs of the four moved files.
