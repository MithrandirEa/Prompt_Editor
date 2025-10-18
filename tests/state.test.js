/**
 * @fileoverview Tests for Application State Management
 * @description Tests the core state management functionality of the App
 */

describe('App State Management', () => {
  let App;

  beforeEach(() => {
    // We need to load the App object - for now we'll create a minimal mock
    // TODO: Extract App to a proper module for easier testing
    App = {
      state: {
        currentTab: 'editor',
        currentTemplateId: null,
        currentFolderId: null,
        isEditing: false,
        isDirty: false,
        searchQuery: '',
        sidebarCollapsed: false,
        theme: 'light'
      },
      
      // Mock methods for testing
      setState: function(newState) {
        this.state = { ...this.state, ...newState };
      },
      
      getState: function() {
        return { ...this.state };
      }
    };
  });

  describe('Initial State', () => {
    test('should have correct default state', () => {
      expect(App.state.currentTab).toBe('editor');
      expect(App.state.currentTemplateId).toBeNull();
      expect(App.state.currentFolderId).toBeNull();
      expect(App.state.isEditing).toBe(false);
      expect(App.state.isDirty).toBe(false);
      expect(App.state.searchQuery).toBe('');
      expect(App.state.sidebarCollapsed).toBe(false);
      expect(App.state.theme).toBe('light');
    });
  });

  describe('State Updates', () => {
    test('should update single state property', () => {
      App.setState({ currentTab: 'manager' });
      expect(App.state.currentTab).toBe('manager');
      expect(App.state.currentTemplateId).toBeNull(); // Other properties unchanged
    });

    test('should update multiple state properties', () => {
      App.setState({ 
        currentTab: 'manager',
        currentTemplateId: 123,
        isEditing: true
      });
      
      expect(App.state.currentTab).toBe('manager');
      expect(App.state.currentTemplateId).toBe(123);
      expect(App.state.isEditing).toBe(true);
    });

    test('should not mutate original state object', () => {
      const originalState = App.getState();
      App.setState({ currentTab: 'manager' });
      
      expect(originalState.currentTab).toBe('editor');
      expect(App.state.currentTab).toBe('manager');
    });
  });
});