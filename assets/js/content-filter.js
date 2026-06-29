/**
 * Content Filter Module
 * Provides client-side filtering for study guides and blog posts
 * Supports filtering by category, subcategory, tags, and text search
 */

class ContentFilter {
    constructor(config) {
        this.config = config;
        this.activeFilters = {
            category: 'all',
            subcategory: 'all',
            tags: new Set(),
            searchText: ''
        };

        this.init();
    }

    init() {
        this.cacheElements();
        this.attachEventListeners();
        this.initializeFromURL();
        this.applyFilters();
    }

    cacheElements() {
        // Filter controls
        this.categoryFilter = document.getElementById(this.config.categoryFilterId);
        this.subcategoryFilter = document.getElementById(this.config.subcategoryFilterId);
        this.searchInput = document.getElementById(this.config.searchInputId);
        this.tagContainer = document.getElementById(this.config.tagContainerId);
        this.clearFiltersBtn = document.getElementById(this.config.clearFiltersBtnId);

        // Content elements
        this.contentItems = document.querySelectorAll(this.config.itemSelector);
        this.noResultsEl = document.getElementById(this.config.noResultsId);
        this.resultCountEl = document.getElementById(this.config.resultCountId);

        // Category sections (for study guides)
        this.categorySections = document.querySelectorAll(this.config.sectionSelector || '.category-section');
    }

    attachEventListeners() {
        // Category filter
        if (this.categoryFilter) {
            this.categoryFilter.addEventListener('change', () => {
                this.activeFilters.category = this.categoryFilter.value;
                if (this.subcategoryFilter) {
                    this.updateSubcategoryOptions();
                }
                this.applyFilters();
                this.updateURL();
            });
        }

        // Subcategory filter (optional)
        if (this.subcategoryFilter) {
            this.subcategoryFilter.addEventListener('change', () => {
                this.activeFilters.subcategory = this.subcategoryFilter.value;
                this.applyFilters();
                this.updateURL();
            });
        }

        // Search input with debounce
        if (this.searchInput) {
            let debounceTimer;
            this.searchInput.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.activeFilters.searchText = this.searchInput.value.toLowerCase().trim();
                    this.applyFilters();
                    this.updateURL();
                }, 300);
            });
        }

        // Clear filters button
        if (this.clearFiltersBtn) {
            this.clearFiltersBtn.addEventListener('click', () => {
                this.clearAllFilters();
            });
        }

        // Tag filtering (handled separately for each tag button)
        this.attachTagListeners();
    }

    attachTagListeners() {
        if (!this.tagContainer) return;

        const tagButtons = this.tagContainer.querySelectorAll('.tag-filter-btn');
        tagButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tag = btn.dataset.tag;

                if (this.activeFilters.tags.has(tag)) {
                    this.activeFilters.tags.delete(tag);
                    btn.classList.remove('active');
                } else {
                    this.activeFilters.tags.add(tag);
                    btn.classList.add('active');
                }

                this.applyFilters();
                this.updateURL();
            });
        });
    }

    updateSubcategoryOptions() {
        if (!this.subcategoryFilter || !this.config.subcategoryData) return;

        const selectedCategory = this.activeFilters.category;
        const subcategories = this.config.subcategoryData[selectedCategory] || [];

        // Clear existing options except "All"
        this.subcategoryFilter.innerHTML = '<option value="all">All Subcategories</option>';

        // Add subcategories for selected category
        subcategories.forEach(subcat => {
            const option = document.createElement('option');
            option.value = subcat.toLowerCase().replace(/\s+/g, '-');
            option.textContent = subcat;
            this.subcategoryFilter.appendChild(option);
        });

        // Reset subcategory filter
        this.activeFilters.subcategory = 'all';
        this.subcategoryFilter.value = 'all';
    }

    applyFilters() {
        let visibleCount = 0;
        let totalCount = 0;

        // Filter items and count
        this.contentItems.forEach(item => {
            totalCount++;
            const matches = this.itemMatchesFilters(item);

            if (matches) {
                item.style.display = '';
                item.closest('.guide-card')?.style.setProperty('display', 'block', 'important');
                visibleCount++;
            } else {
                item.style.display = 'none';
                item.closest('.guide-card')?.style.setProperty('display', 'none', 'important');
            }
        });

        // Handle category sections and subcategory visibility (for study guides)
        if (this.categorySections.length > 0) {
            this.categorySections.forEach(section => {
                // Hide empty subcategories within each category
                const subcategoryGroups = section.querySelectorAll('.subcategory-group');
                subcategoryGroups.forEach(subgroup => {
                    const visibleItemsInSubgroup = subgroup.querySelectorAll(`${this.config.itemSelector}:not([style*="display: none"])`);
                    subgroup.style.display = visibleItemsInSubgroup.length > 0 ? '' : 'none';
                });

                // Hide entire category section if no subcategories have visible items
                const visibleItems = section.querySelectorAll(`${this.config.itemSelector}:not([style*="display: none"])`);
                section.style.display = visibleItems.length > 0 ? '' : 'none';
            });
        }

        // Update result count and no results message
        this.updateResultCount(visibleCount, totalCount);

        if (visibleCount === 0) {
            if (this.noResultsEl) this.noResultsEl.style.display = 'block';
        } else {
            if (this.noResultsEl) this.noResultsEl.style.display = 'none';
        }

        // Update clear filters button visibility
        this.updateClearFiltersVisibility();

        // Recalculate accordion heights (for study guides page)
        if (typeof window.updateAllAccordionHeights === 'function') {
            // Small delay to allow display changes to take effect
            setTimeout(() => {
                window.updateAllAccordionHeights();
            }, 50);
        }
    }

    itemMatchesFilters(item) {
        // Category filter
        if (this.activeFilters.category !== 'all') {
            const itemCategory = item.dataset.category?.toLowerCase().replace(/\s+/g, '-');
            if (itemCategory !== this.activeFilters.category) {
                return false;
            }
        }

        // Subcategory filter (optional - only if subcategory filter exists)
        if (this.subcategoryFilter && this.activeFilters.subcategory !== 'all') {
            const itemSubcategory = item.dataset.subcategory?.toLowerCase().replace(/\s+/g, '-');
            if (itemSubcategory !== this.activeFilters.subcategory) {
                return false;
            }
        }

        // Tag filter (item must have ALL selected tags)
        if (this.activeFilters.tags.size > 0) {
            const itemTags = item.dataset.tags?.toLowerCase().split(',').map(t => t.trim()) || [];
            for (const tag of this.activeFilters.tags) {
                if (!itemTags.includes(tag.toLowerCase())) {
                    return false;
                }
            }
        }

        // Search text filter (searches in title and description)
        if (this.activeFilters.searchText) {
            const title = item.dataset.title?.toLowerCase() || '';
            const description = item.dataset.description?.toLowerCase() || '';
            const searchText = this.activeFilters.searchText;

            if (!title.includes(searchText) && !description.includes(searchText)) {
                return false;
            }
        }

        return true;
    }

    updateResultCount(count, total) {
        if (!this.resultCountEl) return;

        // Use the provided total if available, otherwise fall back to all items
        const totalItems = total !== undefined ? total : this.contentItems.length;
        this.resultCountEl.textContent = `Showing ${count} of ${totalItems} ${this.config.itemName || 'items'}`;
    }

    updateClearFiltersVisibility() {
        if (!this.clearFiltersBtn) return;

        const hasActiveFilters =
            this.activeFilters.category !== 'all' ||
            this.activeFilters.subcategory !== 'all' ||
            this.activeFilters.tags.size > 0 ||
            this.activeFilters.searchText !== '';

        this.clearFiltersBtn.style.display = hasActiveFilters ? 'inline-block' : 'none';
    }

    clearAllFilters() {
        // Reset all filter values
        this.activeFilters = {
            category: 'all',
            subcategory: 'all',
            tags: new Set(),
            searchText: ''
        };

        // Reset UI elements
        if (this.categoryFilter) this.categoryFilter.value = 'all';
        if (this.subcategoryFilter) {
            this.subcategoryFilter.value = 'all';
            if (this.config.subcategoryData) {
                this.updateSubcategoryOptions();
            }
        }
        if (this.searchInput) this.searchInput.value = '';

        // Deactivate all tag buttons
        if (this.tagContainer) {
            const tagButtons = this.tagContainer.querySelectorAll('.tag-filter-btn');
            tagButtons.forEach(btn => btn.classList.remove('active'));
        }

        // Apply filters and update URL
        this.applyFilters();
        this.updateURL();
    }

    initializeFromURL() {
        const params = new URLSearchParams(window.location.search);

        // Category
        const category = params.get('category');
        if (category && this.categoryFilter) {
            this.activeFilters.category = category;
            this.categoryFilter.value = category;
            if (this.subcategoryFilter && this.config.subcategoryData) {
                this.updateSubcategoryOptions();
            }
        }

        // Subcategory (optional)
        const subcategory = params.get('subcategory');
        if (subcategory && this.subcategoryFilter) {
            this.activeFilters.subcategory = subcategory;
            this.subcategoryFilter.value = subcategory;
        }

        // Tags
        const tags = params.get('tags');
        if (tags) {
            const tagArray = tags.split(',');
            this.activeFilters.tags = new Set(tagArray);

            // Activate tag buttons
            if (this.tagContainer) {
                tagArray.forEach(tag => {
                    const btn = this.tagContainer.querySelector(`[data-tag="${tag}"]`);
                    if (btn) btn.classList.add('active');
                });
            }
        }

        // Search text
        const search = params.get('search');
        if (search && this.searchInput) {
            this.activeFilters.searchText = search.toLowerCase();
            this.searchInput.value = search;
        }
    }

    updateURL() {
        const params = new URLSearchParams();

        if (this.activeFilters.category !== 'all') {
            params.set('category', this.activeFilters.category);
        }

        if (this.subcategoryFilter && this.activeFilters.subcategory !== 'all') {
            params.set('subcategory', this.activeFilters.subcategory);
        }

        if (this.activeFilters.tags.size > 0) {
            params.set('tags', Array.from(this.activeFilters.tags).join(','));
        }

        if (this.activeFilters.searchText) {
            params.set('search', this.activeFilters.searchText);
        }

        const newURL = params.toString()
            ? `${window.location.pathname}?${params.toString()}`
            : window.location.pathname;

        window.history.replaceState({}, '', newURL);
    }

    slugify(text) {
        if (!text) return '';
        return text.toLowerCase()
            .replace(/&/g, '')  // Remove ampersands first
            .replace(/\s+/g, '-')  // Then replace spaces with dashes
            .replace(/-+/g, '-')  // Collapse multiple dashes into one
            .replace(/^-|-$/g, '');  // Remove leading/trailing dashes
    }
}

// Export for use in layouts
window.ContentFilter = ContentFilter;
