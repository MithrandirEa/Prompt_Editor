/**
 * @fileoverview Global constants for Prompt Editor v2.0
 * @description Centralized configuration constants extracted from the monolithic app.js
 */

/**
 * Application configuration constants
 * @namespace AppConstants
 */
export const AppConstants = {
    /** Maximum number of history entries */
    MAX_HISTORY_SIZE: 50,
    
    /** Search debounce delay in milliseconds */
    SEARCH_DEBOUNCE_DELAY: 300,
    
    /** General UI delay for DOM operations */
    UI_DELAY: 100,
    
    /** Sidebar animation delay */
    SIDEBAR_DELAY: 200,
    
    /** Template loading delay */
    TEMPLATE_LOAD_DELAY: 300,
    
    /** Download batch delay between files */
    DOWNLOAD_BATCH_DELAY: 100,
    
    /** Maximum filename length for sanitization */
    MAX_FILENAME_LENGTH: 100,
    
    /** Search retry attempt multiplier */
    SEARCH_RETRY_MULTIPLIER: 200
};

/**
 * CSS class constants for consistent styling
 * @namespace CSSClasses
 */
export const CSSClasses = {
    // Tab states
    TAB_INACTIVE: 'text-gray-600 hover:bg-gray-100',
    TAB_ACTIVE: 'tab-active',
    
    // Common form styling
    FORM_INPUT: 'w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500',
    FORM_LABEL: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2',
    
    // Button styles
    BUTTON_SECONDARY: 'px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors',
    
    // Visibility
    HIDDEN: 'hidden',
    
    // Event binding marker
    EVENT_BOUND: 'eventBound'
};

/**
 * DOM element IDs for consistent querying
 * @namespace ElementIds
 */
export const ElementIds = {
    // Main containers
    TEMPLATES_SIDEBAR: 'templates-sidebar',
    COLLAPSED_SIDEBAR: 'collapsed-sidebar',
    EDITOR_CONTENT: 'editor-content',
    MANAGER_CONTENT: 'manager-content',
    
    // Tabs
    EDITOR_TAB: 'editor-tab',
    MANAGER_TAB: 'manager-tab',
    
    // Sidebar controls
    TOGGLE_SIDEBAR: 'toggle-sidebar',
    EXPAND_SIDEBAR: 'expand-sidebar',
    SHOW_RECENT: 'show-recent',
    SHOW_FAVORITES: 'show-favorites',
    
    // Template elements
    TEMPLATE_TITLE: 'template-title',
    MARKDOWN_EDITOR: 'markdown-editor',
    MARKDOWN_PREVIEW: 'markdown-preview',
    SAVE_TEMPLATE: 'save-template',
    
    // Search
    GLOBAL_SEARCH: 'global-search',
    SEARCH_RESULTS_CONTENT: 'search-results-content',
    SEARCH_RESULTS_GRID: 'search-results-grid',
    CLEAR_SEARCH_BTN: 'clear-search-btn',
    
    // Manager
    TEMPLATES_GRID: 'templates-grid',
    TEMPLATES_COUNT: 'templates-count',
    FOLDER_TREE: 'folder-tree',
    NEW_FOLDER_BTN: 'new-folder-btn',
    
    // Lists
    RECENT_TEMPLATES_LIST: 'recent-templates-list',
    FAVORITE_TEMPLATES_LIST: 'favorite-templates-list'
};

/**
 * API endpoints constants
 * @namespace ApiEndpoints
 */
export const ApiEndpoints = {
    TEMPLATES: '/api/templates',
    FOLDERS: '/api/folders',
    SEARCH: '/api/templates?search=',
    FAVORITES: '/api/templates?favorites=true'
};

/**
 * Storage keys for localStorage
 * @namespace StorageKeys  
 */
export const StorageKeys = {
    THEME: 'prompt-editor-theme',
    SIDEBAR_STATE: 'prompt-editor-sidebar-state',
    EDITOR_STATE: 'prompt-editor-editor-state'
};

/**
 * Application events for inter-module communication
 * @namespace AppEvents
 */
export const AppEvents = {
    // State changes
    STATE_CHANGED: 'state:changed',
    
    // Template events
    TEMPLATE_LOADED: 'template:loaded',
    TEMPLATE_SAVED: 'template:saved',
    TEMPLATE_DELETED: 'template:deleted',
    
    // Search events
    SEARCH_STARTED: 'search:started',
    SEARCH_RESULTS: 'search:results',
    SEARCH_CLEARED: 'search:cleared',
    
    // UI events
    TAB_CHANGED: 'ui:tab-changed',
    SIDEBAR_TOGGLED: 'ui:sidebar-toggled',
    THEME_CHANGED: 'ui:theme-changed'
};

/**
 * Validation constants
 * @namespace ValidationRules
 */
export const ValidationRules = {
    TEMPLATE_TITLE_MAX_LENGTH: 200,
    TEMPLATE_DESCRIPTION_MAX_LENGTH: 500,
    FOLDER_NAME_MAX_LENGTH: 100,
    
    // Regex patterns
    FILENAME_SANITIZE: /[^\w\s-\.]/g,
    WHITESPACE_NORMALIZE: /\s+/g
};

/**
 * Default configuration values
 * @namespace Defaults
 */
export const Defaults = {
    TAB: 'editor',
    THEME: 'light',
    SIDEBAR_COLLAPSED: false,
    AUTO_SAVE_DELAY: 2000
};