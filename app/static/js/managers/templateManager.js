/**
 * @fileoverview Template Manager for Prompt Editor v2.0
 * @description Centralized template management with CRUD operations, validation, and caching
 */

import { logger, createLogger, performanceLogger } from '../utils/logger.js';
import { handleError, createError, ErrorType, ErrorCode, Validator } from '../utils/errorHandler.js';
import { stateManager, State } from '../core/state.js';
import { TemplateAPI, FolderAPI } from './apiClient.js';
import { AppConstants, AppEvents } from '../config/constants.js';

/**
 * @typedef {Object} Template
 * @property {number} id - Template ID
 * @property {string} name - Template name
 * @property {string} content - Template content
 * @property {string} description - Template description
 * @property {Array<string>} tags - Template tags
 * @property {string} category - Template category
 * @property {number} folder_id - Folder ID
 * @property {boolean} is_favorite - Favorite status
 * @property {string} created_at - Creation timestamp
 * @property {string} updated_at - Update timestamp
 * @property {Object} metadata - Additional metadata
 */

/**
 * @typedef {Object} Folder
 * @property {number} id - Folder ID
 * @property {string} name - Folder name
 * @property {string} description - Folder description
 * @property {string} color - Folder color
 * @property {number} parent_id - Parent folder ID
 * @property {Array<Template>} templates - Templates in folder
 */

/**
 * Template Manager class for centralized template operations
 */
export class TemplateManager extends EventTarget {
    /**
     * Create a new TemplateManager instance
     */
    constructor() {
        super();
        this.logger = createLogger('TemplateManager');
        
        // Caching
        this.cache = {
            templates: new Map(),
            folders: new Map(),
            lastUpdate: null,
            isValid: false
        };
        
        // Validation rules
        this.validationRules = {
            name: {
                required: true,
                minLength: 1,
                maxLength: 200,
                pattern: /^[^<>:"\/\\|?*\x00-\x1f]+$/
            },
            content: {
                required: true,
                minLength: 1,
                maxLength: 50000
            },
            description: {
                required: false,
                maxLength: 1000
            },
            tags: {
                required: false,
                maxTags: 10,
                maxTagLength: 50
            }
        };
        
        // Statistics
        this.stats = {
            totalTemplates: 0,
            totalFolders: 0,
            favoriteCount: 0,
            cacheHits: 0,
            cacheMisses: 0
        };
        
        this.logger.info('TemplateManager initialized');
    }

    /**
     * Initialize the template manager
     */
    async initialize() {
        try {
            this.logger.info('Initializing TemplateManager...');
            
            // Load initial data
            await Promise.all([
                this.loadTemplates(),
                this.loadFolders()
            ]);
            
            // Set up state subscriptions
            this.setupStateSubscriptions();
            
            this.logger.info('TemplateManager initialization complete');
            
        } catch (error) {
            this.logger.error('TemplateManager initialization failed:', error);
            handleError(createError(
                'Failed to initialize TemplateManager',
                ErrorCode.UNKNOWN,
                ErrorType.STATE,
                null,
                error
            ));
        }
    }

    /**
     * Set up state management subscriptions
     */
    setupStateSubscriptions() {
        // Subscribe to search term changes
        stateManager.subscribe('searchTerm', (newTerm) => {
            this.filterTemplates(newTerm);
        });
        
        // Subscribe to filter changes
        stateManager.subscribe('currentFilter', (newFilter) => {
            this.applyFilter(newFilter);
        });
        
        // Subscribe to sort changes
        stateManager.subscribe('currentSort', (newSort) => {
            this.sortTemplates(newSort);
        });
    }

    /**
     * Load all templates with optional parameters
     * @param {Object} params - Query parameters
     * @returns {Promise<Array<Template>>} Templates array
     */
    async loadTemplates(params = {}) {
        const timerName = 'LoadTemplates';
        performanceLogger.start(timerName);
        
        try {
            this.logger.debug('Loading templates with params:', params);
            
            // Check cache first
            if (this.cache.isValid && Object.keys(params).length === 0) {
                this.stats.cacheHits++;
                this.logger.debug('Returning cached templates');
                const cached = Array.from(this.cache.templates.values());
                performanceLogger.end(timerName);
                return cached;
            }
            
            this.stats.cacheMisses++;
            
            // Load from API
            const response = await TemplateAPI.getAll(params);
            
            if (!response.success) {
                throw createError(
                    'Failed to load templates',
                    ErrorCode.API_ERROR,
                    ErrorType.API,
                    { params }
                );
            }
            
            const templates = response.data || [];
            
            // Update cache if no params (full load)
            if (Object.keys(params).length === 0) {
                this.updateTemplateCache(templates);
            }
            
            // Update state
            State.setPrompts(templates);
            this.stats.totalTemplates = templates.length;
            this.stats.favoriteCount = templates.filter(t => t.is_favorite).length;
            
            this.logger.info(`Loaded ${templates.length} templates`);
            performanceLogger.end(timerName);
            
            // Emit event
            this.dispatchEvent(new CustomEvent(AppEvents.TEMPLATES_LOADED, {
                detail: { templates, params }
            }));
            
            return templates;
            
        } catch (error) {
            performanceLogger.end(timerName);
            this.logger.error('Failed to load templates:', error);
            throw error;
        }
    }

    /**
     * Load template by ID
     * @param {number|string} templateId - Template ID
     * @returns {Promise<Template>} Template object
     */
    async loadTemplate(templateId) {
        const timerName = `LoadTemplate:${templateId}`;
        performanceLogger.start(timerName);
        
        try {
            this.logger.debug(`Loading template ${templateId}`);
            
            // Check cache first
            if (this.cache.templates.has(templateId)) {
                this.stats.cacheHits++;
                const cached = this.cache.templates.get(templateId);
                performanceLogger.end(timerName);
                return cached;
            }
            
            this.stats.cacheMisses++;
            
            // Load from API
            const response = await TemplateAPI.getById(templateId);
            
            if (!response.success) {
                throw createError(
                    `Template ${templateId} not found`,
                    ErrorCode.NOT_FOUND,
                    ErrorType.API,
                    { templateId }
                );
            }
            
            const template = response.data;
            
            // Update cache
            this.cache.templates.set(templateId, template);
            
            // Update current template in state
            State.setCurrentPrompt(template);
            
            this.logger.info(`Loaded template: ${template.name} (ID: ${templateId})`);
            performanceLogger.end(timerName);
            
            // Emit event
            this.dispatchEvent(new CustomEvent(AppEvents.TEMPLATE_LOADED, {
                detail: { template }
            }));
            
            return template;
            
        } catch (error) {
            performanceLogger.end(timerName);
            this.logger.error(`Failed to load template ${templateId}:`, error);
            throw error;
        }
    }

    /**
     * Create new template
     * @param {Object} templateData - Template data
     * @returns {Promise<Template>} Created template
     */
    async createTemplate(templateData) {
        const timerName = 'CreateTemplate';
        performanceLogger.start(timerName);
        
        try {
            this.logger.debug('Creating new template:', templateData.name);
            
            // Validate template data
            this.validateTemplateData(templateData);
            
            // Check for duplicate names
            await this.checkDuplicateName(templateData.name);
            
            // Create via API
            const response = await TemplateAPI.create(templateData);
            
            if (!response.success) {
                throw createError(
                    'Failed to create template',
                    ErrorCode.API_ERROR,
                    ErrorType.API,
                    { templateData }
                );
            }
            
            const template = response.data;
            
            // Update cache and state
            this.cache.templates.set(template.id, template);
            this.invalidateTemplateListCache();
            
            this.logger.info(`Created template: ${template.name} (ID: ${template.id})`);
            performanceLogger.end(timerName);
            
            // Emit event
            this.dispatchEvent(new CustomEvent(AppEvents.TEMPLATE_CREATED, {
                detail: { template }
            }));
            
            // Reload templates to update UI
            await this.loadTemplates();
            
            return template;
            
        } catch (error) {
            performanceLogger.end(timerName);
            this.logger.error('Failed to create template:', error);
            throw error;
        }
    }

    /**
     * Update existing template
     * @param {number|string} templateId - Template ID
     * @param {Object} templateData - Updated template data
     * @returns {Promise<Template>} Updated template
     */
    async updateTemplate(templateId, templateData) {
        const timerName = `UpdateTemplate:${templateId}`;
        performanceLogger.start(timerName);
        
        try {
            this.logger.debug(`Updating template ${templateId}:`, templateData.name);
            
            // Validate template data
            this.validateTemplateData(templateData);
            
            // Check for duplicate names (excluding current template)
            await this.checkDuplicateName(templateData.name, templateId);
            
            // Update via API
            const response = await TemplateAPI.update(templateId, templateData);
            
            if (!response.success) {
                throw createError(
                    `Failed to update template ${templateId}`,
                    ErrorCode.API_ERROR,
                    ErrorType.API,
                    { templateId, templateData }
                );
            }
            
            const template = response.data;
            
            // Update cache and state
            this.cache.templates.set(templateId, template);
            this.invalidateTemplateListCache();
            
            // Update current template if it's the one being edited
            const current = State.getCurrentPrompt();
            if (current && current.id === templateId) {
                State.setCurrentPrompt(template);
            }
            
            this.logger.info(`Updated template: ${template.name} (ID: ${templateId})`);
            performanceLogger.end(timerName);
            
            // Emit event
            this.dispatchEvent(new CustomEvent(AppEvents.TEMPLATE_UPDATED, {
                detail: { template, templateId }
            }));
            
            // Reload templates to update UI
            await this.loadTemplates();
            
            return template;
            
        } catch (error) {
            performanceLogger.end(timerName);
            this.logger.error(`Failed to update template ${templateId}:`, error);
            throw error;
        }
    }

    /**
     * Delete template
     * @param {number|string} templateId - Template ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteTemplate(templateId) {
        const timerName = `DeleteTemplate:${templateId}`;
        performanceLogger.start(timerName);
        
        try {
            this.logger.debug(`Deleting template ${templateId}`);
            
            // Get template name for logging
            const template = this.cache.templates.get(templateId);
            const templateName = template ? template.name : `ID ${templateId}`;
            
            // Delete via API
            const response = await TemplateAPI.delete(templateId);
            
            if (!response.success) {
                throw createError(
                    `Failed to delete template ${templateId}`,
                    ErrorCode.API_ERROR,
                    ErrorType.API,
                    { templateId }
                );
            }
            
            // Remove from cache and state
            this.cache.templates.delete(templateId);
            this.invalidateTemplateListCache();
            
            // Clear current template if it's the one being deleted
            const current = State.getCurrentPrompt();
            if (current && current.id === templateId) {
                State.setCurrentPrompt(null);
            }
            
            this.logger.info(`Deleted template: ${templateName} (ID: ${templateId})`);
            performanceLogger.end(timerName);
            
            // Emit event
            this.dispatchEvent(new CustomEvent(AppEvents.TEMPLATE_DELETED, {
                detail: { templateId, templateName }
            }));
            
            // Reload templates to update UI
            await this.loadTemplates();
            
            return true;
            
        } catch (error) {
            performanceLogger.end(timerName);
            this.logger.error(`Failed to delete template ${templateId}:`, error);
            throw error;
        }
    }

    /**
     * Toggle template favorite status
     * @param {number|string} templateId - Template ID
     * @param {boolean} isFavorite - New favorite status
     * @returns {Promise<Template>} Updated template
     */
    async toggleFavorite(templateId, isFavorite) {
        const timerName = `ToggleFavorite:${templateId}`;
        performanceLogger.start(timerName);
        
        try {
            this.logger.debug(`Toggling favorite for template ${templateId}: ${isFavorite}`);
            
            // Update via API
            const response = await TemplateAPI.toggleFavorite(templateId, isFavorite);
            
            if (!response.success) {
                throw createError(
                    `Failed to toggle favorite for template ${templateId}`,
                    ErrorCode.API_ERROR,
                    ErrorType.API,
                    { templateId, isFavorite }
                );
            }
            
            const template = response.data;
            
            // Update cache
            this.cache.templates.set(templateId, template);
            this.invalidateTemplateListCache();
            
            // Update current template if needed
            const current = State.getCurrentPrompt();
            if (current && current.id === templateId) {
                State.setCurrentPrompt(template);
            }
            
            // Update favorite count
            if (isFavorite) {
                this.stats.favoriteCount++;
            } else {
                this.stats.favoriteCount--;
            }
            
            this.logger.info(`Template ${template.name} favorite status: ${isFavorite}`);
            performanceLogger.end(timerName);
            
            // Emit event
            this.dispatchEvent(new CustomEvent(AppEvents.TEMPLATE_FAVORITE_TOGGLED, {
                detail: { template, isFavorite }
            }));
            
            return template;
            
        } catch (error) {
            performanceLogger.end(timerName);
            this.logger.error(`Failed to toggle favorite for template ${templateId}:`, error);
            throw error;
        }
    }

    /**
     * Duplicate template
     * @param {number|string} templateId - Template ID to duplicate
     * @param {Object} overrides - Property overrides for the duplicate
     * @returns {Promise<Template>} Duplicated template
     */
    async duplicateTemplate(templateId, overrides = {}) {
        const timerName = `DuplicateTemplate:${templateId}`;
        performanceLogger.start(timerName);
        
        try {
            this.logger.debug(`Duplicating template ${templateId}`);
            
            // Get original template
            const original = await this.loadTemplate(templateId);
            
            // Create duplicate data
            const duplicateData = {
                name: `${original.name} (Copy)`,
                content: original.content,
                description: original.description,
                tags: [...(original.tags || [])],
                category: original.category,
                folder_id: original.folder_id,
                is_favorite: false,
                ...overrides
            };
            
            // Ensure unique name
            duplicateData.name = await this.getUniqueName(duplicateData.name);
            
            // Create the duplicate
            const duplicate = await this.createTemplate(duplicateData);
            
            this.logger.info(`Duplicated template: ${original.name} -> ${duplicate.name}`);
            performanceLogger.end(timerName);
            
            // Emit event
            this.dispatchEvent(new CustomEvent(AppEvents.TEMPLATE_DUPLICATED, {
                detail: { original, duplicate }
            }));
            
            return duplicate;
            
        } catch (error) {
            performanceLogger.end(timerName);
            this.logger.error(`Failed to duplicate template ${templateId}:`, error);
            throw error;
        }
    }

    /**
     * Load all folders
     * @returns {Promise<Array<Folder>>} Folders array
     */
    async loadFolders() {
        const timerName = 'LoadFolders';
        performanceLogger.start(timerName);
        
        try {
            this.logger.debug('Loading folders');
            
            // Load from API
            const response = await FolderAPI.getAll();
            
            if (!response.success) {
                throw createError(
                    'Failed to load folders',
                    ErrorCode.API_ERROR,
                    ErrorType.API
                );
            }
            
            const folders = response.data || [];
            
            // Update cache
            this.cache.folders.clear();
            folders.forEach(folder => {
                this.cache.folders.set(folder.id, folder);
            });
            
            this.stats.totalFolders = folders.length;
            
            this.logger.info(`Loaded ${folders.length} folders`);
            performanceLogger.end(timerName);
            
            return folders;
            
        } catch (error) {
            performanceLogger.end(timerName);
            this.logger.error('Failed to load folders:', error);
            throw error;
        }
    }

    /**
     * Create new folder
     * @param {Object} folderData - Folder data
     * @returns {Promise<Folder>} Created folder
     */
    async createFolder(folderData) {
        try {
            this.logger.debug('Creating new folder:', folderData.name);
            
            // Validate folder data
            this.validateFolderData(folderData);
            
            // Create via API
            const response = await FolderAPI.create(folderData);
            
            if (!response.success) {
                throw createError(
                    'Failed to create folder',
                    ErrorCode.API_ERROR,
                    ErrorType.API,
                    { folderData }
                );
            }
            
            const folder = response.data;
            
            // Update cache
            this.cache.folders.set(folder.id, folder);
            this.stats.totalFolders++;
            
            this.logger.info(`Created folder: ${folder.name} (ID: ${folder.id})`);
            
            return folder;
            
        } catch (error) {
            this.logger.error('Failed to create folder:', error);
            throw error;
        }
    }

    /**
     * Validate template data
     * @param {Object} templateData - Template data to validate
     * @throws {AppError} If validation fails
     */
    validateTemplateData(templateData) {
        const rules = this.validationRules;
        
        // Validate name
        if (rules.name.required) {
            Validator.required(templateData.name, 'Nom du template');
        }
        
        if (templateData.name) {
            Validator.stringLength(
                templateData.name,
                rules.name.minLength,
                rules.name.maxLength,
                'Nom du template'
            );
            
            if (!rules.name.pattern.test(templateData.name)) {
                throw createError(
                    'Le nom du template contient des caractères non autorisés',
                    ErrorCode.INVALID_FORMAT,
                    ErrorType.VALIDATION,
                    { name: templateData.name }
                );
            }
        }
        
        // Validate content
        if (rules.content.required) {
            Validator.required(templateData.content, 'Contenu du template');
        }
        
        if (templateData.content) {
            Validator.stringLength(
                templateData.content,
                rules.content.minLength,
                rules.content.maxLength,
                'Contenu du template'
            );
        }
        
        // Validate description
        if (templateData.description && templateData.description.length > rules.description.maxLength) {
            throw createError(
                `La description ne peut pas dépasser ${rules.description.maxLength} caractères`,
                ErrorCode.INVALID_FORMAT,
                ErrorType.VALIDATION,
                { description: templateData.description }
            );
        }
        
        // Validate tags
        if (templateData.tags && Array.isArray(templateData.tags)) {
            if (templateData.tags.length > rules.tags.maxTags) {
                throw createError(
                    `Maximum ${rules.tags.maxTags} tags autorisés`,
                    ErrorCode.INVALID_FORMAT,
                    ErrorType.VALIDATION,
                    { tags: templateData.tags }
                );
            }
            
            templateData.tags.forEach(tag => {
                if (typeof tag !== 'string' || tag.length > rules.tags.maxTagLength) {
                    throw createError(
                        `Les tags ne peuvent pas dépasser ${rules.tags.maxTagLength} caractères`,
                        ErrorCode.INVALID_FORMAT,
                        ErrorType.VALIDATION,
                        { tag }
                    );
                }
            });
        }
    }

    /**
     * Validate folder data
     * @param {Object} folderData - Folder data to validate
     * @throws {AppError} If validation fails
     */
    validateFolderData(folderData) {
        Validator.required(folderData.name, 'Nom du dossier');
        Validator.stringLength(folderData.name, 1, 200, 'Nom du dossier');
    }

    /**
     * Check for duplicate template names
     * @param {string} name - Template name to check
     * @param {number|string} excludeId - Template ID to exclude from check
     * @throws {AppError} If duplicate found
     */
    async checkDuplicateName(name, excludeId = null) {
        const templates = Array.from(this.cache.templates.values());
        const duplicate = templates.find(t => 
            t.name.toLowerCase() === name.toLowerCase() && 
            t.id !== excludeId
        );
        
        if (duplicate) {
            throw createError(
                'Un template avec ce nom existe déjà',
                ErrorCode.DUPLICATE_NAME,
                ErrorType.VALIDATION,
                { name, existingId: duplicate.id }
            );
        }
    }

    /**
     * Get unique name for template
     * @param {string} baseName - Base name
     * @returns {Promise<string>} Unique name
     */
    async getUniqueName(baseName) {
        let name = baseName;
        let counter = 1;
        
        while (true) {
            try {
                await this.checkDuplicateName(name);
                return name;
            } catch (error) {
                if (error.code === ErrorCode.DUPLICATE_NAME) {
                    counter++;
                    name = `${baseName} (${counter})`;
                } else {
                    throw error;
                }
            }
        }
    }

    /**
     * Filter templates based on search term
     * @param {string} searchTerm - Search term
     * @returns {Array<Template>} Filtered templates
     */
    filterTemplates(searchTerm) {
        const templates = State.getPrompts();
        
        if (!searchTerm || searchTerm.trim() === '') {
            stateManager.set('filteredPrompts', templates);
            return templates;
        }
        
        const term = searchTerm.toLowerCase().trim();
        const filtered = templates.filter(template => {
            return template.name.toLowerCase().includes(term) ||
                   template.content.toLowerCase().includes(term) ||
                   (template.description && template.description.toLowerCase().includes(term)) ||
                   (template.tags && template.tags.some(tag => tag.toLowerCase().includes(term)));
        });
        
        stateManager.set('filteredPrompts', filtered);
        return filtered;
    }

    /**
     * Apply filter to templates
     * @param {string} filter - Filter type
     * @returns {Array<Template>} Filtered templates
     */
    applyFilter(filter) {
        const templates = State.getPrompts();
        
        let filtered;
        switch (filter) {
            case 'favorites':
                filtered = templates.filter(t => t.is_favorite);
                break;
            case 'recent':
                filtered = templates.slice().sort((a, b) => 
                    new Date(b.updated_at) - new Date(a.updated_at)
                ).slice(0, 10);
                break;
            default:
                filtered = templates;
        }
        
        stateManager.set('filteredPrompts', filtered);
        return filtered;
    }

    /**
     * Sort templates
     * @param {string} sortBy - Sort criteria
     * @returns {Array<Template>} Sorted templates
     */
    sortTemplates(sortBy) {
        const templates = State.getPrompts();
        const sortDirection = stateManager.get('settings.sortDirection') || 'asc';
        
        const sorted = templates.slice().sort((a, b) => {
            let comparison = 0;
            
            switch (sortBy) {
                case 'name':
                    comparison = a.name.localeCompare(b.name);
                    break;
                case 'created':
                    comparison = new Date(a.created_at) - new Date(b.created_at);
                    break;
                case 'updated':
                    comparison = new Date(a.updated_at) - new Date(b.updated_at);
                    break;
                case 'favorite':
                    comparison = b.is_favorite - a.is_favorite;
                    break;
                default:
                    return 0;
            }
            
            return sortDirection === 'desc' ? -comparison : comparison;
        });
        
        stateManager.set('sortedPrompts', sorted);
        return sorted;
    }

    /**
     * Update template cache
     * @param {Array<Template>} templates - Templates to cache
     */
    updateTemplateCache(templates) {
        this.cache.templates.clear();
        templates.forEach(template => {
            this.cache.templates.set(template.id, template);
        });
        this.cache.lastUpdate = new Date();
        this.cache.isValid = true;
    }

    /**
     * Invalidate template list cache
     */
    invalidateTemplateListCache() {
        this.cache.isValid = false;
    }

    /**
     * Get template statistics
     * @returns {Object} Template statistics
     */
    getStats() {
        return {
            ...this.stats,
            cacheSize: this.cache.templates.size,
            folderCount: this.cache.folders.size,
            cacheHitRate: this.stats.totalRequests > 0 
                ? ((this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)) * 100).toFixed(2) + '%'
                : '0%'
        };
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.templates.clear();
        this.cache.folders.clear();
        this.cache.isValid = false;
        this.cache.lastUpdate = null;
        this.logger.info('Template cache cleared');
    }
}

/**
 * Default template manager instance
 */
export const templateManager = new TemplateManager();