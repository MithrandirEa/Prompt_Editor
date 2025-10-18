/**
 * Jest setup file for Prompt Editor v2.0 tests
 * This file runs before each test file
 */

// Mock DOM APIs that might not be available in jsdom
global.fetch = jest.fn();
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
global.localStorage = mockLocalStorage;

// Mock sessionStorage
const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
global.sessionStorage = mockSessionStorage;

// Mock window.location
delete window.location;
window.location = {
  href: 'http://localhost:5000',
  protocol: 'http:',
  host: 'localhost:5000',
  pathname: '/',
  search: '',
  hash: '',
  reload: jest.fn()
};

// Mock console methods for cleaner test output
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Set up DOM environment
document.body.innerHTML = `
  <div id="app">
    <main>
      <div id="templates-sidebar"></div>
      <div id="collapsed-sidebar"></div>
      <div id="editor-content"></div>
      <div id="manager-content"></div>
      <div id="templates-grid"></div>
      <input id="template-title" />
      <textarea id="markdown-editor"></textarea>
      <div id="markdown-preview"></div>
      <input id="global-search" />
      <div id="search-results-content"></div>
      <button id="toggle-sidebar"></button>
      <button id="expand-sidebar"></button>
      <button id="editor-tab"></button>
      <button id="manager-tab"></button>
    </main>
  </div>
`;

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  
  // Reset fetch mock
  fetch.mockClear();
  
  // Reset localStorage mock
  mockLocalStorage.getItem.mockClear();
  mockLocalStorage.setItem.mockClear();
  mockLocalStorage.removeItem.mockClear();
  mockLocalStorage.clear.mockClear();
  
  // Reset DOM to initial state
  document.body.innerHTML = document.body.innerHTML;
});

// Global test utilities
global.createMockResponse = (data, status = 200) => {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data))
  });
};

global.createMockError = (message, status = 500) => {
  const error = new Error(message);
  error.status = status;
  return Promise.reject(error);
};

// Mock external libraries
global.marked = {
  parse: jest.fn((markdown) => `<p>${markdown}</p>`)
};

global.DOMPurify = {
  sanitize: jest.fn((html) => html)
};