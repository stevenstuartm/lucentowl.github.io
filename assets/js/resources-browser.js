class ResourceBrowser {
    constructor() {
        this.state = {
            type: null,
            category: null,
            author: null,
            tags: new Set(),
            searches: new Set()
        };
        this.liveSearch = '';
        this.elements = {};
        this.init();
    }

    init() {
        this.cacheElements();
        this.bindTypePills();
        this.bindCategoryPills();
        this.bindAuthorPills();
        this.bindSearch();
        this.bindTagsOnCards();
        this.bindClearAll();
        this.loadFromURL();
        this.applyState();
    }

    cacheElements() {
        this.elements.resourceItems = document.querySelectorAll('.filterable-item');
        this.elements.typePills = document.querySelectorAll('.resource-type-pill');
        this.elements.categoryPills = document.querySelectorAll('.resource-category-pill');
        this.elements.authorPills = document.querySelectorAll('.author-pill');
        this.elements.searchInput = document.getElementById('searchInput');
        this.elements.resultCount = document.getElementById('resultCount');
        this.elements.noResults = document.getElementById('noResults');
        this.elements.activeFiltersBar = document.getElementById('activeFiltersBar');
        this.elements.activeFilterChips = document.getElementById('activeFilterChips');
        this.elements.clearAllBtn = document.getElementById('clearAllFilters');
    }

    bindTypePills() {
        this.elements.typePills.forEach(pill => {
            pill.addEventListener('click', () => {
                const type = pill.dataset.type || null;
                this.state.type = (type && this.state.type !== type) ? type : null;
                this.applyState();
                this.updateURL();
            });
        });
    }

    bindCategoryPills() {
        this.elements.categoryPills.forEach(pill => {
            pill.addEventListener('click', () => {
                const category = pill.dataset.category || null;
                this.state.category = (category && this.state.category !== category) ? category : null;
                this.applyState();
                this.updateURL();
            });
        });
    }

    bindAuthorPills() {
        this.elements.authorPills.forEach(pill => {
            pill.addEventListener('click', () => {
                const author = pill.dataset.author || null;
                this.state.author = (author && this.state.author !== author) ? author : null;
                this.applyState();
                this.updateURL();
            });
        });
    }

    bindSearch() {
        const input = this.elements.searchInput;
        if (!input) return;

        let timer;
        input.addEventListener('input', () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                this.liveSearch = input.value.toLowerCase().trim();
                this.applyFiltersOnly();
            }, 200);
        });

        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const term = input.value.trim();
                if (term) {
                    this.state.searches.add(term.toLowerCase());
                    input.value = '';
                    this.liveSearch = '';
                    this.applyState();
                    this.updateURL();
                }
            }
            if (e.key === 'Escape') {
                input.value = '';
                this.liveSearch = '';
                this.applyFiltersOnly();
            }
        });
    }

    bindTagsOnCards() {
        document.querySelectorAll('.guide-tag[data-tag]').forEach(btn => {
            btn.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                const tag = btn.dataset.tag;
                if (this.state.tags.has(tag)) {
                    this.state.tags.delete(tag);
                } else {
                    this.state.tags.add(tag);
                }
                this.applyState();
                this.updateURL();
            });
        });
    }

    bindClearAll() {
        if (this.elements.clearAllBtn) {
            this.elements.clearAllBtn.addEventListener('click', () => this.clearAll());
        }
        const clearNoResults = document.getElementById('clearNoResults');
        if (clearNoResults) {
            clearNoResults.addEventListener('click', () => this.clearAll());
        }
    }

    clearAll() {
        this.state = { type: null, category: null, author: null, tags: new Set(), searches: new Set() };
        this.liveSearch = '';
        if (this.elements.searchInput) this.elements.searchInput.value = '';
        this.applyState();
        this.updateURL();
    }

    applyState() {
        this.updateTypePills();
        this.updateCategoryPills();
        this.updateAuthorPills();
        const count = this.filterCards();
        this.updateActiveFiltersBar();
        this.updateResultCount(count);
    }

    updateAuthorPills() {
        this.elements.authorPills.forEach(pill => {
            const pillAuthor = pill.dataset.author || null;
            pill.classList.toggle('author-pill--active', pillAuthor === this.state.author);
        });
    }

    applyFiltersOnly() {
        const count = this.filterCards();
        this.updateResultCount(count);
    }

    updateTypePills() {
        this.elements.typePills.forEach(pill => {
            const pillType = pill.dataset.type || null;
            pill.classList.toggle('resource-type-pill--active', pillType === this.state.type);
        });
    }

    updateCategoryPills() {
        this.elements.categoryPills.forEach(pill => {
            const pillCategory = pill.dataset.category || null;
            pill.classList.toggle('resource-category-pill--active', pillCategory === this.state.category);
        });
    }

    filterCards() {
        const { type, category, author, tags, searches } = this.state;
        let visible = 0;

        this.elements.resourceItems.forEach(item => {
            const show = this.itemMatches(item, type, category, author, tags, searches, this.liveSearch);
            item.style.display = show ? '' : 'none';
            if (show) visible++;
        });

        if (this.elements.noResults) {
            this.elements.noResults.style.display = visible === 0 ? '' : 'none';
        }

        return visible;
    }

    itemMatches(item, type, category, author, tags, searches, liveSearch) {
        if (type && item.dataset.type !== type) return false;
        if (category && item.dataset.category !== category) return false;
        if (author && item.dataset.author !== author) return false;

        if (tags.size > 0) {
            const itemTags = (item.dataset.tags || '').split(',').map(t => t.trim()).filter(Boolean);
            for (const tag of tags) {
                if (!itemTags.includes(tag)) return false;
            }
        }

        const title = item.dataset.title || '';
        const desc = item.dataset.description || '';
        const itemTagStr = item.dataset.tags || '';

        for (const term of searches) {
            if (!title.includes(term) && !desc.includes(term) && !itemTagStr.includes(term)) return false;
        }

        if (liveSearch) {
            if (!title.includes(liveSearch) && !desc.includes(liveSearch) && !itemTagStr.includes(liveSearch)) return false;
        }

        return true;
    }

    updateActiveFiltersBar() {
        const { searches, tags, type, category, author } = this.state;
        const chips = [];

        if (category) {
            const pill = document.querySelector(`.resource-category-pill[data-category="${category}"]`);
            const label = pill ? pill.textContent : category;
            chips.push({ chipType: 'category', label, value: category });
        }
        if (type) chips.push({ chipType: 'type', label: type, value: type });
        if (author) {
            const pill = document.querySelector(`.author-pill[data-author="${author}"]`);
            const label = pill ? pill.textContent : author;
            chips.push({ chipType: 'author', label, value: author });
        }
        for (const term of searches) chips.push({ chipType: 'search', label: term, value: term });
        for (const tag of tags) chips.push({ chipType: 'tag', label: tag, value: tag });

        if (this.elements.activeFiltersBar) {
            this.elements.activeFiltersBar.style.display = chips.length > 0 ? '' : 'none';
        }

        if (!this.elements.activeFilterChips) return;

        this.elements.activeFilterChips.innerHTML = chips.map(chip =>
            `<button class="filter-chip filter-chip--${chip.chipType}" data-type="${this.escAttr(chip.chipType)}" data-value="${this.escAttr(chip.value)}" type="button">
                <span class="filter-chip-label">${this.escHtml(chip.label)}</span>
                <span class="filter-chip-remove" aria-hidden="true">&times;</span>
            </button>`
        ).join('');

        this.elements.activeFilterChips.querySelectorAll('.filter-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const chipType = chip.dataset.type;
                const value = chip.dataset.value;
                if (chipType === 'type') this.state.type = null;
                else if (chipType === 'category') this.state.category = null;
                else if (chipType === 'author') this.state.author = null;
                else if (chipType === 'search') this.state.searches.delete(value);
                else if (chipType === 'tag') this.state.tags.delete(value);
                this.applyState();
                this.updateURL();
            });
        });

        document.querySelectorAll('.guide-tag[data-tag]').forEach(btn => {
            btn.classList.toggle('active', this.state.tags.has(btn.dataset.tag));
        });
    }

    updateResultCount(visible) {
        if (!this.elements.resultCount) return;
        const total = this.elements.resourceItems.length;
        const hasFilters = this.state.type || this.state.category || this.state.author || this.state.tags.size > 0
            || this.state.searches.size > 0 || this.liveSearch;
        this.elements.resultCount.textContent = hasFilters
            ? `${visible} of ${total} resources`
            : `${total} resources`;
    }

    loadFromURL() {
        const params = new URLSearchParams(window.location.search);

        const type = params.get('type');
        if (type) this.state.type = type;

        const category = params.get('category');
        if (category) this.state.category = category;

        const author = params.get('author');
        if (author) this.state.author = author;

        const search = params.get('search');
        if (search) search.split(',').forEach(t => { if (t.trim()) this.state.searches.add(t.trim()); });

        const tags = params.get('tags');
        if (tags) tags.split(',').forEach(t => { if (t.trim()) this.state.tags.add(t.trim()); });
    }

    updateURL() {
        const params = new URLSearchParams();
        if (this.state.type) params.set('type', this.state.type);
        if (this.state.category) params.set('category', this.state.category);
        if (this.state.author) params.set('author', this.state.author);
        if (this.state.searches.size > 0) params.set('search', Array.from(this.state.searches).join(','));
        if (this.state.tags.size > 0) params.set('tags', Array.from(this.state.tags).join(','));

        const url = params.toString() ? `${location.pathname}?${params}` : location.pathname;
        history.replaceState({}, '', url);
    }

    escHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    escAttr(str) {
        return String(str).replace(/"/g, '&quot;');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.resourceBrowser = new ResourceBrowser();
});
