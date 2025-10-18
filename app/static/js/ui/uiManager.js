/**
 * @fileoverview UI Manager for Prompt Editor v2.0
 * @description Centralized DOM manipulation, event handling, and UI state management
 */

import { logger, createLogger } from '../utils/logger.js';
import { handleError, createError, ErrorType, ErrorCode } from '../utils/errorHandler.js';
import { stateManager, State } from '../core/state.js';
import { templateManager } from '../managers/templateManager.js';
import { AppConstants, CSSClasses, ElementIds, AppEvents } from '../config/constants.js';

/**
 * @typedef {Object} UIElement
 * @property {HTMLElement} element - DOM element
 * @property {Array<string>} events - Attached event types
 * @property {Array<Function>} handlers - Event handlers
 */

/**
 * UI Manager class for centralized DOM interactions
 */
export class UIManager extends EventTarget {
    /**
     * Create a new UIManager instance
     */
    constructor() {
        super();
        this.logger = createLogger('UIManager');
        
        // Element cache and event tracking
        this.elements = new Map();
        this.eventHandlers = new Map();
        this.observers = new Map();
        
        // Component registry
        this.components = new Map();
        
        // Animation states
        this.animations = new Map();
        
        // Initialization state
        this.isInitialized = false;
        
        this.logger.info('UIManager initialized');
    }

    /**
     * Initialize UI Manager
     */
    async initialize() {
        try {
            this.logger.info('Initializing UIManager...');
            
            // Wait for DOM to be ready
            if (document.readyState !== 'complete') {
                await new Promise(resolve => {
                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', resolve);
                    } else {
                        resolve();
                    }
                });
            }
            
            // Cache important elements
            this.cacheElements();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Initialize components
            this.initializeComponents();
            
            // Set up state subscriptions
            this.setupStateSubscriptions();
            
            // Set up observers
            this.setupObservers();
            
            this.isInitialized = true;
            this.logger.info('UIManager initialization complete');
            
            // Emit initialization event
            this.dispatchEvent(new CustomEvent(AppEvents.UI_INITIALIZED));
            
        } catch (error) {
            this.logger.error('UIManager initialization failed:', error);
            handleError(createError(
                'Failed to initialize UIManager',
                ErrorCode.UI_ERROR,
                ErrorType.UI,
                null,
                error
            ));
        }
    }

    /**
     * Cache important DOM elements
     */
    cacheElements() {
        const elementIds = [
            // Navigation
            ElementIds.EDITOR_TAB,
            ElementIds.MANAGER_TAB,
            ElementIds.SIDEBAR_TOGGLE,
            
            // Main content areas
            ElementIds.EDITOR_CONTENT,
            ElementIds.MANAGER_CONTENT,
            ElementIds.TEMPLATES_GRID,
            
            // Forms and inputs
            ElementIds.TEMPLATE_NAME,
            ElementIds.TEMPLATE_CONTENT,
            ElementIds.TEMPLATE_DESCRIPTION,
            ElementIds.SEARCH_INPUT,
            
            // Buttons
            ElementIds.NEW_TEMPLATE_BTN,
            ElementIds.SAVE_TEMPLATE,
            ElementIds.EXPORT_MD,
            ElementIds.EXPORT_TXT,
            ElementIds.SAVE_TO_FOLDER,
            ElementIds.NEW_FOLDER_BTN,
            ElementIds.EXPORT_ALL_TO_FOLDER,
            ElementIds.THEME_TOGGLE,
            
            // Status and feedback
            ElementIds.STATUS_BAR,
            ElementIds.LOADING_INDICATOR,
            ElementIds.ERROR_MESSAGE
        ];
        
        elementIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                this.elements.set(id, {
                    element,
                    events: [],
                    handlers: []
                });
            } else {
                this.logger.warn(`Element not found: ${id}`);
            }
        });
        
        this.logger.debug(`Cached ${this.elements.size} UI elements`);
    }

    /**
     * Set up main event listeners
     */
    setupEventListeners() {
        // Tab navigation
        this.addEventListener(ElementIds.EDITOR_TAB, 'click', () => {
            this.switchTab('editor');
        });
        
        this.addEventListener(ElementIds.MANAGER_TAB, 'click', () => {
            this.switchTab('manager');
        });
        
        // Sidebar toggle
        this.addEventListener(ElementIds.SIDEBAR_TOGGLE, 'click', () => {
            this.toggleSidebar();
        });
        
        // Template actions
        this.addEventListener(ElementIds.NEW_TEMPLATE_BTN, 'click', () => {
            this.createNewTemplate();
        });
        
        this.addEventListener(ElementIds.SAVE_TEMPLATE, 'click', () => {
            this.saveCurrentTemplate();
        });
        
        // Export actions
        this.addEventListener(ElementIds.EXPORT_MD, 'click', () => {
            this.exportTemplate('markdown');
        });
        
        this.addEventListener(ElementIds.EXPORT_TXT, 'click', () => {
            this.exportTemplate('text');
        });
        
        // Folder actions
        this.addEventListener(ElementIds.SAVE_TO_FOLDER, 'click', () => {
            this.saveToFolder();
        });
        
        this.addEventListener(ElementIds.NEW_FOLDER_BTN, 'click', () => {
            this.createNewFolder();
        });
        
        this.addEventListener(ElementIds.EXPORT_ALL_TO_FOLDER, 'click', () => {
            this.exportAllToFolder();
        });
        
        // Theme toggle
        this.addEventListener(ElementIds.THEME_TOGGLE, 'click', () => {
            this.toggleTheme();
        });
        
        // Search functionality
        this.addEventListener(ElementIds.SEARCH_INPUT, 'input', (event) => {
            this.handleSearch(event.target.value);
        });
        
        // Global keyboard shortcuts
        this.setupKeyboardShortcuts();
        
        // Template grid delegation
        this.setupTemplateGridEvents();
        
        this.logger.debug('Event listeners set up');
    }

    /**
     * Set up keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            // Ctrl/Cmd + S - Save template
            if ((event.ctrlKey || event.metaKey) && event.key === 's') {
                event.preventDefault();
                this.saveCurrentTemplate();
            }
            
            // Ctrl/Cmd + N - New template
            if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
                event.preventDefault();
                this.createNewTemplate();
            }
            
            // Ctrl/Cmd + F - Focus search
            if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
                event.preventDefault();
                const searchInput = this.getElement(ElementIds.SEARCH_INPUT);
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select();
                }
            }
            
            // Escape - Clear search or close modals
            if (event.key === 'Escape') {
                this.handleEscape();
            }
        });
    }

    /**
     * Set up template grid event delegation
     */
    setupTemplateGridEvents() {
        const grid = this.getElement(ElementIds.TEMPLATES_GRID);
        if (!grid) return;
        
        // Template card clicks
        this.addEventListener(ElementIds.TEMPLATES_GRID, 'click', (event) => {
            const card = event.target.closest(`.${CSSClasses.TEMPLATE_CARD}`);
            if (!card) return;
            
            const templateId = parseInt(card.dataset.templateId);
            if (!templateId) return;
            
            // Handle different actions based on clicked element
            if (event.target.closest(`.${CSSClasses.DELETE_BTN}`)) {
                event.stopPropagation();
                this.deleteTemplate(templateId);
            } else if (event.target.closest(`.${CSSClasses.FAVORITE_BTN}`)) {
                event.stopPropagation();
                this.toggleFavorite(templateId);
            } else if (event.target.closest(`.${CSSClasses.DUPLICATE_BTN}`)) {
                event.stopPropagation();
                this.duplicateTemplate(templateId);
            } else {
                // Load template
                this.loadTemplate(templateId);
            }
        });
        
        // Context menu for template cards
        this.addEventListener(ElementIds.TEMPLATES_GRID, 'contextmenu', (event) => {
            const card = event.target.closest(`.${CSSClasses.TEMPLATE_CARD}`);
            if (card) {
                event.preventDefault();
                const templateId = parseInt(card.dataset.templateId);
                this.showTemplateContextMenu(event, templateId);
            }
        });
    }

    /**
     * Set up state subscriptions
     */
    setupStateSubscriptions() {
        // Loading state
        stateManager.subscribe('isLoading', (isLoading) => {
            this.updateLoadingState(isLoading);
        });
        
        // Current template
        stateManager.subscribe('currentPrompt', (template) => {
            this.updateCurrentTemplate(template);
        });
        
        // Templates list
        stateManager.subscribe('prompts', () => {
            this.refreshTemplatesGrid();
        });
        
        // UI state changes
        stateManager.subscribe('ui.sidebarVisible', (visible) => {
            this.updateSidebar(visible);
        });
        
        stateManager.subscribe('ui.currentTab', (tab) => {
            this.updateTabDisplay(tab);
        });
        
        stateManager.subscribe('ui.viewMode', (mode) => {
            this.updateViewMode(mode);
        });
        
        // Search and filter
        stateManager.subscribe('searchTerm', (term) => {
            this.updateSearchInput(term);
        });
        
        stateManager.subscribe('filteredPrompts', () => {
            this.refreshTemplatesGrid();
        });
    }

    /**
     * Set up DOM observers
     */
    setupObservers() {
        // Intersection Observer for lazy loading
        if ('IntersectionObserver' in window) {
            this.observers.set('intersection', new IntersectionObserver(
                this.handleIntersection.bind(this),
                { threshold: 0.1 }
            ));
        }
        
        // Mutation Observer for dynamic content
        this.observers.set('mutation', new MutationObserver(
            this.handleMutation.bind(this)
        ));
        
        const grid = this.getElement(ElementIds.TEMPLATES_GRID);
        if (grid) {
            this.observers.get('mutation').observe(grid, {
                childList: true,
                subtree: true
            });
        }
    }

    /**
     * Initialize UI components
     */
    initializeComponents() {
        // Initialize any custom components here
        this.initializeTooltips();
        this.initializeModals();
        this.initializeDropdowns();
        
        this.logger.debug('UI components initialized');
    }

    /**
     * Initialize tooltips
     */
    initializeTooltips() {
        const tooltipElements = document.querySelectorAll('[data-tooltip]');
        tooltipElements.forEach(element => {
            this.setupTooltip(element);
        });
    }

    /**
     * Initialize modals
     */
    initializeModals() {
        const modalTriggers = document.querySelectorAll('[data-modal]');
        modalTriggers.forEach(trigger => {
            this.setupModalTrigger(trigger);
        });
    }

    /**
     * Initialize dropdowns
     */
    initializeDropdowns() {
        const dropdowns = document.querySelectorAll(`.${CSSClasses.DROPDOWN}`);
        dropdowns.forEach(dropdown => {
            this.setupDropdown(dropdown);
        });
    }

    /**
     * Add event listener to element
     * @param {string} elementId - Element ID
     * @param {string} eventType - Event type
     * @param {Function} handler - Event handler
     * @param {Object} options - Event options
     */
    addEventListener(elementId, eventType, handler, options = {}) {
        const elementData = this.elements.get(elementId);
        if (!elementData) {
            this.logger.warn(`Cannot add event listener: element ${elementId} not found`);
            return;
        }
        
        const { element } = elementData;
        
        // Wrap handler with error handling
        const wrappedHandler = (event) => {
            try {
                handler(event);
            } catch (error) {
                this.logger.error(`Error in event handler for ${elementId}:${eventType}:`, error);
                handleError(createError(
                    `Event handler error: ${elementId}`,
                    ErrorCode.EVENT_ERROR,
                    ErrorType.UI,
                    { elementId, eventType },
                    error
                ));
            }
        };
        
        element.addEventListener(eventType, wrappedHandler, options);
        
        // Track the handler for cleanup
        const handlerId = `${elementId}:${eventType}:${Date.now()}`;
        this.eventHandlers.set(handlerId, {
            element,
            eventType,
            handler: wrappedHandler,
            options
        });
        
        elementData.events.push(eventType);
        elementData.handlers.push(handlerId);
    }

    /**
     * Remove event listener
     * @param {string} handlerId - Handler ID
     */
    removeEventListener(handlerId) {
        const handlerData = this.eventHandlers.get(handlerId);
        if (!handlerData) return;
        
        const { element, eventType, handler, options } = handlerData;
        element.removeEventListener(eventType, handler, options);
        this.eventHandlers.delete(handlerId);
    }

    /**
     * Get cached element
     * @param {string} elementId - Element ID
     * @returns {HTMLElement|null} Element or null
     */
    getElement(elementId) {
        const elementData = this.elements.get(elementId);
        return elementData ? elementData.element : null;
    }

    /**
     * Switch between tabs
     * @param {string} tabName - Tab to switch to
     */
    switchTab(tabName) {
        try {
            this.logger.debug(`Switching to tab: ${tabName}`);
            
            // Update state
            State.setUI('currentTab', tabName);
            
            // Update UI
            this.updateTabDisplay(tabName);
            
            // Emit event
            this.dispatchEvent(new CustomEvent(AppEvents.TAB_CHANGED, {
                detail: { tab: tabName }
            }));
            
        } catch (error) {
            this.logger.error(`Failed to switch tab to ${tabName}:`, error);
            handleError(error);
        }
    }

    /**
     * Update tab display
     * @param {string} activeTab - Active tab name
     */
    updateTabDisplay(activeTab) {
        // Update tab buttons
        const editorTab = this.getElement(ElementIds.EDITOR_TAB);
        const managerTab = this.getElement(ElementIds.MANAGER_TAB);
        
        if (editorTab && managerTab) {
            editorTab.classList.toggle(CSSClasses.ACTIVE, activeTab === 'editor');
            managerTab.classList.toggle(CSSClasses.ACTIVE, activeTab === 'manager');
        }
        
        // Update content visibility
        const editorContent = this.getElement(ElementIds.EDITOR_CONTENT);
        const managerContent = this.getElement(ElementIds.MANAGER_CONTENT);
        
        if (editorContent && managerContent) {
            editorContent.classList.toggle(CSSClasses.HIDDEN, activeTab !== 'editor');
            managerContent.classList.toggle(CSSClasses.HIDDEN, activeTab !== 'manager');
        }
    }

    /**
     * Toggle sidebar visibility
     */
    toggleSidebar() {
        try {
            const currentState = State.getUI('sidebarVisible');
            const newState = !currentState;
            
            this.logger.debug(`Toggling sidebar: ${currentState} -> ${newState}`);
            
            // Update state
            State.setUI('sidebarVisible', newState);
            
            // Update UI
            this.updateSidebar(newState);
            
            // Emit event
            this.dispatchEvent(new CustomEvent(AppEvents.SIDEBAR_TOGGLED, {
                detail: { visible: newState }
            }));
            
        } catch (error) {
            this.logger.error('Failed to toggle sidebar:', error);
            handleError(error);
        }
    }

    /**
     * Update sidebar visibility
     * @param {boolean} visible - Sidebar visibility
     */
    updateSidebar(visible) {
        const sidebar = document.querySelector(`.${CSSClasses.SIDEBAR}`);
        const mainContent = document.querySelector(`.${CSSClasses.MAIN_CONTENT}`);
        
        if (sidebar) {
            sidebar.classList.toggle(CSSClasses.COLLAPSED, !visible);
        }
        
        if (mainContent) {
            mainContent.classList.toggle(CSSClasses.SIDEBAR_COLLAPSED, !visible);
        }
        
        // Update toggle button state
        const toggleBtn = this.getElement(ElementIds.SIDEBAR_TOGGLE);
        if (toggleBtn) {
            toggleBtn.classList.toggle(CSSClasses.ACTIVE, visible);
        }
    }

    /**
     * Handle search input
     * @param {string} searchTerm - Search term
     */
    handleSearch(searchTerm) {
        try {
            this.logger.debug(`Search term: "${searchTerm}"`);
            
            // Update state (this will trigger template filtering)
            State.setSearchTerm(searchTerm);
            
            // Debounce the search
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                templateManager.filterTemplates(searchTerm);
            }, AppConstants.SEARCH_DEBOUNCE || 300);
            
        } catch (error) {
            this.logger.error('Search error:', error);
            handleError(error);
        }
    }

    /**
     * Update search input display
     * @param {string} term - Search term
     */
    updateSearchInput(term) {
        const searchInput = this.getElement(ElementIds.SEARCH_INPUT);
        if (searchInput && searchInput.value !== term) {
            searchInput.value = term;
        }
    }

    /**
     * Create new template
     */
    async createNewTemplate() {
        try {
            this.logger.debug('Creating new template');
            
            // Clear current template
            State.setCurrentPrompt(null);
            
            // Clear form fields
            this.clearTemplateForm();
            
            // Switch to editor tab
            this.switchTab('editor');
            
            // Focus on name field
            const nameField = this.getElement(ElementIds.TEMPLATE_NAME);
            if (nameField) {
                nameField.focus();
            }
            
            // Emit event
            this.dispatchEvent(new CustomEvent(AppEvents.NEW_TEMPLATE_STARTED));
            
        } catch (error) {
            this.logger.error('Failed to create new template:', error);
            handleError(error);
        }
    }

    /**
     * Save current template
     */
    async saveCurrentTemplate() {
        try {
            this.logger.debug('Saving current template');
            
            // Get form data
            const templateData = this.getTemplateFormData();
            
            // Validate form
            if (!this.validateTemplateForm(templateData)) {
                return;
            }
            
            // Show loading state
            State.setLoading(true);
            
            // Save via template manager
            const currentTemplate = State.getCurrentPrompt();
            let savedTemplate;
            
            if (currentTemplate && currentTemplate.id) {
                // Update existing template
                savedTemplate = await templateManager.updateTemplate(currentTemplate.id, templateData);
            } else {
                // Create new template
                savedTemplate = await templateManager.createTemplate(templateData);
            }
            
            // Show success message
            this.showSuccessMessage('Template sauvegardé avec succès');
            
            // Update UI
            State.setCurrentPrompt(savedTemplate);
            
        } catch (error) {
            this.logger.error('Failed to save template:', error);
            this.showErrorMessage('Erreur lors de la sauvegarde');
            handleError(error);
        } finally {
            State.setLoading(false);
        }
    }

    /**
     * Load template
     * @param {number} templateId - Template ID
     */
    async loadTemplate(templateId) {
        try {
            this.logger.debug(`Loading template ${templateId}`);
            
            // Show loading state
            State.setLoading(true);
            
            // Load via template manager
            const template = await templateManager.loadTemplate(templateId);
            
            // Update form
            this.updateTemplateForm(template);
            
            // Switch to editor tab
            this.switchTab('editor');
            
        } catch (error) {
            this.logger.error(`Failed to load template ${templateId}:`, error);
            this.showErrorMessage('Erreur lors du chargement du template');
            handleError(error);
        } finally {
            State.setLoading(false);
        }
    }

    /**
     * Delete template
     * @param {number} templateId - Template ID
     */
    async deleteTemplate(templateId) {
        try {
            // Show confirmation dialog
            const confirmed = await this.showConfirmDialog(
                'Confirmer la suppression',
                'Êtes-vous sûr de vouloir supprimer ce template ?'
            );
            
            if (!confirmed) return;
            
            this.logger.debug(`Deleting template ${templateId}`);
            
            // Show loading state
            State.setLoading(true);
            
            // Delete via template manager
            await templateManager.deleteTemplate(templateId);
            
            // Show success message
            this.showSuccessMessage('Template supprimé avec succès');
            
        } catch (error) {
            this.logger.error(`Failed to delete template ${templateId}:`, error);
            this.showErrorMessage('Erreur lors de la suppression');
            handleError(error);
        } finally {
            State.setLoading(false);
        }
    }

    /**
     * Toggle template favorite status
     * @param {number} templateId - Template ID
     */
    async toggleFavorite(templateId) {
        try {
            this.logger.debug(`Toggling favorite for template ${templateId}`);
            
            // Get current template to check favorite status
            const template = templateManager.cache.templates.get(templateId);
            if (!template) return;
            
            const newFavoriteStatus = !template.is_favorite;
            
            // Update via template manager
            await templateManager.toggleFavorite(templateId, newFavoriteStatus);
            
            // Show feedback
            const message = newFavoriteStatus ? 
                'Template ajouté aux favoris' : 
                'Template retiré des favoris';
            this.showSuccessMessage(message);
            
        } catch (error) {
            this.logger.error(`Failed to toggle favorite for template ${templateId}:`, error);
            this.showErrorMessage('Erreur lors de la modification');
            handleError(error);
        }
    }

    /**
     * Duplicate template
     * @param {number} templateId - Template ID
     */
    async duplicateTemplate(templateId) {
        try {
            this.logger.debug(`Duplicating template ${templateId}`);
            
            // Show loading state
            State.setLoading(true);
            
            // Duplicate via template manager
            const duplicate = await templateManager.duplicateTemplate(templateId);
            
            // Show success message
            this.showSuccessMessage('Template dupliqué avec succès');
            
            // Load the duplicate in editor
            this.loadTemplate(duplicate.id);
            
        } catch (error) {
            this.logger.error(`Failed to duplicate template ${templateId}:`, error);
            this.showErrorMessage('Erreur lors de la duplication');
            handleError(error);
        } finally {
            State.setLoading(false);
        }
    }

    /**
     * Get template form data
     * @returns {Object} Template data
     */
    getTemplateFormData() {
        const nameField = this.getElement(ElementIds.TEMPLATE_NAME);
        const contentField = this.getElement(ElementIds.TEMPLATE_CONTENT);
        const descriptionField = this.getElement(ElementIds.TEMPLATE_DESCRIPTION);
        
        return {
            name: nameField ? nameField.value.trim() : '',
            content: contentField ? contentField.value : '',
            description: descriptionField ? descriptionField.value.trim() : '',
            tags: [], // TODO: Extract from UI
            category: '', // TODO: Extract from UI
            folder_id: null // TODO: Extract from UI
        };
    }

    /**
     * Update template form with data
     * @param {Object} template - Template data
     */
    updateTemplateForm(template) {
        const nameField = this.getElement(ElementIds.TEMPLATE_NAME);
        const contentField = this.getElement(ElementIds.TEMPLATE_CONTENT);
        const descriptionField = this.getElement(ElementIds.TEMPLATE_DESCRIPTION);
        
        if (nameField) nameField.value = template.name || '';
        if (contentField) contentField.value = template.content || '';
        if (descriptionField) descriptionField.value = template.description || '';
    }

    /**
     * Clear template form
     */
    clearTemplateForm() {
        const nameField = this.getElement(ElementIds.TEMPLATE_NAME);
        const contentField = this.getElement(ElementIds.TEMPLATE_CONTENT);
        const descriptionField = this.getElement(ElementIds.TEMPLATE_DESCRIPTION);
        
        if (nameField) nameField.value = '';
        if (contentField) contentField.value = '';
        if (descriptionField) descriptionField.value = '';
    }

    /**
     * Validate template form
     * @param {Object} templateData - Template data to validate
     * @returns {boolean} Validation result
     */
    validateTemplateForm(templateData) {
        if (!templateData.name) {
            this.showErrorMessage('Le nom du template est requis');
            const nameField = this.getElement(ElementIds.TEMPLATE_NAME);
            if (nameField) nameField.focus();
            return false;
        }
        
        if (!templateData.content) {
            this.showErrorMessage('Le contenu du template est requis');
            const contentField = this.getElement(ElementIds.TEMPLATE_CONTENT);
            if (contentField) contentField.focus();
            return false;
        }
        
        return true;
    }

    /**
     * Update current template display
     * @param {Object} template - Current template
     */
    updateCurrentTemplate(template) {
        if (template) {
            this.updateTemplateForm(template);
        } else {
            this.clearTemplateForm();
        }
    }

    /**
     * Refresh templates grid
     */
    async refreshTemplatesGrid() {
        try {
            this.logger.debug('Refreshing templates grid');
            
            const templates = State.get('filteredPrompts') || State.getPrompts();
            const grid = this.getElement(ElementIds.TEMPLATES_GRID);
            
            if (!grid) return;
            
            // Clear existing content
            grid.innerHTML = '';
            
            if (templates.length === 0) {
                this.showEmptyState(grid);
                return;
            }
            
            // Create template cards
            templates.forEach(template => {
                const card = this.createTemplateCard(template);
                grid.appendChild(card);
            });
            
        } catch (error) {
            this.logger.error('Failed to refresh templates grid:', error);
            handleError(error);
        }
    }

    /**
     * Create template card element
     * @param {Object} template - Template data
     * @returns {HTMLElement} Template card element
     */
    createTemplateCard(template) {
        const card = document.createElement('div');
        card.className = CSSClasses.TEMPLATE_CARD;
        card.dataset.templateId = template.id;
        
        const favoriteClass = template.is_favorite ? CSSClasses.FAVORITE_ACTIVE : '';
        
        card.innerHTML = `
            <div class="${CSSClasses.TEMPLATE_CARD_HEADER}">
                <h3 class="${CSSClasses.TEMPLATE_CARD_TITLE}">${this.escapeHtml(template.name)}</h3>
                <div class="${CSSClasses.TEMPLATE_CARD_ACTIONS}">
                    <button class="${CSSClasses.FAVORITE_BTN} ${favoriteClass}" title="Favori">
                        <i class="fas fa-star"></i>
                    </button>
                    <button class="${CSSClasses.DUPLICATE_BTN}" title="Dupliquer">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="${CSSClasses.DELETE_BTN}" title="Supprimer">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="${CSSClasses.TEMPLATE_CARD_CONTENT}">
                ${template.description ? 
                    `<p class="${CSSClasses.TEMPLATE_CARD_DESCRIPTION}">${this.escapeHtml(template.description)}</p>` : 
                    ''
                }
                <div class="${CSSClasses.TEMPLATE_CARD_META}">
                    <span class="${CSSClasses.TEMPLATE_CARD_DATE}">
                        ${this.formatDate(template.updated_at)}
                    </span>
                </div>
            </div>
        `;
        
        return card;
    }

    /**
     * Show empty state in container
     * @param {HTMLElement} container - Container element
     */
    showEmptyState(container) {
        container.innerHTML = `
            <div class="${CSSClasses.EMPTY_STATE}">
                <i class="fas fa-file-alt ${CSSClasses.EMPTY_STATE_ICON}"></i>
                <h3>Aucun template trouvé</h3>
                <p>Créez votre premier template ou ajustez vos critères de recherche.</p>
                <button class="${CSSClasses.BTN} ${CSSClasses.BTN_PRIMARY}" onclick="uiManager.createNewTemplate()">
                    <i class="fas fa-plus"></i>
                    Créer un template
                </button>
            </div>
        `;
    }

    /**
     * Update loading state
     * @param {boolean} isLoading - Loading state
     */
    updateLoadingState(isLoading) {
        const loadingIndicator = this.getElement(ElementIds.LOADING_INDICATOR);
        
        if (loadingIndicator) {
            loadingIndicator.classList.toggle(CSSClasses.VISIBLE, isLoading);
        }
        
        // Disable form elements during loading
        const formElements = document.querySelectorAll('input, button, textarea, select');
        formElements.forEach(element => {
            element.disabled = isLoading;
        });
    }

    /**
     * Show success message
     * @param {string} message - Success message
     */
    showSuccessMessage(message) {
        this.showMessage(message, 'success');
    }

    /**
     * Show error message
     * @param {string} message - Error message
     */
    showErrorMessage(message) {
        this.showMessage(message, 'error');
    }

    /**
     * Show message
     * @param {string} message - Message text
     * @param {string} type - Message type (success, error, info, warning)
     */
    showMessage(message, type = 'info') {
        // Create message element if it doesn't exist
        let messageContainer = document.querySelector(`.${CSSClasses.MESSAGE_CONTAINER}`);
        
        if (!messageContainer) {
            messageContainer = document.createElement('div');
            messageContainer.className = CSSClasses.MESSAGE_CONTAINER;
            document.body.appendChild(messageContainer);
        }
        
        // Create message element
        const messageElement = document.createElement('div');
        messageElement.className = `${CSSClasses.MESSAGE} ${CSSClasses.MESSAGE_PREFIX}${type}`;
        messageElement.innerHTML = `
            <i class="fas fa-${this.getMessageIcon(type)}"></i>
            <span>${this.escapeHtml(message)}</span>
            <button class="${CSSClasses.MESSAGE_CLOSE}">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // Add to container
        messageContainer.appendChild(messageElement);
        
        // Auto remove after delay
        setTimeout(() => {
            this.removeMessage(messageElement);
        }, AppConstants.MESSAGE_TIMEOUT || 5000);
        
        // Close button functionality
        const closeBtn = messageElement.querySelector(`.${CSSClasses.MESSAGE_CLOSE}`);
        closeBtn.addEventListener('click', () => {
            this.removeMessage(messageElement);
        });
    }

    /**
     * Remove message element
     * @param {HTMLElement} messageElement - Message element to remove
     */
    removeMessage(messageElement) {
        if (messageElement && messageElement.parentNode) {
            messageElement.classList.add(CSSClasses.MESSAGE_FADE_OUT);
            setTimeout(() => {
                messageElement.remove();
            }, 300);
        }
    }

    /**
     * Show confirmation dialog
     * @param {string} title - Dialog title
     * @param {string} message - Dialog message
     * @returns {Promise<boolean>} User confirmation
     */
    async showConfirmDialog(title, message) {
        return new Promise((resolve) => {
            // Simple confirmation for now - could be enhanced with custom modal
            const confirmed = confirm(`${title}\n\n${message}`);
            resolve(confirmed);
        });
    }

    /**
     * Handle escape key press
     */
    handleEscape() {
        // Clear search
        const searchInput = this.getElement(ElementIds.SEARCH_INPUT);
        if (searchInput && searchInput.value) {
            searchInput.value = '';
            this.handleSearch('');
        }
        
        // Close any open modals or dropdowns
        const openModals = document.querySelectorAll(`.${CSSClasses.MODAL_OPEN}`);
        openModals.forEach(modal => {
            this.closeModal(modal);
        });
        
        const openDropdowns = document.querySelectorAll(`.${CSSClasses.DROPDOWN_OPEN}`);
        openDropdowns.forEach(dropdown => {
            this.closeDropdown(dropdown);
        });
    }

    /**
     * Get icon for message type
     * @param {string} type - Message type
     * @returns {string} Icon name
     */
    getMessageIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Format date for display
     * @param {string} dateString - Date string
     * @returns {string} Formatted date
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    /**
     * Handle intersection observer events
     * @param {Array} entries - Intersection entries
     */
    handleIntersection(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Handle lazy loading or animations
                entry.target.classList.add(CSSClasses.VISIBLE);
            }
        });
    }

    /**
     * Handle mutation observer events
     * @param {Array} mutations - DOM mutations
     */
    handleMutation(mutations) {
        mutations.forEach(mutation => {
            if (mutation.type === 'childList') {
                // Handle new elements added to the DOM
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        this.initializeNewElement(node);
                    }
                });
            }
        });
    }

    /**
     * Initialize new DOM element
     * @param {HTMLElement} element - New element
     */
    initializeNewElement(element) {
        // Initialize tooltips on new elements
        const tooltipElements = element.querySelectorAll('[data-tooltip]');
        tooltipElements.forEach(el => this.setupTooltip(el));
        
        // Add to intersection observer
        if (this.observers.has('intersection')) {
            this.observers.get('intersection').observe(element);
        }
    }

    /**
     * Setup tooltip for element
     * @param {HTMLElement} element - Element with tooltip
     */
    setupTooltip(element) {
        // Simple tooltip implementation
        element.addEventListener('mouseenter', (event) => {
            this.showTooltip(event.target, event.target.dataset.tooltip);
        });
        
        element.addEventListener('mouseleave', () => {
            this.hideTooltip();
        });
    }

    /**
     * Show tooltip
     * @param {HTMLElement} target - Target element
     * @param {string} text - Tooltip text
     */
    showTooltip(target, text) {
        const tooltip = document.createElement('div');
        tooltip.className = CSSClasses.TOOLTIP;
        tooltip.textContent = text;
        document.body.appendChild(tooltip);
        
        // Position tooltip
        const rect = target.getBoundingClientRect();
        tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
        tooltip.style.top = rect.top - tooltip.offsetHeight - 5 + 'px';
        
        this.currentTooltip = tooltip;
    }

    /**
     * Hide tooltip
     */
    hideTooltip() {
        if (this.currentTooltip) {
            this.currentTooltip.remove();
            this.currentTooltip = null;
        }
    }

    /**
     * Cleanup event listeners and observers
     */
    cleanup() {
        // Remove all event listeners
        this.eventHandlers.forEach((handlerData, handlerId) => {
            this.removeEventListener(handlerId);
        });
        
        // Disconnect observers
        this.observers.forEach(observer => {
            observer.disconnect();
        });
        
        this.logger.info('UIManager cleaned up');
    }
}

/**
 * Default UI manager instance
 */
export const uiManager = new UIManager();

// Make it globally available for inline event handlers (temporary)
window.uiManager = uiManager;