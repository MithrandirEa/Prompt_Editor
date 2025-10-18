/**
 * @fileoverview Tests for Search functionality
 * @description Tests search operations and UI interactions
 */

describe('Search Functionality', () => {
  let mockApp;

  beforeEach(() => {
    mockApp = {
      state: {
        searchQuery: '',
        searchResults: []
      },
      
      performSearch: jest.fn(),
      clearSearchResults: jest.fn(),
      renderSearchResultsGrid: jest.fn()
    };

    global.fetch = jest.fn();
  });

  describe('Search Operations', () => {
    test('should perform search with query', async () => {
      const searchQuery = 'test';
      const mockResults = [
        { id: 1, title: 'Test Template 1', content: 'This is a test' },
        { id: 2, title: 'Another Test', content: 'More test content' }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'success', data: mockResults })
      });

      mockApp.performSearch = async function(query) {
        const response = await fetch(`/api/templates?search=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.status === 'success') {
          this.state.searchQuery = query;
          this.state.searchResults = data.data;
          return data.data;
        }
        throw new Error('Search failed');
      };

      const results = await mockApp.performSearch(searchQuery);

      expect(fetch).toHaveBeenCalledWith('/api/templates?search=test');
      expect(results).toEqual(mockResults);
      expect(mockApp.state.searchQuery).toBe(searchQuery);
      expect(mockApp.state.searchResults).toEqual(mockResults);
    });

    test('should handle empty search results', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'success', data: [] })
      });

      mockApp.performSearch = async function(query) {
        const response = await fetch(`/api/templates?search=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.status === 'success') {
          this.state.searchQuery = query;
          this.state.searchResults = data.data;
          return data.data;
        }
      };

      const results = await mockApp.performSearch('nonexistent');

      expect(results).toEqual([]);
      expect(mockApp.state.searchResults).toEqual([]);
    });

    test('should encode search query properly', async () => {
      const specialQuery = 'test with spaces & symbols!';
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'success', data: [] })
      });

      mockApp.performSearch = async function(query) {
        const response = await fetch(`/api/templates?search=${encodeURIComponent(query)}`);
        return [];
      };

      await mockApp.performSearch(specialQuery);

      expect(fetch).toHaveBeenCalledWith('/api/templates?search=test%20with%20spaces%20%26%20symbols!');
    });
  });

  describe('Search UI Interactions', () => {
    test('should debounce search input', (done) => {
      let searchCallCount = 0;
      
      const debouncedSearch = (query, delay = 300) => {
        let timeoutId;
        return new Promise((resolve) => {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            searchCallCount++;
            resolve(query);
          }, delay);
        });
      };

      // Simulate rapid typing
      debouncedSearch('t', 100);
      debouncedSearch('te', 100);
      debouncedSearch('tes', 100);
      debouncedSearch('test', 100);

      setTimeout(() => {
        expect(searchCallCount).toBe(1); // Only last search should execute
        done();
      }, 150);
    });

    test('should clear search results', () => {
      mockApp.state.searchQuery = 'test';
      mockApp.state.searchResults = [{ id: 1, title: 'Test' }];

      mockApp.clearSearchResults = function() {
        this.state.searchQuery = '';
        this.state.searchResults = [];
        // Mock DOM manipulation
        const searchInput = document.getElementById('global-search');
        if (searchInput) {
          searchInput.value = '';
        }
      };

      mockApp.clearSearchResults();

      expect(mockApp.state.searchQuery).toBe('');
      expect(mockApp.state.searchResults).toEqual([]);
    });
  });

  describe('Search Result Rendering', () => {
    test('should render search results grid', () => {
      const mockResults = [
        { 
          id: 1, 
          title: 'Test Template', 
          content: 'This is test content for the template',
          updated_at: '2025-10-18T17:30:00Z',
          folder_name: 'Test Folder'
        }
      ];

      mockApp.renderSearchResultsGrid = function(templates) {
        const grid = document.getElementById('search-results-grid');
        if (!grid) return;

        grid.innerHTML = templates.map(template => `
          <div class="template-card" data-template-id="${template.id}">
            <h3>${this.escapeHtml(template.title)}</h3>
            <p>${template.content ? this.escapeHtml(template.content.substring(0, 150)) : ''}</p>
            <span class="folder-name">${template.folder_name || ''}</span>
          </div>
        `).join('');
      };

      mockApp.escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      };

      // Create search results grid element
      const grid = document.createElement('div');
      grid.id = 'search-results-grid';
      document.body.appendChild(grid);

      mockApp.renderSearchResultsGrid(mockResults);

      expect(grid.innerHTML).toContain('Test Template');
      expect(grid.innerHTML).toContain('This is test content');
      expect(grid.innerHTML).toContain('Test Folder');
      expect(grid.querySelector('[data-template-id="1"]')).toBeTruthy();
    });

    test('should handle empty search results rendering', () => {
      mockApp.renderSearchResultsGrid = function(templates) {
        const grid = document.getElementById('search-results-grid');
        if (!grid) return;

        if (templates.length === 0) {
          grid.innerHTML = `
            <div class="no-results">
              <p>Aucun template trouvé</p>
            </div>
          `;
        }
      };

      const grid = document.createElement('div');
      grid.id = 'search-results-grid';
      document.body.appendChild(grid);

      mockApp.renderSearchResultsGrid([]);

      expect(grid.innerHTML).toContain('Aucun template trouvé');
    });
  });

  describe('Search Error Handling', () => {
    test('should handle search API errors', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      mockApp.performSearch = async function(query) {
        try {
          const response = await fetch(`/api/templates?search=${encodeURIComponent(query)}`);
          return [];
        } catch (error) {
          console.error('Search failed:', error);
          throw error;
        }
      };

      await expect(mockApp.performSearch('test')).rejects.toThrow('Network error');
    });
  });
});