class CaseStudyBrowser {
    constructor() {
        this.state = {
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
        this.bindCategoryPills();
        this.bindAuthorPills();
        this.bindSearch();
        this.bindClearAll();
        this.loadFromURL();
        this.applyState();
    }

    cacheElements() {
        this.elements.caseStudyItems = document.querySelectorAll('.filterable-item');
        this.elements.categorySections = document.querySelectorAll('.category-section[data-section]');
        this.elements.categoryPills = document.querySelectorAll('.resource-category-pill');
        this.elements.authorPills = document.querySelectorAll('.author-pill');
        this.elements.searchInput = document.getElementById('searchInput');
        this.elements.resultCount = document.getElementById('resultCount');
        this.elements.noResults = document.getElementById('noResults');
        this.elements.activeFiltersBar = document.getElementById('activeFiltersBar');
        this.elements.activeFilterChips = document.getElementById('activeFilterChips');
        this.elements.clearAllBtn = document.getElementById('clearAllFilters');
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
        this.state = { category: null, author: null, tags: new Set(), searches: new Set() };
        this.liveSearch = '';
        if (this.elements.searchInput) this.elements.searchInput.value = '';
        this.applyState();
        this.updateURL();
    }

    applyState() {
        this.updateCategoryPills();
        this.updateAuthorPills();
        const count = this.filterCards();
        this.updateActiveFiltersBar();
        this.updateResultCount(count);
    }

    applyFiltersOnly() {
        const count = this.filterCards();
        this.updateResultCount(count);
    }

    updateCategoryPills() {
        this.elements.categoryPills.forEach(pill => {
            const pillCategory = pill.dataset.category || null;
            pill.classList.toggle('resource-category-pill--active', pillCategory === this.state.category);
        });
    }

    updateAuthorPills() {
        this.elements.authorPills.forEach(pill => {
            const pillAuthor = pill.dataset.author || null;
            pill.classList.toggle('author-pill--active', pillAuthor === this.state.author);
        });
    }

    filterCards() {
        const { category, author, searches } = this.state;
        let visible = 0;

        this.elements.caseStudyItems.forEach(item => {
            const show = this.itemMatches(item, category, author, searches, this.liveSearch);
            item.style.display = show ? '' : 'none';
            if (show) visible++;
        });

        this.elements.categorySections.forEach(section => {
            const hasVisible = section.querySelectorAll('.filterable-item:not([style*="display: none"])').length > 0;
            section.style.display = hasVisible ? '' : 'none';
        });

        if (this.elements.noResults) {
            this.elements.noResults.style.display = visible === 0 ? '' : 'none';
        }

        return visible;
    }

    itemMatches(item, category, author, searches, liveSearch) {
        if (category && item.dataset.category !== category) return false;
        if (author && item.dataset.author !== author) return false;

        const title = item.dataset.title || '';
        const desc = item.dataset.description || '';

        for (const term of searches) {
            if (!title.includes(term) && !desc.includes(term)) return false;
        }

        if (liveSearch) {
            if (!title.includes(liveSearch) && !desc.includes(liveSearch)) return false;
        }

        return true;
    }

    updateActiveFiltersBar() {
        const { searches, category, author } = this.state;
        const chips = [];

        if (category) {
            const pill = document.querySelector(`.resource-category-pill[data-category="${category}"]`);
            const label = pill ? pill.textContent : category;
            chips.push({ chipType: 'category', label, value: category });
        }
        if (author) {
            const pill = document.querySelector(`.author-pill[data-author="${author}"]`);
            const label = pill ? pill.textContent : author;
            chips.push({ chipType: 'author', label, value: author });
        }
        for (const term of searches) chips.push({ chipType: 'search', label: term, value: term });

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
                if (chipType === 'category') this.state.category = null;
                else if (chipType === 'author') this.state.author = null;
                else if (chipType === 'search') this.state.searches.delete(value);
                this.applyState();
                this.updateURL();
            });
        });
    }

    updateResultCount(visible) {
        if (!this.elements.resultCount) return;
        const total = this.elements.caseStudyItems.length;
        const hasFilters = this.state.category || this.state.author || this.state.searches.size > 0 || this.liveSearch;
        this.elements.resultCount.textContent = hasFilters
            ? `${visible} of ${total} case studies`
            : `${total} case studies`;
    }

    loadFromURL() {
        const params = new URLSearchParams(window.location.search);

        const category = params.get('category');
        if (category) this.state.category = category;

        const author = params.get('author');
        if (author) this.state.author = author;

        const search = params.get('search');
        if (search) search.split(',').forEach(t => { if (t.trim()) this.state.searches.add(t.trim()); });
    }

    updateURL() {
        const params = new URLSearchParams();
        if (this.state.category) params.set('category', this.state.category);
        if (this.state.author) params.set('author', this.state.author);
        if (this.state.searches.size > 0) params.set('search', Array.from(this.state.searches).join(','));

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
    window.caseStudyBrowser = new CaseStudyBrowser();
});
