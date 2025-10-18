/**
 * @fileoverview Main Application Orchestrator for Prompt Editor v2.0
 * @description Lightweight coordinator for modular architecture - replaces monolithic app.js
 * @version 2.0.0
 */

// Core modules
import { logger, createLogger, performanceLogger, DevLogger } from './utils/logger.js';
import { errorHandler, handleError, createError, ErrorType, ErrorCode } from './utils/errorHandler.js';
import { stateManager, State } from './core/state.js';

// Manager modules  
import { apiClient } from './managers/apiClient.js';
import { templateManager } from './managers/templateManager.js';
import { searchManager } from './managers/searchManager.js';

// UI modules
import { uiManager } from './ui/uiManager.js';

// Configuration
import { AppConstants, AppEvents } from './config/constants.js';

/**
 * @typedef {Object} AppConfig
 * @property {string} version - Application version
 * @property {boolean} debug - Debug mode flag
 * @property {Object} features - Feature flags
 * @property {Object} performance - Performance settings
 */

/**
 * Main Application class - Orchestrates all modules
 */
export class PromptEditorApp extends EventTarget {
    /**
     * Create a new PromptEditorApp instance
     * @param {AppConfig} config - Application configuration
     */
    constructor(config = {}) {
        super();
        
        // Application metadata
        this.version = config.version || '2.0.0';
        this.buildDate = new Date().toISOString();
        
        // Configuration
        this.config = {
            debug: config.debug || false,
            features: {
                analytics: true,
                autoSave: true,
                offlineMode: false,
                ...config.features
            },
            performance: {
                enableMetrics: true,
                logLevel: 'INFO',
                ...config.performance
            }
        };
        
        // Initialize logger
        this.logger = createLogger('App');
        
        // Module registry
        this.modules = new Map();
        
        // Application state
        this.state = {
            isInitialized: false,
            isReady: false,
            startTime: null,
            initializationTime: null,
            lastActivity: null
        };
        
        // Performance tracking
        this.metrics = {
            startupTime: 0,
            memoryUsage: 0,
            modulesLoaded: 0,
            totalRequests: 0
        };
        
        this.logger.info(`🚀 Prompt Editor v${this.version} - Application created`);
    }

    /**
     * Initialize the application
     */
    async initialize() {
        const startTime = performance.now();
        this.state.startTime = startTime;
        
        try {
            this.logger.info('🏗️ Starting application initialization...');
            
            // Set up development mode if enabled
            if (this.config.debug) {
                DevLogger.enableDebug();
                this.logger.info('🔧 Debug mode enabled');
            }
            
            // Register modules
            this.registerModules();
            
            // Initialize modules in dependency order
            await this.initializeModules();
            
            // Set up inter-module communication
            this.setupModuleCommunication();
            
            // Set up global error handling
            this.setupGlobalErrorHandling();
            
            // Set up application event listeners
            this.setupApplicationEvents();
            
            // Set up critical DOM event listeners
            this.setupCriticalDOMEvents();
            
            // Set up periodic tasks
            this.setupPeriodicTasks();
            
            // Mark as initialized
            this.state.isInitialized = true;
            this.state.initializationTime = performance.now() - startTime;
            this.metrics.startupTime = this.state.initializationTime;
            
            this.logger.info(`✅ Application initialized successfully in ${this.state.initializationTime.toFixed(2)}ms`);
            
            // Emit initialization complete event
            this.dispatchEvent(new CustomEvent(AppEvents.APP_INITIALIZED, {
                detail: {
                    version: this.version,
                    initTime: this.state.initializationTime,
                    debug: this.config.debug
                }
            }));
            
            // Start the application
            await this.start();
            
        } catch (error) {
            this.logger.error('❌ Application initialization failed:', error);
            handleError(createError(
                'Application initialization failed',
                ErrorCode.UNKNOWN,
                ErrorType.UNKNOWN,
                { 
                    version: this.version,
                    config: this.config 
                },
                error
            ));
            throw error;
        }
    }

    /**
     * Register all application modules
     */
    registerModules() {
        const modules = [
            { name: 'errorHandler', instance: errorHandler, priority: 1 },
            { name: 'stateManager', instance: stateManager, priority: 2 },
            { name: 'apiClient', instance: apiClient, priority: 3 },
            { name: 'templateManager', instance: templateManager, priority: 4 },
            { name: 'searchManager', instance: searchManager, priority: 5 },
            { name: 'uiManager', instance: uiManager, priority: 6 }
        ];
        
        // Sort by priority and register
        modules
            .sort((a, b) => a.priority - b.priority)
            .forEach(module => {
                this.modules.set(module.name, module.instance);
                this.logger.debug(`📦 Registered module: ${module.name}`);
            });
        
        this.metrics.modulesLoaded = modules.length;
        this.logger.info(`📦 Registered ${modules.length} modules`);
    }

    /**
     * Initialize modules in dependency order
     */
    async initializeModules() {
        const timerName = 'ModuleInitialization';
        performanceLogger.start(timerName);
        
        try {
            // Initialize core modules first
            for (const [name, module] of this.modules) {
                if (module && typeof module.initialize === 'function') {
                    this.logger.debug(`🔧 Initializing ${name}...`);
                    
                    const moduleTimer = `Initialize:${name}`;
                    performanceLogger.start(moduleTimer);
                    
                    await module.initialize();
                    
                    const moduleTime = performanceLogger.end(moduleTimer);
                    this.logger.info(`✅ ${name} initialized (${moduleTime.toFixed(2)}ms)`);
                } else {
                    this.logger.debug(`⏭️ ${name} - no initialization required`);
                }
            }
            
            const totalTime = performanceLogger.end(timerName);
            this.logger.info(`🔧 All modules initialized in ${totalTime.toFixed(2)}ms`);
            
        } catch (error) {
            performanceLogger.end(timerName);
            throw createError(
                'Module initialization failed',
                ErrorCode.UNKNOWN,
                ErrorType.UNKNOWN,
                null,
                error
            );
        }
    }

    /**
     * Set up communication between modules
     */
    setupModuleCommunication() {
        this.logger.debug('🔗 Setting up inter-module communication...');
        
        // Helper function to safely add event listeners
        const safeAddEventListener = (module, event, callback, moduleName) => {
            if (module && typeof module.addEventListener === 'function') {
                module.addEventListener(event, callback);
                this.logger.debug(`✅ Event listener added for ${moduleName}: ${event}`);
            } else {
                this.logger.warn(`⚠️ Module ${moduleName} does not support addEventListener`);
            }
        };
        
        // Template events -> UI updates
        safeAddEventListener(templateManager, AppEvents.TEMPLATE_LOADED, (event) => {
            this.logger.debug('Template loaded, updating UI');
            // UI updates are handled by state subscriptions
        }, 'templateManager');
        
        safeAddEventListener(templateManager, AppEvents.TEMPLATES_LOADED, (event) => {
            this.logger.debug(`${event.detail.templates.length} templates loaded`);
            if (searchManager && searchManager.buildIndex) {
                searchManager.buildIndex(event.detail.templates);
            }
        }, 'templateManager');
        
        // Search events -> State updates
        safeAddEventListener(searchManager, AppEvents.SEARCH_COMPLETED, (event) => {
            this.logger.debug(`Search completed: ${event.detail.resultCount} results`);
            this.updateActivity();
        }, 'searchManager');
        
        // UI events -> Actions
        safeAddEventListener(uiManager, AppEvents.TAB_CHANGED, (event) => {
            this.logger.debug(`Tab changed to: ${event.detail.tab}`);
            this.updateActivity();
        }, 'uiManager');
        
        // API events -> Performance tracking
        safeAddEventListener(apiClient, 'request_completed', (event) => {
            this.metrics.totalRequests++;
        }, 'apiClient');
        
        // Error events -> Logging and recovery
        safeAddEventListener(errorHandler, AppEvents.ERROR_OCCURRED, (event) => {
            this.handleApplicationError(event.detail.error);
        }, 'errorHandler');
        
        this.logger.info('🔗 Inter-module communication established');
    }

    /**
     * Set up global error handling
     */
    setupGlobalErrorHandling() {
        // Application-level error recovery
        this.addEventListener('error', (event) => {
            this.logger.error('Application-level error:', event.detail);
            this.attemptRecovery(event.detail.error);
        });
        
        // Monitor for critical errors
        errorHandler.addEventListener(AppEvents.ERROR_OCCURRED, (event) => {
            const { error } = event.detail;
            
            // Check for critical errors that might require recovery
            if (this.isCriticalError(error)) {
                this.handleCriticalError(error);
            }
        });
        
        this.logger.debug('🛡️ Global error handling configured');
    }

    /**
     * Set up application-level event listeners
     */
    setupApplicationEvents() {
        // Window events
        window.addEventListener('beforeunload', () => {
            this.beforeUnload();
        });
        
        window.addEventListener('focus', () => {
            this.onWindowFocus();
        });
        
        window.addEventListener('blur', () => {
            this.onWindowBlur();
        });
        
        // Visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.onAppHidden();
            } else {
                this.onAppVisible();
            }
        });
        
        this.logger.debug('📡 Application event listeners configured');
    }

    /**
     * Set up critical DOM event listeners that must work
     */
    setupCriticalDOMEvents() {
        this.logger.debug('🎯 Setting up critical DOM event listeners...');
        
        // Sidebar toggle
        const toggleSidebar = document.getElementById('toggle-sidebar');
        if (toggleSidebar) {
            toggleSidebar.addEventListener('click', () => {
                this.logger.debug('Sidebar toggle clicked');
                const sidebar = document.getElementById('templates-sidebar');
                const collapsed = document.getElementById('collapsed-sidebar');
                if (sidebar && collapsed) {
                    sidebar.classList.add('hidden');
                    collapsed.classList.remove('hidden');
                }
            });
        }
        
        // Expand sidebar
        const expandSidebar = document.getElementById('expand-sidebar');
        if (expandSidebar) {
            expandSidebar.addEventListener('click', () => {
                this.logger.debug('Sidebar expand clicked');
                const sidebar = document.getElementById('templates-sidebar');
                const collapsed = document.getElementById('collapsed-sidebar');
                if (sidebar && collapsed) {
                    sidebar.classList.remove('hidden');
                    collapsed.classList.add('hidden');
                }
            });
        }
        
        // Tab navigation
        const editorTab = document.getElementById('editor-tab');
        const managerTab = document.getElementById('manager-tab');
        const editorContent = document.getElementById('editor-content');
        const managerContent = document.getElementById('manager-content');
        
        if (editorTab && managerTab && editorContent && managerContent) {
            editorTab.addEventListener('click', () => {
                this.logger.debug('Editor tab clicked');
                // Remove active class from manager tab
                managerTab.classList.remove('tab-active');
                managerTab.classList.add('text-gray-600', 'dark:text-gray-300', 'hover:bg-gray-100', 'dark:hover:bg-gray-700');
                
                // Add active class to editor tab
                editorTab.classList.add('tab-active');
                editorTab.classList.remove('text-gray-600', 'dark:text-gray-300', 'hover:bg-gray-100', 'dark:hover:bg-gray-700');
                
                // Show editor content, hide manager content
                editorContent.classList.remove('hidden');
                managerContent.classList.add('hidden');
            });
            
            managerTab.addEventListener('click', async () => {
                this.logger.debug('Manager tab clicked');
                // Remove active class from editor tab
                editorTab.classList.remove('tab-active');
                editorTab.classList.add('text-gray-600', 'dark:text-gray-300', 'hover:bg-gray-100', 'dark:hover:bg-gray-700');
                
                // Add active class to manager tab
                managerTab.classList.add('tab-active');
                managerTab.classList.remove('text-gray-600', 'dark:text-gray-300', 'hover:bg-gray-100', 'dark:hover:bg-gray-700');
                
                // Show manager content, hide editor content
                managerContent.classList.remove('hidden');
                editorContent.classList.add('hidden');
                
                // Load templates for manager view
                await this.loadTemplatesForManager();
            });
        }
        
        // New template button
        const newTemplateBtn = document.getElementById('new-template-btn');
        if (newTemplateBtn) {
            newTemplateBtn.addEventListener('click', () => {
                this.logger.debug('New template button clicked');
                // Clear the editor
                const titleInput = document.getElementById('template-title');
                const contentArea = document.getElementById('markdown-editor');
                if (titleInput) titleInput.value = '';
                if (contentArea) contentArea.value = '';
                
                // Switch to editor tab
                if (editorTab) editorTab.click();
            });
        }
        
        // Global search
        const globalSearch = document.getElementById('global-search');
        if (globalSearch) {
            globalSearch.addEventListener('input', (e) => {
                this.logger.debug('Search input:', e.target.value);
                // Basic search functionality
                this.performBasicSearch(e.target.value);
            });
        }
        
        // Save template button
        const saveTemplateBtn = document.getElementById('save-template');
        if (saveTemplateBtn) {
            saveTemplateBtn.addEventListener('click', async () => {
                await this.saveCurrentTemplate();
            });
        }
        
        this.logger.info('🎯 Critical DOM event listeners configured');
    }
    
    /**
     * Perform basic search functionality
     */
    performBasicSearch(query) {
        if (!query.trim()) return;
        
        // Simple search in template titles in sidebar
        const templateItems = document.querySelectorAll('.template-item');
        templateItems.forEach(item => {
            const title = item.querySelector('h4');
            if (title) {
                const titleText = title.textContent.toLowerCase();
                const isMatch = titleText.includes(query.toLowerCase());
                item.style.display = isMatch ? 'block' : 'none';
            }
        });
    }

    /**
     * Save the current template
     */
    async saveCurrentTemplate() {
        try {
            this.logger.debug('Saving current template...');
            
            const titleInput = document.getElementById('template-title');
            const contentArea = document.getElementById('markdown-editor');
            
            if (!titleInput || !contentArea) {
                throw new Error('Template form elements not found');
            }
            
            const title = titleInput.value.trim();
            const content = contentArea.value.trim();
            
            if (!title) {
                this.showNotification('Veuillez entrer un titre pour le template', 'error');
                return;
            }
            
            const templateData = {
                title: title,
                content: content,
                description: `Template créé le ${new Date().toLocaleDateString()}`
            };
            
            // Use fetch to save template
            const response = await fetch('/api/templates', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(templateData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            this.logger.info('Template saved successfully:', result);
            
            this.showNotification('Template sauvegardé avec succès !', 'success');
            
            // Reload templates in sidebar
            await this.loadTemplatesForSidebar();
            
        } catch (error) {
            this.logger.error('Error saving template:', error);
            this.showNotification(`Erreur lors de la sauvegarde: ${error.message}`, 'error');
        }
    }
    
    /**
     * Load templates for the manager view
     */
    async loadTemplatesForManager() {
        try {
            this.logger.debug('Loading templates for manager...');
            
            const response = await fetch('/api/templates');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            const templates = data.data || [];
            
            this.logger.info(`Loaded ${templates.length} templates for manager`);
            
            // Update templates grid
            const templatesGrid = document.getElementById('templates-grid');
            if (!templatesGrid) return;
            
            templatesGrid.innerHTML = '';
            
            if (templates.length === 0) {
                templatesGrid.innerHTML = `
                    <div class="col-span-full text-center py-8">
                        <p class="text-gray-500 dark:text-gray-400">Aucun template trouvé</p>
                        <button onclick="document.getElementById('new-template-btn').click()" 
                                class="mt-2 text-blue-600 hover:text-blue-800">
                            Créer votre premier template
                        </button>
                    </div>
                `;
                return;
            }
            
            templates.forEach(template => {
                const templateCard = this.createTemplateCard(template);
                templatesGrid.appendChild(templateCard);
            });
            
            // Update count
            const countElement = document.getElementById('templates-count');
            if (countElement) {
                countElement.textContent = `${templates.length} template(s)`;
            }
            
        } catch (error) {
            this.logger.error('Error loading templates for manager:', error);
            this.showNotification(`Erreur lors du chargement: ${error.message}`, 'error');
        }
    }
    
    /**
     * Load templates for sidebar
     */
    async loadTemplatesForSidebar() {
        try {
            const response = await fetch('/api/templates');
            if (!response.ok) return;
            
            const data = await response.json();
            const templates = data.data || [];
            
            const recentList = document.getElementById('recent-templates-list');
            if (!recentList) return;
            
            recentList.innerHTML = '';
            
            templates.slice(0, 10).forEach(template => {
                const item = document.createElement('div');
                item.className = 'template-item p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 cursor-pointer transition-colors duration-200 bg-white dark:bg-gray-700';
                item.dataset.templateId = template.id;
                
                item.innerHTML = `
                    <div class="flex items-center justify-between">
                        <h4 class="text-sm font-medium text-gray-900 dark:text-white truncate">${template.title}</h4>
                        ${template.is_favorite ? '<i class="fas fa-star text-yellow-400 text-xs"></i>' : ''}
                    </div>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${new Date(template.created_at).toLocaleDateString()}</p>
                `;
                
                recentList.appendChild(item);
            });
            
        } catch (error) {
            this.logger.error('Error loading templates for sidebar:', error);
        }
    }
    
    /**
     * Create a template card for the manager view
     */
    createTemplateCard(template) {
        const card = document.createElement('div');
        card.className = 'template-card bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 p-4 hover:shadow-lg transition-all duration-200';
        
        card.innerHTML = `
            <div class="flex items-start justify-between mb-2">
                <h3 class="text-lg font-medium text-gray-900 dark:text-white truncate">${template.title}</h3>
                <i class="fas fa-star ${template.is_favorite ? 'text-yellow-400' : 'text-gray-300'} cursor-pointer"></i>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">${template.description || 'Pas de description'}</p>
            <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-3">
                <span>Créé le ${new Date(template.created_at).toLocaleDateString()}</span>
                <span>${template.content ? template.content.length : 0} caractères</span>
            </div>
            <div class="flex space-x-2">
                <button class="edit-btn flex-1 bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors">
                    <i class="fas fa-edit mr-1"></i> Éditer
                </button>
                <button class="delete-btn bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        return card;
    }
    
    /**
     * Show notification to user
     */
    showNotification(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        const bgColor = type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-blue-600';
        
        toast.className = `${bgColor} text-white px-4 py-2 rounded-lg shadow-lg transition-all duration-300 transform translate-x-full`;
        toast.innerHTML = `
            <div class="flex items-center justify-between">
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" class="ml-2 text-white opacity-70 hover:opacity-100">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        container.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.classList.remove('translate-x-full');
        }, 100);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            toast.classList.add('translate-x-full');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    /**
     * Set up periodic maintenance tasks
     */
    setupPeriodicTasks() {
        // Memory cleanup every 5 minutes
        setInterval(() => {
            this.performMaintenance();
        }, 5 * 60 * 1000);
        
        // Statistics reporting every minute (debug mode only)
        if (this.config.debug) {
            setInterval(() => {
                this.reportStatistics();
            }, 60 * 1000);
        }
        
        this.logger.debug('⏰ Periodic tasks configured');
    }

    /**
     * Start the application
     */
    async start() {
        try {
            this.logger.info('🎬 Starting application...');
            
            // Load initial data
            await this.loadInitialData();
            
            // Mark as ready
            this.state.isReady = true;
            this.updateActivity();
            
            this.logger.info('🎉 Application started successfully');
            
            // Emit ready event
            this.dispatchEvent(new CustomEvent(AppEvents.APP_READY, {
                detail: {
                    startupTime: this.metrics.startupTime,
                    version: this.version
                }
            }));
            
        } catch (error) {
            this.logger.error('Failed to start application:', error);
            throw error;
        }
    }

    /**
     * Load initial application data
     */
    async loadInitialData() {
        const timerName = 'LoadInitialData';
        performanceLogger.start(timerName);
        
        try {
            this.logger.debug('📊 Loading initial data...');
            
            // Load templates and folders in parallel, then populate UI
            await Promise.all([
                templateManager.loadTemplates && templateManager.loadTemplates(),
                templateManager.loadFolders && templateManager.loadFolders()
            ].filter(Boolean));
            
            // Load templates for sidebar
            await this.loadTemplatesForSidebar();
            
            const loadTime = performanceLogger.end(timerName);
            this.logger.info(`📊 Initial data loaded in ${loadTime.toFixed(2)}ms`);
            
        } catch (error) {
            performanceLogger.end(timerName);
            this.logger.error('Failed to load initial data:', error);
            
            // Try to recover with offline mode or cached data
            this.attemptDataRecovery();
        }
    }

    /**
     * Handle application error
     * @param {Error} error - Application error
     */
    handleApplicationError(error) {
        this.logger.error('Application error handled:', error);
        
        // Update metrics
        if (this.metrics.errors) {
            this.metrics.errors++;
        } else {
            this.metrics.errors = 1;
        }
        
        // Emit application error event
        this.dispatchEvent(new CustomEvent('error', {
            detail: { error }
        }));
    }

    /**
     * Check if error is critical
     * @param {Error} error - Error to check
     * @returns {boolean} Whether error is critical
     */
    isCriticalError(error) {
        const criticalCodes = [
            ErrorCode.NETWORK_ERROR,
            ErrorCode.SERVER_ERROR,
            ErrorCode.STATE_ERROR
        ];
        
        return criticalCodes.includes(error.code) || 
               error.message.toLowerCase().includes('critical');
    }

    /**
     * Handle critical error
     * @param {Error} error - Critical error
     */
    handleCriticalError(error) {
        this.logger.error('Critical error detected:', error);
        
        // Attempt recovery strategies
        if (error.code === ErrorCode.NETWORK_ERROR) {
            this.enableOfflineMode();
        } else if (error.code === ErrorCode.STATE_ERROR) {
            this.resetApplicationState();
        }
    }

    /**
     * Attempt error recovery
     * @param {Error} error - Error to recover from
     */
    attemptRecovery(error) {
        this.logger.info('Attempting error recovery...');
        
        try {
            // Reset UI state
            if (uiManager && uiManager.isInitialized) {
                // Refresh UI
                uiManager.refreshTemplatesGrid();
            }
            
            // Clear caches
            if (searchManager) {
                searchManager.clearCache();
            }
            
            this.logger.info('Error recovery completed');
            
        } catch (recoveryError) {
            this.logger.error('Error recovery failed:', recoveryError);
        }
    }

    /**
     * Attempt data recovery
     */
    attemptDataRecovery() {
        this.logger.info('Attempting data recovery...');
        
        // Try to load from local storage or show empty state
        try {
            // Set empty state
            State.setPrompts([]);
            uiManager.refreshTemplatesGrid();
            
            this.logger.info('Data recovery: Empty state set');
            
        } catch (error) {
            this.logger.error('Data recovery failed:', error);
        }
    }

    /**
     * Enable offline mode
     */
    enableOfflineMode() {
        this.logger.info('Enabling offline mode...');
        this.config.features.offlineMode = true;
        
        // Show user notification
        if (uiManager) {
            uiManager.showMessage('Mode hors ligne activé', 'warning');
        }
    }

    /**
     * Reset application state
     */
    resetApplicationState() {
        this.logger.warn('Resetting application state...');
        
        try {
            stateManager.reset();
            this.logger.info('Application state reset completed');
        } catch (error) {
            this.logger.error('State reset failed:', error);
        }
    }

    /**
     * Update last activity timestamp
     */
    updateActivity() {
        this.state.lastActivity = new Date().toISOString();
    }

    /**
     * Perform periodic maintenance
     */
    performMaintenance() {
        try {
            this.logger.debug('🧹 Performing maintenance...');
            
            // Clear old cache entries
            if (searchManager) {
                const stats = searchManager.getStats();
                if (stats.cacheSize > 50) {
                    searchManager.clearCache();
                    this.logger.debug('Search cache cleared during maintenance');
                }
            }
            
            // Update memory usage metrics
            if (performance.memory) {
                this.metrics.memoryUsage = performance.memory.usedJSHeapSize;
            }
            
            this.logger.debug('🧹 Maintenance completed');
            
        } catch (error) {
            this.logger.error('Maintenance failed:', error);
        }
    }

    /**
     * Report application statistics
     */
    reportStatistics() {
        const stats = {
            app: {
                version: this.version,
                uptime: performance.now() - this.state.startTime,
                isReady: this.state.isReady,
                lastActivity: this.state.lastActivity
            },
            modules: {
                loaded: this.metrics.modulesLoaded,
                templates: templateManager ? templateManager.getStats() : null,
                search: searchManager ? searchManager.getStats() : null,
                api: apiClient ? apiClient.getStats() : null
            },
            performance: this.metrics
        };
        
        this.logger.debug('📊 Application Statistics:', stats);
    }

    /**
     * Handle window focus event
     */
    onWindowFocus() {
        this.logger.debug('Application focused');
        this.updateActivity();
        
        // Refresh data if needed
        if (this.shouldRefreshOnFocus()) {
            templateManager.loadTemplates();
        }
    }

    /**
     * Handle window blur event
     */
    onWindowBlur() {
        this.logger.debug('Application blurred');
        
        // Auto-save if enabled
        if (this.config.features.autoSave) {
            this.performAutoSave();
        }
    }

    /**
     * Handle app becoming visible
     */
    onAppVisible() {
        this.logger.debug('Application became visible');
        this.updateActivity();
    }

    /**
     * Handle app becoming hidden
     */
    onAppHidden() {
        this.logger.debug('Application became hidden');
        
        // Pause non-critical operations
        this.pauseNonCriticalOperations();
    }

    /**
     * Handle before unload event
     */
    beforeUnload() {
        this.logger.info('Application is closing...');
        
        // Cleanup resources
        this.cleanup();
    }

    /**
     * Check if data should be refreshed on focus
     * @returns {boolean} Whether to refresh data
     */
    shouldRefreshOnFocus() {
        if (!this.state.lastActivity) return true;
        
        const lastActivity = new Date(this.state.lastActivity);
        const timeDiff = Date.now() - lastActivity.getTime();
        
        // Refresh if inactive for more than 5 minutes
        return timeDiff > 5 * 60 * 1000;
    }

    /**
     * Perform auto-save
     */
    performAutoSave() {
        try {
            const currentTemplate = State.getCurrentPrompt();
            if (currentTemplate && uiManager) {
                // Trigger save if there are unsaved changes
                this.logger.debug('Auto-save triggered');
                // Implementation would depend on UI state
            }
        } catch (error) {
            this.logger.error('Auto-save failed:', error);
        }
    }

    /**
     * Pause non-critical operations
     */
    pauseNonCriticalOperations() {
        // Pause animations, polling, etc.
        this.logger.debug('Non-critical operations paused');
    }

    /**
     * Get module by name
     * @param {string} name - Module name
     * @returns {Object|null} Module instance
     */
    getModule(name) {
        return this.modules.get(name) || null;
    }

    /**
     * Get application status
     * @returns {Object} Application status
     */
    getStatus() {
        return {
            version: this.version,
            buildDate: this.buildDate,
            state: this.state,
            config: this.config,
            metrics: this.metrics,
            modules: Array.from(this.modules.keys())
        };
    }

    /**
     * Cleanup application resources
     */
    cleanup() {
        try {
            this.logger.info('🧹 Cleaning up application resources...');
            
            // Cleanup modules
            for (const [name, module] of this.modules) {
                if (module && typeof module.cleanup === 'function') {
                    try {
                        module.cleanup();
                        this.logger.debug(`✅ ${name} cleaned up`);
                    } catch (error) {
                        this.logger.warn(`❌ Failed to cleanup ${name}:`, error);
                    }
                }
            }
            
            // Clear intervals and timeouts
            // (Would need to track these)
            
            this.logger.info('🧹 Application cleanup completed');
            
        } catch (error) {
            this.logger.error('Application cleanup failed:', error);
        }
    }
}

/**
 * Application instance and initialization
 */
let appInstance = null;

/**
 * Create and initialize the application
 * @param {AppConfig} config - Application configuration
 * @returns {Promise<PromptEditorApp>} Application instance
 */
export async function createApp(config = {}) {
    if (appInstance) {
        logger.warn('Application already exists');
        return appInstance;
    }
    
    try {
        // Detect environment
        const isDevelopment = window.location.hostname === 'localhost' || 
                             window.location.hostname === '127.0.0.1';
        
        // Create application with environment-specific config
        const appConfig = {
            debug: isDevelopment,
            version: '2.0.0',
            features: {
                analytics: !isDevelopment,
                autoSave: true,
                offlineMode: false
            },
            ...config
        };
        
        appInstance = new PromptEditorApp(appConfig);
        
        // Initialize the application
        await appInstance.initialize();
        
        // Make globally available for debugging
        if (appConfig.debug) {
            window.app = appInstance;
            window.logger = logger;
            window.state = stateManager;
        }
        
        return appInstance;
        
    } catch (error) {
        logger.error('Failed to create application:', error);
        throw error;
    }
}

/**
 * Get the current application instance
 * @returns {PromptEditorApp|null} Application instance
 */
export function getApp() {
    return appInstance;
}

/**
 * Auto-initialization when DOM is ready
 */
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🎬 DOM loaded, starting application...');
    try {
        console.log('🔧 Creating app instance...');
        const app = await createApp();
        console.log('🎉 Application successfully started!', app);
        
        // Hide any error messages that might be showing
        const existingError = document.querySelector('[style*="background:#f44336"]');
        if (existingError) {
            existingError.remove();
        }
        
    } catch (error) {
        console.error('❌ Failed to start application:', error);
        console.error('❌ Error stack:', error.stack);
        
        // Show detailed error to user
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'position:fixed;top:20px;right:20px;background:#f44336;color:white;padding:16px;border-radius:4px;z-index:10000;max-width:400px;';
        errorDiv.innerHTML = `
            <strong>Erreur d'initialisation</strong><br>
            ${error.message || 'L\'application n\'a pas pu démarrer.'}<br>
            <small>Détails: ${error.stack ? error.stack.split('\n')[0] : 'Erreur inconnue'}</small><br>
            <button onclick="location.reload()" style="margin-top:8px;background:white;color:#f44336;border:none;padding:4px 8px;border-radius:2px;cursor:pointer;">
                Recharger
            </button>
        `;
        document.body.appendChild(errorDiv);
    }
});