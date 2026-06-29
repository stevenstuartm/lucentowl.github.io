/**
 * Reading Progress Tracker
 * Tracks user's reading position in study guides using localStorage
 */

class ReadingProgressTracker {
    constructor() {
        this.storageKey = 'studyGuideProgress';
        this.maxHistoryItems = 10;
        this.minGuideHeight = 1000; // Don't track guides shorter than this

        this.isTracking = false;
    }

    /**
     * Initialize tracking for the current guide page
     * @param {Object} guideData - { url, title, category }
     */
    initTracking(guideData) {
        if (!this.shouldTrack()) {
            return;
        }

        this.currentGuide = guideData;
        this.isTracking = true;

        // Save position when leaving the page
        window.addEventListener('beforeunload', () => this.saveProgress());

        // Also save on visibility change (more reliable on mobile)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.saveProgress();
            }
        });

        // Backup: save periodically while page is visible (every 30 seconds)
        this.periodicSaveInterval = setInterval(() => {
            if (!document.hidden) {
                this.saveProgress();
            }
        }, 30000);
    }

    /**
     * Check if we should track this guide
     */
    shouldTrack() {
        const prefs = this.getPreferences();
        if (!prefs.trackProgress) {
            return false;
        }

        // Don't track if guide is too short
        const scrollHeight = this.getScrollHeight();
        return scrollHeight >= this.minGuideHeight;
    }

    /**
     * Get scroll height - simple and reliable
     */
    getScrollHeight() {
        const body = document.body;
        const html = document.documentElement;

        return Math.max(
            body.scrollHeight,
            body.offsetHeight,
            html.clientHeight,
            html.scrollHeight,
            html.offsetHeight
        );
    }


    /**
     * Save current reading progress (called on page unload)
     */
    saveProgress() {
        if (!this.isTracking) {
            console.log('[Reading Progress] Not tracking, skipping save');
            return;
        }

        // Use pageYOffset for better mobile compatibility
        const scrollPosition = window.pageYOffset || window.scrollY || document.documentElement.scrollTop;

        console.log('[Reading Progress] Current scroll position:', scrollPosition);

        // Normalize URL to use relative path (strip domain if present)
        const normalizedUrl = this.normalizeUrl(this.currentGuide.url);

        const progressData = {
            url: normalizedUrl,
            title: this.currentGuide.title,
            category: this.currentGuide.category,
            scrollPosition: Math.max(scrollPosition, 0), // Save position even if at top
            lastRead: new Date().toISOString()
        };

        console.log('[Reading Progress] Saving progress:', progressData);

        const data = this.getData();
        data.currentGuide = progressData;
        this.setData(data);

        console.log('[Reading Progress] Saved to localStorage');
    }

    /**
     * Normalize URL to relative path for consistent storage
     */
    normalizeUrl(url) {
        try {
            // If it's a full URL, extract the pathname
            if (url.startsWith('http://') || url.startsWith('https://')) {
                const urlObj = new URL(url);
                return urlObj.pathname;
            }
            return url;
        } catch (e) {
            // If URL parsing fails, return as-is
            return url;
        }
    }

    /**
     * Get all progress data from localStorage
     */
    getData() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (!stored) {
                return this.getDefaultData();
            }
            return JSON.parse(stored);
        } catch (e) {
            console.error('Error reading progress data:', e);
            return this.getDefaultData();
        }
    }

    /**
     * Save progress data to localStorage
     */
    setData(data) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(data));
        } catch (e) {
            console.error('Error saving progress data:', e);
        }
    }

    /**
     * Get default data structure
     */
    getDefaultData() {
        return {
            currentGuide: null,
            readingHistory: [],
            preferences: {
                trackProgress: true
            }
        };
    }

    /**
     * Get user preferences
     */
    getPreferences() {
        const data = this.getData();
        return data.preferences || {
            trackProgress: true
        };
    }

    /**
     * Update user preferences
     */
    setPreferences(prefs) {
        const data = this.getData();
        data.preferences = { ...data.preferences, ...prefs };
        this.setData(data);
    }

    /**
     * Get current reading progress (for use in homepage)
     */
    getCurrentProgress() {
        const data = this.getData();
        return data.currentGuide;
    }

    /**
     * Get reading history
     */
    getHistory() {
        const data = this.getData();
        return data.readingHistory || [];
    }

    /**
     * Clear all progress data
     */
    clearAll() {
        localStorage.removeItem(this.storageKey);
    }

    /**
     * Format time ago string
     */
    static formatTimeAgo(isoString) {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

        return date.toLocaleDateString();
    }
}

// Create global instance
window.ReadingProgressTracker = ReadingProgressTracker;
