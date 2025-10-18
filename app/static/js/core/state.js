/**
 * @fileoverview Centralized state management system for Prompt Editor v2.0
 * @description Replaces scattered App.state usage with a structured state management system
 */

import { logger, createLogger } from '../utils/logger.js';
import { AppConstants, AppEvents } from '../config/constants.js';

/**
 * @typedef {Object} AppState
 * @property {Array} prompts - Array of prompt templates
 * @property {Array} promptsList - Filtered/sorted prompts list
 * @property {Array} filteredPrompts - Search-filtered prompts
 * @property {Array} sortedPrompts - Sorted prompts array
 * @property {Object} currentPrompt - Currently selected prompt
 * @property {string} currentFilter - Current filter criteria
 * @property {string} currentSort - Current sort criteria
 * @property {string} searchTerm - Current search term
 * @property {boolean} isLoading - Loading state indicator
 * @property {Object} ui - UI state object
 * @property {Object} settings - Application settings
 */

/**
 * State change event details
 * @typedef {Object} StateChangeEvent
 * @property {string} property - Changed property name
 * @property {any} oldValue - Previous value
 * @property {any} newValue - New value
 * @property {string} timestamp - Change timestamp
 */

/**
 * Centralized State Manager class
 */
export class StateManager extends EventTarget {
    /**
     * Create a new StateManager instance
     */
    constructor() {
        super();
        this.logger = createLogger('StateManager');
        this.state = this.getInitialState();
        this.subscribers = new Map();
        this.history = [];
        this.maxHistorySize = AppConstants.MAX_HISTORY_SIZE || 50;
        
        this.logger.info('StateManager initialized with initial state');
        this.logState();
    }

    /**
     * Get initial application state
     * @returns {AppState} Initial state object
     */
    getInitialState() {
        return {
            // Core data
            prompts: [],
            promptsList: [],
            filteredPrompts: [],
            sortedPrompts: [],
            
            // Current selections
            currentPrompt: null,
            currentFilter: 'all',
            currentSort: 'name',
            searchTerm: '',
            
            // UI state
            ui: {
                sidebarVisible: true,
                currentTab: 'prompts',
                editMode: false,
                selectedPromptId: null,
                expandedCategories: new Set(),
                activeFilters: new Set(),
                viewMode: 'grid'
            },
            
            // Application state
            isLoading: false,
            lastUpdated: null,
            isDirty: false,
            
            // Settings
            settings: {
                autoSave: true,
                sortDirection: 'asc',
                itemsPerPage: 20,
                theme: 'light',
                language: 'fr'
            }
        };
    }

    /**
     * Get current state value by path
     * @param {string} path - Dot notation path to state property
     * @returns {any} State value
     */
    get(path) {
        if (!path) {
            return { ...this.state };
        }

        const keys = path.split('.');
        let current = this.state;
        
        for (const key of keys) {
            if (current === null || current === undefined) {
                return undefined;
            }
            current = current[key];
        }
        
        return current;
    }

    /**
     * Set state value by path
     * @param {string} path - Dot notation path to state property
     * @param {any} value - New value
     * @param {boolean} silent - Whether to suppress events
     */
    set(path, value, silent = false) {
        if (!path) {
            this.logger.error('Cannot set state: path is required');
            return;
        }

        const keys = path.split('.');
        const lastKey = keys.pop();
        let current = this.state;
        
        // Navigate to parent object
        for (const key of keys) {
            if (current[key] === null || current[key] === undefined) {
                current[key] = {};
            }
            current = current[key];
        }
        
        const oldValue = current[lastKey];
        
        // Only update if value actually changed
        if (this.deepEqual(oldValue, value)) {
            return;
        }
        
        current[lastKey] = value;
        
        // Add to history
        this.addToHistory({
            property: path,
            oldValue: this.deepClone(oldValue),
            newValue: this.deepClone(value),
            timestamp: new Date().toISOString()
        });
        
        // Mark as dirty
        this.state.isDirty = true;
        this.state.lastUpdated = new Date().toISOString();
        
        if (!silent) {
            this.notifyChange(path, oldValue, value);
        }
        
        this.logger.debug(`State updated: ${path}`, { oldValue, newValue: value });
    }

    /**
     * Update multiple state properties at once
     * @param {Object} updates - Object with property paths as keys
     * @param {boolean} silent - Whether to suppress events
     */
    update(updates, silent = false) {
        const changes = [];
        
        for (const [path, value] of Object.entries(updates)) {
            const oldValue = this.get(path);
            if (!this.deepEqual(oldValue, value)) {
                changes.push({ path, oldValue, newValue: value });
            }
        }
        
        if (changes.length === 0) {
            return;
        }
        
        // Apply all changes
        for (const change of changes) {
            this.set(change.path, change.newValue, true);
        }
        
        if (!silent) {
            // Emit batch change event
            this.dispatchEvent(new CustomEvent(AppEvents.STATE_BATCH_UPDATE, {
                detail: { changes }
            }));
            
            this.logger.debug(`Batch state update: ${changes.length} properties changed`, changes);
        }
    }

    /**
     * Subscribe to state changes for a specific path
     * @param {string} path - State path to watch
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    subscribe(path, callback) {
        if (!this.subscribers.has(path)) {
            this.subscribers.set(path, new Set());
        }
        
        this.subscribers.get(path).add(callback);
        
        this.logger.debug(`Subscribed to state changes for: ${path}`);
        
        // Return unsubscribe function
        return () => {
            const pathSubscribers = this.subscribers.get(path);
            if (pathSubscribers) {
                pathSubscribers.delete(callback);
                if (pathSubscribers.size === 0) {
                    this.subscribers.delete(path);
                }
            }
            this.logger.debug(`Unsubscribed from state changes for: ${path}`);
        };
    }

    /**
     * Subscribe to any state change
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    subscribeAll(callback) {
        const handler = (event) => {
            callback(event.detail);
        };
        
        this.addEventListener(AppEvents.STATE_CHANGE, handler);
        
        return () => {
            this.removeEventListener(AppEvents.STATE_CHANGE, handler);
        };
    }

    /**
     * Notify subscribers about state change
     * @param {string} path - Changed path
     * @param {any} oldValue - Old value
     * @param {any} newValue - New value
     */
    notifyChange(path, oldValue, newValue) {
        // Notify specific path subscribers
        const pathSubscribers = this.subscribers.get(path);
        if (pathSubscribers) {
            for (const callback of pathSubscribers) {
                try {
                    callback(newValue, oldValue, path);
                } catch (error) {
                    this.logger.error(`Error in state subscriber for ${path}:`, error);
                }
            }
        }
        
        // Notify global subscribers
        this.dispatchEvent(new CustomEvent(AppEvents.STATE_CHANGE, {
            detail: { path, oldValue, newValue }
        }));
    }

    /**
     * Reset state to initial values
     */
    reset() {
        const oldState = this.deepClone(this.state);
        this.state = this.getInitialState();
        
        this.dispatchEvent(new CustomEvent(AppEvents.STATE_RESET, {
            detail: { oldState, newState: this.state }
        }));
        
        this.logger.info('State reset to initial values');
    }

    /**
     * Get state snapshot for debugging
     * @returns {Object} State snapshot
     */
    getSnapshot() {
        return {
            state: this.deepClone(this.state),
            timestamp: new Date().toISOString(),
            subscribers: Array.from(this.subscribers.keys()),
            historySize: this.history.length
        };
    }

    /**
     * Add change to history
     * @param {StateChangeEvent} change - Change event
     */
    addToHistory(change) {
        this.history.push(change);
        
        // Trim history if it exceeds max size
        if (this.history.length > this.maxHistorySize) {
            this.history = this.history.slice(-this.maxHistorySize);
        }
    }

    /**
     * Get state change history
     * @param {number} limit - Maximum number of entries to return
     * @returns {Array<StateChangeEvent>} History entries
     */
    getHistory(limit = 10) {
        return this.history.slice(-limit);
    }

    /**
     * Deep clone an object
     * @param {any} obj - Object to clone
     * @returns {any} Cloned object
     */
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        
        if (obj instanceof Date) {
            return new Date(obj);
        }
        
        if (obj instanceof Set) {
            return new Set(obj);
        }
        
        if (obj instanceof Map) {
            return new Map(obj);
        }
        
        if (Array.isArray(obj)) {
            return obj.map(item => this.deepClone(item));
        }
        
        const cloned = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                cloned[key] = this.deepClone(obj[key]);
            }
        }
        
        return cloned;
    }

    /**
     * Deep equality comparison
     * @param {any} a - First value
     * @param {any} b - Second value
     * @returns {boolean} Whether values are deeply equal
     */
    deepEqual(a, b) {
        if (a === b) return true;
        
        if (a === null || b === null || typeof a !== typeof b) {
            return false;
        }
        
        if (a instanceof Date && b instanceof Date) {
            return a.getTime() === b.getTime();
        }
        
        if (a instanceof Set && b instanceof Set) {
            if (a.size !== b.size) return false;
            for (const item of a) {
                if (!b.has(item)) return false;
            }
            return true;
        }
        
        if (Array.isArray(a) && Array.isArray(b)) {
            if (a.length !== b.length) return false;
            for (let i = 0; i < a.length; i++) {
                if (!this.deepEqual(a[i], b[i])) return false;
            }
            return true;
        }
        
        if (typeof a === 'object') {
            const keysA = Object.keys(a);
            const keysB = Object.keys(b);
            
            if (keysA.length !== keysB.length) return false;
            
            for (const key of keysA) {
                if (!b.hasOwnProperty(key) || !this.deepEqual(a[key], b[key])) {
                    return false;
                }
            }
            return true;
        }
        
        return false;
    }

    /**
     * Log current state for debugging
     */
    logState() {
        this.logger.debug('Current state snapshot:', this.getSnapshot());
    }
}

/**
 * Default state manager instance
 */
export const stateManager = new StateManager();

/**
 * Convenience functions for common state operations
 */
export const State = {
    /**
     * Get prompts array
     * @returns {Array} Prompts array
     */
    getPrompts() {
        return stateManager.get('prompts') || [];
    },

    /**
     * Set prompts array
     * @param {Array} prompts - New prompts array
     */
    setPrompts(prompts) {
        stateManager.set('prompts', prompts);
        stateManager.set('promptsList', prompts);
    },

    /**
     * Get current prompt
     * @returns {Object|null} Current prompt
     */
    getCurrentPrompt() {
        return stateManager.get('currentPrompt');
    },

    /**
     * Set current prompt
     * @param {Object} prompt - Prompt object
     */
    setCurrentPrompt(prompt) {
        stateManager.update({
            'currentPrompt': prompt,
            'ui.selectedPromptId': prompt ? prompt.id : null
        });
    },

    /**
     * Get search term
     * @returns {string} Search term
     */
    getSearchTerm() {
        return stateManager.get('searchTerm') || '';
    },

    /**
     * Set search term
     * @param {string} term - Search term
     */
    setSearchTerm(term) {
        stateManager.set('searchTerm', term);
    },

    /**
     * Get loading state
     * @returns {boolean} Loading state
     */
    isLoading() {
        return stateManager.get('isLoading') || false;
    },

    /**
     * Set loading state
     * @param {boolean} loading - Loading state
     */
    setLoading(loading) {
        stateManager.set('isLoading', loading);
    },

    /**
     * Get UI state property
     * @param {string} property - UI property name
     * @returns {any} UI property value
     */
    getUI(property) {
        return stateManager.get(`ui.${property}`);
    },

    /**
     * Set UI state property
     * @param {string} property - UI property name
     * @param {any} value - New value
     */
    setUI(property, value) {
        stateManager.set(`ui.${property}`, value);
    },

    /**
     * Subscribe to state changes
     * @param {string} path - State path
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    subscribe: stateManager.subscribe.bind(stateManager),

    /**
     * Get state snapshot
     * @returns {Object} State snapshot
     */
    getSnapshot: stateManager.getSnapshot.bind(stateManager)
};