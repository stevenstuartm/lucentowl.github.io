# Derivation Check

A check for content that reproduces one source's distinctive form without naming it. It applies to every content type: guides, resources, posts, and case studies.

## Why sourcing doesn't catch it

Sourcing covers facts a writer knows they took from somewhere. Derivation is different. A model trained on a field's standard book reproduces the book's structure (its tables, scales, lists, and coined names) as if that were simply how the subject is presented. The writer never feels they are quoting, so nothing prompts a citation.

Ideas and facts are free to use. A particular expression, selection, or arrangement belongs to its author. Scoring nine architecture styles from one to five stars on the same eight characteristics, with the scores a book assigned, reproduces that book's judgments, even when every sentence around the table is original. The architecture style guides carried exactly that table until it was found by chance.

## Signals

Flag anything that matches one of these while reading:

1. **Scores for judgments.** Stars, 1-5 ratings, or letter grades for things nobody measures, such as testability or simplicity.
2. **A fixed grid repeated across a series.** The same set of attributes assessed for every member of a family of guides.
3. **Coined names.** A memorable name for an anti-pattern, technique, or concept ("architecture sinkhole", "grains of sand", "strangler fig"). Someone coined it.
4. **Counted lists and ordered taxonomies.** "The five types of X", "the four laws of Y", or a section order that reads like a chapter outline.
5. **A book's examples.** The same worked example or example set a well-known source uses.
6. **Direct quotations or near-quotations** of a definition, rule, or aphorism, especially one phrased memorably.

## Where to look first

Derivation concentrates where one or two sources dominate a field. Start with these, and give a hit in them more weight:

| Area | Dominant sources |
| --- | --- |
| Architecture styles, characteristics, quanta, risk | Mark Richards and Neal Ford, *Fundamentals of Software Architecture* and *Software Architecture: The Hard Parts* |
| Design patterns | Gamma, Helm, Johnson, and Vlissides, *Design Patterns* |
| Enterprise and integration patterns | Martin Fowler, *Patterns of Enterprise Application Architecture*; Hohpe and Woolf, *Enterprise Integration Patterns* |
| Refactoring and code smells | Martin Fowler, *Refactoring* |
| Domain-driven design | Eric Evans, *Domain-Driven Design*; Vaughn Vernon, *Implementing Domain-Driven Design* |
| Microservices | Sam Newman, *Building Microservices*; Chris Richardson, *Microservices Patterns* |
| Delivery performance | Forsgren, Humble, and Kim, *Accelerate*; the DORA reports |
| Team structure | Skelton and Pais, *Team Topologies* |
| Reliability operations | Google's *Site Reliability Engineering* |
| Data-intensive systems | Martin Kleppmann, *Designing Data-Intensive Applications* |
| Clean code and architecture | Robert C. Martin, *Clean Code* and *Clean Architecture* |

A series of guides built from one book is the likeliest miss. The first run over Architecture found that single-topic guides credited their sources well (Constantine and Yourdon, Feathers, Brandolini, Harmel-Law), while the nine style guides, the foundations guides, and the characteristics glossary followed *Fundamentals of Software Architecture* chapter by chapter, in its taxonomies, its lists, and its examples. No single guide feels like a quotation, so nothing prompted the writer to notice, and the problem was the form itself rather than a missing citation.

Check the site's own standards as well. A writing standard that tells writers to use a source's criteria, categories, or process spreads that source's form into every guide written to it. The architecture terminology standard did exactly that until the same pass removed it.

Guides built from vendor documentation (AWS, Azure, product APIs) already cite their sources and rarely carry this problem.

## The test

For each flagged item, ask: **could two authors working independently have produced this?** A fact passes, since anyone checking would state it the same way. A score, a coined name, a grid, or a counted taxonomy doesn't pass.

Vocabulary that has become the field's own, such as "microservices", "technical debt", or "CQRS", needs no credit. The line is whether the term, scale, or structure still leads back to one identifiable source. If searching for it lands on one author's work, it does.

## The fix

First decide whether the hit is **content** or **form**:

- **Content** is a specific thing a source contributed: a coined term, a named technique, a rule of thumb, a metric, a definition. It can be used, as long as its source is named.
- **Form** is how material is organized and presented: section structure, the taxonomy that divides a topic, the selection of what to cover, the order it's covered in, the set of examples. Form has to be the site's own. **Credit never fixes form.** A reproduced structure with a citation on it is still a reproduced structure.

Then each hit gets one of three resolutions:

- **Credit** (content only). Name the author and work in prose at the specific item, where it first appears: "Mark Richards and Neal Ford call this the architecture sinkhole anti-pattern." The credit is attached to the thing that came from the source, never to a whole guide or section. A line such as "This guide follows X as Y describes it", or any variation that credits a whole guide or its approach, is not an acceptable fix. It admits the form is borrowed without changing it. A guide whose subject *is* one source's technique, such as risk storming, names that technique's author as it would any other technique. In blog posts, name the source in prose and add it to `sources` front matter, per the post link rule.
- **Restructure** (form). Rebuild the borrowed part in the site's own organization and reasoning, so that someone who knows the source wouldn't recognize its outline. Organize a mechanism around what the reader needs to understand, such as the path a request takes or the decision the reader is making, rather than around the source's catalogue of named parts. Choose examples for this guide instead of reusing the source's set. The architecture style ratings became situation-and-reason entries in each guide's "When it fits" and "When to avoid" sections.
- **Cut.** Remove anything that adds nothing once the borrowed form is gone.

When most of a guide's structure traces to one source, the guide is restructured, not credited.

## Running it cheaply

No sweep of the literature is needed:

1. **Extract the skeleton.** List headings, bold lead-ins, and table headers. Most signals show up there, and a whole category can be scanned in one pass.
2. **Grep for the mechanical signals.** Stars and scores (`⭐`, `★`, `/5`, `out of 5`), counted headings (`The [0-9]+ `, `Five `, `Seven `), and "anti-pattern".
3. **Read only around the hits.** Apply the test.
4. **Search once per surviving hit** to confirm the source before crediting it. Credit only a source you have confirmed; a wrong credit is worse than none.

## Where it runs

- **Study guides and resources:** item 10 of the Quality Checklist in `study-guide-guide.md`, so it runs for new guides and in depth refinement passes.
- **Independent review:** the `guide-reviewer` agent reports hits as findings.
- **Posts and case studies:** a step in `/review-publishable`.
