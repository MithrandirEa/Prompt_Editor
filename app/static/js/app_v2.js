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
        
        // Drag & Drop state
        this.draggedTemplate = null;
        this.draggedFolder = null;
        
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
            
            // Initialize theme first
            this.initializeTheme();
            
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
                
                // Refresh preview when switching to editor tab
                setTimeout(() => {
                    this.updateMarkdownPreview();
                }, 100);
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
                
                // Clean up and reinitialize event handlers
                this.cleanupNavigationHandlers();
                this.setupTemplateItemsHandlers();
                
                // Load templates for manager view and folders for navigation
                await this.loadTemplatesForManager();
                await this.loadFoldersForNavigation();
            });
        }
        
        // Global search
        const globalSearch = document.getElementById('global-search');
        if (globalSearch) {
            // Filter sidebar on input
            globalSearch.addEventListener('input', (e) => {
                this.logger.debug('Search input:', e.target.value);
                // Basic search functionality for sidebar
                this.performBasicSearch(e.target.value);
            });
            
            // Show search results on Enter
            globalSearch.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.performFullSearch(e.target.value);
                }
            });
        }
        
        // Search icon click handler
        const searchIcon = document.querySelector('i.fa-search');
        if (searchIcon) {
            searchIcon.addEventListener('click', () => {
                const searchInput = document.getElementById('global-search');
                if (searchInput) {
                    this.performFullSearch(searchInput.value);
                }
            });
        }
        
        // Logs panel management
        const logsToggle = document.getElementById('logs-toggle');
        const logsPanel = document.getElementById('logs-panel');
        const logsClear = document.getElementById('logs-clear');
        
        if (logsToggle && logsPanel) {
            logsToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                logsPanel.classList.toggle('hidden');
            });
            
            // Close logs panel when clicking outside
            document.addEventListener('click', (e) => {
                if (!logsToggle.contains(e.target) && !logsPanel.contains(e.target)) {
                    logsPanel.classList.add('hidden');
                }
            });
        }
        
        if (logsClear) {
            logsClear.addEventListener('click', () => {
                const logsContent = document.getElementById('logs-content');
                if (logsContent) {
                    logsContent.innerHTML = '<div class="text-xs text-gray-500 dark:text-gray-400 italic text-center py-4">Aucun log pour le moment</div>';
                    this.updateLogsCount();
                }
            });
        }
        
        // Save template button
        const saveTemplateBtn = document.getElementById('save-template');
        if (saveTemplateBtn) {
            saveTemplateBtn.addEventListener('click', async () => {
                await this.saveCurrentTemplate();
            });
        }
        
        // Theme toggle button
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                this.toggleTheme();
            });
        }
        
        // App title click - create new template
        const appTitle = document.getElementById('app-title');
        if (appTitle) {
            appTitle.addEventListener('click', () => {
                this.logger.debug('App title clicked - creating new template');
                this.createNewTemplate();
            });
        }
        
        // Navigation buttons
        const navBackBtn = document.getElementById('nav-back-btn');
        const navForwardBtn = document.getElementById('nav-forward-btn');
        if (navBackBtn) {
            navBackBtn.addEventListener('click', () => {
                this.navigateBack();
            });
        }
        if (navForwardBtn) {
            navForwardBtn.addEventListener('click', () => {
                this.navigateForward();
            });
        }
        
        // New folder button
        const newFolderBtn = document.getElementById('new-folder-btn');
        if (newFolderBtn) {
            newFolderBtn.addEventListener('click', () => {
                this.showNewFolderModal();
            });
        }
        
        // Sync from filesystem button
        const syncFilesystemBtn = document.getElementById('sync-from-filesystem');
        if (syncFilesystemBtn) {
            syncFilesystemBtn.addEventListener('click', async () => {
                await this.syncFromFilesystem();
            });
        }
        
        // Export all button
        const exportAllBtn = document.getElementById('export-all-to-folder');
        if (exportAllBtn) {
            exportAllBtn.addEventListener('click', () => {
                this.exportAllToFolder();
            });
        }
        
        // View favorites/all buttons
        const viewFavoritesBtn = document.getElementById('view-favorites');
        const viewAllBtn = document.getElementById('view-all');
        if (viewFavoritesBtn) {
            viewFavoritesBtn.addEventListener('click', () => {
                this.filterTemplates('favorites');
            });
        }
        if (viewAllBtn) {
            viewAllBtn.addEventListener('click', () => {
                this.filterTemplates('all');
            });
        }
        
        // Markdown toolbar buttons
        const toolbarButtons = document.querySelectorAll('.markdown-toolbar button');
        toolbarButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.applyMarkdownFormat(action);
            });
        });
        
        // Markdown editor for live preview
        const markdownEditor = document.getElementById('markdown-editor');
        if (markdownEditor) {
            // Multiple events for comprehensive auto-refresh
            const updatePreview = () => {
                this.updateMarkdownPreview();
            };
            
            // Real-time updates
            markdownEditor.addEventListener('input', updatePreview);
            markdownEditor.addEventListener('keyup', updatePreview);
            markdownEditor.addEventListener('paste', () => {
                // Slight delay for paste content to be processed
                setTimeout(updatePreview, 50);
            });
            
            // Focus/blur events
            markdownEditor.addEventListener('focus', updatePreview);
            markdownEditor.addEventListener('blur', updatePreview);
            
            // Content change detection
            markdownEditor.addEventListener('change', updatePreview);
            
            this.logger.debug('Auto-refresh preview events configured');
        }

        // Preview toggle functionality
        this.setupPreviewToggle();

        // Sidebar tab buttons (Recent/Favorites)
        this.setupSidebarTabs();
        
        // Template items click handlers
        this.setupTemplateItemsHandlers();

        // Resize handle for navigation panel
        this.setupResizeHandle();
        
        this.logger.info('🎯 Critical DOM event listeners configured');
    }
    
    /**
     * Setup sidebar tabs (Recent/Favorites)
     */
    setupSidebarTabs() {
        const showRecentBtn = document.getElementById('show-recent');
        const showFavoritesBtn = document.getElementById('show-favorites');
        const recentList = document.getElementById('recent-templates-list');
        const favoritesList = document.getElementById('favorite-templates-list');
        
        if (showRecentBtn && showFavoritesBtn && recentList && favoritesList) {
            showRecentBtn.addEventListener('click', () => {
                this.logger.debug('Show recent templates clicked');
                
                // Update tab visual state
                showRecentBtn.classList.add('sidebar-tab-active', 'bg-gray-100', 'dark:bg-gray-700');
                showFavoritesBtn.classList.remove('sidebar-tab-active', 'bg-gray-100', 'dark:bg-gray-700');
                
                // Show/hide content
                recentList.classList.remove('hidden');
                favoritesList.classList.add('hidden');
                
                this.loadRecentTemplatesForSidebar();
            });
            
            showFavoritesBtn.addEventListener('click', () => {
                this.logger.debug('Show favorite templates clicked');
                
                // Update tab visual state
                showFavoritesBtn.classList.add('sidebar-tab-active', 'bg-gray-100', 'dark:bg-gray-700');
                showRecentBtn.classList.remove('sidebar-tab-active', 'bg-gray-100', 'dark:bg-gray-700');
                
                // Show/hide content
                favoritesList.classList.remove('hidden');
                recentList.classList.add('hidden');
                
                this.loadFavoriteTemplatesForSidebar();
            });
        }
        
        this.logger.debug('Sidebar tabs configured');
    }
    
    /**
     * Setup preview toggle functionality
     */
    setupPreviewToggle() {
        const togglePreviewBtn = document.getElementById('toggle-preview');
        const expandPreviewBtn = document.getElementById('expand-preview');
        const previewPanel = document.getElementById('preview-panel');
        const previewToggleCollapsed = document.getElementById('preview-toggle-collapsed');
        const previewToggleIcon = document.getElementById('preview-toggle-icon');
        
        if (!togglePreviewBtn || !expandPreviewBtn || !previewPanel || !previewToggleCollapsed || !previewToggleIcon) {
            this.logger.warn('Preview toggle elements not found');
            return;
        }
        
        let isPreviewCollapsed = false;
        
        // Toggle preview panel
        const togglePreview = () => {
            isPreviewCollapsed = !isPreviewCollapsed;
            
            if (isPreviewCollapsed) {
                // Collapse preview
                previewPanel.classList.add('preview-collapsed');
                previewPanel.classList.remove('preview-expanded');
                previewToggleCollapsed.classList.remove('hidden');
                previewToggleIcon.className = 'fas fa-chevron-right';
                
                this.logger.debug('Preview panel collapsed');
                this.addLogEntry('info', 'Aperçu réduit');
            } else {
                // Expand preview
                previewPanel.classList.remove('preview-collapsed');
                previewPanel.classList.add('preview-expanded');
                previewToggleCollapsed.classList.add('hidden');
                previewToggleIcon.className = 'fas fa-chevron-left';
                
                this.logger.debug('Preview panel expanded');
                this.addLogEntry('info', 'Aperçu affiché');
            }
        };
        
        // Event listeners
        togglePreviewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            togglePreview();
        });
        
        expandPreviewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isPreviewCollapsed) {
                togglePreview();
            }
        });
        
        // Keyboard shortcut (Ctrl+P for preview toggle)
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'p' && !e.shiftKey) {
                // Check if we're in the editor tab
                const editorTab = document.getElementById('editor-tab');
                if (editorTab && editorTab.classList.contains('tab-active')) {
                    e.preventDefault();
                    togglePreview();
                }
            }
        });
        
        this.logger.debug('Preview toggle functionality configured');
    }
    
    /**
     * Clean up navigation panel event handlers
     */
    cleanupNavigationHandlers() {
        const navigationPanel = document.getElementById('navigation-panel');
        if (navigationPanel && this.navigationClickHandler) {
            navigationPanel.removeEventListener('click', this.navigationClickHandler);
            this.navigationClickHandler = null;
            this.logger.debug('Navigation panel handlers cleaned up');
        }
    }

    /**
     * Setup template items click handlers
     */
    setupTemplateItemsHandlers() {
        // Clean up any existing handlers first
        this.cleanupNavigationHandlers();
        
        // Use event delegation since template items may be added dynamically
        // Delegate to navigation panel specifically to avoid conflicts
        const navigationPanel = document.getElementById('navigation-panel');
        if (!navigationPanel) {
            this.logger.warn('Navigation panel not found for event delegation');
            return;
        }
        
        // Store the handler for cleanup
        this.navigationClickHandler = async (e) => {
            // Handle template item clicks
            const templateItem = e.target.closest('.template-item');
            if (templateItem) {
                e.stopPropagation();
                const templateId = templateItem.dataset.templateId;
                if (templateId) {
                    this.logger.debug(`Template item clicked: ${templateId}`);
                    await this.loadTemplateInEditor(templateId);
                }
                return;
            }
            
            // Handle any folder clicks (including "All templates")
            const folderContent = e.target.closest('.folder-content');
            if (folderContent && !e.target.closest('.delete-folder-btn')) {
                e.stopPropagation();
                const folderElement = folderContent.closest('.folder-item');
                if (folderElement) {
                    const folderId = folderElement.dataset.folderId;
                    const folderName = folderElement.dataset.folderName;
                    if (folderId && folderName) {
                        // Spécial handling for "All templates"
                        if (folderId === 'all') {
                            this.logger.debug('All templates clicked');
                            this.loadTemplatesForManager(); // Refresh all templates
                        } else {
                            this.logger.debug(`Folder clicked: ${folderName} (${folderId})`);
                            this.selectFolder(folderId, folderName);
                        }
                    }
                }
                return;
            }
            
            // Handle folder delete clicks
            const deleteBtn = e.target.closest('.delete-folder-btn');
            if (deleteBtn) {
                e.stopPropagation();
                const folderElement = deleteBtn.closest('.folder-item');
                if (folderElement) {
                    const folderId = folderElement.dataset.folderId;
                    const folderName = folderElement.dataset.folderName;
                    if (folderId && folderName) {
                        this.logger.debug(`Folder delete clicked: ${folderName} (${folderId})`);
                        await this.deleteFolder(folderId, folderName);
                    }
                }
                return;
            }
        };
        
        // Attach the handler
        navigationPanel.addEventListener('click', this.navigationClickHandler);
        
        this.logger.debug('Template items handlers configured with proper delegation');
    }
    
    /**
     * Setup resize handle for navigation panel
     */
    setupResizeHandle() {
        const resizeHandle = document.getElementById('resize-handle');
        const navigationPanel = document.getElementById('navigation-panel');
        
        if (!resizeHandle || !navigationPanel) {
            this.logger.debug('Resize handle or navigation panel not found');
            return;
        }

        let isResizing = false;
        let startX = 0;
        let startWidth = 0;

        // Mouse down on resize handle
        resizeHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startWidth = parseInt(document.defaultView.getComputedStyle(navigationPanel).width, 10);
            
            // Add visual feedback
            resizeHandle.style.backgroundColor = '#3b82f6';
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            
            e.preventDefault();
        });

        // Mouse move (global)
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            const dx = e.clientX - startX;
            const newWidth = startWidth + dx;
            const minWidth = 200;
            const maxWidth = 600;

            // Constrain width
            const constrainedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
            
            navigationPanel.style.width = constrainedWidth + 'px';
            
            e.preventDefault();
        });

        // Mouse up (global)
        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                
                // Remove visual feedback
                resizeHandle.style.backgroundColor = '';
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                
                this.logger.debug(`Navigation panel resized to: ${navigationPanel.style.width}`);
            }
        });

        this.logger.debug('Resize handle configured');
    }
    
    /**
     * Perform basic search functionality (sidebar filtering only)
     */
    performBasicSearch(query) {
        if (!query.trim()) {
            // Show all items when query is empty
            const templateItems = document.querySelectorAll('.template-item');
            templateItems.forEach(item => {
                item.style.display = 'block';
            });
            return;
        }
        
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
     * Perform full search and display results in main view
     */
    async performFullSearch(query) {
        if (!query.trim()) {
            this.showNotification('Veuillez entrer un terme de recherche', 'warning');
            return;
        }

        try {
            this.logger.debug('Performing full search for:', query);
            
            // Switch to management tab to show results
            const managerTab = document.getElementById('manager-tab');
            if (managerTab) {
                this.logger.debug('Switching to manager tab');
                managerTab.click();
                // Wait for tab switch to complete
                await new Promise(resolve => setTimeout(resolve, 100));
            } else {
                this.logger.warn('Manager tab not found');
            }

            // Show loading indicator
            this.showNotification('Recherche en cours...', 'info');

            // Perform search via API
            const searchUrl = `/api/templates?search=${encodeURIComponent(query)}`;
            this.logger.debug('Fetching search results from:', searchUrl);
            
            const response = await fetch(searchUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const searchResults = data.data || [];

            this.logger.debug(`Search API returned ${searchResults.length} results`);

            // Display search results
            await this.displaySearchResults(searchResults, query);

            this.showNotification(`${searchResults.length} résultat(s) trouvé(s)`, 'success');

        } catch (error) {
            this.logger.error('Error performing search:', error);
            this.showNotification(`Erreur lors de la recherche: ${error.message}`, 'error');
        }
    }

    /**
     * Display search results in the management view
     */
    async displaySearchResults(results, query) {
        const templatesContainer = document.getElementById('templates-grid');
        if (!templatesContainer) {
            this.logger.error('Templates grid not found - unable to display search results');
            this.showNotification('Erreur: Zone d\'affichage non trouvée', 'error');
            return;
        }

        this.logger.debug(`Displaying ${results.length} search results for query: "${query}"`);

        // Clear current content
        templatesContainer.innerHTML = '';

        if (results.length === 0) {
            templatesContainer.innerHTML = `
                <div class="col-span-full text-center py-16">
                    <div class="text-gray-400 dark:text-gray-500 mb-4">
                        <i class="fas fa-search text-6xl"></i>
                    </div>
                    <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        Aucun résultat trouvé
                    </h3>
                    <p class="text-gray-500 dark:text-gray-400">
                        Aucun template ne correspond à votre recherche "<strong>${query}</strong>"
                    </p>
                    <button 
                        onclick="app.clearSearch()" 
                        class="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Voir tous les templates
                    </button>
                </div>
            `;
            return;
        }

        // Add search header
        const searchHeader = document.createElement('div');
        searchHeader.className = 'col-span-full mb-6';
        searchHeader.innerHTML = `
            <div class="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <i class="fas fa-search text-blue-600 dark:text-blue-400"></i>
                        <div>
                            <h3 class="text-lg font-medium text-blue-900 dark:text-blue-100">
                                Résultats de recherche
                            </h3>
                            <p class="text-sm text-blue-700 dark:text-blue-300">
                                ${results.length} résultat(s) pour "<strong>${query}</strong>"
                            </p>
                        </div>
                    </div>
                    <button 
                        onclick="app.clearSearch()" 
                        class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
                    >
                        Effacer
                    </button>
                </div>
            </div>
        `;
        templatesContainer.appendChild(searchHeader);

        // Display search results
        results.forEach(template => {
            const card = this.createTemplateCard(template);
            // Highlight search terms in the card
            this.highlightSearchTerms(card, query);
            templatesContainer.appendChild(card);
        });
    }

    /**
     * Highlight search terms in a template card
     */
    highlightSearchTerms(card, query) {
        const searchRegex = new RegExp(`(${query})`, 'gi');
        
        // Highlight in title
        const titleElement = card.querySelector('h3');
        if (titleElement) {
            titleElement.innerHTML = titleElement.textContent.replace(
                searchRegex, 
                '<mark class="bg-yellow-200 dark:bg-yellow-600 px-1 rounded">$1</mark>'
            );
        }

        // Highlight in description
        const descElement = card.querySelector('p');
        if (descElement) {
            descElement.innerHTML = descElement.textContent.replace(
                searchRegex, 
                '<mark class="bg-yellow-200 dark:bg-yellow-600 px-1 rounded">$1</mark>'
            );
        }
    }

    /**
     * Clear search and show all templates
     */
    async clearSearch() {
        this.logger.debug('Clearing search results');
        
        // Clear search input
        const searchInput = document.getElementById('global-search');
        if (searchInput) {
            searchInput.value = '';
        }

        // Clear sidebar filter
        this.performBasicSearch('');

        // Reload all templates in management view
        await this.loadTemplatesForManager();

        this.showNotification('Recherche effacée', 'success');
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
            await this.refreshSidebar();
            
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
                        <button onclick="app.createNewTemplate()" 
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
     * Load recent templates for sidebar
     */
    async loadRecentTemplatesForSidebar() {
        try {
            this.logger.debug('Loading recent templates for sidebar...');
            
            const response = await fetch('/api/templates?recent=true');
            if (!response.ok) return;
            
            const data = await response.json();
            const templates = data.data || [];
            
            const recentList = document.getElementById('recent-templates-list');
            if (!recentList) return;
            
            recentList.innerHTML = '';
            
            if (templates.length === 0) {
                recentList.innerHTML = `
                    <div class="text-center py-8 text-gray-500 dark:text-gray-400">
                        <i class="fas fa-clock text-2xl mb-2"></i>
                        <p class="text-sm">Aucun template récent</p>
                    </div>
                `;
                return;
            }
            
            templates.slice(0, 10).forEach(template => {
                const item = this.createSidebarTemplateItem(template);
                recentList.appendChild(item);
            });
            
        } catch (error) {
            this.logger.error('Error loading recent templates for sidebar:', error);
        }
    }

    /**
     * Load favorite templates for sidebar
     */
    async loadFavoriteTemplatesForSidebar() {
        try {
            this.logger.debug('Loading favorite templates for sidebar...');
            
            const response = await fetch('/api/templates?favorites=true');
            if (!response.ok) return;
            
            const data = await response.json();
            const templates = data.data || [];
            
            const favoritesList = document.getElementById('favorite-templates-list');
            if (!favoritesList) return;
            
            favoritesList.innerHTML = '';
            
            if (templates.length === 0) {
                favoritesList.innerHTML = `
                    <div class="text-center py-8 text-gray-500 dark:text-gray-400">
                        <i class="fas fa-star text-2xl mb-2"></i>
                        <p class="text-sm">Aucun template favori</p>
                        <p class="text-xs mt-1">Cliquez sur ⭐ pour ajouter des favoris</p>
                    </div>
                `;
                return;
            }
            
            templates.forEach(template => {
                const item = this.createSidebarTemplateItem(template);
                favoritesList.appendChild(item);
            });
            
        } catch (error) {
            this.logger.error('Error loading favorite templates for sidebar:', error);
        }
    }

    /**
     * Create sidebar template item
     */
    createSidebarTemplateItem(template) {
        const item = document.createElement('div');
        item.className = 'template-item p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 cursor-pointer transition-colors duration-200 bg-white dark:bg-gray-700 group';
        item.dataset.templateId = template.id;
        
        item.innerHTML = `
            <div class="flex items-center justify-between">
                <h4 class="text-sm font-medium text-gray-900 dark:text-white truncate pr-2">${template.title}</h4>
                <div class="flex items-center space-x-1">
                    ${template.is_favorite ? '<i class="fas fa-star text-yellow-400 text-xs"></i>' : ''}
                    <i class="fas fa-chevron-right text-gray-300 group-hover:text-blue-500 text-xs transition-colors"></i>
                </div>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${new Date(template.created_at).toLocaleDateString()}</p>
            <div class="text-xs text-gray-400 dark:text-gray-500 mt-1">
                ${template.content ? template.content.length : 0} caractères
            </div>
        `;
        
        return item;
    }

    /**
     * Load template in editor
     */
    async loadTemplateInEditor(templateId) {
        try {
            this.logger.debug(`Loading template ${templateId} in editor...`);
            
            const response = await fetch(`/api/templates/${templateId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            const template = data.data;
            
            // Load template data in editor
            const titleInput = document.getElementById('template-title');
            const contentArea = document.getElementById('markdown-editor');
            
            if (titleInput) titleInput.value = template.title || '';
            if (contentArea) contentArea.value = template.content || '';
            
            // Update markdown preview
            this.updateMarkdownPreview();
            
            // Visual feedback that template is loaded
            this.showNotification(`Template "${template.title}" chargé`, 'success');
            
            // Store current template ID for save operations
            this.currentTemplateId = templateId;
            
        } catch (error) {
            this.logger.error('Error loading template in editor:', error);
            this.showNotification(`Erreur lors du chargement: ${error.message}`, 'error');
        }
    }

    /**
     * Create new template - clear editor and switch to editor tab
     */
    createNewTemplate() {
        this.logger.debug('Creating new template...');
        
        try {
            // Clear the editor
            const titleInput = document.getElementById('template-title');
            const contentArea = document.getElementById('markdown-editor');
            
            if (titleInput) {
                titleInput.value = '';
                titleInput.placeholder = 'Titre du template...';
            }
            if (contentArea) {
                contentArea.value = '';
                contentArea.placeholder = 'Commencez à écrire votre template ici...';
            }
            
            // Clear current template ID
            this.currentTemplateId = null;
            
            // Update markdown preview to be empty
            this.updateMarkdownPreview();
            
            // Switch to editor tab
            const editorTab = document.getElementById('editor-tab');
            if (editorTab) {
                editorTab.click();
            }
            
            // Focus on title input
            if (titleInput) {
                setTimeout(() => titleInput.focus(), 100);
            }
            
            this.showNotification('Nouveau template créé', 'success');
            
        } catch (error) {
            this.logger.error('Error creating new template:', error);
            this.showNotification(`Erreur lors de la création: ${error.message}`, 'error');
        }
    }
    
    /**
     * Create a template card for the manager view
     */
    createTemplateCard(template) {
        const card = document.createElement('div');
        card.className = 'template-card bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 p-4 hover:shadow-lg transition-all duration-200';
        card.draggable = true;
        card.dataset.templateId = template.id;
        
        card.innerHTML = `
            <div class="flex items-start justify-between mb-2">
                <h3 class="text-lg font-medium text-gray-900 dark:text-white truncate">${template.title}</h3>
                <i class="fas fa-star ${template.is_favorite ? 'text-yellow-400' : 'text-gray-300'} cursor-pointer star-btn" data-template-id="${template.id}"></i>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">${template.description || 'Pas de description'}</p>
            <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-3">
                <span>Créé le ${new Date(template.created_at).toLocaleDateString()}</span>
                <span>${template.content ? template.content.length : 0} caractères</span>
            </div>
            <div class="flex space-x-2">
                <button class="edit-btn flex-1 bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors" data-template-id="${template.id}">
                    <i class="fas fa-edit mr-1"></i> Éditer
                </button>
                <button class="delete-btn bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors" data-template-id="${template.id}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        // Add event listeners for interactions
        this.attachTemplateCardEvents(card, template);
        
        return card;
    }

    /**
     * Attach event listeners to template card
     */
    attachTemplateCardEvents(card, template) {
        // Drag events
        card.addEventListener('dragstart', (e) => {
            this.handleDragStart(e, template);
        });
        
        card.addEventListener('dragend', (e) => {
            this.handleDragEnd(e);
        });

        // Star button (favorite toggle)
        const starBtn = card.querySelector('.star-btn');
        if (starBtn) {
            starBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.toggleTemplateFavorite(template.id, !template.is_favorite);
            });
        }

        // Edit button
        const editBtn = card.querySelector('.edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.editTemplate(template.id);
            });
        }

        // Delete button
        const deleteBtn = card.querySelector('.delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.deleteTemplate(template.id, template.title);
            });
        }

        // Card click (edit template directly)
        card.addEventListener('click', async (e) => {
            // Ignore clicks on buttons and their children
            if (e.target.matches('.star-btn, .edit-btn, .delete-btn, .fas') || 
                e.target.closest('.star-btn, .edit-btn, .delete-btn')) {
                return;
            }
            
            e.stopPropagation();
            e.preventDefault();
            await this.editTemplate(template.id);
        });
    }
    
    /**
     * Show notification to user
     */
    showNotification(message, type = 'info') {
        this.addLogEntry(message, type);
    }

    addLogEntry(message, type = 'info') {
        const logsContent = document.getElementById('logs-content');
        const logsCount = document.getElementById('logs-count');
        const logsToggle = document.getElementById('logs-toggle');
        
        if (!logsContent) return;
        
        // Remove empty message if it exists
        const emptyMessage = logsContent.querySelector('.italic');
        if (emptyMessage) {
            emptyMessage.remove();
        }
        
        // Create log entry
        const logEntry = document.createElement('div');
        const timestamp = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        const typeConfig = {
            'success': { icon: 'fas fa-check-circle', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-l-green-500' },
            'error': { icon: 'fas fa-exclamation-circle', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-l-red-500' },
            'warning': { icon: 'fas fa-exclamation-triangle', color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-l-yellow-500' },
            'info': { icon: 'fas fa-info-circle', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-l-blue-500' }
        };
        
        const config = typeConfig[type] || typeConfig['info'];
        
        logEntry.className = `${config.bg} border-l-2 ${config.border} p-2 rounded text-xs transition-all duration-300 opacity-0 transform translate-y-2`;
        logEntry.innerHTML = `
            <div class="flex items-start space-x-2">
                <i class="${config.icon} ${config.color} mt-0.5 flex-shrink-0"></i>
                <div class="flex-1 min-w-0">
                    <div class="text-gray-900 dark:text-gray-100 break-words">${message}</div>
                    <div class="text-gray-500 dark:text-gray-400 text-xs mt-1">${timestamp}</div>
                </div>
                <button onclick="this.parentElement.parentElement.remove(); app.updateLogsCount();" class="text-gray-400 hover:text-red-500 flex-shrink-0">
                    <i class="fas fa-times text-xs"></i>
                </button>
            </div>
        `;
        
        // Add to top of logs
        logsContent.insertBefore(logEntry, logsContent.firstChild);
        
        // Animate in
        setTimeout(() => {
            logEntry.classList.remove('opacity-0', 'translate-y-2');
        }, 100);
        
        // Update count and show indicator
        this.updateLogsCount();
        
        // Auto-scroll to top
        logsContent.scrollTop = 0;
        
        // Limit to 50 logs maximum
        const allLogs = logsContent.querySelectorAll('div[class*="border-l-2"]');
        if (allLogs.length > 50) {
            allLogs[allLogs.length - 1].remove();
        }
    }

    updateLogsCount() {
        const logsContent = document.getElementById('logs-content');
        const logsCount = document.getElementById('logs-count');
        
        if (!logsContent || !logsCount) return;
        
        const logEntries = logsContent.querySelectorAll('div[class*="border-l-2"]');
        const count = logEntries.length;
        
        if (count > 0) {
            logsCount.textContent = count > 99 ? '99+' : count;
            logsCount.classList.remove('hidden');
        } else {
            logsCount.classList.add('hidden');
            // Add empty message back
            logsContent.innerHTML = '<div class="text-xs text-gray-500 dark:text-gray-400 italic text-center py-4">Aucun log pour le moment</div>';
        }
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
            
            // Initialize preview on startup
            this.initializePreview();

            this.logger.info('🎉 Application started successfully');            // Emit ready event
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
            
            // Load templates for sidebar (default to recent)
            await this.loadRecentTemplatesForSidebar();
            
            // Load folders for navigation panel
            await this.loadFoldersForNavigation();
            
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
     * Toggle template favorite status
     */
    async toggleTemplateFavorite(templateId, isFavorite) {
        try {
            this.logger.debug(`Toggling favorite for template ${templateId}: ${isFavorite}`);
            
            const response = await fetch(`/api/templates/${templateId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ is_favorite: isFavorite })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            this.showNotification(
                isFavorite ? 'Template ajouté aux favoris' : 'Template retiré des favoris', 
                'success'
            );
            
            // Reload templates to reflect changes
            await this.loadTemplatesForManager();
            
            // Refresh sidebar tabs to show updated favorites/recent
            await this.refreshSidebar();
            
        } catch (error) {
            this.logger.error('Error toggling favorite:', error);
            this.showNotification(`Erreur: ${error.message}`, 'error');
        }
    }

    /**
     * Refresh sidebar content based on current tab
     */
    async refreshSidebar() {
        try {
            const showRecentBtn = document.getElementById('show-recent');
            const showFavoritesBtn = document.getElementById('show-favorites');
            
            // Check which tab is currently active
            if (showRecentBtn && showRecentBtn.classList.contains('sidebar-tab-active')) {
                await this.loadRecentTemplatesForSidebar();
            } else if (showFavoritesBtn && showFavoritesBtn.classList.contains('sidebar-tab-active')) {
                await this.loadFavoriteTemplatesForSidebar();
            } else {
                // Default to recent
                await this.loadRecentTemplatesForSidebar();
            }
            
        } catch (error) {
            this.logger.error('Error refreshing sidebar:', error);
        }
    }

    /**
     * Edit template (switch to editor tab and load template)
     */
    async editTemplate(templateId) {
        try {
            this.logger.debug(`Editing template ${templateId}`);
            
            const response = await fetch(`/api/templates/${templateId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            const template = data.data;
            
            // Load template in editor
            const titleInput = document.getElementById('template-title');
            const contentArea = document.getElementById('markdown-editor');
            
            if (titleInput) titleInput.value = template.title;
            if (contentArea) contentArea.value = template.content || '';
            
            // Switch to editor tab
            const editorTab = document.getElementById('editor-tab');
            if (editorTab) {
                editorTab.click();
            }
            
            this.showNotification('Template chargé dans l\'éditeur', 'success');
            
        } catch (error) {
            this.logger.error('Error editing template:', error);
            this.showNotification(`Erreur lors du chargement: ${error.message}`, 'error');
        }
    }

    /**
     * Delete template with confirmation
     */
    async deleteTemplate(templateId, templateTitle) {
        try {
            // Use a custom confirmation method to avoid conflicts
            const confirmed = await this.showCustomConfirm(
                'Confirmer la suppression',
                `Êtes-vous sûr de vouloir supprimer le template "${templateTitle}" ?\n\nCette action est irréversible.`,
                'Supprimer',
                'Annuler'
            );
            
            if (!confirmed) return;
            
            this.logger.debug(`Deleting template ${templateId}`);
            
            const response = await fetch(`/api/templates/${templateId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            this.showNotification('Template supprimé avec succès', 'success');
            
            // Reload templates and sidebar
            await this.loadTemplatesForManager();
            await this.refreshSidebar();
            
        } catch (error) {
            this.logger.error('Error deleting template:', error);
            this.showNotification(`Erreur lors de la suppression: ${error.message}`, 'error');
        }
    }

    /**
     * Preview template (could open in modal or show details)
     */
    previewTemplate(template) {
        this.logger.debug(`Previewing template: ${template.title}`);
        
        // For now, just show template info
        const info = `
Titre: ${template.title}
Description: ${template.description || 'Aucune'}
Créé le: ${new Date(template.created_at).toLocaleDateString()}
Caractères: ${template.content ? template.content.length : 0}
Favori: ${template.is_favorite ? 'Oui' : 'Non'}
        `.trim();
        
        alert(info);
        
        // TODO: Implement proper preview modal
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
     * Toggle dark/light theme
     */
    toggleTheme() {
        this.logger.debug('Toggling theme...');
        const html = document.documentElement;
        const isDark = html.classList.contains('dark');
        
        if (isDark) {
            html.classList.remove('dark');
            localStorage.setItem('theme', 'light');
            this.updateThemeIcon('light');
        } else {
            html.classList.add('dark');
            localStorage.setItem('theme', 'dark');
            this.updateThemeIcon('dark');
        }
        
        this.logger.info(`Theme switched to: ${isDark ? 'light' : 'dark'}`);
    }
    
    /**
     * Update theme icon
     */
    updateThemeIcon(theme) {
        const icon = document.getElementById('theme-icon');
        if (icon) {
            icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }
    
    /**
     * Initialize theme from localStorage
     */
    initializeTheme() {
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const isDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
        
        if (isDark) {
            document.documentElement.classList.add('dark');
            this.updateThemeIcon('dark');
        } else {
            this.updateThemeIcon('light');
        }
    }
    
    /**
     * Navigation history management
     */
    navigateBack() {
        this.logger.debug('Navigate back clicked');
        // Implement navigation history
        window.history.back();
    }
    
    navigateForward() {
        this.logger.debug('Navigate forward clicked');
        // Implement navigation history
        window.history.forward();
    }
    
    /**
     * Show new folder modal
     */
    showNewFolderModal() {
        this.logger.debug('Showing new folder modal...');
        const modalOverlay = document.getElementById('modal-overlay');
        const modalContent = document.getElementById('modal-content');
        
        if (!modalOverlay || !modalContent) return;
        
        modalContent.innerHTML = `
            <div class="space-y-4">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Nouveau dossier</h3>
                <div>
                    <label for="folder-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Nom du dossier
                    </label>
                    <input 
                        type="text" 
                        id="folder-name" 
                        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Entrez le nom du dossier..."
                        maxlength="100"
                    >
                </div>
                <div class="flex justify-end space-x-3">
                    <button 
                        onclick="app.closeModal()" 
                        class="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition-colors"
                    >
                        Annuler
                    </button>
                    <button 
                        onclick="app.createFolder()" 
                        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Créer
                    </button>
                </div>
            </div>
        `;
        
        modalOverlay.classList.remove('hidden');
        
        // Focus on input
        setTimeout(() => {
            const input = document.getElementById('folder-name');
            if (input) input.focus();
        }, 100);
    }
    
    /**
     * Close modal
     */
    closeModal() {
        const modalOverlay = document.getElementById('modal-overlay');
        if (modalOverlay) {
            modalOverlay.classList.add('hidden');
        }
    }

    /**
     * Show custom confirmation dialog
     */
    showCustomConfirm(title, message, confirmText = 'OK', cancelText = 'Annuler') {
        return new Promise((resolve) => {
            const modalOverlay = document.getElementById('modal-overlay');
            const modalContent = document.getElementById('modal-content');
            
            if (!modalOverlay || !modalContent) {
                // Fallback to native confirm
                resolve(confirm(message));
                return;
            }

            modalContent.innerHTML = `
                <div class="text-center">
                    <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
                        <i class="fas fa-exclamation-triangle text-red-600 dark:text-red-400 text-xl"></i>
                    </div>
                    <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">${title}</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6 whitespace-pre-line">${message}</p>
                    <div class="flex space-x-3 justify-center">
                        <button 
                            id="confirm-cancel-btn" 
                            class="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                        >
                            ${cancelText}
                        </button>
                        <button 
                            id="confirm-ok-btn" 
                            class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                        >
                            ${confirmText}
                        </button>
                    </div>
                </div>
            `;

            // Show modal
            modalOverlay.classList.remove('hidden');

            // Add event listeners
            const cancelBtn = document.getElementById('confirm-cancel-btn');
            const okBtn = document.getElementById('confirm-ok-btn');

            const cleanup = () => {
                modalOverlay.classList.add('hidden');
                if (cancelBtn) cancelBtn.removeEventListener('click', handleCancel);
                if (okBtn) okBtn.removeEventListener('click', handleOk);
            };

            const handleCancel = () => {
                cleanup();
                resolve(false);
            };

            const handleOk = () => {
                cleanup();
                resolve(true);
            };

            if (cancelBtn) cancelBtn.addEventListener('click', handleCancel);
            if (okBtn) okBtn.addEventListener('click', handleOk);

            // Close on outside click
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) {
                    handleCancel();
                }
            });
        });
    }
    
    /**
     * Create new folder
     */
    async createFolder() {
        const nameInput = document.getElementById('folder-name');
        if (!nameInput) return;
        
        const name = nameInput.value.trim();
        if (!name) {
            this.showNotification('Veuillez entrer un nom pour le dossier', 'error');
            return;
        }
        
        try {
            const response = await fetch('/api/folders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            this.logger.info('Folder created successfully:', result);
            
            this.showNotification('Dossier créé avec succès !', 'success');
            this.closeModal();
            
            // Reload folder tree
            await this.loadFoldersForNavigation();
            
        } catch (error) {
            this.logger.error('Error creating folder:', error);
            this.showNotification(`Erreur lors de la création: ${error.message}`, 'error');
        }
    }
    
    /**
     * Load folders for navigation panel
     */
    async loadFoldersForNavigation() {
        try {
            const response = await fetch('/api/folders');
            if (!response.ok) return;
            
            const data = await response.json();
            const folders = data.data || [];
            
            const folderTree = document.getElementById('folder-tree');
            if (!folderTree) return;
            
            folderTree.innerHTML = '';

            // Add "All templates" option at the top
            const allTemplatesElement = this.createAllTemplatesElement();
            folderTree.appendChild(allTemplatesElement);
            
            if (folders.length === 0) {
                const emptyMessage = document.createElement('div');
                emptyMessage.className = 'text-center py-8 text-gray-500 dark:text-gray-400';
                emptyMessage.innerHTML = `
                    <i class="fas fa-folder-open text-2xl mb-2"></i>
                    <p>Aucun dossier</p>
                    <button onclick="app.showNewFolderModal()" class="mt-2 text-blue-600 hover:text-blue-800 text-sm">
                        Créer votre premier dossier
                    </button>
                `;
                folderTree.appendChild(emptyMessage);
                return;
            }
            
            // Build hierarchical structure
            const folderHierarchy = this.buildFolderHierarchy(folders);
            
            // Render folders hierarchically
            this.renderFolderHierarchy(folderHierarchy, folderTree, 0);
            
        } catch (error) {
            this.logger.error('Error loading folders:', error);
        }
    }
    
    /**
     * Build hierarchical folder structure from flat array
     */
    buildFolderHierarchy(folders) {
        // Create a map for quick lookup
        const folderMap = new Map();
        folders.forEach(folder => {
            folder.children = [];
            folderMap.set(folder.id, folder);
        });
        
        // Build hierarchy
        const rootFolders = [];
        folders.forEach(folder => {
            if (folder.parent_id) {
                const parent = folderMap.get(folder.parent_id);
                if (parent) {
                    parent.children.push(folder);
                } else {
                    // Parent not found, treat as root
                    rootFolders.push(folder);
                }
            } else {
                rootFolders.push(folder);
            }
        });
        
        return rootFolders;
    }
    
    /**
     * Render folder hierarchy recursively
     */
    renderFolderHierarchy(folders, container, level) {
        folders.forEach(folder => {
            const folderElement = this.createFolderElement(folder);
            
            // Add nesting class for nested folders
            if (level > 0) {
                const levelClass = `nested-folder-level-${Math.min(level, 3)}`;
                folderElement.classList.add('nested-folder', levelClass);
            }
            
            container.appendChild(folderElement);
            
            // Render children recursively
            if (folder.children && folder.children.length > 0) {
                this.renderFolderHierarchy(folder.children, container, level + 1);
            }
        });
    }

    /**
     * Create "All templates" element
     */
    createAllTemplatesElement() {
        const element = document.createElement('div');
        element.className = 'folder-item group all-templates-item mb-2';
        element.dataset.folderId = 'all';
        element.dataset.folderName = 'Tous les templates';
        
        element.innerHTML = `
            <div class="folder-content flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 transition-colors">
                <div class="flex items-center space-x-2">
                    <i class="fas fa-th-large text-blue-600 dark:text-blue-400"></i>
                    <span class="text-sm font-medium text-blue-900 dark:text-blue-100">Tous les templates</span>
                </div>
                <i class="fas fa-chevron-right text-blue-600 dark:text-blue-400"></i>
            </div>
        `;
        
        // Add click event
        element.addEventListener('click', () => {
            this.selectAllTemplates();
        });
        
        // Add drag & drop events for root folder
        this.attachRootFolderDragDropEvents(element);
        
        return element;
    }
    
    /**
     * Create folder element for navigation
     */
    createFolderElement(folder) {
        const element = document.createElement('div');
        element.className = 'folder-item group';
        element.dataset.folderId = folder.id;
        element.dataset.folderName = folder.name;
        element.draggable = true; // Make folders draggable
        
        element.innerHTML = `
            <div class="folder-content flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors">
                <div class="flex items-center space-x-2">
                    <i class="fas fa-folder text-amber-600 dark:text-amber-400"></i>
                    <span class="text-sm font-medium text-gray-900 dark:text-white">${folder.name}</span>
                </div>
                <div class="flex items-center space-x-2">
                    <span class="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">${folder.template_count || 0}</span>
                    <button class="delete-folder-btn opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 p-1 transition-all" data-folder-id="${folder.id}" title="Supprimer le dossier">
                        <i class="fas fa-trash text-xs"></i>
                    </button>
                    <i class="fas fa-chevron-right text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors"></i>
                </div>
            </div>
        `;
        
        // Add drag & drop events for receiving templates
        this.attachFolderDragDropEvents(element, folder);
        
        // Add drag events for the folder itself
        this.attachFolderDragEvents(element, folder);
        
        // Note: Click events are handled through event delegation in setupTemplateItemsHandlers
        // This avoids duplicate event handlers and ensures proper functioning across tab switches

        return element;
    }
    
    /**
     * Delete folder with confirmation
     */
    async deleteFolder(folderId, folderName) {
        const confirmed = confirm(`Êtes-vous sûr de vouloir supprimer le dossier "${folderName}" ? Les templates seront déplacés vers la racine.`);
        if (!confirmed) return;
        
        try {
            const response = await fetch(`/api/folders/${folderId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Erreur lors de la suppression');
            }
            
            this.showNotification(`Dossier "${folderName}" supprimé avec succès`, 'success');
            
            // Refresh folders and templates
            await this.loadFoldersForNavigation();
            await this.loadTemplatesForManager();
            
        } catch (error) {
            this.logger.error('Error deleting folder:', error);
            this.showNotification(`Erreur: ${error.message}`, 'error');
        }
    }
    
    /**
     * Handle drag start
     */
    handleDragStart(e, template) {
        this.draggedTemplate = template;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.target.outerHTML);
        e.target.classList.add('dragging');
    }
    
    /**
     * Handle drag end
     */
    handleDragEnd(e) {
        e.target.classList.remove('dragging');
        this.draggedTemplate = null;
        this.draggedFolder = null;
        
        // Remove drag-over class from all folders
        document.querySelectorAll('.folder-item').forEach(folder => {
            folder.classList.remove('drag-over');
        });
    }
    
    /**
     * Attach drag & drop events to folder element
     */
    attachFolderDragDropEvents(element, folder) {
        element.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            // Don't allow dropping a folder into itself
            if (this.draggedFolder && this.draggedFolder.id === folder.id) {
                e.dataTransfer.dropEffect = 'none';
                return;
            }
            
            element.classList.add('drag-over');
        });
        
        element.addEventListener('dragleave', (e) => {
            // Only remove drag-over if we're really leaving the folder
            if (!element.contains(e.relatedTarget)) {
                element.classList.remove('drag-over');
            }
        });
        
        element.addEventListener('drop', async (e) => {
            e.preventDefault();
            element.classList.remove('drag-over');
            
            if (this.draggedTemplate) {
                await this.moveTemplateToFolder(this.draggedTemplate.id, folder.id);
            } else if (this.draggedFolder && this.draggedFolder.id !== folder.id) {
                await this.moveFolderToFolder(this.draggedFolder.id, folder.id);
            }
        });
    }
    
    /**
     * Attach drag events to folder element (for dragging the folder itself)
     */
    attachFolderDragEvents(element, folder) {
        element.addEventListener('dragstart', (e) => {
            this.draggedFolder = folder;
            e.dataTransfer.effectAllowed = 'move';
            element.classList.add('dragging');
            this.logger.debug('Started dragging folder:', folder.name);
        });
        
        element.addEventListener('dragend', (e) => {
            element.classList.remove('dragging');
            this.draggedFolder = null;
            
            // Remove drag-over class from all folders
            document.querySelectorAll('.folder-item').forEach(el => {
                el.classList.remove('drag-over');
            });
            
            this.logger.debug('Finished dragging folder');
        });
    }
    
    /**
     * Move template to folder
     */
    async moveTemplateToFolder(templateId, folderId) {
        try {
            const response = await fetch(`/api/templates/${templateId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    folder_id: folderId
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Erreur lors du déplacement');
            }
            
            this.showNotification('Template déplacé avec succès', 'success');
            
            // Refresh templates and folders
            await this.loadTemplatesForManager();
            await this.loadFoldersForNavigation();
            
        } catch (error) {
            this.logger.error('Error moving template:', error);
            this.showNotification(`Erreur: ${error.message}`, 'error');
        }
    }
    
    /**
     * Move folder to another folder (nesting)
     */
    async moveFolderToFolder(folderId, parentFolderId) {
        try {
            const response = await fetch(`/api/folders/${folderId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    parent_id: parentFolderId
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Erreur lors du déplacement du dossier');
            }
            
            this.showNotification('Dossier déplacé avec succès', 'success');
            
            // Refresh folders and templates
            await this.loadFoldersForNavigation();
            await this.loadTemplatesForManager();
            
        } catch (error) {
            this.logger.error('Error moving folder:', error);
            this.showNotification(`Erreur: ${error.message}`, 'error');
        }
    }
    
    /**
     * Move folder to root (remove from parent)
     */
    async moveFolderToRoot(folderId) {
        try {
            const response = await fetch(`/api/folders/${folderId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    parent_id: null
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Erreur lors du déplacement du dossier');
            }
            
            this.showNotification('Dossier déplacé vers la racine', 'success');
            
            // Refresh folders and templates
            await this.loadFoldersForNavigation();
            await this.loadTemplatesForManager();
            
        } catch (error) {
            this.logger.error('Error moving folder to root:', error);
            this.showNotification(`Erreur: ${error.message}`, 'error');
        }
    }
    
    /**
     * Attach drag & drop events to root folder element (All templates)
     */
    attachRootFolderDragDropEvents(element) {
        element.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            element.classList.add('drag-over');
        });
        
        element.addEventListener('dragleave', (e) => {
            // Only remove drag-over if we're really leaving the folder
            if (!element.contains(e.relatedTarget)) {
                element.classList.remove('drag-over');
            }
        });
        
        element.addEventListener('drop', async (e) => {
            e.preventDefault();
            element.classList.remove('drag-over');
            
            if (this.draggedTemplate) {
                await this.moveTemplateToFolder(this.draggedTemplate.id, null);
            } else if (this.draggedFolder) {
                await this.moveFolderToRoot(this.draggedFolder.id);
            }
        });
    }
    
    /**
     * Select folder and show its templates
     */
    async selectFolder(folderId, folderName) {
        this.logger.debug(`Selecting folder: ${folderName} (${folderId})`);
        
        try {
            // Update visual selection
            this.updateFolderSelection(folderId);
            
            // Update title and path
            const titleElement = document.getElementById('current-folder-title');
            const pathElement = document.getElementById('current-folder-path');
            if (titleElement) titleElement.textContent = folderName;
            if (pathElement) pathElement.textContent = `Racine > ${folderName}`;
            
            const response = await fetch(`/api/folders/${folderId}/templates`);
            if (!response.ok) return;
            
            const data = await response.json();
            const templates = data.data || [];
            
            // Update templates grid
            const templatesGrid = document.getElementById('templates-grid');
            if (!templatesGrid) return;
            
            templatesGrid.innerHTML = '';
            
            if (templates.length === 0) {
                templatesGrid.innerHTML = `
                    <div class="col-span-full text-center py-8">
                        <i class="fas fa-folder-open text-4xl text-gray-300 dark:text-gray-600 mb-4"></i>
                        <p class="text-gray-500 dark:text-gray-400 mb-2">Ce dossier est vide</p>
                        <button onclick="app.createNewTemplate()" 
                                class="text-blue-600 hover:text-blue-800 text-sm">
                            Ajouter un template à ce dossier
                        </button>
                    </div>
                `;
                
                // Update count
                const countElement = document.getElementById('templates-count');
                if (countElement) countElement.textContent = '0 template(s)';
                
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
            this.logger.error('Error loading folder templates:', error);
            this.showNotification(`Erreur lors du chargement du dossier: ${error.message}`, 'error');
        }
    }

    /**
     * Update visual selection of folders
     */
    updateFolderSelection(selectedFolderId) {
        // Remove previous selection
        document.querySelectorAll('.folder-item').forEach(item => {
            const div = item.querySelector('div');
            div.classList.remove('bg-blue-100', 'dark:bg-blue-800', 'border', 'border-blue-300', 'dark:border-blue-600');
        });
        
        // Add selection to current folder
        const selectedItem = document.querySelector(`[data-folder-id="${selectedFolderId}"]`);
        if (selectedItem) {
            const div = selectedItem.querySelector('div');
            div.classList.add('bg-blue-100', 'dark:bg-blue-800', 'border', 'border-blue-300', 'dark:border-blue-600');
        }
    }

    /**
     * Select "All templates" view
     */
    async selectAllTemplates() {
        this.logger.debug('Selecting all templates view');
        
        // Update visual selection
        this.updateFolderSelection('all');
        
        // Update title
        const titleElement = document.getElementById('current-folder-title');
        const pathElement = document.getElementById('current-folder-path');
        if (titleElement) titleElement.textContent = 'Tous les templates';
        if (pathElement) pathElement.textContent = 'Racine';
        
        // Load all templates
        await this.loadTemplatesForManager();
    }

    /**
     * Export all templates to folder
     */
    async exportAllToFolder() {
        this.logger.debug('Exporting all templates to folder...');
        
        try {
            const response = await fetch('/api/templates');
            if (!response.ok) return;
            
            const data = await response.json();
            const templates = data.data || [];
            
            if (templates.length === 0) {
                this.showNotification('Aucun template à exporter', 'error');
                return;
            }
            
            // Create ZIP file
            const zip = new JSZip();
            
            templates.forEach(template => {
                const filename = `${template.title.replace(/[^a-zA-Z0-9]/g, '_')}.md`;
                const content = `# ${template.title}\n\n${template.content || ''}`;
                zip.file(filename, content);
            });
            
            // Generate and download ZIP
            const blob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = 'tous_les_templates.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
            
            this.showNotification('Tous les templates ont été exportés !', 'success');
            
        } catch (error) {
            this.logger.error('Error exporting all templates:', error);
            this.showNotification(`Erreur lors de l'export: ${error.message}`, 'error');
        }
    }
    
    /**
     * Synchronize templates from filesystem to database
     */
    async syncFromFilesystem() {
        this.logger.debug('Synchronizing from filesystem...');
        
        try {
            // Show loading state
            const syncBtn = document.getElementById('sync-from-filesystem');
            if (syncBtn) {
                syncBtn.disabled = true;
                syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Synchronisation...';
            }
            
            const response = await fetch('/api/sync/filesystem', {
                method: 'POST'
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Erreur lors de la synchronisation');
            }
            
            const result = await response.json();
            this.showNotification(result.message || 'Synchronisation réussie', 'success');
            
            // Refresh templates and folders
            await this.loadTemplatesForManager();
            await this.loadFoldersForNavigation();
            
        } catch (error) {
            this.logger.error('Error syncing from filesystem:', error);
            this.showNotification(`Erreur: ${error.message}`, 'error');
        } finally {
            // Restore button state
            const syncBtn = document.getElementById('sync-from-filesystem');
            if (syncBtn) {
                syncBtn.disabled = false;
                syncBtn.innerHTML = '<i class="fas fa-sync mr-2"></i>Sync Filesystem';
            }
        }
    }
    
    /**
     * Filter templates (favorites/all)
     */
    async filterTemplates(filter) {
        this.logger.debug(`Filtering templates: ${filter}`);
        
        try {
            let url = '/api/templates';
            if (filter === 'favorites') {
                url += '?favorites=true';
            }
            
            const response = await fetch(url);
            if (!response.ok) return;
            
            const data = await response.json();
            const templates = data.data || [];
            
            // Update templates grid
            const templatesGrid = document.getElementById('templates-grid');
            if (!templatesGrid) return;
            
            templatesGrid.innerHTML = '';
            
            if (templates.length === 0) {
                templatesGrid.innerHTML = `
                    <div class="col-span-full text-center py-8">
                        <p class="text-gray-500 dark:text-gray-400">
                            ${filter === 'favorites' ? 'Aucun template favori' : 'Aucun template trouvé'}
                        </p>
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
            
            // Update folder title
            const titleElement = document.getElementById('current-folder-title');
            if (titleElement) {
                titleElement.textContent = filter === 'favorites' ? 'Templates favoris' : 'Tous les templates';
            }
            
        } catch (error) {
            this.logger.error('Error filtering templates:', error);
        }
    }
    
    /**
     * Apply markdown formatting
     */
    applyMarkdownFormat(action) {
        const editor = document.getElementById('markdown-editor');
        if (!editor) return;
        
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const selectedText = editor.value.substring(start, end);
        let replacement = '';
        
        switch (action) {
            case 'bold':
                replacement = `**${selectedText || 'texte en gras'}**`;
                break;
            case 'italic':
                replacement = `*${selectedText || 'texte en italique'}*`;
                break;
            case 'heading':
                replacement = `# ${selectedText || 'Titre'}`;
                break;
            case 'list':
                replacement = `- ${selectedText || 'élément de liste'}`;
                break;
            case 'quote':
                replacement = `> ${selectedText || 'citation'}`;
                break;
            case 'code':
                replacement = `\`${selectedText || 'code'}\``;
                break;
        }
        
        if (replacement) {
            editor.value = editor.value.substring(0, start) + replacement + editor.value.substring(end);
            editor.focus();
            this.updateMarkdownPreview();
        }
    }
    
    /**
     * Update markdown preview with debouncing
     */
    updateMarkdownPreview() {
        // Clear existing timeout to debounce rapid updates
        if (this.previewUpdateTimeout) {
            clearTimeout(this.previewUpdateTimeout);
        }
        
        // Debounce updates to avoid excessive processing
        this.previewUpdateTimeout = setTimeout(() => {
            this.doUpdateMarkdownPreview();
        }, 150); // 150ms debounce delay
    }
    
    /**
     * Perform the actual markdown preview update
     */
    doUpdateMarkdownPreview() {
        try {
            const editor = document.getElementById('markdown-editor');
            const preview = document.getElementById('markdown-preview');
            
            if (!editor || !preview) {
                this.logger.warn('Editor or preview element not found');
                return;
            }
            
            const content = editor.value;
            const trimmedContent = content.trim();
            
            if (trimmedContent) {
                // Use marked.js to parse markdown if available
                if (typeof marked !== 'undefined') {
                    try {
                        const htmlContent = marked.parse(content, {
                            breaks: true,
                            gfm: true,
                            sanitize: false
                        });
                        preview.innerHTML = htmlContent;
                    } catch (markedError) {
                        this.logger.warn('Marked.js parsing error:', markedError);
                        // Fallback to simple formatting
                        this.applySimpleFormatting(content, preview);
                    }
                } else {
                    // Fallback simple formatting
                    this.applySimpleFormatting(content, preview);
                }
                
                // Add styling classes to rendered content
                this.enhancePreviewStyling(preview);
                
            } else {
                // Empty content placeholder
                preview.innerHTML = '<p class="text-gray-500 dark:text-gray-400 italic">L\'aperçu apparaîtra ici...</p>';
            }
            
            // Scroll preview to maintain position if needed
            this.syncPreviewScroll();
            
        } catch (error) {
            this.logger.error('Error updating markdown preview:', error);
            const preview = document.getElementById('markdown-preview');
            if (preview) {
                preview.innerHTML = '<p class="text-red-500 italic">Erreur lors de la mise à jour de l\'aperçu</p>';
            }
        }
    }
    
    /**
     * Apply simple markdown formatting as fallback
     */
    applySimpleFormatting(content, preview) {
        const formatted = content
            // Headers
            .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mb-2 mt-4">$1</h3>')
            .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mb-3 mt-4">$1</h2>')
            .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mb-4 mt-4">$1</h1>')
            // Bold and italic
            .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
            .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
            // Code blocks
            .replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg my-2 overflow-x-auto"><code>$1</code></pre>')
            .replace(/`(.*?)`/g, '<code class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm">$1</code>')
            // Lists
            .replace(/^\* (.*$)/gim, '<li class="ml-4">• $1</li>')
            .replace(/^- (.*$)/gim, '<li class="ml-4">• $1</li>')
            // Line breaks
            .replace(/\n\n/g, '</p><p class="mb-2">')
            .replace(/\n/g, '<br>');
            
        preview.innerHTML = `<div class="prose dark:prose-invert max-w-none"><p class="mb-2">${formatted}</p></div>`;
    }
    
    /**
     * Enhance preview styling
     */
    enhancePreviewStyling(preview) {
        // Add classes to common elements
        const headers = preview.querySelectorAll('h1, h2, h3, h4, h5, h6');
        headers.forEach(header => {
            header.classList.add('text-gray-900', 'dark:text-white');
        });
        
        const codeBlocks = preview.querySelectorAll('pre');
        codeBlocks.forEach(block => {
            block.classList.add('bg-gray-100', 'dark:bg-gray-800', 'p-3', 'rounded-lg', 'my-2', 'overflow-x-auto');
        });
        
        const inlineCode = preview.querySelectorAll('code:not(pre code)');
        inlineCode.forEach(code => {
            code.classList.add('bg-gray-100', 'dark:bg-gray-800', 'px-1', 'py-0.5', 'rounded', 'text-sm');
        });
    }
    
    /**
     * Sync preview scroll position with editor if needed
     */
    syncPreviewScroll() {
        // This could be enhanced to sync scroll positions
        // For now, just ensure preview is visible
        const preview = document.getElementById('markdown-preview');
        if (preview && preview.scrollHeight > preview.clientHeight) {
            // Auto-scroll to bottom for new content
            const isNearBottom = preview.scrollTop > (preview.scrollHeight - preview.clientHeight - 100);
            if (isNearBottom) {
                preview.scrollTop = preview.scrollHeight;
            }
        }
    }
    
    /**
     * Initialize preview on application startup
     */
    initializePreview() {
        try {
            this.logger.debug('Initializing markdown preview...');
            
            // Initialize preview state
            this.previewUpdateTimeout = null;
            
            // Initial preview update
            this.updateMarkdownPreview();
            
            // Set up periodic refresh (every 30 seconds) to handle any edge cases
            this.previewRefreshInterval = setInterval(() => {
                const editor = document.getElementById('markdown-editor');
                if (editor && editor.value.trim()) {
                    this.updateMarkdownPreview();
                }
            }, 30000);
            
            this.logger.debug('Preview initialized successfully');
            
        } catch (error) {
            this.logger.error('Error initializing preview:', error);
        }
    }

    /**
     * Cleanup application resources
     */
    cleanup() {
        try {
            this.logger.info('🧹 Cleaning up application resources...');
            
            // Clean up navigation handlers
            this.cleanupNavigationHandlers();
            
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
            if (this.previewRefreshInterval) {
                clearInterval(this.previewRefreshInterval);
                this.previewRefreshInterval = null;
                this.logger.debug('Preview refresh interval cleared');
            }
            
            if (this.previewUpdateTimeout) {
                clearTimeout(this.previewUpdateTimeout);
                this.previewUpdateTimeout = null;
                this.logger.debug('Preview update timeout cleared');
            }
            
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
        
        // Make globally available for debugging and HTML onclick handlers
        if (appConfig.debug) {
            window.app = appInstance;
            window.logger = logger;
            window.state = stateManager;
        }
        
        // Always make app available for HTML onclick handlers
        window.app = appInstance;
        
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

// Expose clearSearch function globally for HTML onclick handlers
window.clearSearch = () => {
    if (appInstance) {
        appInstance.clearSearch();
    }
};

// Expose createNewTemplate function globally for HTML onclick handlers
window.createNewTemplate = () => {
    if (appInstance) {
        appInstance.createNewTemplate();
    }
};