# Figure Guide

A figure is one diagram stored once in `_figures/` and composed into the pages that use it. Figures are building blocks. They never get a page of their own. Read [writing-standards.md](../skills/refine-prose/writing-standards.md) for the universal rules, and [domain-map-guide.md](domain-map-guide.md) for the drawing rules that figures share with component maps.

---

## Figures, Composites, and Guides

Three things work together, and each has one job.

| Piece | Lives in | Job |
| --- | --- | --- |
| Figure | `_figures/<id>.html` | One diagram answering one structural question. The single source of truth for that diagram |
| Composite resource | `_resources/*.md` with a `figures:` list | The destination: every figure for a system, in reading order, each with an anchor |
| Guide | `_guides/**` | The full explanation, embedding figures where the structure they show is being discussed |

A guide shows each figure it embeds in full, in place, so the reader never leaves the page. Figures are composed into pages and never refer to other pages. Navigation between a guide and a composite comes from the composite's `related_guides`, which renders in both directions like any resource's. Several guides can embed the same figure. The Beads claim-topology figure appears in both the Beads and Gas City guides.

Nothing is ever copied. Editing a figure file updates every guide and composite that uses it, which is the point: a copied diagram is a second copy that drifts.

---

## The Figure File

```html
---
title: "One Controller Tick"
kind: component
system: gas-city
summary: "The five steps of one tick, in order."
---
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 540" ...>...</svg>
```

- **Filename is the id.** `<system prefix>-<topic>`, such as `gc-controller-tick` or `bd-ready-frontier`. Guides and composites reference it, so treat it as permanent, like any content filename.
- **`title`**: the name shown above the embedded figure and as the composite's heading.
- **`kind`**: drives the badge. One of `context`, `container`, `component`, `dynamic`, `deployment` (the C4 levels and supplementary views), or `state`, `graph`, `flow`, `structure`, `layering`, `boundary`, `rules`, `chart` (a plotted chart such as a loss curve or scatter plot). Add a kind in both `_includes/figure.html` and `.figcheck.py` before using it.
- **`system`**: the system the figure belongs to. Used for grouping, not rendering.
- **`summary`**: a short phrase naming what the diagram shows, about **6 to 12 words**. The guide's prose carries the explanation, so the summary is a label beside the picture, not a substitute for the paragraph. Say the subject and the one thing that distinguishes it ("The five steps of one tick, in order.", "An order API's trust boundaries, with a threat on each crossing."). **Never open with "Why"**, never phrase it as the reason something is true, and don't stack clauses: a summary long enough to need the guide's context to parse leaves the reader worse off than a plain label. `title` is the plain name of the thing, not a clever phrase.
- **Body**: exactly one `<svg>`, with no wrapper `<div>`. The include supplies the container and the horizontal scrolling.

### Drawing Rules

The form rules in [domain-map-guide.md](domain-map-guide.md) apply: inline SVG, bands and grids, lines between boxes, line style encoding edge class with a legend on the canvas, site CSS variables with hex fallbacks, `role="img"` with `<title>` and `<desc>`. Figures add these:

- **Self-contained.** Each SVG carries its own `<style>` and `<defs>`, because it can appear alone on any page.
- **Unique ids and classes per figure.** Prefix every `id` (title, desc, markers) and every CSS class with a short figure tag such as `gc3-`, and pick a tag no other figure uses. Two figures on one page must not share ids, and an SVG's `<style>` applies to the whole page, so two figures sharing a class prefix restyle each other. A composite resource puts a whole system's figures on one page, so check the tag against every figure, not just the neighbors.
- **C4 box convention** for structural views: the name in bold, the kind and technology in italics as `[Container: Go process]`, then one line of responsibility.
- **No Liquid braces.** Jekyll runs Liquid over a figure's content when it is included, so a literal double brace in a label would be evaluated. Write "variables unfilled", not a template placeholder.
- **Validate and look.** Run `python .svgcheck.py _figures/<id>.html` for geometry, then `python .figrender.py <id>` and open the PNG it prints. The checker catches overflow and collisions but not a line that crosses a label, an arrowhead pointing at a label instead of a box, two parallel lines where one was meant, or a layout that reads in the wrong order. Only looking catches those, so look at every figure after every change.

### Rendering a Figure

`.figrender.py` screenshots one or more figures with headless Chrome, Chromium, or Edge. It strips the front matter, wraps the SVG in a page that loads Raleway, and sizes the window to the SVG's aspect ratio.

```bash
python .figrender.py dn-di-scopes dn-await-timeline      # ids or paths
python .figrender.py dn-di-scopes --width 700            # check a narrow layout
```

- PNGs go to `<system temp>/figrender/` unless you pass `--out`. Never write them into the repo.
- CSS variables are unset in that page, so what you see is the hex fallbacks. A missing or wrong fallback shows up here as a wrong colour.
- When drafting, render after each fix rather than batching several fixes, because fixing one collision often creates another.
- If no browser is found, add its path to `BROWSERS` at the top of the script.

### Granularity

Whether a guide section earns a figure at all is decided by [Show What the Reader Has to Picture](study-guide-guide.md#show-what-the-reader-has-to-picture), which weighs the subject, the guide's depth, and the individual topic. This section covers how to split a figure once it has earned its place.

One structural question per figure. A diagram that answers two questions is two figures: the routed-work sequence and the claim-tier rules started as one diagram and were split, so each can sit beside the paragraph it illustrates. A figure that only restates a table is a table, and belongs in the guide as one.

---

## Composing a Composite Resource

A composite is an ordinary resource whose front matter lists figure ids. Its body can be empty.

```yaml
figures:
  - gc-context
  - gc-containers
  - gc-controller-tick
```

The resource layout renders each figure in `section` mode: an `h2` anchored as `#fig-<id>`, the kind badge, the summary, and the diagram. Order the list the way a reader should meet the system: context first, then containers, then the parts.

**The `figures:` list is the inventory, so the front matter around it isn't.** A composite's `description` states its scope, such as "the diagrams behind the WinUI 3 study guides: how a desktop app's markup, layout, controls, data, and threads fit together at run time". Its `tags` name the domain. Neither is extended when a figure is added. Each figure's own `title` and `summary` already describe it on the page, so a description that lists figures repeats them, grows with every addition, and turns a listing card into a paragraph. Sessions appending one clause per figure pushed several descriptions past 700 characters before this rule existed. See `description` and `tags` in the [resource guide](resource-guide.md).

Every figure belongs to exactly one composite. `.figcheck.py` flags a figure that a guide embeds but no composite lists.

A composite whose body tells a story, such as a worked example, can place its figures itself: set `figures_inline: true`, embed each listed figure in the body with the include, and the layout skips the list at the bottom. The `figures:` list still records ownership.

---

## Embedding in a Guide

```liquid
{% include figure.html id="gc-controller-tick" %}
```

This renders the full diagram in a bordered container with its kind badge, title, and summary. There is one mode on purpose. The figure is on the page from load, so nothing shifts, and a wide diagram scrolls sideways inside its container on a narrow screen. If a diagram would interrupt a guide rather than support it, leave it out of that guide. The composite still has it.

- **Place the include after the paragraph that introduces the structure**, on its own line with a blank line before and after, starting at column 0.
- **The prose still carries the argument.** Don't narrate the figure box by box. When prose refers to what the figure shows, use the labels the figure uses, not letters or names that exist only in the prose.
- **Guides wrapped in `{% raw %}`** (see CLAUDE.md, Liquid and Code Samples) must close the raw block around each include and reopen it after.
- **Guides never embed a fictional worked system's figures.** A mock company or system appears only in the worked example that introduces it, never unannounced in a guide or a general composite.
- **Blog posts never embed figures.** Posts are syndicated and link-free, and an embedded figure would not survive syndication.
- **Embedding adds no link.** The guide reaches the composite through the composite's `related_guides`, the same as any resource, so the `related_*` rule is unchanged. List every guide that embeds a figure in its composite's `related_guides`.

---

## Workflow

1. Draw the figure in `_figures/<id>.html`, validate it with `.svgcheck.py`, and look at it with `.figrender.py`.
2. Add its id to the composite's `figures:` list, and the embedding guide to its `related_guides`, creating the composite resource if the system has none, and register a new composite in `assets/data/resources_config.json`. Leave the composite's `description` and `tags` alone. They state scope, not contents (see Composing a Composite Resource).
3. Embed it in the guides that explain it.
4. Run `python .figcheck.py`. It reports unknown ids, missing front matter, unused figures, and figures missing from every composite, and prints where each figure is used.
5. Build. A running `jekyll serve` does not reload `_config.yml`, so restart it after any collection or config change.
