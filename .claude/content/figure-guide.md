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
summary: "The five steps every tick runs in order, and which state lives only in memory."
---
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 540" ...>...</svg>
```

- **Filename is the id.** `<system prefix>-<topic>`, such as `gc-controller-tick` or `bd-ready-frontier`. Guides and composites reference it, so treat it as permanent, like any content filename.
- **`title`**: the name shown above the embedded figure and as the composite's heading.
- **`kind`**: drives the badge. One of `context`, `container`, `component`, `dynamic`, `deployment` (the C4 levels and supplementary views), or `state`, `graph`, `flow`, `structure`, `layering`, `boundary`, `rules`. Add a kind in both `_includes/figure.html` and `.figcheck.py` before using it.
- **`system`**: the system the figure belongs to. Used for grouping, not rendering.
- **`summary`**: one sentence saying what the reader will learn from the figure, not what it contains.
- **Body**: exactly one `<svg>`, with no wrapper `<div>`. The include supplies the container and the horizontal scrolling.

### Drawing Rules

The form rules in [domain-map-guide.md](domain-map-guide.md) apply: inline SVG, bands and grids, lines between boxes, line style encoding edge class with a legend on the canvas, site CSS variables with hex fallbacks, `role="img"` with `<title>` and `<desc>`. Figures add these:

- **Self-contained.** Each SVG carries its own `<style>` and `<defs>`, because it can appear alone on any page.
- **Unique ids per figure.** Prefix every `id` (title, desc, markers) with a short figure tag such as `gc3-`. Two figures on one page must not share ids.
- **C4 box convention** for structural views: the name in bold, the kind and technology in italics as `[Container: Go process]`, then one line of responsibility.
- **No Liquid braces.** Jekyll runs Liquid over a figure's content when it is included, so a literal double brace in a label would be evaluated. Write "variables unfilled", not a template placeholder.
- **Validate and look.** Run `python .svgcheck.py _figures/<id>.html` for geometry, then render it and look at it. The checker catches overflow and collisions but not a line that crosses a label.

### Granularity

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

1. Draw the figure in `_figures/<id>.html` and validate it with `.svgcheck.py`.
2. Add its id to the composite's `figures:` list, creating the composite resource if the system has none, and register a new composite in `assets/data/resources_config.json`.
3. Embed it in the guides that explain it.
4. Run `python .figcheck.py`. It reports unknown ids, missing front matter, unused figures, and figures missing from every composite, and prints where each figure is used.
5. Build. A running `jekyll serve` does not reload `_config.yml`, so restart it after any collection or config change.
