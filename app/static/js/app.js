/**
 * Prompt Editor v2.0 - Main JavaScript Application
 * 
 * This module handles all client-side functionality including:
 * - Tab management and UI interactions
 * - Template editing and preview
 * - Folder management and template organization
 * - Export functionality and API communication
 */

const App = {
    // Application state
    state: {
        currentTab: 'editor',
        currentTemplate: null,
        currentFolder: null,
        selectedFolderId: null, // For new template creation
        templates: [],
        folders: [],
        isEditing: false,
        autoSaveTimeout: null,
        darkMode: false,
        draggedItem: null, // Item being dragged
        draggedType: null,  // 'folder' or 'template'
        isResizing: false, // Panel resizing state
        startX: 0, // Mouse start position for resizing
        startWidth: 0, // Panel start width for resizing
        navigationHistory: [], // History of visited pages/templates
        navigationIndex: -1, // Current position in history
        maxHistorySize: 50 // Maximum number of history entries
    },

    // Initialize the application
    init() {
        this.initializeTheme();
        
        // Wait for DOM to be fully loaded before binding events
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.bindEvents();
                this.loadInitialData();
                this.setupMarkdownPreview();
                this.setupAutoSave();
                this.initializeSidebar();
                this.initializeResizing();
                this.updateNavigationButtons();
            });
        } else {
            this.bindEvents();
            this.loadInitialData();
            this.setupMarkdownPreview();
            this.setupAutoSave();
            this.initializeSidebar();
            this.initializeResizing();
            this.updateNavigationButtons();
        }
        
        console.log('✅ Prompt Editor v2.0 initialized');
    },

    // Bind all event listeners
    bindEvents() {
        // Tab switching
        document.getElementById('editor-tab').addEventListener('click', () => {
            this.switchTab('editor');
        });
        
        document.getElementById('manager-tab').addEventListener('click', () => {
            this.switchTab('manager');
        });

        // Template actions
        document.getElementById('new-template-btn').addEventListener('click', () => {
            this.createNewTemplate();
        });

        document.getElementById('save-template').addEventListener('click', () => {
            this.saveCurrentTemplate();
        });

        // Export actions
        document.getElementById('export-md').addEventListener('click', () => {
            this.exportTemplate('md');
        });

        document.getElementById('export-txt').addEventListener('click', () => {
            this.exportTemplate('txt');
        });

        // Save to folder action
        document.getElementById('save-to-folder').addEventListener('click', () => {
            this.saveToFolderDialog();
        });

        // Folder actions
        document.getElementById('new-folder-btn').addEventListener('click', () => {
            this.createNewFolder();
        });

        // Export all templates to folder
        document.getElementById('export-all-to-folder').addEventListener('click', () => {
            this.exportAllToFolder();
        });

        // Theme toggle
        document.getElementById('theme-toggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Navigation buttons - with delay to ensure DOM is ready
        setTimeout(() => {
            this.bindNavigationButtons();
        }, 100);

        // Search functionality - using event delegation for reliability
        document.addEventListener('input', (e) => {
            console.log('📝 Input event detected on:', e.target, 'ID:', e.target.id, 'Value:', e.target.value);
            
            if (e.target && e.target.id === 'global-search') {
                console.log('✅ Search input event detected via delegation:', e.target.value);
                this.debounce(() => this.searchTemplates(e.target.value), 300);
            }
        });

        // Also try direct binding as backup
        setTimeout(() => {
            const searchElement = document.getElementById('global-search');
            if (searchElement) {
                console.log('✅ Direct binding - search element found');
                searchElement.addEventListener('input', (e) => {
                    console.log('✅ Direct search input:', e.target.value);
                    this.debounce(() => this.searchTemplates(e.target.value), 300);
                });
            } else {
                console.error('❌ Direct binding - search element not found');
            }
        }, 500);

        // Favorites filter buttons
        document.getElementById('view-favorites').addEventListener('click', () => {
            this.filterTemplates('favorites');
        });

        document.getElementById('view-all').addEventListener('click', () => {
            this.filterTemplates('all');
        });

        // Bind sidebar events (separate function to avoid duplication)
        this.bindSidebarEvents();

        // Markdown toolbar
        document.querySelectorAll('.markdown-toolbar button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.applyMarkdownFormat(action);
            });
        });

        // Template editor
        document.getElementById('markdown-editor').addEventListener('input', () => {
            this.updatePreview();
            this.scheduleAutoSave();
        });

        document.getElementById('template-title').addEventListener('input', () => {
            this.scheduleAutoSave();
        });

        // Bind events to sidebar template items
        this.bindSidebarTemplateEvents();

        // Modal handling
        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.closeModal();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });
    },

    // Bind sidebar-specific events (separate from main events)
    bindSidebarEvents(force = false) {
        console.log('🔗 Binding sidebar events, force:', force);
        
        // Sidebar toggle functionality
        const toggleBtn = document.getElementById('toggle-sidebar');
        const expandBtn = document.getElementById('expand-sidebar');
        const showRecentBtn = document.getElementById('show-recent');
        const showFavoritesBtn = document.getElementById('show-favorites');

        console.log('🔗 Sidebar elements found:', {
            toggleBtn: !!toggleBtn,
            expandBtn: !!expandBtn,
            showRecentBtn: !!showRecentBtn,
            showFavoritesBtn: !!showFavoritesBtn
        });

        if (toggleBtn && (!toggleBtn.dataset.eventBound || force)) {
            toggleBtn.addEventListener('click', () => {
                console.log('🔗 Toggle button clicked via event');
                this.toggleSidebar();
            });
            toggleBtn.dataset.eventBound = 'true';
            console.log('🔗 Toggle button event bound');
        }

        if (expandBtn && (!expandBtn.dataset.eventBound || force)) {
            expandBtn.addEventListener('click', () => {
                console.log('🔗 Expand button clicked via event');
                this.expandSidebar();
            });
            expandBtn.dataset.eventBound = 'true';
            console.log('🔗 Expand button event bound');
        }

        if (showRecentBtn && (!showRecentBtn.dataset.eventBound || force)) {
            showRecentBtn.addEventListener('click', () => this.showSidebarTab('recent'));
            showRecentBtn.dataset.eventBound = 'true';
        }

        if (showFavoritesBtn && (!showFavoritesBtn.dataset.eventBound || force)) {
            showFavoritesBtn.addEventListener('click', () => this.showSidebarTab('favorites'));
            showFavoritesBtn.dataset.eventBound = 'true';
        }
    },

    // Bind click events to sidebar template items
    bindSidebarTemplateEvents() {
        // Bind events to recent templates in sidebar
        const recentTemplates = document.querySelectorAll('#recent-templates-list .template-item');
        recentTemplates.forEach(item => {
            // Remove existing event listeners to prevent duplicates
            const newItem = item.cloneNode(true);
            item.parentNode.replaceChild(newItem, item);
            
            newItem.addEventListener('click', (e) => {
                // Prevent event if clicking on drag handle or other interactive elements
                if (e.target.closest('input') || e.target.closest('button')) {
                    return;
                }
                
                const templateId = parseInt(newItem.dataset.templateId);
                this.loadTemplate(templateId);
                
                // Switch to editor tab
                this.switchTab('editor');
            });
        });
    },

    // Setup search functionality with comprehensive retry mechanism
    setupSearchFunctionality() {
        console.log('Setting up search functionality...');
        
        const attemptSearchBinding = (attempt = 1) => {
            console.log(`Search binding attempt ${attempt}`);
            
            // Multiple ways to find the element
            const searchElement = document.getElementById('global-search') || 
                                document.querySelector('#global-search') ||
                                document.querySelector('input[placeholder="Rechercher..."]');
            
            console.log('Search element found:', searchElement);
            console.log('Document ready state:', document.readyState);
            console.log('All inputs in document:', document.querySelectorAll('input').length);
            
            if (searchElement) {
                // Remove any existing listeners by cloning the element
                const newSearchElement = searchElement.cloneNode(true);
                searchElement.parentNode.replaceChild(newSearchElement, searchElement);
                
                // Add the event listener
                newSearchElement.addEventListener('input', (e) => {
                    console.log('✅ Search input detected:', e.target.value);
                    this.debounce(() => this.searchTemplates(e.target.value), 300);
                });
                
                // Also add keydown for testing
                newSearchElement.addEventListener('keydown', (e) => {
                    console.log('✅ Search keydown detected:', e.key);
                });
                
                console.log('✅ Search event listeners successfully added');
                return true;
            } else {
                console.error(`❌ Search element not found on attempt ${attempt}`);
                
                if (attempt < 5) {
                    setTimeout(() => attemptSearchBinding(attempt + 1), 200 * attempt);
                } else {
                    console.error('❌ Failed to bind search after 5 attempts');
                    // Try one more time with document ready
                    if (document.readyState !== 'complete') {
                        window.addEventListener('load', () => {
                            console.log('🔄 Trying search binding after window load');
                            attemptSearchBinding(1);
                        });
                    }
                }
                return false;
            }
        };
        
        // Start the binding attempts
        attemptSearchBinding();
    },

    // Bind navigation buttons with retry mechanism
    bindNavigationButtons() {
        console.log('Attempting to bind navigation buttons...');
        
        const backBtn = document.getElementById('nav-back-btn');
        const forwardBtn = document.getElementById('nav-forward-btn');
        
        console.log('Navigation buttons found:', { 
            backBtn: backBtn ? 'found' : 'not found', 
            forwardBtn: forwardBtn ? 'found' : 'not found' 
        });
        
        if (backBtn) {
            // Remove any existing listeners
            backBtn.replaceWith(backBtn.cloneNode(true));
            const newBackBtn = document.getElementById('nav-back-btn');
            
            newBackBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Back button clicked');
                this.navigateBack();
            });
            console.log('Back button event listener added');
        } else {
            console.error('Back button not found! Retrying in 500ms...');
            setTimeout(() => this.bindNavigationButtons(), 500);
            return;
        }

        if (forwardBtn) {
            // Remove any existing listeners
            forwardBtn.replaceWith(forwardBtn.cloneNode(true));
            const newForwardBtn = document.getElementById('nav-forward-btn');
            
            newForwardBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Forward button clicked');
                this.navigateForward();
            });
            console.log('Forward button event listener added');
        } else {
            console.error('Forward button not found! Retrying in 500ms...');
            setTimeout(() => this.bindNavigationButtons(), 500);
        }
    },

    // Switch between editor and manager tabs
    switchTab(tab) {
        // Clear search results when switching tabs
        this.clearSearchResults();
        
        this.switchTabDirect(tab);
    },

    // Switch tabs without clearing search results
    switchTabDirect(tab) {
        console.log('🔄 switchTabDirect to:', tab);
        
        // Clear search results if we're in search mode
        const searchResults = document.getElementById('search-results-content');
        if (searchResults) {
            console.log('🧹 Search results detected, clearing before tab switch');
            this.clearSearchResults();
            
            // Wait for DOM restoration and then ensure sidebar events are bound
            setTimeout(() => {
                console.log('🔄 Post-switch sidebar events check and rebind');
                this.bindSidebarEvents(true);
            }, 200);
        }
        
        // Update button states
        document.querySelectorAll('[id$="-tab"]').forEach(btn => {
            btn.classList.remove('tab-active');
            btn.classList.add('text-gray-600', 'hover:bg-gray-100');
        });
        
        const activeTab = document.getElementById(`${tab}-tab`);
        if (activeTab) {
            activeTab.classList.add('tab-active');
            activeTab.classList.remove('text-gray-600', 'hover:bg-gray-100');
        }

        // Show/hide content
        const editorContent = document.getElementById('editor-content');
        const managerContent = document.getElementById('manager-content');
        
        console.log('🔄 Content elements found:', { 
            editorContent: !!editorContent, 
            managerContent: !!managerContent 
        });
        
        if (editorContent) {
            editorContent.classList.toggle('hidden', tab !== 'editor');
        }
        if (managerContent) {
            managerContent.classList.toggle('hidden', tab !== 'manager');
        }

        this.state.currentTab = tab;

        // Load tab-specific data
        if (tab === 'manager') {
            // Delay loading to ensure DOM is ready
            setTimeout(() => {
                this.loadTemplatesGrid();
                this.loadFolderTree();
            }, 100);
        }
        
        console.log('🔄 switchTabDirect completed for:', tab);
    },

    // Load initial data from API
    async loadInitialData() {
        try {
            await Promise.all([
                this.loadTemplates(),
                this.loadFolders()
            ]);
            
            // Bind events to sidebar templates after data is loaded
            setTimeout(() => {
                this.bindSidebarTemplateEvents();
            }, 100);
            
        } catch (error) {
            this.showToast('Erreur lors du chargement des données', 'error');
            console.error('Failed to load initial data:', error);
        }
    },

    // Load templates from API
    async loadTemplates(params = {}) {
        try {
            const queryString = new URLSearchParams(params).toString();
            const response = await fetch(`/api/templates?${queryString}`);
            const data = await response.json();
            
            if (data.status === 'success') {
                this.state.templates = data.data;
                return data.data;
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Failed to load templates:', error);
            throw error;
        }
    },

    // Load folders from API
    async loadFolders() {
        try {
            const response = await fetch('/api/folders');
            const data = await response.json();
            
            if (data.status === 'success') {
                this.state.folders = data.data;
                return data.data;
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Failed to load folders:', error);
            throw error;
        }
    },

    // Create new template
    createNewTemplate() {
        this.showNewTemplateModal();
    },

    // Show modal for creating new template with folder selection
    showNewTemplateModal() {
        const modalContent = document.getElementById('modal-content');
        modalContent.innerHTML = `
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Nouveau Template</h3>
            <form id="new-template-form">
                <div class="mb-4">
                    <label for="new-template-title" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Titre du template
                    </label>
                    <input 
                        type="text" 
                        id="new-template-title" 
                        class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Entrez le titre..."
                        required
                    />
                </div>
                
                <div class="mb-6">
                    <label for="new-template-folder" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Dossier de destination
                    </label>
                    <select 
                        id="new-template-folder" 
                        class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">Aucun dossier (racine)</option>
                        ${this.generateFolderOptions()}
                    </select>
                </div>
                
                <div class="flex justify-end space-x-3">
                    <button 
                        type="button" 
                        class="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                        onclick="App.closeModal()"
                    >
                        Annuler
                    </button>
                    <button 
                        type="submit" 
                        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Créer
                    </button>
                </div>
            </form>
        `;

        // Show modal
        document.getElementById('modal-overlay').classList.remove('hidden');

        // Focus on title input
        setTimeout(() => {
            document.getElementById('new-template-title').focus();
        }, 100);

        // Handle form submission
        document.getElementById('new-template-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleNewTemplateSubmit();
        });
    },

    // Generate folder options for select
    generateFolderOptions() {
        let options = '';
        const addFolderOptions = (folders, level = 0) => {
            folders.forEach(folder => {
                const indent = '&nbsp;'.repeat(level * 4);
                options += `<option value="${folder.id}">${indent}📁 ${folder.name}</option>`;
                if (folder.children && folder.children.length > 0) {
                    addFolderOptions(folder.children, level + 1);
                }
            });
        };

        if (this.state.folders && this.state.folders.length > 0) {
            addFolderOptions(this.state.folders);
        }
        return options;
    },

    // Handle new template form submission
    async handleNewTemplateSubmit() {
        const title = document.getElementById('new-template-title').value.trim();
        const folderId = document.getElementById('new-template-folder').value || null;

        if (!title) {
            this.showToast('Veuillez saisir un titre', 'warning');
            return;
        }

        // Close modal
        this.closeModal();

        // Switch to editor and set up new template
        this.switchTab('editor');
        
        // Clear editor
        document.getElementById('template-title').value = title;
        document.getElementById('markdown-editor').value = '';
        document.getElementById('markdown-preview').innerHTML = '<p class="text-gray-500 italic">L\'aperçu apparaîtra ici...</p>';
        
        this.state.currentTemplate = null;
        this.state.isEditing = true;
        this.state.selectedFolderId = folderId;
        
        // Initialize history for new template
        this.initializeHistory();
        
        // Focus on markdown editor
        document.getElementById('markdown-editor').focus();
    },

    // Save current template
    async saveCurrentTemplate() {
        const title = document.getElementById('template-title').value.trim();
        const content = document.getElementById('markdown-editor').value;

        if (!title) {
            this.showToast('Veuillez saisir un titre', 'warning');
            document.getElementById('template-title').focus();
            return;
        }

        // Standard save to application database
        try {
            const templateData = {
                title,
                content,
                description: '',
                folder_id: this.state.selectedFolderId || this.state.currentFolder?.id || null
            };

            let response;
            if (this.state.currentTemplate) {
                // Update existing template
                response = await fetch(`/api/templates/${this.state.currentTemplate.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(templateData)
                });
            } else {
                // Create new template
                response = await fetch('/api/templates', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(templateData)
                });
            }

            const data = await response.json();
            
            if (data.status === 'success') {
                this.state.currentTemplate = data.data;
                this.state.isEditing = false;
                this.state.selectedFolderId = null; // Reset selected folder ID
                this.showToast(
                    this.state.currentTemplate.id ? 'Template mis à jour' : 'Template créé',
                    'success'
                );
                
                // Refresh data
                await this.loadTemplates();
                this.updateRecentTemplates();
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Error saving template:', error);
            this.showToast('Erreur lors de la sauvegarde: ' + error.message, 'error');
        }
    },

    // Save template to filesystem folder
    async saveToFilesystemFolder(title, content) {
        try {
            if (!this.state.selectedDirectoryHandle) {
                this.showToast('Aucun dossier sélectionné', 'error');
                return;
            }

            // Create filename
            const filename = this.sanitizeFilename(title) + '.md';
            
            // Create file content with metadata
            const fileContent = this.createMarkdownFileContent(title, content);
            
            // Create file handle
            const fileHandle = await this.state.selectedDirectoryHandle.getFileHandle(filename, {
                create: true
            });
            
            // Write content
            const writable = await fileHandle.createWritable();
            await writable.write(fileContent);
            await writable.close();
            
            this.showToast(`Template sauvegardé: ${filename}`, 'success');
            
            // Reset state
            this.state.isEditing = false;
            this.state.saveToFilesystem = false;
            this.state.selectedDirectoryHandle = null;
            this.state.selectedFolderId = null;
            
        } catch (error) {
            console.error('Error saving to filesystem:', error);
            if (error.name === 'NotAllowedError') {
                this.showToast('Permission refusée pour écrire dans ce dossier', 'error');
            } else {
                this.showToast('Erreur lors de la sauvegarde: ' + error.message, 'error');
            }
        }
    },

    // Sanitize filename for filesystem
    sanitizeFilename(filename) {
        return filename.replace(/[^\w\s-\.]/g, '').replace(/\s+/g, '_').substring(0, 100);
    },

    // Create markdown file content with metadata
    createMarkdownFileContent(title, content) {
        const now = new Date().toISOString();
        return `---
title: "${title}"
created: ${now}
updated: ${now}
source: Prompt Editor v2
---

# ${title}

${content}`;
    },

    // Show dialog to save current template to filesystem folder
    async saveToFolderDialog() {
        const title = document.getElementById('template-title').value.trim();
        const content = document.getElementById('markdown-editor').value;

        if (!title) {
            this.showToast('Veuillez saisir un titre', 'warning');
            document.getElementById('template-title').focus();
            return;
        }

        // Create file content with metadata
        const fileContent = this.createMarkdownFileContent(title, content);
        const filename = this.sanitizeFilename(title) + '.md';

        // Try modern File System Access API (Chrome/Edge)
        if ('showSaveFilePicker' in window) {
            try {
                const fileHandle = await window.showSaveFilePicker({
                    suggestedName: filename,
                    types: [{
                        description: 'Fichiers Markdown',
                        accept: { 'text/markdown': ['.md'] }
                    }]
                });
                
                const writable = await fileHandle.createWritable();
                await writable.write(fileContent);
                await writable.close();
                
                this.showToast(`Template sauvegardé: ${fileHandle.name}`, 'success');
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('Error saving file:', error);
                    this.showToast('Erreur lors de la sauvegarde', 'error');
                }
            }
        } else {
            // Fallback for other browsers (Firefox, Safari)
            this.downloadFile(fileContent, filename, 'text/markdown');
            this.showToast(`Template téléchargé: ${filename}`, 'success');
        }
    },

    // Download file (fallback method for unsupported browsers)
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    // Export all templates to filesystem
    async exportAllToFolder() {
        if (this.state.templates.length === 0) {
            this.showToast('Aucun template à exporter', 'warning');
            return;
        }

        // Create a ZIP file containing all templates
        const JSZip = window.JSZip;
        if (!JSZip) {
            // Fallback: export as individual files
            this.exportTemplatesIndividually();
            return;
        }

        try {
            const zip = new JSZip();
            
            // Add each template to the zip
            this.state.templates.forEach(template => {
                const filename = this.sanitizeFilename(template.title) + '.md';
                const content = this.createMarkdownFileContent(template.title, template.content);
                zip.file(filename, content);
            });

            // Generate ZIP file
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            
            // Download the ZIP file
            const now = new Date().toISOString().split('T')[0];
            const zipFilename = `templates_export_${now}.zip`;
            this.downloadFile(zipBlob, zipFilename, 'application/zip');
            
            this.showToast(`${this.state.templates.length} templates exportés dans ${zipFilename}`, 'success');

        } catch (error) {
            console.error('Error creating zip:', error);
            // Fallback to individual files
            this.exportTemplatesIndividually();
        }
    },

    // Export templates as individual files (fallback)
    exportTemplatesIndividually() {
        let exportedCount = 0;
        
        this.state.templates.forEach((template, index) => {
            setTimeout(() => {
                const filename = this.sanitizeFilename(template.title) + '.md';
                const content = this.createMarkdownFileContent(template.title, template.content);
                this.downloadFile(content, filename, 'text/markdown');
                exportedCount++;
                
                if (exportedCount === this.state.templates.length) {
                    this.showToast(`${exportedCount} templates téléchargés individuellement`, 'success');
                }
            }, index * 100); // Small delay between downloads
        });
    },

    // Load template into editor
    async loadTemplate(templateId, addToHistory = true) {
        console.log('🔄 loadTemplate called with ID:', templateId, 'addToHistory:', addToHistory);
        
        try {
            console.log('🔄 Fetching template from API...');
            const response = await fetch(`/api/templates/${templateId}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('🔄 API response:', data);
            
            if (data.status === 'success') {
                const template = data.data;
                console.log('🔄 Template data:', template);
                
                // Switch to editor tab (this will clear search results if needed)
                console.log('🔄 Switching to editor tab...');
                this.switchTabDirect('editor');
                
                // Wait for DOM to be ready and for sidebar events to be bound
                await new Promise(resolve => setTimeout(resolve, 300));
                
                // Load template data with retry mechanism
                console.log('🔄 Loading template data into form...');
                let retries = 3;
                let titleElement, editorElement;
                
                do {
                    titleElement = document.getElementById('template-title');
                    editorElement = document.getElementById('markdown-editor');
                    
                    if (!titleElement || !editorElement) {
                        console.log(`🔄 Form elements not ready, retrying... (${retries} left)`);
                        await new Promise(resolve => setTimeout(resolve, 100));
                        retries--;
                    }
                } while ((!titleElement || !editorElement) && retries > 0);
                
                console.log('🔄 Form elements found:', { titleElement, editorElement });
                
                if (titleElement) {
                    titleElement.value = template.title || '';
                    console.log('🔄 Title set to:', template.title);
                } else {
                    console.error('❌ Title element not found after retries!');
                }
                
                if (editorElement) {
                    editorElement.value = template.content || '';
                    console.log('🔄 Content set, length:', (template.content || '').length);
                } else {
                    console.error('❌ Editor element not found after retries!');
                }
                
                this.state.currentTemplate = template;
                
                // Update preview with error handling
                try {
                    console.log('🔄 Updating preview...');
                    this.updatePreview();
                } catch (previewError) {
                    console.error('❌ Preview update failed:', previewError);
                }
                
                // Add to navigation history if requested
                if (addToHistory) {
                    try {
                        console.log('🔄 Adding to navigation history...');
                        this.addToNavigationHistory({
                            type: 'template',
                            id: template.id,
                            title: template.title
                        });
                    } catch (historyError) {
                        console.error('❌ Navigation history failed:', historyError);
                    }
                }
                
                // Initialize history for this template
                try {
                    console.log('🔄 Initializing history...');
                    this.initializeHistory();
                } catch (initError) {
                    console.error('❌ History initialization failed:', initError);
                }
                
                console.log('✅ Template loaded successfully');
                this.showToast(`Template "${template.title}" chargé`, 'info');
                
            } else {
                console.error('❌ API returned error:', data.message || 'Unknown error');
                throw new Error(data.message || 'Unknown API error');
            }
        } catch (error) {
            console.error('❌ loadTemplate error:', error);
            console.error('❌ Error stack:', error.stack);
            this.showToast(`Erreur lors du chargement du template: ${error.message}`, 'error');
            
            // Try to restore normal view on error
            try {
                this.clearSearchResults();
                this.switchTabDirect('editor');
            } catch (restoreError) {
                console.error('❌ Failed to restore view after error:', restoreError);
            }
        }
    },

    // Delete template
    async deleteTemplate(templateId) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer ce template ?')) {
            return;
        }

        try {
            const response = await fetch(`/api/templates/${templateId}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            
            if (data.status === 'success') {
                this.showToast('Template supprimé', 'success');
                
                // Clear editor if this template was loaded
                if (this.state.currentTemplate?.id === templateId) {
                    this.createNewTemplate();
                }
                
                // Refresh data
                await this.loadTemplates();
                this.loadTemplatesGrid();
                this.updateRecentTemplates();
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            this.showToast('Erreur lors de la suppression', 'error');
            console.error('Failed to delete template:', error);
        }
    },

    // Export template
    async exportTemplate(format) {
        if (!this.state.currentTemplate) {
            this.showToast('Aucun template sélectionné', 'warning');
            return;
        }

        try {
            const url = `/export/${format}/${this.state.currentTemplate.id}`;
            window.open(url, '_blank');
            this.showToast(`Export ${format.toUpperCase()} démarré`, 'info');
        } catch (error) {
            this.showToast('Erreur lors de l\'export', 'error');
            console.error('Failed to export template:', error);
        }
    },

    // Create new folder
    async createNewFolder() {
        this.showNewFolderModal();
    },

    // Show new folder modal
    showNewFolderModal() {
        const modalContent = document.getElementById('modal-content');
        modalContent.innerHTML = `
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Nouveau Dossier</h3>
            <form id="new-folder-form">
                <div class="mb-6">
                    <label for="new-folder-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Nom du dossier
                    </label>
                    <input 
                        type="text" 
                        id="new-folder-name" 
                        class="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Entrez le nom du dossier..."
                        required
                    />
                </div>
                
                <div class="flex justify-end space-x-3">
                    <button 
                        type="button" 
                        class="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                        onclick="App.closeModal()"
                    >
                        Annuler
                    </button>
                    <button 
                        type="submit" 
                        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Créer
                    </button>
                </div>
            </form>
        `;

        // Show modal
        document.getElementById('modal-overlay').classList.remove('hidden');

        // Focus on name input
        setTimeout(() => {
            document.getElementById('new-folder-name').focus();
        }, 100);

        // Handle form submission
        document.getElementById('new-folder-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleNewFolderSubmit();
        });
    },

    // Handle new folder form submission
    async handleNewFolderSubmit() {
        const name = document.getElementById('new-folder-name').value.trim();
        if (!name) return;

        try {
            const response = await fetch('/api/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name,
                    parent_id: this.state.currentFolder?.id || null
                })
            });

            const data = await response.json();
            
            if (data.status === 'success') {
                this.showToast('Dossier créé', 'success');
                await this.loadFolders();
                this.loadFolderTree();
                this.closeModal();
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            this.showToast('Erreur lors de la création du dossier', 'error');
            console.error('Failed to create folder:', error);
        }
    },

    // Search templates
    async searchTemplates(query) {
        console.log('searchTemplates called with query:', query);
        
        // If query is empty, restore normal view
        if (!query || query.trim() === '') {
            this.clearSearchResults();
            return;
        }
        
        try {
            const templates = await this.loadTemplates({ search: query });
            console.log('Search results:', templates);
            this.showSearchResults(templates, query);
        } catch (error) {
            console.error('Search failed:', error);
            // Show error message in search results
            this.showSearchResults([], query);
        }
    },

    // Show search results in main content area
    showSearchResults(templates, query) {
        console.log('🎯 showSearchResults called with:', templates.length, 'templates for query:', query);
        
        // Create search results container - use main directly
        const mainContent = document.querySelector('main');
        console.log('🎯 Main content element found:', mainContent);
        
        // Hide existing content
        const editorContent = document.getElementById('editor-content');
        const managerContent = document.getElementById('manager-content');
        
        console.log('🎯 Hiding existing content:', { editorContent, managerContent });
        
        if (editorContent) editorContent.classList.add('hidden');
        if (managerContent) managerContent.classList.add('hidden');
        
        // Remove existing search results if any
        const existingResults = document.getElementById('search-results-content');
        if (existingResults) {
            console.log('🎯 Removing existing search results');
            existingResults.remove();
        }
        
        // Create new search results container
        const searchContainer = document.createElement('div');
        searchContainer.id = 'search-results-content';
        searchContainer.className = 'flex-1 flex flex-col h-full bg-gray-50 dark:bg-gray-900';
        
        console.log('🎯 Created search container:', searchContainer);
        
        // Professional styled content
        searchContainer.innerHTML = `
            <div class="p-6">
                <div class="flex items-center justify-between mb-6">
                    <div>
                        <h2 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                            <i class="fas fa-search mr-3 text-blue-600"></i>
                            Résultats de recherche
                        </h2>
                        <p class="text-gray-600 dark:text-gray-400 mt-1">
                            ${templates.length} résultat(s) pour "<span class="font-medium text-blue-600 dark:text-blue-400">${query}</span>"
                        </p>
                    </div>
                    <button 
                        id="clear-search-btn"
                        class="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 flex items-center space-x-2"
                    >
                        <i class="fas fa-times"></i>
                        <span>Effacer la recherche</span>
                    </button>
                </div>
                
                <div id="search-results-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    <!-- Results will be inserted here -->
                </div>
            </div>
        `;
        
        // Add to main content
        if (mainContent) {
            // Clear main content completely first
            mainContent.innerHTML = '';
            mainContent.appendChild(searchContainer);
            console.log('🎯 Search container added to main content - CONTENT REPLACED');
        } else {
            console.error('❌ Main content not found, cannot add search container');
            // Try alternative selectors
            const alternatives = [
                document.querySelector('main'),
                document.querySelector('[class*="main"]'),
                document.querySelector('body')
            ];
            
            console.log('🔍 Trying alternative containers:', alternatives);
            
            for (let alt of alternatives) {
                if (alt) {
                    alt.appendChild(searchContainer);
                    console.log('✅ Added to alternative container:', alt);
                    break;
                }
            }
            return;
        }
        
        // Render templates in the search grid
        this.renderSearchResultsGrid(templates);
        
        // Add event listener for clear button
        setTimeout(() => {
            const clearBtn = document.getElementById('clear-search-btn');
            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    console.log('🎯 Clear button clicked');
                    this.clearSearchResults();
                    // Clear search input
                    const searchInput = document.getElementById('global-search');
                    if (searchInput) {
                        searchInput.value = '';
                    }
                });
                console.log('🎯 Clear button event listener added');
            }
        }, 100);
    },

    // Render templates in search results grid
    renderSearchResultsGrid(templates) {
        const grid = document.getElementById('search-results-grid');
        if (!grid) return;
        
        if (templates.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full text-center py-16">
                    <div class="flex flex-col items-center">
                        <i class="fas fa-search text-6xl text-gray-300 dark:text-gray-600 mb-4"></i>
                        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">Aucun template trouvé</h3>
                        <p class="text-gray-500 dark:text-gray-400">Essayez avec d'autres mots-clés</p>
                    </div>
                </div>
            `;
            return;
        }
        
        grid.innerHTML = templates.map(template => `
            <div class="template-card bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-lg hover:scale-[1.02] transition-all duration-200 p-5 cursor-pointer border border-gray-200 dark:border-gray-700 group"
                 data-template-id="${template.id}">
                
                <!-- Header with title and favorite -->
                <div class="flex items-start justify-between mb-4">
                    <h3 class="font-bold text-gray-900 dark:text-white text-lg leading-tight flex-1 mr-3 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        ${this.escapeHtml(template.title)}
                    </h3>
                    <div class="flex items-center space-x-2 flex-shrink-0">
                        ${template.is_favorite ? '<i class="fas fa-star text-yellow-500 text-lg"></i>' : ''}
                        <i class="fas fa-arrow-right text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100"></i>
                    </div>
                </div>
                
                <!-- Content preview -->
                <div class="mb-4">
                    <p class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-3">
                        ${template.content ? this.escapeHtml(template.content.substring(0, 150)) + (template.content.length > 150 ? '...' : '') : '<em class="text-gray-400">Pas de contenu</em>'}
                    </p>
                </div>
                
                <!-- Footer with metadata -->
                <div class="flex items-center justify-between text-xs pt-3 border-t border-gray-100 dark:border-gray-700">
                    <div class="flex items-center text-gray-500 dark:text-gray-400">
                        <i class="fas fa-clock mr-1"></i>
                        <span>${new Date(template.updated_at).toLocaleDateString('fr-FR')}</span>
                    </div>
                    ${template.folder_name ? `
                        <span class="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full font-medium flex items-center">
                            <i class="fas fa-folder mr-1 text-xs"></i>
                            ${this.escapeHtml(template.folder_name)}
                        </span>
                    ` : ''}
                </div>
                
                <!-- Hover overlay -->
                <div class="absolute inset-0 bg-blue-50 dark:bg-blue-900/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
            </div>
        `).join('');
        
        // Add enhanced click handlers with visual feedback
        grid.querySelectorAll('.template-card').forEach(card => {
            card.addEventListener('click', () => {
                console.log('🎯 Template card clicked');
                const templateId = parseInt(card.dataset.templateId);
                console.log('🎯 Template ID:', templateId);
                
                // Visual feedback
                card.classList.add('scale-95');
                setTimeout(() => card.classList.remove('scale-95'), 150);
                
                try {
                    console.log('🎯 Calling loadTemplate with ID:', templateId);
                    // Load template
                    this.loadTemplate(templateId);
                } catch (error) {
                    console.error('❌ Error in loadTemplate:', error);
                }
            });
            
            // Add keyboard navigation support
            card.setAttribute('tabindex', '0');
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    console.log('🎯 Template card activated via keyboard');
                    card.click();
                }
            });
        });
    },

    // Clear search results and restore normal view
    clearSearchResults() {
        console.log('🧹 Clearing search results');
        
        try {
            // Remove search results container
            const searchResults = document.getElementById('search-results-content');
            if (searchResults) {
                console.log('🧹 Removing search results container');
                searchResults.remove();
            } else {
                console.log('🧹 No search results container to remove');
            }
            
            // Check if main content structure needs restoration
            const mainElement = document.querySelector('main');
            const editorContent = document.getElementById('editor-content');
            const managerContent = document.getElementById('manager-content');
            
            console.log('🧹 Content structure check:', { 
                mainEmpty: mainElement && mainElement.children.length === 0,
                editorExists: !!editorContent,
                managerExists: !!managerContent
            });
            
            // Restore main content structure if needed
            if (mainElement && (mainElement.children.length === 0 || !editorContent || !managerContent)) {
                console.log('🧹 Restoring main structure...');
                
                // Recreate the complete main structure
                mainElement.innerHTML = `
                    <!-- Templates Sidebar -->
                    <div id="templates-sidebar" class="w-64 bg-white dark:bg-gray-800 shadow-sm border-r border-gray-200 dark:border-gray-700 transition-all duration-300">
                        <!-- Sidebar Header -->
                        <div class="p-4 border-b border-gray-200 dark:border-gray-700">
                            <div class="flex items-center justify-between">
                                <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide flex items-center">
                                    <i class="fas fa-file-alt mr-2 text-blue-600 dark:text-blue-400"></i>
                                    Templates
                                </h3>
                                <button 
                                    id="toggle-sidebar" 
                                    class="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                                    title="Réduire le panneau"
                                >
                                    <i class="fas fa-chevron-left"></i>
                                </button>
                            </div>
                        </div>
                        
                        <!-- Sidebar Content -->
                        <div class="flex-1 overflow-y-auto">
                            <!-- Filter Tabs -->
                            <div class="p-4 border-b border-gray-200 dark:border-gray-700">
                                <div class="flex space-x-1">
                                    <button 
                                        id="show-recent" 
                                        class="flex-1 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors sidebar-tab-active"
                                    >
                                        <i class="fas fa-clock mr-1"></i> Récents
                                    </button>
                                    <button 
                                        id="show-favorites" 
                                        class="flex-1 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                    >
                                        <i class="fas fa-star mr-1"></i> Favoris
                                    </button>
                                </div>
                            </div>
                            
                            <!-- Templates List -->
                            <div class="p-4">
                                <!-- Recent Templates -->
                                <div id="recent-templates-list" class="space-y-2">
                                    <!-- Templates will be loaded here -->
                                </div>
                                
                                <!-- Favorite Templates (initially hidden) -->
                                <div id="favorite-templates-list" class="space-y-2 hidden">
                                    <!-- Will be populated by JavaScript -->
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Collapsed Sidebar -->
                    <div id="collapsed-sidebar" class="w-12 bg-white dark:bg-gray-800 shadow-sm border-r border-gray-200 dark:border-gray-700 hidden">
                        <div class="p-3">
                            <button 
                                id="expand-sidebar" 
                                class="w-full p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                                title="Développer le panneau"
                            >
                                <i class="fas fa-chevron-right"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Content Area -->
                    <div class="flex-1 flex flex-col">
                        
                        <!-- Editor Tab Content -->
                        <div id="editor-content" class="flex-1 flex">
                            
                            <!-- Editor Panel -->
                            <div class="flex-1 flex flex-col bg-white dark:bg-gray-800">
                                
                                <!-- Editor Toolbar -->
                                <div class="border-b border-gray-200 dark:border-gray-700 p-4">
                                    <div class="flex items-center justify-between">
                                        <div class="flex items-center space-x-4">
                                            <input 
                                                type="text" 
                                                id="template-title" 
                                                placeholder="Titre du template..." 
                                                class="text-xl font-semibold bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 text-gray-900 dark:text-white"
                                                value=""
                                            >
                                        </div>
                                        
                                        <div class="flex items-center space-x-2">
                                            <button id="save-template" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200">
                                                <i class="fas fa-save mr-2"></i>Sauvegarder
                                            </button>
                                            
                                            <div class="flex items-center space-x-1 border-l border-gray-200 dark:border-gray-600 pl-2">
                                                <button id="save-to-folder" class="text-gray-600 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 px-2 py-1 rounded transition-colors duration-200" title="Télécharger comme fichier .md">
                                                    <i class="fas fa-download"></i>
                                                </button>
                                                <button id="export-md" class="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-2 py-1 rounded transition-colors duration-200" title="Exporter en Markdown">
                                                    <i class="fab fa-markdown"></i>
                                                </button>
                                                <button id="export-txt" class="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-2 py-1 rounded transition-colors duration-200" title="Exporter en texte">
                                                    <i class="fas fa-file-alt"></i>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Markdown Toolbar -->
                                <div class="border-b border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-900">
                                    <div class="markdown-toolbar flex items-center space-x-2">
                                        <button data-action="bold" class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 text-gray-700 dark:text-gray-300" title="Gras">
                                            <i class="fas fa-bold"></i>
                                        </button>
                                        <button data-action="italic" class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 text-gray-700 dark:text-gray-300" title="Italique">
                                            <i class="fas fa-italic"></i>
                                        </button>
                                        <button data-action="heading" class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 text-gray-700 dark:text-gray-300" title="Titre">
                                            <i class="fas fa-heading"></i>
                                        </button>
                                        <div class="w-px h-6 bg-gray-300 dark:bg-gray-600"></div>
                                        <button data-action="list" class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 text-gray-700 dark:text-gray-300" title="Liste">
                                            <i class="fas fa-list-ul"></i>
                                        </button>
                                        <button data-action="quote" class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 text-gray-700 dark:text-gray-300" title="Citation">
                                            <i class="fas fa-quote-left"></i>
                                        </button>
                                        <button data-action="code" class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 text-gray-700 dark:text-gray-300" title="Code">
                                            <i class="fas fa-code"></i>
                                        </button>
                                    </div>
                                </div>
                                
                                <!-- Editor Area -->
                                <div class="flex-1 flex">
                                    <div class="flex-1 p-4">
                                        <textarea 
                                            id="markdown-editor" 
                                            class="w-full h-full resize-none border-none focus:outline-none text-sm font-mono leading-relaxed custom-scrollbar bg-transparent text-gray-900 dark:text-white"
                                            placeholder="Commencez à taper votre prompt en Markdown..."
                                        ></textarea>
                                    </div>
                                    
                                    <!-- Live Preview -->
                                    <div class="flex-1 border-l border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900">
                                        <div class="h-full">
                                            <h4 class="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">Aperçu</h4>
                                            <div id="markdown-preview" class="markdown-preview custom-scrollbar overflow-y-auto h-full bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white">
                                                <p class="text-gray-500 dark:text-gray-400 italic">L'aperçu apparaîtra ici...</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Manager Tab Content -->
                        <div id="manager-content" class="flex-1 hidden flex flex-col h-full">
                            
                            <!-- Manager Toolbar -->
                            <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
                                <div class="flex items-center justify-between">
                                    <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Gestion des Templates</h2>
                                    
                                    <div class="flex items-center space-x-2">
                                        <button id="export-all-to-folder" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200">
                                            <i class="fas fa-download mr-2"></i>Télécharger tous
                                        </button>
                                        <button id="new-folder-btn" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200">
                                            <i class="fas fa-folder-plus mr-2"></i>Nouveau dossier
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Manager Content -->
                            <div class="flex-1 flex h-full">
                                
                                <!-- Folder Navigation Panel -->
                                <div id="navigation-panel" class="folder-space navigation-panel bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-600 flex flex-col h-full" style="width: 320px; min-width: 200px; max-width: 600px;">
                                    <!-- Navigation Header - Similar to Templates Header -->
                                    <div class="bg-white dark:bg-gray-800 border-b-2 border-gray-200 dark:border-gray-600 p-4 shadow-sm">
                                        <div class="flex items-center justify-between">
                                            <div class="flex items-center space-x-3">
                                                <i class="fas fa-folder-tree text-blue-600 dark:text-blue-400 text-lg"></i>
                                                <div>
                                                    <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">Navigation</h3>
                                                    <p class="text-xs text-gray-500 dark:text-gray-400">Arborescence des dossiers</p>
                                                </div>
                                            </div>
                                            <div class="flex items-center space-x-3">
                                                <button 
                                                    onclick="showNewFolderModal()" 
                                                    class="px-3 py-1.5 text-sm bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-lg transition-colors duration-200 flex items-center space-x-1" 
                                                    title="Nouveau dossier">
                                                    <i class="fas fa-plus"></i>
                                                    <span>Nouveau</span>
                                                </button>
                                                <button id="expand-all-folders" class="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors duration-200 flex items-center space-x-1" title="Tout développer">
                                                    <i class="fas fa-expand-arrows-alt"></i>
                                                    <span>Développer</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- Folder Tree - Full height -->
                                    <div class="flex-1 p-6 overflow-y-auto">
                                        <div id="folder-tree" class="space-y-1">
                                            <!-- Folder tree will be populated by JavaScript -->
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Resize Handle -->
                                <div id="resize-handle" class="w-1 bg-gray-300 dark:bg-gray-600 hover:bg-blue-500 dark:hover:bg-blue-400 cursor-col-resize transition-colors duration-200 flex-shrink-0 relative group">
                                    <div class="absolute inset-0 flex items-center justify-center">
                                        <div class="w-0.5 h-8 bg-gray-400 dark:bg-gray-500 group-hover:bg-blue-600 dark:group-hover:bg-blue-300 transition-colors duration-200"></div>
                                    </div>
                                </div>
                                
                                <!-- Templates Display Panel -->
                                <div class="templates-space flex-1 bg-white dark:bg-gray-800 custom-scrollbar overflow-y-auto">
                                    <!-- Templates Panel Header -->
                                    <div class="bg-white dark:bg-gray-800 border-b-2 border-gray-200 dark:border-gray-600 p-4 sticky top-0 z-10 shadow-sm">
                                        <div class="flex items-center justify-between">
                                            <div class="flex items-center space-x-3">
                                                <i class="fas fa-folder-open text-blue-600 dark:text-blue-400 text-lg"></i>
                                                <div>
                                                    <h3 id="current-folder-title" class="text-lg font-bold text-gray-900 dark:text-gray-100">Tous les templates</h3>
                                                    <p id="current-folder-path" class="text-xs text-gray-500 dark:text-gray-400">Racine</p>
                                                </div>
                                            </div>
                                            <div class="flex items-center space-x-3">
                                                <div class="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
                                                    <span id="templates-count">0 template(s)</span>
                                                </div>
                                                <div class="w-px h-6 bg-gray-300 dark:bg-gray-600"></div>
                                                <button id="view-favorites" class="px-3 py-1.5 text-sm bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-800 rounded-lg transition-colors duration-200 flex items-center space-x-1">
                                                    <i class="fas fa-star"></i>
                                                    <span>Voir favoris</span>
                                                </button>
                                                <button id="view-all" class="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors duration-200 flex items-center space-x-1">
                                                    <i class="fas fa-th-large"></i>
                                                    <span>Voir tout</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- Templates Grid -->
                                    <div class="p-6">
                                        <div id="templates-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            <!-- Template cards will be populated by JavaScript -->
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                
                // Reinitialize components after DOM recreation
                setTimeout(() => {
                    this.initializeSidebar();
                    this.initializeResizing();
                    this.initializeMarkdownEditor();
                    this.initializeMarkdownToolbar();
                    
                    // Re-bind only necessary event listeners for new DOM elements (force=true)
                    this.bindSidebarEvents(true);
                    this.bindSidebarTemplateEvents();
                    
                    // Re-bind manager events after DOM restoration
                    this.bindEvents();
                    
                    // Reload templates in sidebar
                    this.loadRecentTemplates();
                    
                    console.log('🧹 Components reinitialized after structure restoration');
                }, 100);
            }
            
            // Show the current tab content
            const currentTab = this.state.currentTab || 'editor';
            console.log('🧹 Restoring tab content for:', currentTab);
            
            const editorContentElement = document.getElementById('editor-content');
            const managerContentElement = document.getElementById('manager-content');
            
            console.log('🧹 Final content elements:', { 
                editorContent: !!editorContentElement, 
                managerContent: !!managerContentElement 
            });
            
            if (editorContentElement) {
                editorContentElement.classList.toggle('hidden', currentTab !== 'editor');
            }
            if (managerContentElement) {
                managerContentElement.classList.toggle('hidden', currentTab !== 'manager');
            }
            
            console.log('🧹 Search results cleared and interface restored');
            
        } catch (error) {
            console.error('❌ Error in clearSearchResults:', error);
        }
    },

    // Filter templates by type
    filterTemplates(type) {
        let templates = [...this.state.templates];
        let titleText = '';
        let pathText = '';
        
        // Update button states
        const favoriteBtn = document.getElementById('view-favorites');
        const allBtn = document.getElementById('view-all');
        
        favoriteBtn.classList.remove('bg-yellow-200', 'text-yellow-800');
        favoriteBtn.classList.add('bg-yellow-100', 'text-yellow-700');
        allBtn.classList.remove('bg-blue-200', 'text-blue-800');
        allBtn.classList.add('bg-gray-100', 'text-gray-700');
        
        if (type === 'favorites') {
            templates = templates.filter(t => t.is_favorite);
            titleText = 'Templates favoris';
            pathText = 'Favoris uniquement';
            favoriteBtn.classList.remove('bg-yellow-100', 'text-yellow-700');
            favoriteBtn.classList.add('bg-yellow-200', 'text-yellow-800');
        } else {
            titleText = this.state.currentFolder ? this.state.currentFolder.name : 'Tous les templates';
            pathText = this.state.currentFolder ? this.buildFolderPath(this.state.currentFolder) : 'Racine';
            allBtn.classList.remove('bg-gray-100', 'text-gray-700');
            allBtn.classList.add('bg-blue-200', 'text-blue-800');
        }
        
        // Update header
        document.getElementById('current-folder-title').textContent = titleText;
        document.getElementById('current-folder-path').textContent = pathText;
        
        // Render filtered templates
        this.renderTemplatesGrid(templates);
    },
    
    // Build folder path for breadcrumb
    buildFolderPath(folder) {
        const path = [];
        let current = folder;
        
        while (current) {
            path.unshift(current.name);
            current = this.state.folders.find(f => f.id === current.parent_id);
        }
        
        return path.length > 0 ? path.join(' > ') : 'Racine';
    },

    // Setup markdown preview
    setupMarkdownPreview() {
        this.updatePreview();
    },

    // Update markdown preview
    updatePreview() {
        const content = document.getElementById('markdown-editor').value;
        const preview = document.getElementById('markdown-preview');
        
        if (content.trim()) {
            try {
                // Check if marked is available
                if (typeof marked !== 'undefined') {
                    // Configure marked options for better rendering
                    marked.setOptions({
                        breaks: true,
                        gfm: true,
                        headerIds: false,
                        mangle: false
                    });
                    preview.innerHTML = marked.parse(content);
                } else {
                    // Fallback: simple HTML conversion
                    preview.innerHTML = this.simpleMarkdownToHtml(content);
                }
            } catch (error) {
                console.error('Markdown rendering error:', error);
                preview.innerHTML = '<p class="text-red-500">Erreur de rendu Markdown</p>';
            }
        } else {
            preview.innerHTML = '<p class="text-gray-500 italic">L\'aperçu apparaîtra ici...</p>';
        }
    },

    // Simple markdown to HTML converter (fallback)
    simpleMarkdownToHtml(markdown) {
        let html = markdown
            // Headers
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            // Bold
            .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
            // Italic
            .replace(/\*(.*)\*/gim, '<em>$1</em>')
            // Code
            .replace(/`(.*)`/gim, '<code>$1</code>');
        
        // Process lists
        const lines = html.split('\n');
        let inUl = false;
        let inOl = false;
        let result = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            
            // Unordered list
            if (trimmedLine.startsWith('- ')) {
                if (!inUl) {
                    if (inOl) {
                        result.push('</ol>');
                        inOl = false;
                    }
                    result.push('<ul>');
                    inUl = true;
                }
                result.push(`<li>${trimmedLine.substring(2)}</li>`);
            }
            // Ordered list
            else if (/^\d+\.\s/.test(trimmedLine)) {
                if (!inOl) {
                    if (inUl) {
                        result.push('</ul>');
                        inUl = false;
                    }
                    result.push('<ol>');
                    inOl = true;
                }
                result.push(`<li>${trimmedLine.replace(/^\d+\.\s/, '')}</li>`);
            }
            // Regular line
            else {
                if (inUl) {
                    result.push('</ul>');
                    inUl = false;
                }
                if (inOl) {
                    result.push('</ol>');
                    inOl = false;
                }
                if (trimmedLine) {
                    result.push(`<p>${line}</p>`);
                } else {
                    result.push('<br>');
                }
            }
        }
        
        // Close any open lists
        if (inUl) result.push('</ul>');
        if (inOl) result.push('</ol>');
        
        return result.join('\n');
    },

    // Apply markdown formatting
    applyMarkdownFormat(action) {
        const editor = document.getElementById('markdown-editor');
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const text = editor.value;
        const selectedText = text.substring(start, end);

        let replacement = '';
        let cursorOffset = 0;

        switch (action) {
            case 'bold':
                replacement = `**${selectedText || 'texte'}**`;
                cursorOffset = selectedText ? 0 : -2;
                break;
            case 'italic':
                replacement = `*${selectedText || 'texte'}*`;
                cursorOffset = selectedText ? 0 : -1;
                break;
            case 'heading':
                replacement = `# ${selectedText || 'Titre'}`;
                cursorOffset = selectedText ? 0 : -5;
                break;
            case 'list':
                replacement = selectedText 
                    ? selectedText.split('\n').map(line => `- ${line}`).join('\n')
                    : '- Élément de liste';
                break;
            case 'quote':
                replacement = selectedText
                    ? selectedText.split('\n').map(line => `> ${line}`).join('\n')
                    : '> Citation';
                break;
            case 'code':
                replacement = `\`${selectedText || 'code'}\``;
                cursorOffset = selectedText ? 0 : -1;
                break;
        }

        // Replace text
        editor.value = text.substring(0, start) + replacement + text.substring(end);
        
        // Set cursor position
        const newPosition = start + replacement.length + cursorOffset;
        editor.setSelectionRange(newPosition, newPosition);
        
        // Update preview
        this.updatePreview();
        editor.focus();
    },

    // Load templates grid in manager tab
    async loadTemplatesGrid() {
        try {
            const templates = await this.loadTemplates();
            this.renderTemplatesGrid(templates);
        } catch (error) {
            console.error('Failed to load templates grid:', error);
        }
    },

    // Render templates grid
    renderTemplatesGrid(templates) {
        const grid = document.getElementById('templates-grid');
        const countElement = document.getElementById('templates-count');
        
        // Check if grid element exists and is visible
        if (!grid) {
            console.error('❌ Templates grid element not found');
            return;
        }
        
        if (countElement) {
            countElement.textContent = `${templates.length} template(s)`;
        }
        
        if (!templates || templates.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full text-center py-16">
                    <i class="fas fa-folder-open text-6xl text-gray-300 mb-4"></i>
                    <p class="text-lg text-gray-500 mb-2">Aucun template trouvé</p>
                    <p class="text-sm text-gray-400">Créez votre premier template pour commencer</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = templates.map(template => `
            <div class="template-card bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 p-6 cursor-pointer hover:shadow-lg transition-all duration-300" 
                 data-template-id="${template.id}"
                 draggable="true"
                 ondragstart="App.handleDragStart(event, 'template', ${template.id})"
                 ondragend="App.handleDragEnd(event)"
                 ondragover="App.handleDragOver(event)"
                 ondrop="App.handleDrop(event, 'template', ${template.id})"
                 ondragenter="App.handleDragEnter(event)"
                 ondragleave="App.handleDragLeave(event)">
                
                <!-- Header with favorite checkbox -->
                <div class="flex items-start justify-between mb-4">
                    <h3 class="font-semibold text-gray-900 dark:text-white truncate flex-1 mr-3 text-lg">
                        ${this.escapeHtml(template.title)}
                    </h3>
                    <div class="flex items-center space-x-2">
                        <label class="flex items-center cursor-pointer group" title="Marquer comme favori">
                            <input type="checkbox" 
                                   class="favorite-checkbox" 
                                   data-template-id="${template.id}"
                                   ${template.is_favorite ? 'checked' : ''}
                                   onclick="event.stopPropagation()">
                        </label>
                    </div>
                </div>
                
                <!-- Description -->
                <p class="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-3 min-h-[3rem]">
                    ${this.escapeHtml(template.description || 'Aucune description disponible pour ce template.')}
                </p>
                
                <!-- Metadata -->
                <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-4 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                    <div class="flex items-center space-x-3">
                        <span class="flex items-center">
                            <i class="fas fa-clock mr-1"></i>
                            ${new Date(template.updated_at).toLocaleDateString('fr-FR')}
                        </span>
                        <span class="flex items-center">
                            <i class="fas fa-file-alt mr-1"></i>
                            ${template.content_length} caractères
                        </span>
                    </div>
                    ${template.folder_name ? `
                        <span class="flex items-center bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                            <i class="fas fa-folder mr-1"></i>
                            ${this.escapeHtml(template.folder_name)}
                        </span>
                    ` : ''}
                </div>
                
                <!-- Action buttons -->
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <button class="edit-template bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors duration-200 text-xs font-medium" 
                                data-template-id="${template.id}"
                                title="Éditer ce template">
                            <i class="fas fa-edit mr-1"></i>Éditer
                        </button>
                        <button class="duplicate-template text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-200 text-xs" 
                                data-template-id="${template.id}"
                                title="Dupliquer ce template">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                    <button class="delete-template text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 px-2 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900 transition-colors duration-200 text-xs"
                            data-template-id="${template.id}"
                            title="Supprimer ce template">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');

        // Bind events for template actions
        this.bindTemplateCardEvents(grid);
    },
    
    // Bind events for template cards
    bindTemplateCardEvents(grid) {
        // Edit template buttons
        grid.querySelectorAll('.edit-template').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.loadTemplate(parseInt(e.currentTarget.dataset.templateId));
            });
        });

        // Delete template buttons
        grid.querySelectorAll('.delete-template').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteTemplate(parseInt(e.currentTarget.dataset.templateId));
            });
        });
        
        // Duplicate template buttons
        grid.querySelectorAll('.duplicate-template').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.duplicateTemplate(parseInt(e.currentTarget.dataset.templateId));
            });
        });

        // Favorite checkboxes
        grid.querySelectorAll('.favorite-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                this.toggleTemplateFavorite(parseInt(e.target.dataset.templateId), e.target.checked);
            });
        });

        // Template card clicks (for preview or details)
        grid.querySelectorAll('.template-card').forEach(card => {
            card.addEventListener('click', () => {
                this.loadTemplate(parseInt(card.dataset.templateId));
            });
        });
    },

    // Load folder tree
    loadFolderTree() {
        const tree = document.getElementById('folder-tree');
        
        // Add "All Templates" root option
        const rootFolders = this.state.folders.filter(f => !f.parent_id);
        const allTemplatesCount = this.state.templates.length;
        
        let html = `
            <div class="folder-item ${!this.state.currentFolder ? 'active' : ''}" 
                 data-folder-id="root" 
                 onclick="selectFolder(null)"
                 ondragover="App.handleDragOver(event)"
                 ondrop="App.handleDrop(event, 'folder', null)"
                 ondragenter="App.handleDragEnter(event)"
                 ondragleave="App.handleDragLeave(event)">
                <div class="flex items-center justify-between py-2 px-3">
                    <div class="flex items-center space-x-2">
                        <i class="fas fa-home text-blue-600"></i>
                        <span class="text-sm font-medium">Tous les templates</span>
                    </div>
                    <span class="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
                        ${allTemplatesCount}
                    </span>
                </div>
            </div>
        `;
        
        // Add folder tree
        html += rootFolders.map(folder => this.renderFolderNode(folder, 0)).join('');
        tree.innerHTML = html;
        
        // Bind events for folder expansion
        this.bindFolderEvents();
    },

    // Render folder node with recursive children
    renderFolderNode(folder, level = 0) {
        const hasChildren = this.state.folders.some(f => f.parent_id === folder.id);
        const children = this.state.folders.filter(f => f.parent_id === folder.id);
        const isActive = this.state.currentFolder && this.state.currentFolder.id === folder.id;
        const isExpanded = this.state.expandedFolders?.includes(folder.id) || false;
        const indent = level * 16;
        
        let html = `
            <div class="folder-item ${isActive ? 'active' : ''}" 
                 data-folder-id="${folder.id}" 
                 style="margin-left: ${indent}px"
                 draggable="true"
                 ondragstart="App.handleDragStart(event, 'folder', ${folder.id})"
                 ondragend="App.handleDragEnd(event)"
                 ondragover="App.handleDragOver(event)"
                 ondrop="App.handleDrop(event, 'folder', ${folder.id})"
                 ondragenter="App.handleDragEnter(event)"
                 ondragleave="App.handleDragLeave(event)">
                <div class="flex items-center justify-between py-2 px-3" 
                     onclick="selectFolder(${folder.id})">
                    <div class="flex items-center space-x-2">
                        ${hasChildren ? `
                            <i class="folder-icon fas fa-chevron-right text-xs text-gray-400 cursor-pointer transition-transform ${isExpanded ? 'transform rotate-90' : ''}" 
                               onclick="event.stopPropagation(); toggleFolderExpansion(${folder.id})"></i>
                        ` : '<div class="w-3"></div>'}
                        <i class="fas ${isExpanded && hasChildren ? 'fa-folder-open' : 'fa-folder'} text-amber-500"></i>
                        <span class="text-sm">${this.escapeHtml(folder.name)}</span>
                    </div>
                    <span class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                        ${folder.templates_count || 0}
                    </span>
                </div>
            </div>
        `;
        
        // Add children if expanded
        if (isExpanded && hasChildren) {
            html += children.map(child => this.renderFolderNode(child, level + 1)).join('');
        }
        
        return html;
    },
    
    // Bind events for folder interaction
    bindFolderEvents() {
        // Initialize expanded folders state if not exists
        if (!this.state.expandedFolders) {
            this.state.expandedFolders = [];
        }
    },
    
    // Select folder and load its templates
    selectFolder(folderId) {
        this.state.currentFolder = folderId ? this.state.folders.find(f => f.id === folderId) : null;
        
        // Load templates for this folder
        let filteredTemplates;
        if (folderId) {
            filteredTemplates = this.state.templates.filter(t => t.folder_id === folderId);
        } else {
            filteredTemplates = this.state.templates;
        }
        
        // Update UI
        this.updateFolderTitle();
        this.renderTemplatesGrid(filteredTemplates);
        this.loadFolderTree(); // Refresh to show active state
    },
    
    // Toggle folder expansion
    toggleFolderExpansion(folderId) {
        if (!this.state.expandedFolders) {
            this.state.expandedFolders = [];
        }
        
        const index = this.state.expandedFolders.indexOf(folderId);
        if (index > -1) {
            this.state.expandedFolders.splice(index, 1);
        } else {
            this.state.expandedFolders.push(folderId);
        }
        
        this.loadFolderTree(); // Refresh to show expansion state
    },
    
    // Update folder title and breadcrumb
    updateFolderTitle() {
        const titleElement = document.getElementById('current-folder-title');
        const pathElement = document.getElementById('current-folder-path');
        
        if (this.state.currentFolder) {
            titleElement.textContent = this.state.currentFolder.name;
            pathElement.textContent = this.buildFolderPath(this.state.currentFolder);
        } else {
            titleElement.textContent = 'Tous les templates';
            pathElement.textContent = 'Racine';
        }
        
        // Reset filter buttons
        document.getElementById('view-all').classList.add('bg-blue-200', 'text-blue-800');
        document.getElementById('view-all').classList.remove('bg-gray-100', 'text-gray-700');
        document.getElementById('view-favorites').classList.add('bg-yellow-100', 'text-yellow-700');
        document.getElementById('view-favorites').classList.remove('bg-yellow-200', 'text-yellow-800');
    },

    // Toggle template favorite status
    async toggleTemplateFavorite(templateId, isFavorite) {
        try {
            const response = await fetch(`/api/templates/${templateId}/favorite`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    is_favorite: isFavorite
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to update favorite status');
            }
            
            // Update local state
            const template = this.state.templates.find(t => t.id === templateId);
            if (template) {
                template.is_favorite = isFavorite;
            }
            
            // Show notification
            this.showToast(
                isFavorite ? 'Ajouté aux favoris ⭐' : 'Retiré des favoris', 
                isFavorite ? 'success' : 'info'
            );
            
            // Update recent templates sidebar
            this.updateRecentTemplates();
            
        } catch (error) {
            console.error('Error toggling favorite:', error);
            this.showToast('Erreur lors de la mise à jour des favoris', 'error');
            
            // Revert checkbox state
            const checkbox = document.querySelector(`.favorite-checkbox[data-template-id="${templateId}"]`);
            if (checkbox) {
                checkbox.checked = !isFavorite;
            }
        }
    },
    
    // Duplicate template
    async duplicateTemplate(templateId) {
        try {
            const template = this.state.templates.find(t => t.id === templateId);
            if (!template) {
                throw new Error('Template not found');
            }
            
            const response = await fetch('/api/templates', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: `${template.title} (Copie)`,
                    content: template.content,
                    description: template.description,
                    folder_id: template.folder_id
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to duplicate template');
            }
            
            const newTemplate = await response.json();
            
            // Add to local state
            this.state.templates.unshift(newTemplate);
            
            // Refresh display
            if (this.state.currentTab === 'manager') {
                this.loadManagerData();
            }
            
            this.showToast('Template dupliqué avec succès 📄', 'success');
            
        } catch (error) {
            console.error('Error duplicating template:', error);
            this.showToast('Erreur lors de la duplication', 'error');
        }
    },

    // Update recent templates sidebar
    updateRecentTemplates() {
        // This would update the recent templates in the sidebar
        // Implementation depends on the specific requirements
    },

    // Setup auto-save functionality
    setupAutoSave() {
        // Auto-save implementation
    },

    // Schedule auto-save
    scheduleAutoSave() {
        if (this.state.autoSaveTimeout) {
            clearTimeout(this.state.autoSaveTimeout);
        }
        
        this.state.autoSaveTimeout = setTimeout(() => {
            if (this.state.isEditing && this.state.currentTemplate) {
                this.saveCurrentTemplate();
            }
        }, 5000); // Auto-save after 5 seconds of inactivity
    },

    // Handle keyboard shortcuts
    handleKeyboardShortcuts(e) {
        // Ctrl+S: Save
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            this.saveCurrentTemplate();
        }
        
        // Ctrl+N: New template
        if (e.ctrlKey && e.key === 'n') {
            e.preventDefault();
            this.createNewTemplate();
        }
        
        // Alt+Left: Navigate back
        if (e.altKey && e.key === 'ArrowLeft') {
            e.preventDefault();
            this.navigateBack();
        }
        
        // Alt+Right: Navigate forward
        if (e.altKey && e.key === 'ArrowRight') {
            e.preventDefault();
            this.navigateForward();
        }
        
        // Escape: Close modal
        if (e.key === 'Escape') {
            this.closeModal();
        }
    },

    // Show toast notification
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        }[type];
        
        toast.innerHTML = `
            <div class="flex items-center">
                <i class="${icon} mr-2"></i>
                <span>${this.escapeHtml(message)}</span>
                <button class="ml-auto text-gray-400 hover:text-gray-600" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        container.appendChild(toast);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 5000);
    },

    // Close modal
    closeModal() {
        document.getElementById('modal-overlay').classList.add('hidden');
    },

    // Utility: Escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // Navigation functions
    addToNavigationHistory(page) {
        console.log('Adding to navigation history:', page);
        
        // Remove any pages after current index (when going back then visiting new page)
        this.state.navigationHistory = this.state.navigationHistory.slice(0, this.state.navigationIndex + 1);
        
        // Add new page to history
        this.state.navigationHistory.push({
            type: page.type, // 'template' or 'folder'
            id: page.id,
            title: page.title,
            timestamp: Date.now()
        });
        
        // Update current index
        this.state.navigationIndex = this.state.navigationHistory.length - 1;
        
        console.log('Navigation history updated:', {
            history: this.state.navigationHistory,
            index: this.state.navigationIndex
        });
        
        // Limit history size (keep last 50 pages)
        if (this.state.navigationHistory.length > 50) {
            this.state.navigationHistory = this.state.navigationHistory.slice(-50);
            this.state.navigationIndex = 49;
        }
        
        this.updateNavigationButtons();
    },

    navigateBack() {
        console.log('navigateBack called', {
            currentIndex: this.state.navigationIndex,
            historyLength: this.state.navigationHistory.length,
            history: this.state.navigationHistory
        });
        
        if (this.state.navigationIndex > 0) {
            this.state.navigationIndex--;
            const page = this.state.navigationHistory[this.state.navigationIndex];
            console.log('Loading page from history:', page);
            this.loadHistoryPage(page);
            this.updateNavigationButtons();
        } else {
            console.log('Cannot go back - already at beginning');
        }
    },

    navigateForward() {
        console.log('navigateForward called', {
            currentIndex: this.state.navigationIndex,
            historyLength: this.state.navigationHistory.length,
            history: this.state.navigationHistory
        });
        
        if (this.state.navigationIndex < this.state.navigationHistory.length - 1) {
            this.state.navigationIndex++;
            const page = this.state.navigationHistory[this.state.navigationIndex];
            console.log('Loading page from history:', page);
            this.loadHistoryPage(page);
            this.updateNavigationButtons();
        } else {
            console.log('Cannot go forward - already at end');
        }
    },

    loadHistoryPage(page) {
        if (page.type === 'template') {
            this.loadTemplate(page.id, false); // false = don't add to history again
        }
        // For folders, we could implement folder navigation later
    },

    updateNavigationButtons() {
        const backBtn = document.getElementById('nav-back-btn');
        const forwardBtn = document.getElementById('nav-forward-btn');
        
        if (backBtn) {
            backBtn.disabled = this.state.navigationIndex <= 0;
        }
        
        if (forwardBtn) {
            forwardBtn.disabled = this.state.navigationIndex >= this.state.navigationHistory.length - 1;
        }
    },

    // Utility: Debounce function calls
    debounce(func, wait) {
        console.log('Debounce called with wait:', wait);
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
        }
        this.debounceTimeout = setTimeout(() => {
            console.log('Debounce timeout executed');
            func();
        }, wait);
    },

    // Initialize theme based on system preference and saved setting
    initializeTheme() {
        // Check for saved theme preference or default to system preference
        const savedTheme = localStorage.getItem('theme');
        const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        if (savedTheme === 'dark' || (savedTheme === null && systemDark)) {
            this.setDarkMode(true);
        } else {
            this.setDarkMode(false);
        }

        // Listen for system theme changes
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (localStorage.getItem('theme') === null) {
                    this.setDarkMode(e.matches);
                }
            });
        }
    },

    // Toggle between light and dark themes
    toggleTheme() {
        const newDarkMode = !this.state.darkMode;
        this.setDarkMode(newDarkMode);
        
        // Save user preference
        localStorage.setItem('theme', newDarkMode ? 'dark' : 'light');
        
        this.showToast(
            `Mode ${newDarkMode ? 'sombre' : 'clair'} activé`, 
            'info'
        );
    },

    // Set dark or light mode
    setDarkMode(isDark) {
        this.state.darkMode = isDark;
        const html = document.documentElement;
        const themeIcon = document.getElementById('theme-icon');
        
        if (isDark) {
            html.classList.add('dark');
            themeIcon.className = 'fas fa-sun';
            document.getElementById('theme-toggle').title = 'Basculer vers le mode clair';
        } else {
            html.classList.remove('dark');
            themeIcon.className = 'fas fa-moon';
            document.getElementById('theme-toggle').title = 'Basculer vers le mode sombre';
        }
        
        // Update meta theme-color for mobile browsers
        this.updateThemeColor(isDark);
    },

    // Sidebar management functions
    toggleSidebar() {
        console.log('🔄 toggleSidebar() called');
        const sidebar = document.getElementById('templates-sidebar');
        const collapsedSidebar = document.getElementById('collapsed-sidebar');
        
        console.log('🔄 Elements found:', { sidebar: !!sidebar, collapsedSidebar: !!collapsedSidebar });
        
        if (sidebar && collapsedSidebar) {
            sidebar.classList.add('hidden');
            collapsedSidebar.classList.remove('hidden');
            console.log('🔄 Sidebar collapsed');
        } else {
            console.error('❌ Sidebar elements not found');
        }
        
        // Save state
        localStorage.setItem('sidebarCollapsed', 'true');
    },

    expandSidebar() {
        console.log('🔄 expandSidebar() called');
        const sidebar = document.getElementById('templates-sidebar');
        const collapsedSidebar = document.getElementById('collapsed-sidebar');
        
        console.log('🔄 Elements found:', { sidebar: !!sidebar, collapsedSidebar: !!collapsedSidebar });
        
        if (sidebar && collapsedSidebar) {
            collapsedSidebar.classList.add('hidden');
            sidebar.classList.remove('hidden');
            console.log('🔄 Sidebar expanded');
        } else {
            console.error('❌ Sidebar elements not found');
        }
        
        // Save state
        localStorage.setItem('sidebarCollapsed', 'false');
    },

    showSidebarTab(tab) {
        const recentBtn = document.getElementById('show-recent');
        const favoritesBtn = document.getElementById('show-favorites');
        const recentList = document.getElementById('recent-templates-list');
        const favoritesList = document.getElementById('favorite-templates-list');
        
        // Update buttons
        recentBtn.classList.remove('sidebar-tab-active');
        favoritesBtn.classList.remove('sidebar-tab-active');
        
        if (tab === 'recent') {
            recentBtn.classList.add('sidebar-tab-active');
            recentList.classList.remove('hidden');
            favoritesList.classList.add('hidden');
        } else {
            favoritesBtn.classList.add('sidebar-tab-active');
            recentList.classList.add('hidden');
            favoritesList.classList.remove('hidden');
            this.loadFavoriteTemplates();
        }
    },

    loadFavoriteTemplates() {
        fetch('/api/templates?favorites=true')
            .then(response => response.json())
            .then(data => {
                const favoritesList = document.getElementById('favorite-templates-list');
                
                if (data.status === 'success' && data.data && data.data.length > 0) {
                    favoritesList.innerHTML = data.data.map(template => `
                        <div class="template-item p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 cursor-pointer transition-colors duration-200 bg-white dark:bg-gray-700"
                             data-template-id="${template.id}">
                            <div class="flex items-center justify-between">
                                <h4 class="text-sm font-medium text-gray-900 dark:text-white truncate">${template.title}</h4>
                                <i class="fas fa-star text-yellow-400 text-xs"></i>
                            </div>
                            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${new Date(template.updated_at).toLocaleDateString('fr-FR')}</p>
                        </div>
                    `).join('');
                    
                    // Add click events to favorite templates
                    favoritesList.querySelectorAll('.template-item').forEach(item => {
                        item.addEventListener('click', (e) => {
                            // Prevent event if clicking on drag handle or other interactive elements
                            if (e.target.closest('input') || e.target.closest('button')) {
                                return;
                            }
                            
                            const templateId = parseInt(item.dataset.templateId);
                            this.loadTemplate(templateId);
                            
                            // Switch to editor tab
                            this.switchTab('editor');
                        });
                    });
                } else {
                    favoritesList.innerHTML = `
                        <div class="text-center text-gray-500 dark:text-gray-400 py-8">
                            <i class="fas fa-star text-3xl mb-2"></i>
                            <p class="text-sm">Aucun template favori</p>
                        </div>
                    `;
                }
            })
            .catch(error => {
                console.error('Error loading favorite templates:', error);
                this.showToast('Erreur lors du chargement des favoris', 'error');
            });
    },

    // Initialize sidebar state
    initializeSidebar() {
        const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        if (isCollapsed) {
            this.toggleSidebar();
        }
    },

    // Update theme color meta tag for mobile browsers
    updateThemeColor(isDark) {
        let themeColorMeta = document.querySelector('meta[name="theme-color"]');
        if (!themeColorMeta) {
            themeColorMeta = document.createElement('meta');
            themeColorMeta.name = 'theme-color';
            document.head.appendChild(themeColorMeta);
        }
        themeColorMeta.content = isDark ? '#111827' : '#ffffff';
    },

    // Drag and Drop functionality
    handleDragStart(event, type, id) {
        this.state.draggedItem = id;
        this.state.draggedType = type;
        
        // Set drag effect
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', `${type}:${id}`);
        
        // Add visual feedback
        event.target.style.opacity = '0.5';
        event.target.classList.add('dragging');
        
        console.log(`Dragging ${type} with ID: ${id}`);
    },

    handleDragEnd(event) {
        // Reset visual feedback
        event.target.style.opacity = '1';
        event.target.classList.remove('dragging');
        
        // Clean up state
        this.state.draggedItem = null;
        this.state.draggedType = null;
    },

    handleDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    },

    handleDragEnter(event) {
        event.preventDefault();
        
        // Add visual feedback for drop zone
        const element = event.currentTarget;
        if (element.classList.contains('folder-item')) {
            element.classList.add('drag-over');
        }
    },

    handleDragLeave(event) {
        // Remove visual feedback when leaving drop zone
        const element = event.currentTarget;
        if (element.classList.contains('folder-item')) {
            element.classList.remove('drag-over');
        }
    },

    handleDrop(event, targetType, targetId) {
        event.preventDefault();
        
        // Remove visual feedback
        const element = event.currentTarget;
        element.classList.remove('drag-over');
        
        // Get dragged item info
        const draggedType = this.state.draggedType;
        const draggedId = this.state.draggedItem;
        
        // Prevent dropping on itself
        if (draggedType === targetType && draggedId === targetId) {
            return;
        }
        
        // Handle different drop scenarios
        if (targetType === 'folder') {
            if (draggedType === 'template') {
                this.moveTemplateToFolder(draggedId, targetId);
            } else if (draggedType === 'folder') {
                this.moveFolderToFolder(draggedId, targetId);
            }
        }
        
        // Clean up
        this.state.draggedItem = null;
        this.state.draggedType = null;
    },

    // Move template to a different folder
    async moveTemplateToFolder(templateId, folderId) {
        try {
            const response = await fetch(`/api/templates/${templateId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    folder_id: folderId // null for root
                })
            });

            if (response.ok) {
                const folderName = folderId 
                    ? this.state.folders.find(f => f.id === folderId)?.name 
                    : 'racine';
                this.showToast(`Template déplacé vers "${folderName}"`, 'success');
                // Reload data to reflect changes
                await this.loadInitialData();
                this.loadFolderTree();
                this.renderTemplatesGrid(this.state.templates);
            } else {
                throw new Error('Erreur lors du déplacement du template');
            }
        } catch (error) {
            console.error('Error moving template:', error);
            this.showToast('Erreur lors du déplacement du template', 'error');
        }
    },

    // Move folder to a different parent folder
    async moveFolderToFolder(folderId, parentFolderId) {
        // Prevent circular dependencies
        if (this.wouldCreateCircularDependency(folderId, parentFolderId)) {
            this.showToast('Impossible de déplacer le dossier : cela créerait une dépendance circulaire', 'error');
            return;
        }

        try {
            const response = await fetch(`/api/folders/${folderId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    parent_id: parentFolderId // null for root
                })
            });

            if (response.ok) {
                const parentName = parentFolderId 
                    ? this.state.folders.find(f => f.id === parentFolderId)?.name 
                    : 'racine';
                this.showToast(`Dossier déplacé vers "${parentName}"`, 'success');
                // Reload data to reflect changes
                await this.loadInitialData();
                this.loadFolderTree();
            } else {
                throw new Error('Erreur lors du déplacement du dossier');
            }
        } catch (error) {
            console.error('Error moving folder:', error);
            this.showToast('Erreur lors du déplacement du dossier', 'error');
        }
    },

    // Check if moving folder would create circular dependency
    wouldCreateCircularDependency(folderId, parentFolderId) {
        // If trying to move to itself, it's circular
        if (folderId === parentFolderId) {
            return true;
        }

        // Check if parentFolderId is a descendant of folderId
        const isDescendant = (checkFolderId, ancestorId) => {
            const folder = this.state.folders.find(f => f.id === checkFolderId);
            if (!folder || !folder.parent_id) {
                return false;
            }
            if (folder.parent_id === ancestorId) {
                return true;
            }
            return isDescendant(folder.parent_id, ancestorId);
        };

        return isDescendant(parentFolderId, folderId);
    },

    // Panel resizing functionality
    initializeResizing() {
        const resizeHandle = document.getElementById('resize-handle');
        const navigationPanel = document.getElementById('navigation-panel');
        
        if (!resizeHandle || !navigationPanel) return;
        
        // Load saved width from localStorage
        const savedWidth = localStorage.getItem('navigationPanelWidth');
        if (savedWidth) {
            navigationPanel.style.width = savedWidth + 'px';
        }
        
        resizeHandle.addEventListener('mousedown', (e) => {
            this.startResize(e);
        });
        
        // Add global mouse events for resizing
        document.addEventListener('mousemove', (e) => {
            this.handleResize(e);
        });
        
        document.addEventListener('mouseup', () => {
            this.stopResize();
        });
    },

    startResize(e) {
        this.state.isResizing = true;
        this.state.startX = e.clientX;
        this.state.startWidth = document.getElementById('navigation-panel').offsetWidth;
        
        // Add visual feedback
        document.body.classList.add('resizing');
        
        // Prevent text selection during resize
        e.preventDefault();
    },

    handleResize(e) {
        if (!this.state.isResizing) return;
        
        const navigationPanel = document.getElementById('navigation-panel');
        const deltaX = e.clientX - this.state.startX;
        const newWidth = this.state.startWidth + deltaX;
        
        // Enforce min/max constraints
        const minWidth = 200;
        const maxWidth = 600;
        const constrainedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
        
        navigationPanel.style.width = constrainedWidth + 'px';
    },

    stopResize() {
        if (!this.state.isResizing) return;
        
        this.state.isResizing = false;
        
        // Reset cursor and selection
        document.body.classList.remove('resizing');
        
        // Save the width to localStorage
        const navigationPanel = document.getElementById('navigation-panel');
        if (navigationPanel) {
            localStorage.setItem('navigationPanelWidth', navigationPanel.offsetWidth);
        }
    },

    // Undo/Redo functionality
    saveToHistory() {
        if (!this.state.currentTemplate) return;
        
        const editor = document.getElementById('markdown-editor');
        const titleInput = document.getElementById('template-title');
        
        if (!editor || !titleInput) return;
        
        const currentState = {
            title: titleInput.value,
            content: editor.value,
            timestamp: Date.now()
        };
        
        // Don't save if content hasn't changed
        const lastState = this.state.undoStack[this.state.undoStack.length - 1];
        if (lastState && 
            lastState.title === currentState.title && 
            lastState.content === currentState.content) {
            return;
        }
        
        // Add to undo stack
        this.state.undoStack.push(currentState);
        
        // Clear redo stack when new action is performed
        this.state.redoStack = [];
        
        // Limit history size
        if (this.state.undoStack.length > this.state.maxHistorySize) {
            this.state.undoStack.shift();
        }
        
        this.updateUndoRedoButtons();
    },

    undo() {
        if (this.state.undoStack.length <= 1) return;
        
        // Get current state and add to redo stack
        const editor = document.getElementById('markdown-editor');
        const titleInput = document.getElementById('template-title');
        
        if (!editor || !titleInput) return;
        
        const currentState = {
            title: titleInput.value,
            content: editor.value,
            timestamp: Date.now()
        };
        
        this.state.redoStack.push(currentState);
        
        // Remove current state from undo stack and get previous state
        this.state.undoStack.pop();
        const previousState = this.state.undoStack[this.state.undoStack.length - 1];
        
        if (previousState) {
            // Restore previous state
            titleInput.value = previousState.title;
            editor.value = previousState.content;
            
            // Update preview
            this.updatePreview();
            
            // Mark as editing
            this.state.isEditing = true;
        }
        
        this.updateUndoRedoButtons();
        this.showToast('Action annulée', 'info');
    },

    redo() {
        if (this.state.redoStack.length === 0) return;
        
        const editor = document.getElementById('markdown-editor');
        const titleInput = document.getElementById('template-title');
        
        if (!editor || !titleInput) return;
        
        // Get next state from redo stack
        const nextState = this.state.redoStack.pop();
        
        if (nextState) {
            // Add current state to undo stack
            const currentState = {
                title: titleInput.value,
                content: editor.value,
                timestamp: Date.now()
            };
            this.state.undoStack.push(currentState);
            
            // Restore next state
            titleInput.value = nextState.title;
            editor.value = nextState.content;
            
            // Update preview
            this.updatePreview();
            
            // Mark as editing
            this.state.isEditing = true;
        }
        
        this.updateUndoRedoButtons();
        this.showToast('Action refaite', 'info');
    },

    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        
        if (undoBtn) {
            undoBtn.disabled = this.state.undoStack.length <= 1;
        }
        
        if (redoBtn) {
            redoBtn.disabled = this.state.redoStack.length === 0;
        }
    },

    // Initialize history for current template
    initializeHistory() {
        this.state.undoStack = [];
        this.state.redoStack = [];
        
        // Save initial state
        this.saveToHistory();
        this.updateUndoRedoButtons();
    }
};

// Export for global access
window.App = App;

// Expose functions for onclick handlers
window.selectFolder = function(folderId) {
    App.selectFolder.call(App, folderId);
};

window.toggleFolderExpansion = function(folderId) {
    App.toggleFolderExpansion.call(App, folderId);
};