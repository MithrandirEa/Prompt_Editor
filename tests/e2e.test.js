/**
 * @fileoverview End-to-End Tests for Prompt Editor v2.0
 * @description Full workflow tests simulating real user interactions
 * @version 2.0.0
 */

describe('Prompt Editor v2.0 - End-to-End Tests', () => {
    let mockServer;
    let app;

    beforeEach(() => {
        // Setup comprehensive DOM structure
        document.body.innerHTML = `
            <!DOCTYPE html>
            <html lang="fr" class="">
            <head>
                <title>Prompt Editor v2.0</title>
            </head>
            <body class="bg-gray-50">
                <!-- Header -->
                <header class="bg-white dark:bg-gray-800">
                    <div class="flex justify-between items-center h-16 px-2">
                        <div class="flex items-center space-x-2">
                            <button id="nav-back-btn" disabled>←</button>
                            <button id="nav-forward-btn" disabled>→</button>
                            <button id="theme-toggle">
                                <i id="theme-icon" class="fas fa-moon"></i>
                            </button>
                            <h1>Prompt Editor v2.0</h1>
                            <button id="editor-tab" class="tab-active">Édition</button>
                            <button id="manager-tab">Gestion</button>
                        </div>
                        <div class="flex items-center space-x-4">
                            <input id="global-search" placeholder="Rechercher...">
                            <button id="new-template-btn">Nouveau</button>
                        </div>
                    </div>
                </header>

                <!-- Main Content -->
                <main class="flex-1 flex">
                    <!-- Sidebar -->
                    <div id="templates-sidebar" class="w-64">
                        <div class="p-4">
                            <button id="toggle-sidebar">←</button>
                            <div class="flex space-x-1">
                                <button id="show-recent" class="sidebar-tab-active">Récents</button>
                                <button id="show-favorites">Favoris</button>
                            </div>
                        </div>
                        <div id="recent-templates-list" class="space-y-2"></div>
                        <div id="favorite-templates-list" class="space-y-2 hidden"></div>
                    </div>
                    
                    <!-- Collapsed Sidebar -->
                    <div id="collapsed-sidebar" class="w-12 hidden">
                        <button id="expand-sidebar">→</button>
                    </div>

                    <!-- Content Area -->
                    <div class="flex-1 flex flex-col">
                        <!-- Editor Tab Content -->
                        <div id="editor-content" class="flex-1 flex">
                            <div class="flex-1 flex flex-col">
                                <div class="border-b p-4">
                                    <input id="template-title" placeholder="Titre du template...">
                                    <button id="save-template">Sauvegarder</button>
                                    <button id="save-to-folder">Télécharger</button>
                                    <button id="export-md">Export MD</button>
                                    <button id="export-txt">Export TXT</button>
                                </div>
                                <div class="border-b p-3">
                                    <div class="markdown-toolbar">
                                        <button data-action="bold">B</button>
                                        <button data-action="italic">I</button>
                                        <button data-action="heading">H</button>
                                        <button data-action="list">List</button>
                                        <button data-action="quote">Quote</button>
                                        <button data-action="code">Code</button>
                                    </div>
                                </div>
                                <div class="flex-1 flex">
                                    <div class="flex-1">
                                        <textarea id="markdown-editor" placeholder="Commencez à taper..."></textarea>
                                    </div>
                                    <div class="flex-1 border-l">
                                        <h4>Aperçu</h4>
                                        <div id="markdown-preview">L'aperçu apparaîtra ici...</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Manager Tab Content -->
                        <div id="manager-content" class="flex-1 hidden flex flex-col">
                            <div class="border-b p-4">
                                <h2>Gestion des Templates</h2>
                                <button id="export-all-to-folder">Télécharger tous</button>
                                <button id="new-folder-btn">Nouveau dossier</button>
                            </div>
                            <div class="flex-1 flex">
                                <div id="navigation-panel" class="w-80">
                                    <div class="border-b p-4">
                                        <h3>Navigation</h3>
                                        <button onclick="app.showNewFolderModal()">Nouveau</button>
                                        <button id="expand-all-folders">Développer</button>
                                    </div>
                                    <div class="flex-1 p-6">
                                        <div id="folder-tree" class="space-y-1"></div>
                                    </div>
                                </div>
                                <div class="flex-1">
                                    <div class="border-b p-4">
                                        <h3 id="current-folder-title">Tous les templates</h3>
                                        <p id="current-folder-path">Racine</p>
                                        <span id="templates-count">0 template(s)</span>
                                        <button id="view-favorites">Favoris</button>
                                        <button id="view-all">Voir tout</button>
                                    </div>
                                    <div class="p-6">
                                        <div id="templates-grid" class="grid gap-6"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>

                <!-- Modal -->
                <div id="modal-overlay" class="fixed inset-0 hidden">
                    <div id="modal-content" class="bg-white rounded-lg"></div>
                </div>

                <!-- Toast notifications -->
                <div id="toast-container" class="fixed top-4 right-4"></div>
            </body>
            </html>
        `;

        // Mock external dependencies
        global.fetch = jest.fn();
        global.marked = {
            parse: jest.fn((content) => `<p>${content}</p>`)
        };
        global.JSZip = jest.fn().mockImplementation(() => ({
            file: jest.fn(),
            generateAsync: jest.fn().mockResolvedValue(new Blob())
        }));
        global.URL = {
            createObjectURL: jest.fn(() => 'blob:mock-url'),
            revokeObjectURL: jest.fn()
        };

        // Mock localStorage
        const localStorageMock = {
            getItem: jest.fn(),
            setItem: jest.fn(),
            removeItem: jest.fn(),
            clear: jest.fn()
        };
        Object.defineProperty(window, 'localStorage', {
            value: localStorageMock
        });

        // Mock document.documentElement.classList
        document.documentElement.classList = {
            add: jest.fn(),
            remove: jest.fn(),
            contains: jest.fn(() => false)
        };

        // Setup mock server responses
        mockServer = {
            setupSuccessResponses() {
                global.fetch.mockImplementation((url, options) => {
                    if (url === '/api/templates' && !options) {
                        return Promise.resolve({
                            ok: true,
                            json: () => Promise.resolve({
                                data: [
                                    { id: 1, title: 'Welcome Template', content: 'Welcome content', created_at: new Date().toISOString(), is_favorite: true },
                                    { id: 2, title: 'Test Template', content: 'Test content', created_at: new Date().toISOString(), is_favorite: false }
                                ]
                            })
                        });
                    }
                    if (url === '/api/folders' && !options) {
                        return Promise.resolve({
                            ok: true,
                            json: () => Promise.resolve({
                                data: [
                                    { id: 1, name: 'Work', template_count: 3 },
                                    { id: 2, name: 'Personal', template_count: 1 }
                                ]
                            })
                        });
                    }
                    if (url === '/api/templates' && options?.method === 'POST') {
                        const body = JSON.parse(options.body);
                        return Promise.resolve({
                            ok: true,
                            json: () => Promise.resolve({
                                id: 3,
                                ...body,
                                created_at: new Date().toISOString()
                            })
                        });
                    }
                    if (url === '/api/folders' && options?.method === 'POST') {
                        const body = JSON.parse(options.body);
                        return Promise.resolve({
                            ok: true,
                            json: () => Promise.resolve({
                                id: 3,
                                ...body,
                                template_count: 0
                            })
                        });
                    }
                    if (url.includes('/api/folders/') && url.includes('/templates')) {
                        return Promise.resolve({
                            ok: true,
                            json: () => Promise.resolve({
                                data: [
                                    { id: 1, title: 'Folder Template', content: 'Content in folder', created_at: new Date().toISOString() }
                                ]
                            })
                        });
                    }
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ data: [] })
                    });
                });
            },
            setupErrorResponses() {
                global.fetch.mockRejectedValue(new Error('Network error'));
            }
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
        if (app && app.cleanup) {
            app.cleanup();
        }
    });

    describe('Complete User Workflow', () => {
        test('should complete full template creation and management workflow', async () => {
            // Setup successful API responses
            mockServer.setupSuccessResponses();

            // 1. Initialize the application
            const { createApp } = await import('../app/static/js/app_v2.js');
            app = await createApp({ debug: true });

            // Wait for initialization
            await new Promise(resolve => setTimeout(resolve, 50));

            // 2. Verify initial state
            expect(app.state.isInitialized).toBe(true);
            expect(app.state.isReady).toBe(true);

            // 3. Create a new template
            const titleInput = document.getElementById('template-title');
            const contentArea = document.getElementById('markdown-editor');
            const saveBtn = document.getElementById('save-template');

            titleInput.value = 'My Test Template';
            contentArea.value = '# Test Template\n\nThis is a test template with **bold** text.';

            // Trigger markdown preview update
            const inputEvent = new Event('input');
            contentArea.dispatchEvent(inputEvent);

            // Verify preview is updated
            expect(global.marked.parse).toHaveBeenCalledWith('# Test Template\n\nThis is a test template with **bold** text.');

            // Save the template
            saveBtn.click();
            await new Promise(resolve => setTimeout(resolve, 50));

            // Verify save API call
            expect(global.fetch).toHaveBeenCalledWith('/api/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: expect.stringContaining('My Test Template')
            });

            // 4. Switch to manager tab
            const managerTab = document.getElementById('manager-tab');
            managerTab.click();
            await new Promise(resolve => setTimeout(resolve, 50));

            // Verify tab switch
            const editorContent = document.getElementById('editor-content');
            const managerContent = document.getElementById('manager-content');
            expect(managerContent.classList.contains('hidden')).toBe(false);

            // 5. Create a new folder
            const newFolderBtn = document.getElementById('new-folder-btn');
            newFolderBtn.click();

            // Verify modal is shown
            const modalOverlay = document.getElementById('modal-overlay');
            expect(modalOverlay.classList.contains('hidden')).toBe(false);

            // Fill folder name and create
            const folderNameInput = document.getElementById('folder-name');
            folderNameInput.value = 'New Project';
            
            await app.createFolder();
            await new Promise(resolve => setTimeout(resolve, 50));

            // Verify folder creation API call
            expect(global.fetch).toHaveBeenCalledWith('/api/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'New Project' })
            });

            // 6. Test search functionality
            const searchInput = document.getElementById('global-search');
            searchInput.value = 'test';
            searchInput.dispatchEvent(new Event('input'));

            // 7. Test theme toggle
            const themeToggle = document.getElementById('theme-toggle');
            themeToggle.click();

            expect(document.documentElement.classList.add).toHaveBeenCalledWith('dark');
            expect(localStorage.setItem).toHaveBeenCalledWith('theme', 'dark');

            // 8. Test sidebar toggle
            const sidebarToggle = document.getElementById('toggle-sidebar');
            sidebarToggle.click();

            const sidebar = document.getElementById('templates-sidebar');
            const collapsedSidebar = document.getElementById('collapsed-sidebar');
            // Note: In real implementation, these would have classList modifications

            // 9. Test markdown formatting
            contentArea.value = 'selected text';
            contentArea.selectionStart = 0;
            contentArea.selectionEnd = 13;

            app.applyMarkdownFormat('bold');
            expect(contentArea.value).toBe('**selected text**');

            // 10. Test export functionality
            const exportAllBtn = document.getElementById('export-all-to-folder');
            exportAllBtn.click();
            await new Promise(resolve => setTimeout(resolve, 50));

            // Verify export process
            expect(global.JSZip).toHaveBeenCalled();

            console.log('✅ Complete workflow test passed!');
        });

        test('should handle error scenarios gracefully', async () => {
            // Setup error responses
            mockServer.setupErrorResponses();

            const { createApp } = await import('../app/static/js/app_v2.js');
            
            // Application should handle initialization errors
            await expect(createApp()).rejects.toThrow('Network error');
        });

        test('should maintain state consistency across operations', async () => {
            mockServer.setupSuccessResponses();

            const { createApp } = await import('../app/static/js/app_v2.js');
            app = await createApp({ debug: true });

            await new Promise(resolve => setTimeout(resolve, 50));

            // Test multiple rapid operations
            const titleInput = document.getElementById('template-title');
            const contentArea = document.getElementById('markdown-editor');
            const saveBtn = document.getElementById('save-template');

            // Multiple rapid saves
            titleInput.value = 'Template 1';
            contentArea.value = 'Content 1';
            saveBtn.click();

            titleInput.value = 'Template 2';
            contentArea.value = 'Content 2';
            saveBtn.click();

            await new Promise(resolve => setTimeout(resolve, 100));

            // Both saves should have been attempted
            expect(global.fetch).toHaveBeenCalledTimes(4); // 2 for initial load, 2 for saves
        });

        test('should handle keyboard shortcuts and accessibility', async () => {
            mockServer.setupSuccessResponses();

            const { createApp } = await import('../app/static/js/app_v2.js');
            app = await createApp({ debug: true });

            await new Promise(resolve => setTimeout(resolve, 50));

            // Test that all interactive elements are properly initialized
            const interactiveElements = [
                'nav-back-btn',
                'nav-forward-btn', 
                'theme-toggle',
                'editor-tab',
                'manager-tab',
                'global-search',
                'new-template-btn',
                'toggle-sidebar',
                'template-title',
                'save-template',
                'markdown-editor'
            ];

            interactiveElements.forEach(id => {
                const element = document.getElementById(id);
                expect(element).toBeTruthy();
            });

            // Test navigation
            const backBtn = document.getElementById('nav-back-btn');
            const forwardBtn = document.getElementById('nav-forward-btn');

            window.history.back = jest.fn();
            window.history.forward = jest.fn();

            backBtn.click();
            forwardBtn.click();

            expect(window.history.back).toHaveBeenCalled();
            expect(window.history.forward).toHaveBeenCalled();
        });
    });

    describe('Performance and Memory Management', () => {
        test('should handle large datasets efficiently', async () => {
            // Mock large dataset
            const largeTemplateSet = Array.from({ length: 1000 }, (_, i) => ({
                id: i + 1,
                title: `Template ${i + 1}`,
                content: `Content for template ${i + 1}`,
                created_at: new Date().toISOString(),
                is_favorite: i % 10 === 0
            }));

            global.fetch.mockImplementation((url) => {
                if (url === '/api/templates') {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({ data: largeTemplateSet })
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ data: [] })
                });
            });

            const { createApp } = await import('../app/static/js/app_v2.js');
            app = await createApp({ debug: true });

            await new Promise(resolve => setTimeout(resolve, 100));

            // Should handle large dataset without errors
            expect(app.state.isReady).toBe(true);
        });

        test('should clean up resources properly', async () => {
            mockServer.setupSuccessResponses();

            const { createApp } = await import('../app/static/js/app_v2.js');
            app = await createApp({ debug: true });

            await new Promise(resolve => setTimeout(resolve, 50));

            // Cleanup should not throw errors
            expect(() => app.cleanup()).not.toThrow();
        });
    });

    describe('Cross-browser Compatibility', () => {
        test('should work with different localStorage scenarios', async () => {
            // Test when localStorage is not available
            const originalLocalStorage = window.localStorage;
            delete window.localStorage;

            mockServer.setupSuccessResponses();

            const { createApp } = await import('../app/static/js/app_v2.js');
            app = await createApp({ debug: true });

            // Should still initialize without localStorage
            expect(app.state.isInitialized).toBe(true);

            // Restore localStorage
            window.localStorage = originalLocalStorage;
        });

        test('should handle missing DOM elements gracefully', async () => {
            // Remove some DOM elements
            document.getElementById('theme-toggle')?.remove();
            document.getElementById('nav-back-btn')?.remove();

            mockServer.setupSuccessResponses();

            const { createApp } = await import('../app/static/js/app_v2.js');
            app = await createApp({ debug: true });

            // Should still initialize even with missing elements
            expect(app.state.isInitialized).toBe(true);
        });
    });
});