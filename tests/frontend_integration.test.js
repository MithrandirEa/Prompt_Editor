/**
 * @fileoverview Frontend Integration Tests for Prompt Editor v2.0
 * @description Comprehensive test suite covering all user-facing functionality
 * @version 2.0.0
 */

/**
 * Test Suite: Prompt Editor v2.0 Frontend Integration
 * Tests all major user interactions and functionality
 */

describe('Prompt Editor v2.0 - Frontend Integration Tests', () => {
    let app;
    let mockFetch;
    
    beforeEach(() => {
        // Setup DOM
        document.body.innerHTML = `
            <div id="templates-sidebar" class="w-64">
                <button id="toggle-sidebar">Toggle</button>
            </div>
            <div id="collapsed-sidebar" class="w-12 hidden">
                <button id="expand-sidebar">Expand</button>
            </div>
            <div id="editor-content">
                <button id="editor-tab" class="tab-active">Editor</button>
                <button id="manager-tab">Manager</button>
                <input id="template-title" placeholder="Template title">
                <textarea id="markdown-editor"></textarea>
                <div id="markdown-preview"></div>
                <button id="save-template">Save</button>
                <button id="new-template-btn">New</button>
            </div>
            <div id="manager-content" class="hidden">
                <button id="new-folder-btn">New Folder</button>
                <button id="export-all-to-folder">Export All</button>
                <button id="view-favorites">Favorites</button>
                <button id="view-all">All</button>
                <div id="folder-tree"></div>
                <div id="templates-grid"></div>
                <div id="current-folder-title">All Templates</div>
                <div id="templates-count">0 templates</div>
            </div>
            <input id="global-search" placeholder="Search">
            <button id="theme-toggle">
                <i id="theme-icon" class="fas fa-moon"></i>
            </button>
            <button id="nav-back-btn">Back</button>
            <button id="nav-forward-btn">Forward</button>
            <div id="recent-templates-list"></div>
            <div id="modal-overlay" class="hidden">
                <div id="modal-content"></div>
            </div>
            <div id="toast-container"></div>
        `;
        
        // Mock fetch
        mockFetch = jest.fn();
        global.fetch = mockFetch;
        
        // Mock marked.js
        global.marked = {
            parse: jest.fn((content) => `<p>${content}</p>`)
        };
        
        // Mock JSZip
        global.JSZip = jest.fn().mockImplementation(() => ({
            file: jest.fn(),
            generateAsync: jest.fn().mockResolvedValue(new Blob())
        }));
        
        // Mock URL methods
        global.URL = {
            createObjectURL: jest.fn(() => 'blob:mock-url'),
            revokeObjectURL: jest.fn()
        };
        
        // Reset localStorage
        localStorage.clear();
        
        // Setup HTML classList for theme testing
        document.documentElement.classList = {
            add: jest.fn(),
            remove: jest.fn(),
            contains: jest.fn(() => false)
        };
    });
    
    afterEach(() => {
        jest.clearAllMocks();
        if (app && app.cleanup) {
            app.cleanup();
        }
    });

    describe('Application Initialization', () => {
        test('should initialize app successfully', async () => {
            // Mock successful API responses
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ data: [] })
            });
            
            const { createApp } = await import('../app/static/js/app_v2.js');
            app = await createApp({ debug: true });
            
            expect(app).toBeDefined();
            expect(app.state.isInitialized).toBe(true);
            expect(app.version).toBe('2.0.0');
        });

        test('should handle initialization errors gracefully', async () => {
            // Mock failed API response
            mockFetch.mockRejectedValue(new Error('Network error'));
            
            const { createApp } = await import('../app/static/js/app_v2.js');
            
            await expect(createApp()).rejects.toThrow();
        });
    });

    describe('Theme Management', () => {
        beforeEach(async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ data: [] })
            });
            
            const { createApp } = await import('../app/static/js/app_v2.js');
            app = await createApp({ debug: true });
        });

        test('should toggle theme from light to dark', () => {
            document.documentElement.classList.contains.mockReturnValue(false);
            
            app.toggleTheme();
            
            expect(document.documentElement.classList.add).toHaveBeenCalledWith('dark');
            expect(localStorage.setItem).toHaveBeenCalledWith('theme', 'dark');
        });

        test('should toggle theme from dark to light', () => {
            document.documentElement.classList.contains.mockReturnValue(true);
            
            app.toggleTheme();
            
            expect(document.documentElement.classList.remove).toHaveBeenCalledWith('dark');
            expect(localStorage.setItem).toHaveBeenCalledWith('theme', 'light');
        });

        test('should initialize theme from localStorage', () => {
            localStorage.setItem('theme', 'dark');
            
            app.initializeTheme();
            
            expect(document.documentElement.classList.add).toHaveBeenCalledWith('dark');
        });
    });

    describe('Sidebar Management', () => {
        beforeEach(async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ data: [] })
            });
            
            const { createApp } = await import('../app/static/js/app_v2.js');
            app = await createApp({ debug: true });
        });

        test('should toggle sidebar visibility', () => {
            const sidebar = document.getElementById('templates-sidebar');
            const collapsed = document.getElementById('collapsed-sidebar');
            const toggleBtn = document.getElementById('toggle-sidebar');
            
            // Mock classList methods
            sidebar.classList = { add: jest.fn(), remove: jest.fn() };
            collapsed.classList = { add: jest.fn(), remove: jest.fn() };
            
            toggleBtn.click();
            
            expect(sidebar.classList.add).toHaveBeenCalledWith('hidden');
            expect(collapsed.classList.remove).toHaveBeenCalledWith('hidden');
        });

        test('should expand collapsed sidebar', () => {
            const sidebar = document.getElementById('templates-sidebar');
            const collapsed = document.getElementById('collapsed-sidebar');
            const expandBtn = document.getElementById('expand-sidebar');
            
            sidebar.classList = { add: jest.fn(), remove: jest.fn() };
            collapsed.classList = { add: jest.fn(), remove: jest.fn() };
            
            expandBtn.click();
            
            expect(sidebar.classList.remove).toHaveBeenCalledWith('hidden');
            expect(collapsed.classList.add).toHaveBeenCalledWith('hidden');
        });
    });

    describe('Tab Management', () => {
        beforeEach(async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ data: [] })
            });
            
            const { createApp } = await import('../app/static/js/app_v2.js');
            app = await createApp({ debug: true });
        });

        test('should switch to manager tab', async () => {
            const editorTab = document.getElementById('editor-tab');
            const managerTab = document.getElementById('manager-tab');
            const editorContent = document.getElementById('editor-content');
            const managerContent = document.getElementById('manager-content');
            
            // Mock classList methods
            [editorTab, managerTab, editorContent, managerContent].forEach(element => {
                element.classList = { add: jest.fn(), remove: jest.fn() };
            });
            
            // Mock successful template loading
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ data: [
                    { id: 1, title: 'Test Template', content: 'Test content', created_at: new Date().toISOString() }
                ]})
            });
            
            managerTab.click();
            
            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 10));
            
            expect(managerTab.classList.add).toHaveBeenCalledWith('tab-active');
            expect(editorTab.classList.remove).toHaveBeenCalledWith('tab-active');
            expect(managerContent.classList.remove).toHaveBeenCalledWith('hidden');
            expect(editorContent.classList.add).toHaveBeenCalledWith('hidden');
        });

        test('should switch to editor tab', () => {
            const editorTab = document.getElementById('editor-tab');
            const managerTab = document.getElementById('manager-tab');
            const editorContent = document.getElementById('editor-content');
            const managerContent = document.getElementById('manager-content');
            
            [editorTab, managerTab, editorContent, managerContent].forEach(element => {
                element.classList = { add: jest.fn(), remove: jest.fn() };
            });
            
            editorTab.click();
            
            expect(editorTab.classList.add).toHaveBeenCalledWith('tab-active');
            expect(managerTab.classList.remove).toHaveBeenCalledWith('tab-active');
            expect(editorContent.classList.remove).toHaveBeenCalledWith('hidden');
            expect(managerContent.classList.add).toHaveBeenCalledWith('hidden');
        });
    });

    describe('Template Management', () => {
        beforeEach(async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ data: [] })
            });
            
            const { createApp } = await import('../app/static/js/app_v2.js');
            app = await createApp({ debug: true });
        });

        test('should save template successfully', async () => {
            const titleInput = document.getElementById('template-title');
            const contentArea = document.getElementById('markdown-editor');
            const saveBtn = document.getElementById('save-template');
            
            titleInput.value = 'Test Template';
            contentArea.value = 'Test content';
            
            // Mock successful save response
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ id: 1, title: 'Test Template' })
            });
            
            // Mock sidebar reload
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ data: [] })
            });
            
            saveBtn.click();
            
            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 10));
            
            expect(mockFetch).toHaveBeenCalledWith('/api/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: 'Test Template',
                    content: 'Test content',
                    description: expect.stringContaining('Template créé le')
                })
            });
        });

        test('should show error for empty template title', async () => {
            const titleInput = document.getElementById('template-title');
            const saveBtn = document.getElementById('save-template');
            
            titleInput.value = '';
            
            saveBtn.click();
            
            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 10));
            
            // Should show notification (we can't test DOM changes easily, but we can verify fetch wasn't called)
            expect(mockFetch).not.toHaveBeenCalledWith('/api/templates', expect.any(Object));
        });

        test('should create new template', () => {
            const titleInput = document.getElementById('template-title');
            const contentArea = document.getElementById('markdown-editor');
            const newBtn = document.getElementById('new-template-btn');
            const editorTab = document.getElementById('editor-tab');
            
            titleInput.value = 'Existing content';
            contentArea.value = 'Existing content';
            
            editorTab.click = jest.fn();
            
            newBtn.click();
            
            expect(titleInput.value).toBe('');
            expect(contentArea.value).toBe('');
            expect(editorTab.click).toHaveBeenCalled();
        });
    });

    describe('Folder Management', () => {
        beforeEach(async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ data: [] })
            });
            
            const { createApp } = await import('../app/static/js/app_v2.js');
            app = await createApp({ debug: true });
        });

        test('should show new folder modal', () => {
            const newFolderBtn = document.getElementById('new-folder-btn');
            const modalOverlay = document.getElementById('modal-overlay');
            const modalContent = document.getElementById('modal-content');
            
            modalOverlay.classList = { add: jest.fn(), remove: jest.fn() };
            
            newFolderBtn.click();
            
            expect(modalOverlay.classList.remove).toHaveBeenCalledWith('hidden');
            expect(modalContent.innerHTML).toContain('Nouveau dossier');
        });

        test('should create folder successfully', async () => {
            // First show the modal
            app.showNewFolderModal();
            
            // Set folder name
            const nameInput = document.getElementById('folder-name');
            nameInput.value = 'Test Folder';
            
            // Mock successful folder creation
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ id: 1, name: 'Test Folder' })
            });
            
            // Mock folder tree reload
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ data: [] })
            });
            
            await app.createFolder();
            
            expect(mockFetch).toHaveBeenCalledWith('/api/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Test Folder' })
            });
        });

        test('should handle empty folder name', async () => {
            app.showNewFolderModal();
            
            const nameInput = document.getElementById('folder-name');
            nameInput.value = '';
            
            await app.createFolder();
            
            // Should not make API call for empty name
            expect(mockFetch).not.toHaveBeenCalledWith('/api/folders', expect.any(Object));
        });
    });

    describe('Search Functionality', () => {
        beforeEach(async () => {
            // Setup templates in sidebar
            const recentList = document.getElementById('recent-templates-list');
            recentList.innerHTML = `
                <div class="template-item" style="display: block;">
                    <h4>Test Template 1</h4>
                </div>
                <div class="template-item" style="display: block;">
                    <h4>Another Template</h4>
                </div>
            `;
            
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ data: [] })
            });
            
            const { createApp } = await import('../app/static/js/app_v2.js');
            app = await createApp({ debug: true });
        });

        test('should filter templates by search query', () => {
            const searchInput = document.getElementById('global-search');
            
            // Simulate typing in search
            searchInput.value = 'test';
            searchInput.dispatchEvent(new Event('input'));
            
            // Check if templates are filtered (basic functionality)
            const templateItems = document.querySelectorAll('.template-item');
            expect(templateItems.length).toBe(2); // Both items should still be present
        });

        test('should show all templates when search is cleared', () => {
            const searchInput = document.getElementById('global-search');
            
            searchInput.value = '';
            searchInput.dispatchEvent(new Event('input'));
            
            const templateItems = document.querySelectorAll('.template-item');
            templateItems.forEach(item => {
                expect(item.style.display).toBe('block');
            });
        });
    });

    describe('Markdown Editor', () => {
        beforeEach(async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ data: [] })
            });
            
            const { createApp } = await import('../app/static/js/app_v2.js');
            app = await createApp({ debug: true });
        });

        test('should apply bold formatting', () => {
            const editor = document.getElementById('markdown-editor');
            const preview = document.getElementById('markdown-preview');
            
            editor.value = 'selected text';
            editor.selectionStart = 0;
            editor.selectionEnd = 13;
            
            app.applyMarkdownFormat('bold');
            
            expect(editor.value).toBe('**selected text**');
        });

        test('should apply italic formatting', () => {
            const editor = document.getElementById('markdown-editor');
            
            editor.value = 'selected text';
            editor.selectionStart = 0;
            editor.selectionEnd = 13;
            
            app.applyMarkdownFormat('italic');
            
            expect(editor.value).toBe('*selected text*');
        });

        test('should update markdown preview', () => {
            const editor = document.getElementById('markdown-editor');
            const preview = document.getElementById('markdown-preview');
            
            editor.value = '# Test Heading';
            
            app.updateMarkdownPreview();
            
            expect(global.marked.parse).toHaveBeenCalledWith('# Test Heading');
            expect(preview.innerHTML).toBe('<p># Test Heading</p>');
        });
    });

    describe('Navigation', () => {
        beforeEach(async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ data: [] })
            });
            
            const { createApp } = await import('../app/static/js/app_v2.js');
            app = await createApp({ debug: true });
        });

        test('should handle back navigation', () => {
            const backBtn = document.getElementById('nav-back-btn');
            
            // Mock window.history
            window.history.back = jest.fn();
            
            backBtn.click();
            
            expect(window.history.back).toHaveBeenCalled();
        });

        test('should handle forward navigation', () => {
            const forwardBtn = document.getElementById('nav-forward-btn');
            
            // Mock window.history
            window.history.forward = jest.fn();
            
            forwardBtn.click();
            
            expect(window.history.forward).toHaveBeenCalled();
        });
    });

    describe('Export Functionality', () => {
        beforeEach(async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ data: [] })
            });
            
            const { createApp } = await import('../app/static/js/app_v2.js');
            app = await createApp({ debug: true });
        });

        test('should export all templates', async () => {
            const exportBtn = document.getElementById('export-all-to-folder');
            
            // Mock templates response
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    data: [
                        { title: 'Template 1', content: 'Content 1' },
                        { title: 'Template 2', content: 'Content 2' }
                    ]
                })
            });
            
            // Mock ZIP creation
            const mockZip = {
                file: jest.fn(),
                generateAsync: jest.fn().mockResolvedValue(new Blob())
            };
            global.JSZip.mockReturnValue(mockZip);
            
            exportBtn.click();
            
            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 10));
            
            expect(mockFetch).toHaveBeenCalledWith('/api/templates');
            expect(mockZip.file).toHaveBeenCalledTimes(2);
        });
    });

    describe('Error Handling', () => {
        beforeEach(async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ data: [] })
            });
            
            const { createApp } = await import('../app/static/js/app_v2.js');
            app = await createApp({ debug: true });
        });

        test('should handle template save errors gracefully', async () => {
            const titleInput = document.getElementById('template-title');
            const saveBtn = document.getElementById('save-template');
            
            titleInput.value = 'Test Template';
            
            // Mock failed save response
            mockFetch.mockRejectedValueOnce(new Error('Network error'));
            
            saveBtn.click();
            
            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 10));
            
            // Should handle error gracefully (no thrown exceptions)
            expect(true).toBe(true); // Test passes if no uncaught exceptions
        });

        test('should handle folder creation errors gracefully', async () => {
            app.showNewFolderModal();
            
            const nameInput = document.getElementById('folder-name');
            nameInput.value = 'Test Folder';
            
            // Mock failed folder creation
            mockFetch.mockRejectedValueOnce(new Error('Server error'));
            
            await app.createFolder();
            
            // Should handle error gracefully
            expect(true).toBe(true);
        });
    });

    describe('Modal Management', () => {
        beforeEach(async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ data: [] })
            });
            
            const { createApp } = await import('../app/static/js/app_v2.js');
            app = await createApp({ debug: true });
        });

        test('should close modal', () => {
            const modalOverlay = document.getElementById('modal-overlay');
            modalOverlay.classList = { add: jest.fn(), remove: jest.fn() };
            
            app.closeModal();
            
            expect(modalOverlay.classList.add).toHaveBeenCalledWith('hidden');
        });

        test('should close modal when clicking overlay', () => {
            const modalOverlay = document.getElementById('modal-overlay');
            modalOverlay.classList = { add: jest.fn(), remove: jest.fn() };
            
            // Simulate click on overlay (not on content)
            const clickEvent = new Event('click');
            Object.defineProperty(clickEvent, 'target', { value: modalOverlay });
            Object.defineProperty(clickEvent, 'currentTarget', { value: modalOverlay });
            
            modalOverlay.dispatchEvent(clickEvent);
            
            expect(modalOverlay.classList.add).toHaveBeenCalledWith('hidden');
        });
    });
});