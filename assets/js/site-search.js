/**
 * Site Search
 * Full-text search over the Pagefind index built into _site/pagefind/ after
 * `jekyll build`. The Pagefind runtime is imported on first use, so nothing
 * loads until a reader searches. No query is stored or sent anywhere.
 *
 * SiteSearch renders into a root that marks its parts with data-search-*;
 * SearchPanel wires it to the header button and _includes/search-panel.html.
 */

class SiteSearch {
    static PAGE_SIZE = 10;
    static MIN_QUERY_LENGTH = 2; // one character only ever matches prefix noise
    static MAX_SECTIONS = 2;
    static WORDS_PER_MINUTE = 200;

    // Values of data-pagefind-filter="type:…" in the content layouts, in tab order
    static TYPES = { 'Guide': 'Guides', 'Post': 'Posts', 'Resource': 'Resources', 'Case Study': 'Case Studies', 'Path': 'Paths' };

    constructor(root) {
        this.root = root;
        this.bundlePath = root.dataset.bundle;
        this.form = root.querySelector('[data-search-form]');
        this.input = root.querySelector('[data-search-input]');
        this.tabs = root.querySelector('[data-search-tabs]');
        this.status = root.querySelector('[data-search-status]');
        this.list = root.querySelector('[data-search-results]');
        this.moreButton = root.querySelector('[data-search-more]');

        this.pagefind = null;
        this.results = [];
        this.counts = {};
        this.type = null; // null = All
        this.shown = 0;
        this.kept = 0;
        this.exhausted = false;
        this.query = '';
        this.generation = 0; // discards results from a search that a newer one replaced

        this.form.addEventListener('submit', e => e.preventDefault());
        this.input.addEventListener('input', () => this.search(this.input.value));
        this.moreButton.addEventListener('click', () => this.showMore());
        this.tabs.addEventListener('click', e => {
            const tab = e.target.closest('[data-type]');
            if (!tab) return;
            this.type = tab.dataset.type || null;
            this.search(this.input.value, { immediate: true });
        });
        root.addEventListener('keydown', e => this.onArrowKey(e));
    }

    focus() {
        this.input.focus();
        this.input.select();
    }

    async load() {
        if (!this.pagefind) {
            this.pagefind = await import(this.bundlePath + 'pagefind.js');
            // Title matches outrank pages that only repeat a term in code ("ec2", "s3")
            await this.pagefind.options({ excerptLength: 24, ranking: { metaWeights: { title: 20 } } });
            await this.pagefind.filters(); // until the filter index loads, search responses carry no per-type counts
        }
        return this.pagefind;
    }

    async search(raw, { immediate = false } = {}) {
        const query = raw.trim();
        const generation = ++this.generation;

        if (query.length < SiteSearch.MIN_QUERY_LENGTH) {
            this.clear();
            return;
        }

        let pagefind;
        try {
            pagefind = await this.load();
        } catch (err) {
            this.setStatus('Search is unavailable: the search index has not been built.');
            return;
        }

        // The unfiltered search supplies the per-type counts for the tabs
        const response = immediate
            ? await pagefind.search(query)
            : await pagefind.debouncedSearch(query, {}, 200);
        if (response === null || generation !== this.generation) return;

        // "route53" also runs as "route 53", since the guide spells it that way
        const variant = SiteSearch.splitVariant(query);
        const variantResponse = variant ? await SiteSearch.searchPhrase(pagefind, variant) : null;
        if (generation !== this.generation) return;

        const all = SiteSearch.merge(response, variantResponse);
        const counts = SiteSearch.mergeCounts(response, variantResponse);
        if (this.type && !counts[this.type]) this.type = null; // the chosen type has nothing for this query

        let results = all;
        if (this.type) {
            const filter = { filters: { type: this.type } };
            const [filtered, filteredVariant] = await Promise.all([
                pagefind.search(query, filter),
                variant ? SiteSearch.searchPhrase(pagefind, variant, filter) : null
            ]);
            if (generation !== this.generation) return;
            results = SiteSearch.merge(filtered, filteredVariant);
        }

        this.query = query;
        this.terms = SiteSearch.words(variant ? `${query} ${variant}` : query);
        this.counts = counts;
        this.countsExact = !variantResponse; // a merged result set has no exact per-type counts
        this.total = all.length;
        this.results = results;
        this.shown = 0;
        this.kept = 0;
        this.exhausted = false;
        this.list.innerHTML = '';
        await this.showMore(generation);
    }

    async showMore(generation = this.generation) {
        const batch = this.results.slice(this.shown, this.shown + SiteSearch.PAGE_SIZE);
        const pages = await Promise.all(batch.map(r => r.data()));
        if (generation !== this.generation) return;

        // Pagefind ranks closer matches first, so the first stray match means the rest are strays too
        const firstStray = pages.findIndex(p => !this.isRealMatch(p));
        const kept = firstStray === -1 ? pages : pages.slice(0, firstStray);
        if (firstStray !== -1) this.exhausted = true;

        const firstNew = this.kept;
        this.list.insertAdjacentHTML('beforeend', kept.map(p => this.renderResult(p)).join(''));
        this.shown += batch.length;
        this.kept += kept.length;
        this.moreButton.hidden = this.exhausted || this.shown >= this.results.length;
        this.updateStatus();
        this.renderTabs();

        // After "show more", move focus to the first new result so keyboard users continue from there
        if (firstNew > 0) {
            const link = this.list.children[firstNew]?.querySelector('a');
            if (link) link.focus();
        }
    }

    updateStatus() {
        const count = this.exhausted ? this.kept : this.results.length;
        if (count === 0) {
            this.setStatus(`No results for “${this.query}”.`);
            return;
        }
        const scope = this.type ? ` in ${SiteSearch.TYPES[this.type]}` : '';
        this.setStatus(`${count} ${count === 1 ? 'result' : 'results'} for “${this.query}”${scope}`);
    }

    /**
     * Tabs: All plus each type that has results. Pagefind's counts include the
     * stray prefix matches that isRealMatch drops, so when strays turned up the
     * counts would overstate and are left off.
     */
    renderTabs() {
        const types = Object.keys(SiteSearch.TYPES).filter(t => this.counts[t]);
        if (this.kept === 0 || types.length < 2) {
            this.tabs.hidden = true;
            this.tabs.innerHTML = '';
            return;
        }

        const count = n => this.exhausted || !this.countsExact ? '' : ` <span class="site-search-tab-count">${n}</span>`;
        const tab = (type, label, n) => {
            const active = (this.type || '') === type;
            return `<button type="button" class="site-search-tab${active ? ' active' : ''}" data-type="${this.escAttr(type)}" aria-pressed="${active}">${label}${count(n)}</button>`;
        };

        this.tabs.innerHTML = tab('', 'All', this.total)
            + types.map(t => tab(t, SiteSearch.TYPES[t], this.counts[t])).join('');
        this.tabs.hidden = false;
    }

    /**
     * When a word has no match in the index, Pagefind falls back to shorter and
     * shorter prefixes, so "kanban" can match a lone "k" in a code sample. A
     * result is real when one of its highlighted words resembles a query word:
     * the query word is a prefix of it ("latenc" → latency), or it is a close
     * misspelling that shares most of its length ("idempotant" → idempotent).
     */
    isRealMatch(page) {
        const excerpts = [page.excerpt, ...page.sub_results.map(s => s.excerpt)].join(' ');
        const marked = [...excerpts.matchAll(/<mark>(.*?)<\/mark>/g)].flatMap(m => SiteSearch.words(m[1]));
        if (marked.length === 0) return true; // nothing to judge by, so trust Pagefind

        return marked.some(word => this.terms.some(term => SiteSearch.resembles(word, term)));
    }

    /**
     * Content often writes a product name with a space the reader leaves out:
     * "Route 53" searched as "route53". Returns the spaced form for a word of 3+
     * letters followed by digits, or null. Two-letter names like "s3" and "ec2"
     * are left alone, and the original query always runs too, so a real single
     * word ("base64", "sha256") still matches.
     */
    static splitVariant(query) {
        const split = query.replace(/(\p{L}{3,})(\p{N}+)(?![\p{L}\p{N}])/gu, '$1 $2');
        return split === query ? null : split;
    }

    /**
     * Pages containing the words as an exact phrase, ranked by the plain search's
     * scores. The plain search alone adds noise ("base 64" matches any page with
     * "based" and "64"); the phrase search alone ranks poorly.
     */
    static async searchPhrase(pagefind, words, options = {}) {
        const [loose, phrase] = await Promise.all([
            pagefind.search(words, options),
            pagefind.search(`"${words}"`, options)
        ]);
        const inPhrase = new Set(phrase.results.map(r => r.id));
        return { results: loose.results.filter(r => inPhrase.has(r.id)), filters: phrase.filters };
    }

    // Union of two result sets by page, each page at its better score
    static merge(primary, secondary) {
        if (!secondary) return primary.results;
        const best = new Map();
        for (const r of [...primary.results, ...secondary.results]) {
            const seen = best.get(r.id);
            if (!seen || r.score > seen.score) best.set(r.id, r);
        }
        return [...best.values()].sort((a, b) => b.score - a.score);
    }

    // Types present in either result set; the numbers only matter when there is one set
    static mergeCounts(primary, secondary) {
        const counts = { ...(primary.filters?.type || {}) };
        for (const [type, n] of Object.entries(secondary?.filters?.type || {})) {
            counts[type] = Math.max(counts[type] || 0, n);
        }
        return counts;
    }

    static resembles(word, term) {
        let common = 0;
        while (common < word.length && common < term.length && word[common] === term[common]) common++;
        if (common === term.length) return true;
        return common >= 3 && common >= 0.6 * term.length && word.length >= 0.8 * term.length;
    }

    static words(text) {
        return text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    }

    /**
     * Pagefind starts a section excerpt with the section heading ("Transactional
     * Outbox. Catalogued by…"), which repeats the link right before it. Drop the
     * leading sentence when it is the heading, or the tail end of it.
     */
    static withoutHeading(excerpt, heading) {
        // The period can sit inside a highlight when the heading word matched: "<mark>Idempotency.</mark> An…"
        const stop = excerpt.match(/\.(<\/mark>)? /);
        if (!stop) return excerpt;
        const lead = SiteSearch.words(excerpt.slice(0, stop.index).replace(/<[^>]+>/g, '')).join(' ');
        const head = SiteSearch.words(heading).join(' ');
        return lead && head.endsWith(lead) ? excerpt.slice(stop.index + stop[0].length) : excerpt;
    }

    renderResult(page) {
        const title = page.meta.title || page.url;
        const type = page.filters?.type?.[0];
        const minutes = Math.max(1, Math.round(page.word_count / SiteSearch.WORDS_PER_MINUTE));
        const meta = [page.meta.category || page.meta.date, `${minutes} min`].filter(Boolean)
            .map(m => `<span>${this.escHtml(m)}</span>`).join('');
        const badge = type && !this.type ? `<span class="site-search-type">${this.escHtml(type)}</span>` : '';

        // Sections with an anchor; the page-level entry (no #) duplicates the page excerpt
        const anchored = page.sub_results.filter(s => s.url.includes('#') && s.url !== page.url);
        const sections = anchored.slice(0, SiteSearch.MAX_SECTIONS);
        const extra = anchored.length - sections.length;

        // Pagefind excerpts are escaped text with <mark> around matched terms
        const body = sections.length
            ? `<ul class="site-search-sections">${sections.map(s => `
                <li><a href="${this.escAttr(s.url)}" class="site-search-section-link">${this.escHtml(s.title)}</a>
                    <span class="site-search-excerpt">${SiteSearch.withoutHeading(s.excerpt, s.title)}</span></li>`).join('')}
                ${extra > 0 ? `<li class="site-search-extra">+${extra} more matching ${extra === 1 ? 'section' : 'sections'}</li>` : ''}
               </ul>`
            : `<p class="site-search-excerpt site-search-page-excerpt">${page.excerpt}</p>`;

        return `
            <li class="site-search-result">
                <div class="site-search-head">
                    ${badge}<a href="${this.escAttr(page.url)}" class="site-search-title">${this.escHtml(title)}</a>
                    <span class="site-search-meta">${meta}</span>
                </div>
                ${body}
            </li>`;
    }

    // ↑/↓ step through the search box, every result link, and "Show more"; Enter follows the link
    onArrowKey(e) {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        const stops = [this.input, ...this.list.querySelectorAll('a')];
        if (!this.moreButton.hidden) stops.push(this.moreButton);
        const at = stops.indexOf(document.activeElement);
        if (at === -1) return;

        e.preventDefault();
        const next = Math.max(0, Math.min(stops.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1)));
        stops[next].focus();
        if (next > 0) stops[next].scrollIntoView({ block: 'nearest' });
    }

    clear() {
        this.results = [];
        this.shown = 0;
        this.kept = 0;
        this.list.innerHTML = '';
        this.moreButton.hidden = true;
        this.tabs.hidden = true;
        this.tabs.innerHTML = '';
        this.setStatus('');
    }

    setStatus(text) {
        this.status.textContent = text;
    }

    escHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    escAttr(str) {
        return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    }
}

/**
 * Header panel: the search button opens a dialog overlay, like the shelf and
 * What's New panels. "/" opens it from anywhere outside a text field.
 */
class SearchPanel {
    constructor(button, overlay) {
        this.button = button;
        this.overlay = overlay;
        this.search = new SiteSearch(overlay);

        button.addEventListener('click', () => this.open());
        overlay.querySelector('[data-search-close]').addEventListener('click', () => this.close());
        overlay.addEventListener('click', e => { if (e.target === overlay) this.close(); });

        // Following a result to a section on the current page leaves the panel open otherwise
        overlay.querySelector('[data-search-results]').addEventListener('click', e => {
            if (e.target.closest('a')) this.close();
        });

        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && this.isOpen()) {
                this.close();
            } else if (e.key === '/' && !this.isOpen() && !this.isTyping(e.target)) {
                e.preventDefault();
                this.open();
            }
        });
    }

    isOpen() {
        return this.overlay.classList.contains('open');
    }

    isTyping(el) {
        return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
    }

    open() {
        this.overlay.classList.add('open');
        this.button.setAttribute('aria-expanded', 'true');
        this.search.focus();
    }

    close() {
        this.overlay.classList.remove('open');
        this.button.setAttribute('aria-expanded', 'false');
        this.button.focus();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('searchIndicator');
    const overlay = document.getElementById('searchPanelOverlay');
    if (button && overlay) new SearchPanel(button, overlay);
});
