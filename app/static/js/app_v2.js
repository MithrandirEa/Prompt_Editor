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
        
        // Template events -> UI updates
        templateManager.addEventListener(AppEvents.TEMPLATE_LOADED, (event) => {
            this.logger.debug('Template loaded, updating UI');
            // UI updates are handled by state subscriptions
        });
        
        templateManager.addEventListener(AppEvents.TEMPLATES_LOADED, (event) => {
            this.logger.debug(`${event.detail.templates.length} templates loaded`);
            searchManager.buildIndex(event.detail.templates);
        });
        
        // Search events -> State updates
        searchManager.addEventListener(AppEvents.SEARCH_COMPLETED, (event) => {
            this.logger.debug(`Search completed: ${event.detail.resultCount} results`);
            this.updateActivity();
        });
        
        // UI events -> Actions
        uiManager.addEventListener(AppEvents.TAB_CHANGED, (event) => {
            this.logger.debug(`Tab changed to: ${event.detail.tab}`);
            this.updateActivity();
        });
        
        // API events -> Performance tracking
        apiClient.addEventListener('request_completed', (event) => {
            this.metrics.totalRequests++;
        });
        
        // Error events -> Logging and recovery
        errorHandler.addEventListener(AppEvents.ERROR_OCCURRED, (event) => {
            this.handleApplicationError(event.detail.error);
        });
        
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
            
            // Load templates and folders in parallel
            await Promise.all([
                templateManager.loadTemplates(),
                templateManager.loadFolders()
            ]);
            
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
    try {
        logger.info('🎬 DOM loaded, starting application...');
        await createApp();
        logger.info('🎉 Application successfully started!');
    } catch (error) {
        logger.error('❌ Failed to start application:', error);
        
        // Show error to user
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'position:fixed;top:20px;right:20px;background:#f44336;color:white;padding:16px;border-radius:4px;z-index:10000;';
        errorDiv.innerHTML = `
            <strong>Erreur d'initialisation</strong><br>
            L'application n'a pas pu démarrer. Veuillez recharger la page.
            <button onclick="location.reload()" style="margin-left:10px;background:white;color:#f44336;border:none;padding:4px 8px;border-radius:2px;cursor:pointer;">
                Recharger
            </button>
        `;
        document.body.appendChild(errorDiv);
    }
});