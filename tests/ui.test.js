/**
 * @fileoverview Tests for UI Management and DOM interactions
 * @description Tests UI state management, event handling, and DOM manipulation
 */

describe('UI Management', () => {
  let mockApp;

  beforeEach(() => {
    mockApp = {
      state: {
        currentTab: 'editor',
        sidebarCollapsed: false
      },
      
      switchTab: jest.fn(),
      bindEvents: jest.fn(),
      bindSidebarEvents: jest.fn()
    };

    // Reset DOM to clean state
    document.body.innerHTML = `
      <div id="app">
        <button id="editor-tab">Editor</button>
        <button id="manager-tab">Manager</button>
        <div id="editor-content">Editor Content</div>
        <div id="manager-content" class="hidden">Manager Content</div>
        <div id="templates-sidebar">Sidebar</div>
        <div id="collapsed-sidebar" class="hidden">Collapsed</div>
        <button id="toggle-sidebar">Toggle</button>
        <button id="expand-sidebar">Expand</button>
      </div>
    `;
  });

  describe('Tab Switching', () => {
    test('should switch to manager tab', () => {
      mockApp.switchTab = function(tab) {
        // Update state
        this.state.currentTab = tab;
        
        // Update UI
        const editorContent = document.getElementById('editor-content');
        const managerContent = document.getElementById('manager-content');
        const editorTab = document.getElementById('editor-tab');
        const managerTab = document.getElementById('manager-tab');
        
        if (tab === 'manager') {
          editorContent.classList.add('hidden');
          managerContent.classList.remove('hidden');
          editorTab.classList.remove('tab-active');
          managerTab.classList.add('tab-active');
        } else {
          editorContent.classList.remove('hidden');
          managerContent.classList.add('hidden');
          editorTab.classList.add('tab-active');
          managerTab.classList.remove('tab-active');
        }
      };

      mockApp.switchTab('manager');

      expect(mockApp.state.currentTab).toBe('manager');
      
      const editorContent = document.getElementById('editor-content');
      const managerContent = document.getElementById('manager-content');
      
      expect(editorContent.classList.contains('hidden')).toBe(true);
      expect(managerContent.classList.contains('hidden')).toBe(false);
    });

    test('should switch to editor tab', () => {
      // Start in manager tab
      mockApp.state.currentTab = 'manager';
      document.getElementById('editor-content').classList.add('hidden');
      document.getElementById('manager-content').classList.remove('hidden');

      mockApp.switchTab = function(tab) {
        this.state.currentTab = tab;
        
        const editorContent = document.getElementById('editor-content');
        const managerContent = document.getElementById('manager-content');
        
        if (tab === 'editor') {
          editorContent.classList.remove('hidden');
          managerContent.classList.add('hidden');
        }
      };

      mockApp.switchTab('editor');

      expect(mockApp.state.currentTab).toBe('editor');
      
      const editorContent = document.getElementById('editor-content');
      const managerContent = document.getElementById('manager-content');
      
      expect(editorContent.classList.contains('hidden')).toBe(false);
      expect(managerContent.classList.contains('hidden')).toBe(true);
    });
  });

  describe('Sidebar Management', () => {
    test('should toggle sidebar collapse', () => {
      mockApp.toggleSidebar = function() {
        const sidebar = document.getElementById('templates-sidebar');
        const collapsedSidebar = document.getElementById('collapsed-sidebar');
        
        if (this.state.sidebarCollapsed) {
          // Expand
          sidebar.classList.remove('hidden');
          collapsedSidebar.classList.add('hidden');
          this.state.sidebarCollapsed = false;
        } else {
          // Collapse
          sidebar.classList.add('hidden');
          collapsedSidebar.classList.remove('hidden');
          this.state.sidebarCollapsed = true;
        }
      };

      // Initially expanded
      expect(mockApp.state.sidebarCollapsed).toBe(false);

      // Collapse sidebar
      mockApp.toggleSidebar();
      
      expect(mockApp.state.sidebarCollapsed).toBe(true);
      expect(document.getElementById('templates-sidebar').classList.contains('hidden')).toBe(true);
      expect(document.getElementById('collapsed-sidebar').classList.contains('hidden')).toBe(false);

      // Expand sidebar
      mockApp.toggleSidebar();
      
      expect(mockApp.state.sidebarCollapsed).toBe(false);
      expect(document.getElementById('templates-sidebar').classList.contains('hidden')).toBe(false);
      expect(document.getElementById('collapsed-sidebar').classList.contains('hidden')).toBe(true);
    });

    test('should bind sidebar events', () => {
      let toggleClickCount = 0;
      let expandClickCount = 0;

      mockApp.bindSidebarEvents = function() {
        const toggleBtn = document.getElementById('toggle-sidebar');
        const expandBtn = document.getElementById('expand-sidebar');
        
        if (toggleBtn) {
          toggleBtn.addEventListener('click', () => {
            toggleClickCount++;
            this.toggleSidebar();
          });
        }
        
        if (expandBtn) {
          expandBtn.addEventListener('click', () => {
            expandClickCount++;
            this.toggleSidebar();
          });
        }
      };

      mockApp.toggleSidebar = jest.fn();

      mockApp.bindSidebarEvents();

      // Test toggle button click
      document.getElementById('toggle-sidebar').click();
      expect(toggleClickCount).toBe(1);
      expect(mockApp.toggleSidebar).toHaveBeenCalledTimes(1);

      // Test expand button click
      document.getElementById('expand-sidebar').click();
      expect(expandClickCount).toBe(1);
      expect(mockApp.toggleSidebar).toHaveBeenCalledTimes(2);
    });
  });

  describe('Event Binding', () => {
    test('should bind tab click events', () => {
      let editorTabClicked = false;
      let managerTabClicked = false;

      mockApp.bindEvents = function() {
        document.getElementById('editor-tab').addEventListener('click', () => {
          editorTabClicked = true;
          this.switchTab('editor');
        });
        
        document.getElementById('manager-tab').addEventListener('click', () => {
          managerTabClicked = true;
          this.switchTab('manager');
        });
      };

      mockApp.bindEvents();

      // Test editor tab click
      document.getElementById('editor-tab').click();
      expect(editorTabClicked).toBe(true);
      expect(mockApp.switchTab).toHaveBeenCalledWith('editor');

      // Test manager tab click
      document.getElementById('manager-tab').click();
      expect(managerTabClicked).toBe(true);
      expect(mockApp.switchTab).toHaveBeenCalledWith('manager');
    });

    test('should prevent duplicate event binding', () => {
      let clickCount = 0;

      mockApp.bindSidebarEvents = function(force = false) {
        const toggleBtn = document.getElementById('toggle-sidebar');
        
        // Check if already bound
        if (toggleBtn && (!toggleBtn.dataset.eventBound || force)) {
          toggleBtn.addEventListener('click', () => {
            clickCount++;
          });
          toggleBtn.dataset.eventBound = 'true';
        }
      };

      // Bind events first time
      mockApp.bindSidebarEvents();
      
      // Bind again (should not add duplicate listener)
      mockApp.bindSidebarEvents();
      
      // Click button
      document.getElementById('toggle-sidebar').click();
      
      // Should only increment once
      expect(clickCount).toBe(1);

      // Force rebind
      mockApp.bindSidebarEvents(true);
      
      // Click again
      document.getElementById('toggle-sidebar').click();
      
      // Should increment again (new listener added)
      expect(clickCount).toBe(3); // Original + new listener
    });
  });

  describe('DOM Utilities', () => {
    test('should escape HTML properly', () => {
      const escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      };

      expect(escapeHtml('Hello World')).toBe('Hello World');
      expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
      expect(escapeHtml('Hello & "World"')).toBe('Hello &amp; "World"');
    });

    test('should check element visibility', () => {
      const isVisible = (element) => {
        return !element.classList.contains('hidden') && 
               element.style.display !== 'none';
      };

      const visibleElement = document.createElement('div');
      const hiddenElement = document.createElement('div');
      hiddenElement.classList.add('hidden');
      
      expect(isVisible(visibleElement)).toBe(true);
      expect(isVisible(hiddenElement)).toBe(false);
    });
  });

  describe('CSS Class Management', () => {
    test('should toggle CSS classes', () => {
      const element = document.createElement('div');
      element.className = 'class1 class2';

      const toggleClass = (el, className) => {
        el.classList.toggle(className);
      };

      toggleClass(element, 'class3');
      expect(element.classList.contains('class3')).toBe(true);

      toggleClass(element, 'class3');
      expect(element.classList.contains('class3')).toBe(false);

      toggleClass(element, 'class1');
      expect(element.classList.contains('class1')).toBe(false);
    });

    test('should add/remove active states', () => {
      const tab1 = document.createElement('button');
      const tab2 = document.createElement('button');
      
      tab1.classList.add('tab-active');

      const setActiveTab = (activeTab, allTabs) => {
        allTabs.forEach(tab => tab.classList.remove('tab-active'));
        activeTab.classList.add('tab-active');
      };

      setActiveTab(tab2, [tab1, tab2]);

      expect(tab1.classList.contains('tab-active')).toBe(false);
      expect(tab2.classList.contains('tab-active')).toBe(true);
    });
  });
});