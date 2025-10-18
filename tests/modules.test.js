/**
 * @fileoverview Unit Tests for Prompt Editor v2.0 Core Modules
 * @description Test suite for individual modules (state, logger, errorHandler, etc.)
 * @version 2.0.0
 */

describe('Prompt Editor v2.0 - Core Module Tests', () => {
    
    describe('Logger Module', () => {
        let logger, DevLogger, performanceLogger;
        
        beforeEach(async () => {
            // Reset console methods
            console.log = jest.fn();
            console.error = jest.fn();
            console.warn = jest.fn();
            console.debug = jest.fn();
            
            const loggerModule = await import('../app/static/js/utils/logger.js');
            logger = loggerModule.logger;
            DevLogger = loggerModule.DevLogger;
            performanceLogger = loggerModule.performanceLogger;
        });

        test('should create logger with correct context', () => {
            const { createLogger } = require('../app/static/js/utils/logger.js');
            const testLogger = createLogger('TestModule');
            
            expect(testLogger).toBeDefined();
            expect(testLogger.info).toBeDefined();
            expect(testLogger.error).toBeDefined();
            expect(testLogger.warn).toBeDefined();
            expect(testLogger.debug).toBeDefined();
        });

        test('should log info messages', () => {
            logger.info('Test info message');
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('[INFO]'),
                expect.stringContaining('Test info message')
            );
        });

        test('should log error messages', () => {
            logger.error('Test error message');
            expect(console.error).toHaveBeenCalledWith(
                expect.stringContaining('[ERROR]'),
                expect.stringContaining('Test error message')
            );
        });

        test('should track performance metrics', () => {
            performanceLogger.start('testTimer');
            const endTime = performanceLogger.end('testTimer');
            
            expect(endTime).toBeGreaterThanOrEqual(0);
        });

        test('should enable debug mode', () => {
            DevLogger.enableDebug();
            expect(DevLogger.isEnabled()).toBe(true);
        });
    });

    describe('State Manager Module', () => {
        let stateManager, State;
        
        beforeEach(async () => {
            const stateModule = await import('../app/static/js/core/state.js');
            stateManager = stateModule.stateManager;
            State = stateModule.State;
            
            // Reset state
            stateManager.reset();
        });

        test('should initialize with default state', () => {
            expect(State.getPrompts()).toEqual([]);
            expect(State.getCurrentPrompt()).toBeNull();
            expect(State.getFolders()).toEqual([]);
        });

        test('should set and get prompts', () => {
            const testPrompts = [
                { id: 1, title: 'Test 1', content: 'Content 1' },
                { id: 2, title: 'Test 2', content: 'Content 2' }
            ];
            
            State.setPrompts(testPrompts);
            expect(State.getPrompts()).toEqual(testPrompts);
        });

        test('should set and get current prompt', () => {
            const testPrompt = { id: 1, title: 'Test', content: 'Content' };
            
            State.setCurrentPrompt(testPrompt);
            expect(State.getCurrentPrompt()).toEqual(testPrompt);
        });

        test('should add single prompt', () => {
            const testPrompt = { id: 1, title: 'Test', content: 'Content' };
            
            State.addPrompt(testPrompt);
            expect(State.getPrompts()).toContain(testPrompt);
        });

        test('should update existing prompt', () => {
            const originalPrompt = { id: 1, title: 'Original', content: 'Original content' };
            const updatedPrompt = { id: 1, title: 'Updated', content: 'Updated content' };
            
            State.addPrompt(originalPrompt);
            State.updatePrompt(1, updatedPrompt);
            
            expect(State.getPrompts()[0]).toEqual(updatedPrompt);
        });

        test('should remove prompt', () => {
            const testPrompt = { id: 1, title: 'Test', content: 'Content' };
            
            State.addPrompt(testPrompt);
            State.removePrompt(1);
            
            expect(State.getPrompts()).not.toContain(testPrompt);
        });

        test('should manage folders', () => {
            const testFolders = [
                { id: 1, name: 'Folder 1' },
                { id: 2, name: 'Folder 2' }
            ];
            
            State.setFolders(testFolders);
            expect(State.getFolders()).toEqual(testFolders);
        });

        test('should emit events on state changes', () => {
            const mockListener = jest.fn();
            stateManager.addEventListener('prompts_updated', mockListener);
            
            State.setPrompts([{ id: 1, title: 'Test' }]);
            
            expect(mockListener).toHaveBeenCalled();
        });
    });

    describe('Error Handler Module', () => {
        let errorHandler, handleError, createError, ErrorType, ErrorCode;
        
        beforeEach(async () => {
            const errorModule = await import('../app/static/js/utils/errorHandler.js');
            errorHandler = errorModule.errorHandler;
            handleError = errorModule.handleError;
            createError = errorModule.createError;
            ErrorType = errorModule.ErrorType;
            ErrorCode = errorModule.ErrorCode;
            
            console.error = jest.fn();
        });

        test('should create error with correct structure', () => {
            const error = createError(
                'Test error message',
                ErrorCode.VALIDATION_ERROR,
                ErrorType.USER_INPUT,
                { field: 'test' }
            );
            
            expect(error.message).toBe('Test error message');
            expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
            expect(error.type).toBe(ErrorType.USER_INPUT);
            expect(error.context).toEqual({ field: 'test' });
            expect(error.timestamp).toBeDefined();
        });

        test('should handle error and log it', () => {
            const error = createError('Test error', ErrorCode.UNKNOWN, ErrorType.UNKNOWN);
            
            handleError(error);
            
            expect(console.error).toHaveBeenCalledWith(
                expect.stringContaining('[ERROR]'),
                expect.stringContaining('Test error')
            );
        });

        test('should emit error events', () => {
            const mockListener = jest.fn();
            errorHandler.addEventListener('error_occurred', mockListener);
            
            const error = createError('Test error', ErrorCode.UNKNOWN, ErrorType.UNKNOWN);
            handleError(error);
            
            expect(mockListener).toHaveBeenCalled();
        });

        test('should track error statistics', () => {
            const error1 = createError('Error 1', ErrorCode.NETWORK_ERROR, ErrorType.SYSTEM);
            const error2 = createError('Error 2', ErrorCode.VALIDATION_ERROR, ErrorType.USER_INPUT);
            
            handleError(error1);
            handleError(error2);
            
            const stats = errorHandler.getStats();
            expect(stats.totalErrors).toBe(2);
            expect(stats.errorsByType[ErrorType.SYSTEM]).toBe(1);
            expect(stats.errorsByType[ErrorType.USER_INPUT]).toBe(1);
        });
    });

    describe('API Client Module', () => {
        let apiClient;
        let mockFetch;
        
        beforeEach(async () => {
            mockFetch = jest.fn();
            global.fetch = mockFetch;
            
            const apiModule = await import('../app/static/js/managers/apiClient.js');
            apiClient = apiModule.apiClient;
        });

        test('should make GET request', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ data: 'test' })
            });
            
            const result = await apiClient.get('/test');
            
            expect(mockFetch).toHaveBeenCalledWith('/test', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            expect(result).toEqual({ data: 'test' });
        });

        test('should make POST request', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ id: 1 })
            });
            
            const testData = { title: 'Test', content: 'Content' };
            const result = await apiClient.post('/templates', testData);
            
            expect(mockFetch).toHaveBeenCalledWith('/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(testData)
            });
            expect(result).toEqual({ id: 1 });
        });

        test('should handle API errors', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 404,
                statusText: 'Not Found'
            });
            
            await expect(apiClient.get('/nonexistent')).rejects.toThrow('API Error: 404 Not Found');
        });

        test('should handle network errors', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));
            
            await expect(apiClient.get('/test')).rejects.toThrow('Network error');
        });

        test('should track request statistics', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({})
            });
            
            await apiClient.get('/test');
            await apiClient.post('/test', {});
            
            const stats = apiClient.getStats();
            expect(stats.totalRequests).toBe(2);
            expect(stats.successfulRequests).toBe(2);
            expect(stats.failedRequests).toBe(0);
        });
    });

    describe('Template Manager Module', () => {
        let templateManager;
        let mockApiClient;
        
        beforeEach(async () => {
            // Mock API client
            mockApiClient = {
                get: jest.fn(),
                post: jest.fn(),
                put: jest.fn(),
                delete: jest.fn()
            };
            
            const templateModule = await import('../app/static/js/managers/templateManager.js');
            templateManager = templateModule.templateManager;
            
            // Inject mock API client
            templateManager.apiClient = mockApiClient;
        });

        test('should load templates', async () => {
            const mockTemplates = [
                { id: 1, title: 'Template 1', content: 'Content 1' },
                { id: 2, title: 'Template 2', content: 'Content 2' }
            ];
            
            mockApiClient.get.mockResolvedValue({ data: mockTemplates });
            
            await templateManager.loadTemplates();
            
            expect(mockApiClient.get).toHaveBeenCalledWith('/api/templates');
        });

        test('should save template', async () => {
            const templateData = { title: 'New Template', content: 'New content' };
            mockApiClient.post.mockResolvedValue({ id: 3, ...templateData });
            
            const result = await templateManager.saveTemplate(templateData);
            
            expect(mockApiClient.post).toHaveBeenCalledWith('/api/templates', templateData);
            expect(result).toEqual({ id: 3, ...templateData });
        });

        test('should update template', async () => {
            const templateData = { title: 'Updated Template', content: 'Updated content' };
            mockApiClient.put.mockResolvedValue({ id: 1, ...templateData });
            
            const result = await templateManager.updateTemplate(1, templateData);
            
            expect(mockApiClient.put).toHaveBeenCalledWith('/api/templates/1', templateData);
            expect(result).toEqual({ id: 1, ...templateData });
        });

        test('should delete template', async () => {
            mockApiClient.delete.mockResolvedValue({ success: true });
            
            await templateManager.deleteTemplate(1);
            
            expect(mockApiClient.delete).toHaveBeenCalledWith('/api/templates/1');
        });

        test('should handle template loading errors', async () => {
            mockApiClient.get.mockRejectedValue(new Error('Network error'));
            
            await expect(templateManager.loadTemplates()).rejects.toThrow('Network error');
        });
    });

    describe('Search Manager Module', () => {
        let searchManager;
        
        beforeEach(async () => {
            const searchModule = await import('../app/static/js/managers/searchManager.js');
            searchManager = searchModule.searchManager;
            
            // Reset search index
            searchManager.clearCache();
        });

        test('should build search index', () => {
            const templates = [
                { id: 1, title: 'JavaScript Tutorial', content: 'Learn JavaScript' },
                { id: 2, title: 'Python Guide', content: 'Python programming' },
                { id: 3, title: 'React Components', content: 'Building React components' }
            ];
            
            searchManager.buildIndex(templates);
            
            const stats = searchManager.getStats();
            expect(stats.indexSize).toBe(3);
        });

        test('should search templates by title', () => {
            const templates = [
                { id: 1, title: 'JavaScript Tutorial', content: 'Learn JavaScript' },
                { id: 2, title: 'Python Guide', content: 'Python programming' },
                { id: 3, title: 'React Components', content: 'Building React components' }
            ];
            
            searchManager.buildIndex(templates);
            const results = searchManager.search('JavaScript');
            
            expect(results).toHaveLength(1);
            expect(results[0].id).toBe(1);
        });

        test('should search templates by content', () => {
            const templates = [
                { id: 1, title: 'Tutorial', content: 'Learn JavaScript programming' },
                { id: 2, title: 'Guide', content: 'Python programming guide' },
                { id: 3, title: 'Components', content: 'Building React components' }
            ];
            
            searchManager.buildIndex(templates);
            const results = searchManager.search('programming');
            
            expect(results).toHaveLength(2);
            expect(results.map(r => r.id).sort()).toEqual([1, 2]);
        });

        test('should return empty results for no matches', () => {
            const templates = [
                { id: 1, title: 'JavaScript Tutorial', content: 'Learn JavaScript' }
            ];
            
            searchManager.buildIndex(templates);
            const results = searchManager.search('nonexistent');
            
            expect(results).toHaveLength(0);
        });

        test('should clear search cache', () => {
            const templates = [
                { id: 1, title: 'Test', content: 'Test content' }
            ];
            
            searchManager.buildIndex(templates);
            searchManager.clearCache();
            
            const stats = searchManager.getStats();
            expect(stats.indexSize).toBe(0);
        });

        test('should track search statistics', () => {
            const templates = [
                { id: 1, title: 'Test', content: 'Test content' }
            ];
            
            searchManager.buildIndex(templates);
            searchManager.search('test');
            searchManager.search('another');
            
            const stats = searchManager.getStats();
            expect(stats.totalSearches).toBe(2);
        });
    });

    describe('UI Manager Module', () => {
        let uiManager;
        
        beforeEach(async () => {
            // Setup DOM
            document.body.innerHTML = `
                <div id="templates-grid"></div>
                <div id="toast-container"></div>
                <div id="current-folder-title">All Templates</div>
                <div id="templates-count">0 templates</div>
            `;
            
            const uiModule = await import('../app/static/js/ui/uiManager.js');
            uiManager = uiModule.uiManager;
        });

        test('should show notification', () => {
            const toastContainer = document.getElementById('toast-container');
            
            uiManager.showMessage('Test message', 'success');
            
            expect(toastContainer.children.length).toBe(1);
            expect(toastContainer.innerHTML).toContain('Test message');
        });

        test('should update templates grid', () => {
            const templates = [
                { id: 1, title: 'Template 1', content: 'Content 1', created_at: new Date().toISOString() },
                { id: 2, title: 'Template 2', content: 'Content 2', created_at: new Date().toISOString() }
            ];
            
            uiManager.updateTemplatesGrid(templates);
            
            const grid = document.getElementById('templates-grid');
            expect(grid.children.length).toBe(2);
        });

        test('should update folder title and count', () => {
            uiManager.updateFolderInfo('Test Folder', 5);
            
            const titleElement = document.getElementById('current-folder-title');
            const countElement = document.getElementById('templates-count');
            
            expect(titleElement.textContent).toBe('Test Folder');
            expect(countElement.textContent).toBe('5 template(s)');
        });

        test('should handle empty templates grid', () => {
            uiManager.updateTemplatesGrid([]);
            
            const grid = document.getElementById('templates-grid');
            expect(grid.innerHTML).toContain('Aucun template trouvé');
        });
    });

    describe('Constants Module', () => {
        let AppConstants, AppEvents;
        
        beforeEach(async () => {
            const constantsModule = await import('../app/static/js/config/constants.js');
            AppConstants = constantsModule.AppConstants;
            AppEvents = constantsModule.AppEvents;
        });

        test('should have required app constants', () => {
            expect(AppConstants.APP_NAME).toBeDefined();
            expect(AppConstants.VERSION).toBeDefined();
            expect(AppConstants.API_BASE_URL).toBeDefined();
        });

        test('should have required app events', () => {
            expect(AppEvents.APP_INITIALIZED).toBeDefined();
            expect(AppEvents.APP_READY).toBeDefined();
            expect(AppEvents.TEMPLATE_LOADED).toBeDefined();
            expect(AppEvents.TEMPLATES_LOADED).toBeDefined();
            expect(AppEvents.ERROR_OCCURRED).toBeDefined();
        });

        test('should have DOM element selectors', () => {
            expect(AppConstants.SELECTORS.TEMPLATES_GRID).toBeDefined();
            expect(AppConstants.SELECTORS.SEARCH_INPUT).toBeDefined();
            expect(AppConstants.SELECTORS.SIDEBAR).toBeDefined();
        });
    });
});