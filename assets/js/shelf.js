/**
 * Shelf Manager
 * Local-only reading list. Lets a reader save posts, guides, resources, and
 * case studies to revisit later. All state lives in localStorage.
 */

class ShelfManager {
    constructor() {
        this.storageKey = 'contentShelf';
    }

    static TYPE_LABELS = {
        posts: 'Post',
        guides: 'Guide',
        resources: 'Resource',
        case_studies: 'Case Study'
    };

    static getTypeLabel(type) {
        return ShelfManager.TYPE_LABELS[type] || type;
    }

    getAll() {
        const items = this._load();
        return items.slice().sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
    }

    isShelved(url) {
        return this._load().some(item => item.url === url);
    }

    add(item) {
        const items = this._load().filter(existing => existing.url !== item.url);
        items.push({
            url: item.url,
            title: item.title,
            type: item.type,
            addedAt: new Date().toISOString()
        });
        this._save(items);
        this._dispatchChange();
    }

    remove(url) {
        const items = this._load().filter(item => item.url !== url);
        this._save(items);
        this._dispatchChange();
    }

    toggle(item) {
        const shelved = this.isShelved(item.url);
        if (shelved) {
            this.remove(item.url);
        } else {
            this.add(item);
        }
        return !shelved;
    }

    count() {
        return this._load().length;
    }

    _load() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error('Error reading shelf data:', e);
            return [];
        }
    }

    _save(items) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(items));
        } catch (e) {
            console.error('Error saving shelf data:', e);
        }
    }

    _dispatchChange() {
        window.dispatchEvent(new CustomEvent('shelf:change', { detail: { items: this.getAll() } }));
    }
}

window.ShelfManager = ShelfManager;
