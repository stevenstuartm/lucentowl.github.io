class GuideBrowser {
    constructor() {
        this.state = {
            category: null,
            subcategory: null,
            author: null,
            tags: new Set(),
            searches: new Set()   // committed search chips (Enter to add)
        };
        this.liveSearch = '';     // current input text — live filter, not persisted
        this.elements = {};
        this.categoryGridExpanded = true;
        this.init();
    }

    init() {
        this.cacheElements();
        this.bindCategoryCards();
        this.bindCategoryCollapsed();
        this.bindSubcategoryCards();
        this.bindSearch();
        this.bindTagsOnCards();
        this.bindAuthorPills();
        this.bindClearAll();
        this.loadFromURL();
        this.applyState();
    }

    cacheElements() {
        this.elements.guidesPage = document.getElementById('guidesPage');
        this.elements.categoryCardsGrid = document.getElementById('categoryCardsGrid');
        this.elements.categoryCollapsedBar = document.getElementById('categoryCollapsedBar');
        this.elements.categoryCollapsedName = document.getElementById('categoryCollapsedName');
        this.elements.categoryCards = document.querySelectorAll('.category-card');
        this.elements.subcategoryBrowsers = document.querySelectorAll('.subcategory-browser');
        this.elements.subcategoryCards = document.querySelectorAll('.subcategory-card');
        this.elements.guideItems = document.querySelectorAll('.filterable-item');
        this.elements.authorPills = document.querySelectorAll('.author-pill');
        this.elements.categorySections = document.querySelectorAll('.category-section');
        this.elements.subcategoryGroups = document.querySelectorAll('.subcategory-group');
        this.elements.searchInput = document.getElementById('searchInput');
        this.elements.resultCount = document.getElementById('resultCount');
        this.elements.noResults = document.getElementById('noResults');
        this.elements.activeFiltersBar = document.getElementById('activeFiltersBar');
        this.elements.activeFilterChips = document.getElementById('activeFilterChips');
        this.elements.clearAllBtn = document.getElementById('clearAllFilters');
        this.elements.guidesGrid = document.getElementById('guidesGrid');
    }

    bindCategoryCards() {
        this.elements.categoryCards.forEach(card => {
            card.addEventListener('click', () => {
                const cat = card.dataset.category;
                const wasSelected = this.state.category === cat;

                if (wasSelected) {
                    this.state.category = null;
                    this.state.subcategory = null;
                    this.expandCategoryGrid();
                } else {
                    this.state.category = cat;
                    this.state.subcategory = null;
                    this.collapseCategoryGrid(card.querySelector('.category-card-name').textContent);
                }

                this.applyState();
                this.updateURL();
            });
        });
    }

    bindCategoryCollapsed() {
        const browseBtn = document.getElementById('categoryCollapsedBrowse');
        if (browseBtn) {
            browseBtn.addEventListener('click', () => this.expandCategoryGrid());
        }

        const clearBtn = document.getElementById('categoryCollapsedClear');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.state.category = null;
                this.state.subcategory = null;
                this.expandCategoryGrid();
                this.applyState();
                this.updateURL();
            });
        }
    }

    collapseCategoryGrid(categoryName) {
        this.categoryGridExpanded = false;
        if (this.elements.categoryCardsGrid) this.elements.categoryCardsGrid.style.display = 'none';
        if (this.elements.categoryCollapsedBar) this.elements.categoryCollapsedBar.style.display = '';
        if (this.elements.categoryCollapsedName) this.elements.categoryCollapsedName.textContent = categoryName;
    }

    expandCategoryGrid() {
        this.categoryGridExpanded = true;
        if (this.elements.categoryCardsGrid) this.elements.categoryCardsGrid.style.display = '';
        if (this.elements.categoryCollapsedBar) this.elements.categoryCollapsedBar.style.display = 'none';
    }

    bindSubcategoryCards() {
        this.elements.subcategoryCards.forEach(card => {
            card.addEventListener('click', () => {
                const subcat = card.dataset.subcategory;
                if (subcat === 'all') {
                    this.state.subcategory = null;
                } else {
                    this.state.subcategory = this.state.subcategory === subcat ? null : subcat;
                }
                this.applyState();
                this.updateURL();
            });
        });
    }

    bindSearch() {
        const input = this.elements.searchInput;
        if (!input) return;

        // Live filter as user types (does not create a chip)
        let timer;
        input.addEventListener('input', () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                this.liveSearch = input.value.toLowerCase().trim();
                this.applyFiltersOnly();
            }, 200);
        });

        // Commit on Enter → becomes a persistent chip, clears the input
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
            // Escape clears the live search without committing
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
        this.state = { category: null, subcategory: null, author: null, tags: new Set(), searches: new Set() };
        this.liveSearch = '';
        if (this.elements.searchInput) this.elements.searchInput.value = '';
        this.expandCategoryGrid();
        this.applyState();
        this.updateURL();
    }

    // Full state update (category cards, subcategory bar, filters, chips, count)
    applyState() {
        this.updateCategoryCards();
        this.updateSubcategoryBrowser();
        this.updateAuthorPills();
        const count = this.filterGuideCards();
        this.updateGridHeadings();
        this.updateActiveFiltersBar();
        this.updateResultCount(count);
    }

    updateAuthorPills() {
        this.elements.authorPills.forEach(pill => {
            const pillAuthor = pill.dataset.author || null;
            pill.classList.toggle('author-pill--active', pillAuthor === this.state.author);
        });
    }

    // Filter-only update (skip UI chrome — used for live search typing)
    applyFiltersOnly() {
        const count = this.filterGuideCards();
        this.updateResultCount(count);
    }

    updateCategoryCards() {
        this.elements.categoryCards.forEach(card => {
            card.classList.toggle('active', card.dataset.category === this.state.category);
        });
    }

    updateSubcategoryBrowser() {
        this.elements.subcategoryBrowsers.forEach(browser => {
            browser.style.display = browser.dataset.category === this.state.category ? '' : 'none';
        });

        this.elements.subcategoryCards.forEach(card => {
            const isAll = card.dataset.subcategory === 'all';
            const isActive = isAll
                ? card.dataset.category === this.state.category && !this.state.subcategory
                : card.dataset.subcategory === this.state.subcategory;
            card.classList.toggle('active', isActive);
        });
    }

    filterGuideCards() {
        const { category, subcategory, author, tags, searches } = this.state;
        let visible = 0;

        this.elements.guideItems.forEach(item => {
            const show = this.itemMatches(item, category, subcategory, author, tags, searches, this.liveSearch);
            item.style.display = show ? '' : 'none';
            if (show) visible++;
        });

        this.elements.subcategoryGroups.forEach(group => {
            const hasVisible = group.querySelectorAll('.filterable-item:not([style*="display: none"])').length > 0;
            group.style.display = hasVisible ? '' : 'none';
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

    itemMatches(item, category, subcategory, author, tags, searches, liveSearch) {
        if (category && item.dataset.category !== category) return false;
        if (subcategory && item.dataset.subcategory !== subcategory) return false;
        if (author && item.dataset.author !== author) return false;

        if (tags.size > 0) {
            const itemTags = (item.dataset.tags || '').split(',').map(t => t.trim()).filter(Boolean);
            for (const tag of tags) {
                if (!itemTags.includes(tag)) return false;
            }
        }

        const title = item.dataset.title || '';
        const desc = item.dataset.description || '';
        const itemTags = item.dataset.tags || '';

        // All committed search chips must match (AND logic)
        for (const term of searches) {
            if (!title.includes(term) && !desc.includes(term) && !itemTags.includes(term)) return false;
        }

        // Live search text from the input (also AND with committed chips)
        if (liveSearch) {
            if (!title.includes(liveSearch) && !desc.includes(liveSearch) && !itemTags.includes(liveSearch)) return false;
        }

        return true;
    }

    updateGridHeadings() {
        if (!this.elements.guidesGrid) return;
        this.elements.guidesGrid.classList.toggle('guides-grid--single-category', !!this.state.category);
        this.elements.guidesGrid.classList.toggle('guides-grid--single-subcategory', !!this.state.subcategory);
    }

    updateActiveFiltersBar() {
        const { author, searches, tags } = this.state;
        const chips = [];

        if (author) {
            const pill = document.querySelector(`.author-pill[data-author="${author}"]`);
            const label = pill ? pill.textContent : author;
            chips.push({ type: 'author', label, value: author });
        }
        for (const term of searches) {
            chips.push({ type: 'search', label: term, value: term });
        }
        for (const tag of tags) {
            chips.push({ type: 'tag', label: tag, value: tag });
        }

        const hasChips = chips.length > 0;

        if (this.elements.activeFiltersBar) {
            this.elements.activeFiltersBar.style.display = hasChips ? '' : 'none';
        }

        if (!this.elements.activeFilterChips) return;

        this.elements.activeFilterChips.innerHTML = chips.map(chip =>
            `<button class="filter-chip filter-chip--${chip.type}" data-type="${chip.type}" data-value="${this.escAttr(chip.value)}" type="button">
                <span class="filter-chip-label">${this.escHtml(chip.label)}</span>
                <span class="filter-chip-remove" aria-hidden="true">&times;</span>
            </button>`
        ).join('');

        this.elements.activeFilterChips.querySelectorAll('.filter-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const type = chip.dataset.type;
                const value = chip.dataset.value;

                if (type === 'author') {
                    this.state.author = null;
                } else if (type === 'search') {
                    this.state.searches.delete(value);
                } else if (type === 'tag') {
                    this.state.tags.delete(value);
                }

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
        const total = this.elements.guideItems.length;
        const hasFilters = this.state.category || this.state.subcategory || this.state.author
            || this.state.tags.size > 0 || this.state.searches.size > 0 || this.liveSearch;
        this.elements.resultCount.textContent = hasFilters
            ? `${visible} of ${total} guides`
            : `${total} guides`;
    }

    loadFromURL() {
        const params = new URLSearchParams(window.location.search);

        const category = params.get('category');
        if (category) {
            this.state.category = category;
            const card = document.querySelector(`.category-card[data-category="${category}"]`);
            if (card) {
                this.collapseCategoryGrid(card.querySelector('.category-card-name').textContent);
            }
        }

        const subcategory = params.get('subcategory');
        if (subcategory) this.state.subcategory = subcategory;

        const author = params.get('author');
        if (author) this.state.author = author;

        const search = params.get('search');
        if (search) {
            search.split(',').forEach(t => { if (t.trim()) this.state.searches.add(t.trim()); });
        }

        const tags = params.get('tags');
        if (tags) {
            tags.split(',').forEach(t => { if (t.trim()) this.state.tags.add(t.trim()); });
        }
    }

    updateURL() {
        const params = new URLSearchParams();
        if (this.state.category) params.set('category', this.state.category);
        if (this.state.subcategory) params.set('subcategory', this.state.subcategory);
        if (this.state.author) params.set('author', this.state.author);
        if (this.state.searches.size > 0) params.set('search', Array.from(this.state.searches).join(','));
        if (this.state.tags.size > 0) params.set('tags', Array.from(this.state.tags).join(','));

        const url = params.toString()
            ? `${location.pathname}?${params}`
            : location.pathname;
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
    window.guideBrowser = new GuideBrowser();
});
