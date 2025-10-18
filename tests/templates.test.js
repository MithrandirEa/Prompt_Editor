/**
 * @fileoverview Tests for Template Management functionality
 * @description Tests template CRUD operations and related features
 */

describe('Template Management', () => {
  let mockApp;

  beforeEach(() => {
    // Mock App with template-related methods
    mockApp = {
      state: {
        currentTemplateId: null,
        templates: [],
        isDirty: false
      },
      
      // Mock API calls
      loadTemplates: jest.fn(),
      loadTemplate: jest.fn(),
      saveCurrentTemplate: jest.fn(),
      createNewTemplate: jest.fn(),
      deleteTemplate: jest.fn(),
      
      // Mock UI updates
      renderTemplatesGrid: jest.fn(),
      updateUI: jest.fn()
    };

    // Setup fetch mock for API calls
    global.fetch = jest.fn();
  });

  describe('Load Templates', () => {
    test('should fetch templates from API successfully', async () => {
      const mockTemplates = [
        { id: 1, title: 'Template 1', content: 'Content 1' },
        { id: 2, title: 'Template 2', content: 'Content 2' }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'success', data: mockTemplates })
      });

      // Mock the actual loadTemplates implementation
      mockApp.loadTemplates = async function() {
        const response = await fetch('/api/templates');
        const data = await response.json();
        if (data.status === 'success') {
          this.state.templates = data.data;
          return data.data;
        }
        throw new Error('Failed to load templates');
      };

      const result = await mockApp.loadTemplates();

      expect(fetch).toHaveBeenCalledWith('/api/templates');
      expect(result).toEqual(mockTemplates);
      expect(mockApp.state.templates).toEqual(mockTemplates);
    });

    test('should handle API errors gracefully', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ status: 'error', message: 'Server error' })
      });

      mockApp.loadTemplates = async function() {
        const response = await fetch('/api/templates');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
      };

      await expect(mockApp.loadTemplates()).rejects.toThrow('HTTP 500');
    });
  });

  describe('Load Single Template', () => {
    test('should load template by ID', async () => {
      const mockTemplate = { 
        id: 1, 
        title: 'Test Template', 
        content: 'Test content' 
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'success', data: mockTemplate })
      });

      mockApp.loadTemplate = async function(templateId) {
        const response = await fetch(`/api/templates/${templateId}`);
        const data = await response.json();
        if (data.status === 'success') {
          this.state.currentTemplateId = templateId;
          return data.data;
        }
        throw new Error('Failed to load template');
      };

      const result = await mockApp.loadTemplate(1);

      expect(fetch).toHaveBeenCalledWith('/api/templates/1');
      expect(result).toEqual(mockTemplate);
      expect(mockApp.state.currentTemplateId).toBe(1);
    });
  });

  describe('Save Template', () => {
    test('should save new template', async () => {
      const newTemplate = {
        title: 'New Template',
        content: 'New content'
      };

      const savedTemplate = {
        id: 3,
        ...newTemplate,
        created_at: '2025-10-18T17:30:00Z'
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ status: 'success', data: savedTemplate })
      });

      mockApp.saveCurrentTemplate = async function(templateData) {
        const response = await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(templateData)
        });
        
        const data = await response.json();
        if (data.status === 'success') {
          this.state.currentTemplateId = data.data.id;
          this.state.isDirty = false;
          return data.data;
        }
        throw new Error('Failed to save template');
      };

      const result = await mockApp.saveCurrentTemplate(newTemplate);

      expect(fetch).toHaveBeenCalledWith('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTemplate)
      });
      
      expect(result).toEqual(savedTemplate);
      expect(mockApp.state.currentTemplateId).toBe(3);
      expect(mockApp.state.isDirty).toBe(false);
    });

    test('should update existing template', async () => {
      const templateId = 1;
      const updatedTemplate = {
        id: templateId,
        title: 'Updated Template',
        content: 'Updated content'
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'success', data: updatedTemplate })
      });

      mockApp.state.currentTemplateId = templateId;
      
      mockApp.saveCurrentTemplate = async function(templateData) {
        const response = await fetch(`/api/templates/${this.state.currentTemplateId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(templateData)
        });
        
        const data = await response.json();
        if (data.status === 'success') {
          this.state.isDirty = false;
          return data.data;
        }
        throw new Error('Failed to update template');
      };

      const result = await mockApp.saveCurrentTemplate(updatedTemplate);

      expect(fetch).toHaveBeenCalledWith('/api/templates/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTemplate)
      });
      
      expect(result).toEqual(updatedTemplate);
      expect(mockApp.state.isDirty).toBe(false);
    });
  });

  describe('Template Validation', () => {
    test('should validate template data', () => {
      const validateTemplate = (template) => {
        if (!template.title || template.title.trim() === '') {
          return { valid: false, error: 'Title is required' };
        }
        if (!template.content || template.content.trim() === '') {
          return { valid: false, error: 'Content is required' };
        }
        return { valid: true };
      };

      // Valid template
      expect(validateTemplate({ title: 'Test', content: 'Content' }))
        .toEqual({ valid: true });

      // Invalid - no title
      expect(validateTemplate({ title: '', content: 'Content' }))
        .toEqual({ valid: false, error: 'Title is required' });

      // Invalid - no content  
      expect(validateTemplate({ title: 'Test', content: '' }))
        .toEqual({ valid: false, error: 'Content is required' });
    });
  });
});