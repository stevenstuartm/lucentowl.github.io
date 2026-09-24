---
title: "SEO for Developers: How Search Engines Crawl, Index, and Rank"
layout: guide
category: Web Development
subcategory: SEO & Web
description: "How a search engine crawls, renders, indexes, and ranks a page, and what a developer controls at each stage: robots.txt, status codes, noindex, canonicals, redirects, Core Web Vitals, structured data, links, AI search features, and Search Console."
tags: [fundamentals, crawling, robots-txt, canonicalization, core-web-vitals, structured-data, search-console]
---

Search engine optimization is mostly the work of making a site easy for a search engine to fetch, understand, and trust, and then getting out of the way of content people want. Most of what a developer controls sits in the first two parts. A page that can't be crawled, renders empty to the crawler, or points the search engine at the wrong address may not rank at all, or may rank under a URL you didn't intend, and those problems are invisible from a browser.

This guide cites Google's documentation, [Google Search Central](https://developers.google.com/search/docs){:target="_blank" rel="noopener noreferrer"}, which describes its crawler and index in detail. Bing and other engines follow the same crawl, index, and rank model and differ in the details.

## How a Search Engine Processes a Page

This guide splits the process into four stages, each of which can silently drop a page. Google's own overview describes three (crawling, indexing, and serving) and treats rendering as part of crawling. Google states that it doesn't guarantee it will crawl, index, or serve any page, even one that follows all of its guidelines, and it doesn't accept payment to crawl or rank a site.

A few terms come up at every stage. A **`noindex`** directive, set in a robots `<meta>` tag or an `X-Robots-Tag` HTTP header, asks a search engine not to show a page in results. A result's **snippet** is the descriptive text shown under its title, and snippet controls such as `nosnippet` limit what it can include. The figure shows the crawl and render stages as a queue followed by the worker that drains it, and marks where each control this guide covers takes effect.

{% include figure.html id="seo-crawl-pipeline" %}

### Crawling: Discovery and Access

A crawler, which Google calls **Googlebot**, discovers URLs mainly by following links from pages it already knows, and secondarily from XML sitemaps. Google can only follow a link that is an `<a>` element with an `href` attribute. A `<span>` with a click handler, or a router link that renders without an `href`, is not a link to a crawler, and the page behind it may never be discovered. Single-page apps should route with the History API and real paths (`/products/42`), not URL fragments (`#/products/42`), because Google doesn't reliably treat a fragment as a separate page.

A sitemap lists the URLs you want crawled. Submit it through the Sitemaps report in Google Search Console, the site owner's console covered under Measuring Results, or list it on a `Sitemap:` line in `robots.txt`. Either way it is a hint, not a request Google must honor. A single sitemap holds at most 50,000 URLs or 50 MB uncompressed, and larger sites split it under a sitemap index. Google reads `<lastmod>` only if it is consistently accurate, so a build that stamps every URL with the deploy time teaches Google to ignore the field. It ignores `<priority>` and `<changefreq>` entirely.

`robots.txt` tells crawlers which paths not to fetch. It manages crawler traffic, and it does not keep a page out of the index. A disallowed URL that other sites link to can still be indexed, shown with no description because Google never read the page. The file must sit at the root of a host, and it covers only that exact protocol, host, and port. `https://example.com/robots.txt` does nothing for `https://www.example.com` or a staging subdomain, each of which needs its own. Google supports only four fields (`user-agent`, `allow`, `disallow`, and `sitemap`), so a `noindex` line in `robots.txt` is ignored.

**Crawl budget** is the set of URLs Google can and wants to crawl on a site, bounded by how much load your server handles well and by how much demand Google has for your pages. Google's crawl budget guidance is written for sites with over a million pages that change weekly, sites with over 10,000 pages that change daily, and sites where Search Console reports many URLs as "Discovered - currently not indexed." For smaller sites, Google's advice is to keep the sitemap current and check index coverage regularly.

### Rendering: JavaScript Runs Later, If at All

Google fetches the raw HTML first. Pages that return `200` then wait in a render queue until a headless Chromium, kept current with the latest Chrome release, executes their JavaScript. The wait is often seconds and can be longer. Content and links that exist only after JavaScript runs are invisible until that second pass.

Four consequences follow for client-rendered sites:

- **A `noindex` in the initial HTML can stop rendering altogether.** Google may skip JavaScript execution for a page it has been told not to index, so JavaScript that removes the tag later may never run.
- **Error pages need real signals.** A single-page app that renders "Not found" while returning a `200` status produces a **soft 404**, a missing page that claims to exist. Either redirect to a URL whose server returns `404`, or add a `noindex` robots meta tag to the error view.
- **The renderer needs the page's resources.** Blocking the CSS or JavaScript directories in `robots.txt` stops Google from rendering the page as users see it, so content and layout can be missed.
- **Not every crawler runs JavaScript.** Google's own guidance recommends server-side rendering or pre-rendering because it is faster for users and because not all bots can execute scripts. Both add build or server complexity, which is the cost of content every crawler can read on the first fetch.

### Indexing: Duplicates and the Canonical URL

The same content often answers at several URLs, such as with and without a trailing slash, with tracking parameters, over HTTP and HTTPS, or on a print view. The indexer groups these duplicates and picks one **canonical** URL to represent the group in results. The others are treated as alternates.

You influence that choice, and Google makes it. Its signals, from strongest to weakest:

| Signal | Strength | Use it when |
| --- | --- | --- |
| Permanent redirect (`301`, `308`) | Strong | The old URL should stop existing |
| `<link rel="canonical">` | Strong | Both URLs must keep working, such as parameterized or filtered views |
| Listing the URL in a sitemap | Weak | Supporting evidence alongside one of the above |

Point every canonical at a live, indexable URL that returns `200`. A canonical aimed at a redirect, a `404`, or the homepage on every page sends conflicting signals, and Google either ignores the hint or folds pages into the wrong URL.

Google recommends against using `robots.txt` or `noindex` to steer canonicalization. Blocking a duplicate stops Google from seeing that it is a duplicate, and `noindex` removes the page from search entirely rather than folding it into the canonical. Duplicate content by itself is not a penalty. It only splits signals across URLs until a canonical is settled.

**Google indexes the mobile version of a page.** Since July 2024, Google crawls all sites with its smartphone crawler and uses the mobile rendering for both indexing and ranking. Content, structured data, and links that appear only in the desktop layout are effectively absent. Content that loads only on a tap, swipe, or typed input isn't loaded by the crawler, so primary content can't depend on interaction to appear. Googlebot doesn't scroll either, so content and links that load on scroll, such as an infinite feed, need to load as they enter the viewport or be reachable at paginated URLs.

### Serving: Relevance First

When someone searches, Google ranks indexed canonical URLs using hundreds of factors, including the searcher's location, language, and device. Relevance to the query dominates. Google says it will show the most relevant page even when that page's experience is poor, and that experience contributes most when many pages are similarly helpful. Changes you make can take anywhere from hours to months to show up, and Google suggests waiting a few weeks before judging whether a change worked.

## Controlling What Gets Crawled and Indexed

Each control acts at one stage of the pipeline, which is why the wrong one often does nothing or does the opposite of what was intended.

### Choosing the Right Control

| Goal | Use | Why not the alternatives |
| --- | --- | --- |
| Keep a page out of search results | `noindex`, with crawling **allowed** | A `robots.txt` block hides the `noindex` from the crawler, so the URL can stay indexed |
| Keep private content private | Authentication | Both `robots.txt` and `noindex` are public requests that well-behaved crawlers honor and others ignore |
| Stop crawlers wasting requests on endless URL spaces (faceted filters, calendars) | `robots.txt` disallow | `noindex` still requires every URL to be fetched |
| Merge duplicate URLs | `rel="canonical"` or a permanent redirect | See the canonical signals above |
| Move a page for good | `301` or `308` server-side redirect | A temporary redirect keeps the old URL as canonical |
| Move a page briefly | `302` or `307` redirect | A permanent redirect transfers canonical status you'll want back |

**A staging `noindex` is a classic production outage.** Staging environments tend to carry a sitewide `noindex` or a `Disallow: /`, and a deploy that promotes that configuration to production removes pages from search as Google recrawls them. Make the directive environment-specific in configuration rather than a file someone has to remember to change.

### Redirects Work Best on the Server

| Redirect | How Google reads it |
| --- | --- |
| Server-side `301`, `308`, `302`, `307` | Most reliable. Permanent codes signal the target as canonical, and temporary codes don't |
| `meta refresh` with no delay | Permanent |
| `meta refresh` with a delay | Temporary |
| JavaScript redirect | Last resort, because it fires only if rendering succeeds |

Point each redirect straight at its final destination. Every hop in a chain costs the user a round trip, and Googlebot stops following after 10 hops.

### Status Codes Are Crawl Signals

The server's response code tells the crawler what happened, and Google acts on it:

| Response | What Google does |
| --- | --- |
| `404`, `410` | Doesn't use the content, and removes the URL from the index if it was indexed |
| `429`, `5xx`, timeouts | Slows crawling in proportion to how many URLs fail. Indexed URLs are kept at first but dropped if the errors persist |
| `robots.txt` returns `4xx` other than `429` | Treats the site as having no `robots.txt`, so everything is crawlable |
| `robots.txt` returns `5xx` or `429` | Stops crawling the site for 12 hours, then uses the last good copy for up to 30 days |

For planned maintenance, return `503` rather than a maintenance page with `200`, which would get indexed in place of the real content. Keep it to a day or two at most, because a URL that keeps returning `503` or `429` for several days may be dropped from the index.

### Language and Regional Versions

Sites with translated or region-specific versions of a page mark them with `hreflang` annotations, which tell Google which version to show to which searcher:

- Each annotation names a language code, optionally with a region, such as `en` or `en-GB`.
- Each version lists every version of the page, including itself.
- Annotations must be reciprocal. If two pages don't both point to each other, Google ignores the pair.
- `x-default` names the fallback for searchers whose language matches no version.
- The annotations can go in HTML `<link>` tags, HTTP headers, or the sitemap.

Google detects a page's language from its content and doesn't use `hreflang` or the HTML `lang` attribute for that.

## Page Experience and Core Web Vitals

Google doesn't have a single page experience signal. Its ranking systems look at several aspects: whether the page loads and responds quickly, works on mobile, is served over HTTPS, avoids intrusive interstitials that cover content, and avoids so many ads that they distract from the main content. The measurable part is the three **Core Web Vitals**.

### What the Three Metrics Measure

| Metric | Measures | Good | Needs improvement | Poor |
| --- | --- | --- | --- | --- |
| Largest Contentful Paint (LCP) | Loading: when the largest image or text block renders | ≤ 2.5 s | 2.5 to 4 s | > 4 s |
| Interaction to Next Paint (INP) | Responsiveness: delay from a click, tap, or keypress to the next frame, across the visit | ≤ 200 ms | 200 to 500 ms | > 500 ms |
| Cumulative Layout Shift (CLS) | Visual stability: how much visible content moves unexpectedly | ≤ 0.1 | 0.1 to 0.25 | > 0.25 |

INP replaced First Input Delay as a Core Web Vital in March 2024. FID measured only the delay before the first interaction's handler started, while INP covers every interaction and includes the time to paint the result.

### Passing Is Judged on Field Data

The thresholds apply at the 75th percentile of real page loads, measured separately for mobile and desktop, and a page passes when all three metrics are good. Using the 75th percentile means the slowest quarter of visits decides the result. In the chart below, the median visit sees LCP at 1.6 seconds, comfortably good, but the long tail of slower visits (older phones, weak connections) puts the 75th percentile at 2.8 seconds. Seventy percent of visits are good, and the page still fails, because passing needs at least 75 percent within the threshold.

{% include figure.html id="seo-lcp-percentile" %}

Search Console's Core Web Vitals report uses this field data, collected from Chrome users in the Chrome User Experience Report. [PageSpeed Insights](https://pagespeed.web.dev/){:target="_blank" rel="noopener noreferrer"} shows the same field data when Chrome has enough traffic for the URL, next to a Lighthouse **lab** run, which is a single simulated load. When a URL has too little traffic for its own field data, PageSpeed Insights and Search Console fall back to data for the whole origin or a group of similar URLs, so a page can pass or fail on its neighbors' visits. A local Lighthouse run on a fast developer machine can score well while the field data fails, so use the lab score to diagnose and the field data to judge.

### What Moves Each Metric

| Metric | Common causes | Typical fixes |
| --- | --- | --- |
| LCP | Slow server response, render-blocking CSS and JS (files the browser must load before it paints anything), a hero image discovered late or lazy-loaded | Cache or CDN for HTML, inline the CSS the first screen needs, never lazy-load the LCP image, give it `fetchpriority="high"`, serve compressed modern formats (WebP, AVIF) at the displayed size |
| INP | Long tasks (over 50 ms) on the main thread, the one thread that runs scripts and handles input, plus heavy event handlers and large DOM updates | Break up long tasks, defer non-urgent work until after the next paint, ship less JavaScript, move work off the main thread |
| CLS | Images and embeds without dimensions, ads and banners injected above content, web fonts swapping at a different size | Set `width` and `height` or CSS `aspect-ratio`, reserve space for late content, match fallback font metrics |

Performance is the part of ranking most fully under a developer's control, and it affects every visitor regardless of where they came from.

## Helping Search Engines Understand the Page

### Titles, Descriptions, and Headings

The `<title>` element is the main source for the **title link**, the clickable headline of a search result, and Google may build a different one from the page's main visible heading, the `og:title` social-sharing tag, anchor text pointing at the page, or `WebSite` structured data (both covered below). It rewrites titles that are missing, boilerplate repeated across pages, stale (a year in the title that contradicts the page), or unrepresentative of the content. Write a unique, specific title for every page.

Neither titles nor meta descriptions have a length limit. Google truncates both to fit the device width, so the familiar "60 characters" and "160 characters" rules are rough display estimates, not requirements. Google uses the meta description as the snippet only when it describes the page better than text pulled from the page itself, and a description made of keyword lists is less likely to be shown. Google doesn't use the `keywords` meta tag at all.

Headings organize the page for readers and give the search engine context about the section below them. Google's starter guide says heading order doesn't matter to Search and that there is no ideal number of headings, which covers the common rule of exactly one `<h1>`. A logical `h1` to `h2` to `h3` hierarchy still matters for screen reader users, who navigate long pages by headings.

### Structured Data

Structured data is machine-readable markup, using the [Schema.org](https://schema.org/){:target="_blank" rel="noopener noreferrer"} vocabulary, that states facts the page already shows, such as who wrote an article and when, or what a product costs and whether it is in stock. Google supports JSON-LD, Microdata, and RDFa, and recommends JSON-LD because it sits in its own `<script>` block instead of being woven through the visible HTML.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "SEO for Developers",
  "author": { "@type": "Person", "name": "Jane Doe" },
  "datePublished": "2026-09-24"
}
</script>
```

Valid markup makes a page *eligible* for a rich result, such as review stars, product prices, or breadcrumbs in the snippet. It doesn't guarantee one, and Google documents structured data as a way to become eligible for rich results without listing it as a ranking factor. The markup must describe content visible on the page. Markup that misrepresents it can earn a **manual action**, a penalty applied by a human reviewer at Google and reported in Search Console.

**The set of rich result types changes often.** Google limited FAQ rich results to well-known government and health sites in 2023, stopped showing them altogether in May 2026, and announced the retirement of seven other types in June 2025. Markup for a retired feature does no harm and can be left in place, but it no longer changes how the page looks. Check [Google's current search gallery](https://developers.google.com/search/docs/appearance/structured-data/search-gallery){:target="_blank" rel="noopener noreferrer"} before building markup for a feature, and validate with the [Rich Results Test](https://search.google.com/test/rich-results){:target="_blank" rel="noopener noreferrer"}.

### Social Previews Are Separate From Search

[Open Graph](https://ogp.me/){:target="_blank" rel="noopener noreferrer"} tags (`og:title`, `og:description`, `og:image`, `og:url`) control the card shown when a link is shared on social platforms and in chat apps. X reads its own `twitter:` tags and falls back to Open Graph for the title, description, and image. These tags don't rank anything. Google can use `og:title` as one source for a title link, which is the only overlap. Render them on the server so that preview bots that don't run JavaScript still see them.

### Accessibility Overlaps With SEO Without Being a Ranking Factor

Google's search advocate John Mueller has said accessibility isn't a direct ranking factor, and it isn't among the aspects in Google's page experience documentation. The two disciplines still share a lot of ground, because both depend on a machine reading the page without seeing it:

- **Alt text** describes an image to a screen reader and tells image search what the image shows. Decorative images take an empty `alt=""`.
- **Semantic HTML** (`<nav>`, `<main>`, `<article>`, real `<button>` and `<a>` elements) gives assistive technology and crawlers the same structure.
- **Descriptive link text** tells a screen reader user where a link goes out of context, and tells the search engine what the target page is about.

Build to [WCAG 2.2](https://www.w3.org/WAI/WCAG22/quickref/){:target="_blank" rel="noopener noreferrer"}, the current version, for its own sake. The search benefit follows from the overlap.

## Content Quality and What Google Rewards

Google's ranking systems aim to reward what its guidance calls helpful, reliable, people-first content, which means content made primarily to serve a reader rather than to rank. Its self-assessment questions ask whether the page offers original information or analysis, whether a reader would leave feeling they learned enough, and whether it shows first-hand expertise.

### E-E-A-T Is a Rater Concept, Not a Ranking Factor

Experience, Expertise, Authoritativeness, and Trust come from the guidelines Google gives its human search quality raters. Raters evaluate sample results to measure whether ranking changes are working, and their ratings don't rank individual pages. Google says E-E-A-T itself is not a ranking factor, that its systems use a mix of signals that tend to identify content with good E-E-A-T, and that trust matters most of the four.

Google frames the practical version as three questions:

- **Who** created the content. Readers should be able to tell, through bylines and author pages that show relevant background.
- **How** it was created. Where automation or AI played a meaningful role, explaining how helps readers judge it.
- **Why** it exists. The answer should be to help people, not to attract search traffic.

### How It Was Made Matters Less Than Why

Google doesn't penalize content for being AI-generated. Its **scaled content abuse** policy targets many pages generated mainly to manipulate rankings without adding value, whether a model, a template, or a team of writers produced them.

Length and keywords are not targets either. Google states there is no preferred word count and that keywords in a domain name or URL path have hardly any effect. Repeating keywords to hit a density is keyword stuffing, which violates its spam policies. Cover the topic as thoroughly as the reader's question needs, in the words the reader would use, and update a page when what it says goes out of date.

## Links and Reputation

### Links From Other Sites

Links from other sites were the foundation of Google's original PageRank algorithm, which treated each link as a vote weighted by the importance of the page casting it. They remain one signal among many. Google's starter guide says there is much more to Search than links. The durable way to earn them is content other people want to cite, such as original data, tools, reference material, and clear explanations of things that are otherwise hard to find.

### Paid Links Must Be Marked

Buying or selling links that pass ranking credit violates Google's link spam policy. The policy also covers excessive link exchanges, paid advertorials whose links pass ranking credit, links with optimized anchor text in articles, guest posts, or press releases distributed on other sites, and contracts that require a link without letting the other party qualify it. A paid or sponsored link is fine when it is marked:

| `rel` value | Use on |
| --- | --- |
| `sponsored` | Ads, paid placements, and affiliate links |
| `ugc` | Links in comments, forum posts, and other user-generated content |
| `nofollow` | Links you don't want to vouch for when neither of the above fits |

Google's starter guide suggests `nofollow` for links to content you can't vouch for, so ordinary links to sources you cite need no attribute.

### Internal Links Are the Part You Control

Every page you care about needs a link from at least one other page on the site. A page with none, an **orphan page**, depends on the sitemap or on links from other sites to be discovered. Anchor text should be descriptive and concise.

### Disavowing Links Is Rarely Needed

Google says it can usually work out which links to ignore on its own. Its disavow tool is meant only for sites with many spammy or artificial inbound links that have caused, or are likely to cause, a manual action, and Google warns that disavowing incorrectly can hurt a site's performance in Search.

## Search Beyond the Classic Results Page

### AI Overviews and AI Mode

Google's AI Overviews and AI Mode generate an answer and link to the pages it drew from. Google states there are no additional requirements or special optimizations for appearing in them. A page needs to be indexed and eligible to show a snippet, which makes it a candidate for any Google Search feature.

The existing snippet controls also govern these features. `nosnippet`, `data-nosnippet` (on a section of a page), `max-snippet`, and `noindex` limit what can be shown. The separate `Google-Extended` token in `robots.txt` controls whether Google may use your content to train Gemini models and to ground their answers, meaning to retrieve pages to base an answer on. Google states that it does not affect inclusion or ranking in Search.

### Other Search Engines and AI Assistants

[Bing Webmaster Tools](https://www.bing.com/webmasters){:target="_blank" rel="noopener noreferrer"} is Bing's equivalent of Search Console and can import a verified site from it. Bing also supports **IndexNow**, a protocol for notifying search engines the moment a URL changes, which Yandex and several smaller engines support and Google does not.

AI vendors increasingly let you allow some uses of your content and block others in `robots.txt`. Google does it with the `Google-Extended` control token, which has no crawler of its own. OpenAI runs a separate crawler for each purpose:

| User agent | Purpose | Blocking it means |
| --- | --- | --- |
| `OAI-SearchBot` | Surfacing sites in ChatGPT search answers | The site isn't shown in those answers, though it can still appear as a navigational link |
| `GPTBot` | Collecting training data for models | Content shouldn't be used for training |
| `ChatGPT-User` | Fetching a page because a user asked for it | `robots.txt` may not apply, since a person initiated the request |

A site can allow the search crawlers and block the training crawlers. Check each vendor's crawler documentation for the current list, since agents are added and renamed.

### Local Search

For a business with a physical location or service area, the local results, including the map of nearby businesses shown for local queries, draw heavily on its [Google Business Profile](https://www.google.com/business/){:target="_blank" rel="noopener noreferrer"}. Keep the business name, address, phone, hours, and categories complete and consistent with what the website says.

## Measuring Results

[Google Search Console](https://search.google.com/search-console){:target="_blank" rel="noopener noreferrer"} is where Google reports what it knows about your site. A **Domain** property covers every protocol and subdomain, and a **URL-prefix** property covers only the exact prefix you verify, so a Domain property is the one that catches a stray `www` or staging host. These are the reports that answer the pipeline's questions:

| Question | Report |
| --- | --- |
| Can Google find and index my pages, and why not? | Page indexing report, and URL Inspection for one URL, including a live test that shows the rendered HTML |
| How do real users experience my pages? | Core Web Vitals report (field data) |
| Which queries show my pages, and do people click? | Performance report: **impressions** (times a page appeared in results), clicks, click-through rate, average position |
| Is there a manual action or a security issue? | Manual actions and Security issues reports, which also trigger email alerts |

URL Inspection's rendered HTML is the fastest way to find the rendering problems described earlier. If content or links are missing there, Google doesn't see them either.

Track organic clicks and conversions over rankings for single keywords. Position varies by location, device, and personalization, and a rank tracker checking one query from one place reports one data point. Compare periods of several weeks before and after a change.
