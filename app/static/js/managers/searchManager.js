/**
 * @fileoverview Search Manager for Prompt Editor v2.0
 * @description Advanced search, filtering, and indexing system with performance optimization
 */

import { logger, createLogger, performanceLogger } from '../utils/logger.js';
import { handleError, createError, ErrorType, ErrorCode } from '../utils/errorHandler.js';
import { stateManager, State } from '../core/state.js';
import { AppConstants, AppEvents } from '../config/constants.js';

/**
 * @typedef {Object} SearchIndex
 * @property {Map<string, Set<number>>} terms - Term to template IDs mapping
 * @property {Map<number, Object>} documents - Template ID to indexed document mapping
 * @property {Array<string>} stopWords - Stop words to ignore
 */

/**
 * @typedef {Object} SearchResult
 * @property {number} id - Template ID
 * @property {Object} template - Template object
 * @property {number} score - Relevance score
 * @property {Array<Object>} matches - Match details
 */

/**
 * @typedef {Object} FilterCriteria
 * @property {string} category - Category filter
 * @property {Array<string>} tags - Tag filters
 * @property {boolean} favorites - Favorites only
 * @property {Date} dateFrom - Date range start
 * @property {Date} dateTo - Date range end
 * @property {number} folderId - Folder filter
 */

/**
 * Search Manager class for advanced search and filtering
 */
export class SearchManager extends EventTarget {
    /**
     * Create a new SearchManager instance
     */
    constructor() {
        super();
        this.logger = createLogger('SearchManager');
        
        // Search index
        this.index = {
            terms: new Map(),
            documents: new Map(),
            stopWords: new Set([
                'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'à', 'ce', 'qui', 'que',
                'pour', 'dans', 'sur', 'avec', 'par', 'sans', 'sous', 'vers', 'chez', 'entre', 'contre',
                'the', 'a', 'an', 'and', 'or', 'to', 'in', 'on', 'at', 'by', 'for', 'with', 'from'
            ])
        };
        
        // Search configuration
        this.config = {
            minQueryLength: 2,
            maxResults: 100,
            scoreThreshold: 0.1,
            fuzzyThreshold: 0.8,
            enableFuzzySearch: true,
            enableHighlighting: true,
            debounceDelay: AppConstants.SEARCH_DEBOUNCE || 300,
            indexUpdateDelay: 1000
        };
        
        // Search state
        this.state = {
            currentQuery: '',
            lastResults: [],
            filters: {},
            sortBy: 'relevance',
            sortDirection: 'desc'
        };
        
        // Performance tracking
        this.stats = {
            totalSearches: 0,
            averageSearchTime: 0,
            indexSize: 0,
            lastIndexUpdate: null,
            cacheHits: 0,
            cacheMisses: 0
        };
        
        // Result cache
        this.resultCache = new Map();
        this.maxCacheSize = 100;
        
        // Debounced functions
        this.debouncedSearch = this.debounce(this.performSearch.bind(this), this.config.debounceDelay);
        this.debouncedIndexUpdate = this.debounce(this.updateIndex.bind(this), this.config.indexUpdateDelay);
        
        this.logger.info('SearchManager initialized');
    }

    /**
     * Initialize the search manager
     */
    async initialize() {
        try {
            this.logger.info('Initializing SearchManager...');
            
            // Build initial index
            await this.buildIndex();
            
            // Set up state subscriptions
            this.setupStateSubscriptions();
            
            this.logger.info('SearchManager initialization complete');
            
        } catch (error) {
            this.logger.error('SearchManager initialization failed:', error);
            handleError(createError(
                'Failed to initialize SearchManager',
                ErrorCode.UNKNOWN,
                ErrorType.UNKNOWN,
                null,
                error
            ));
        }
    }

    /**
     * Set up state management subscriptions
     */
    setupStateSubscriptions() {
        // Listen for template changes to update index
        stateManager.subscribe('prompts', (templates) => {
            this.debouncedIndexUpdate(templates);
        });
        
        // Listen for search term changes
        stateManager.subscribe('searchTerm', (term) => {
            if (term !== this.state.currentQuery) {
                this.state.currentQuery = term;
                if (term.trim()) {
                    this.debouncedSearch(term);
                } else {
                    this.clearSearch();
                }
            }
        });
        
        // Listen for filter changes
        stateManager.subscribe('currentFilter', (filter) => {
            this.applyFilter(filter);
        });
        
        stateManager.subscribe('currentSort', (sort) => {
            this.setSortCriteria(sort);
        });
    }

    /**
     * Build search index from templates
     * @param {Array} templates - Templates to index (optional, uses state if not provided)
     */
    async buildIndex(templates = null) {
        const timerName = 'BuildSearchIndex';
        performanceLogger.start(timerName);
        
        try {
            this.logger.debug('Building search index...');
            
            // Clear existing index
            this.index.terms.clear();
            this.index.documents.clear();
            
            // Get templates
            if (!templates) {
                templates = State.getPrompts();
            }
            
            if (!templates || templates.length === 0) {
                this.logger.debug('No templates to index');
                return;
            }
            
            // Index each template
            for (const template of templates) {
                this.indexTemplate(template);
            }
            
            // Update statistics
            this.stats.indexSize = this.index.terms.size;
            this.stats.lastIndexUpdate = new Date().toISOString();
            
            const indexTime = performanceLogger.end(timerName);
            this.logger.info(`Search index built: ${templates.length} templates, ${this.stats.indexSize} terms (${indexTime.toFixed(2)}ms)`);
            
            // Clear cache when index is rebuilt
            this.resultCache.clear();
            
            // Emit event
            this.dispatchEvent(new CustomEvent(AppEvents.SEARCH_INDEX_UPDATED, {
                detail: { 
                    templateCount: templates.length, 
                    termCount: this.stats.indexSize,
                    buildTime: indexTime
                }
            }));
            
        } catch (error) {
            performanceLogger.end(timerName);
            this.logger.error('Failed to build search index:', error);
            throw error;
        }
    }

    /**
     * Update search index (incremental)
     * @param {Array} templates - Updated templates
     */
    updateIndex(templates) {
        try {
            this.logger.debug('Updating search index');
            this.buildIndex(templates);
        } catch (error) {
            this.logger.error('Failed to update search index:', error);
            handleError(error);
        }
    }

    /**
     * Index a single template
     * @param {Object} template - Template to index
     */
    indexTemplate(template) {
        try {
            // Create searchable document
            const document = {
                id: template.id,
                name: template.name || '',
                content: template.content || '',
                description: template.description || '',
                tags: template.tags || [],
                category: template.category || '',
                created_at: template.created_at,
                updated_at: template.updated_at,
                is_favorite: template.is_favorite,
                folder_id: template.folder_id
            };
            
            // Store document
            this.index.documents.set(template.id, document);
            
            // Extract and index terms
            const searchableText = [
                document.name,
                document.content,
                document.description,
                ...document.tags,
                document.category
            ].join(' ').toLowerCase();
            
            const terms = this.extractTerms(searchableText);
            
            // Add terms to index
            terms.forEach(term => {
                if (!this.index.terms.has(term)) {
                    this.index.terms.set(term, new Set());
                }
                this.index.terms.get(term).add(template.id);
            });
            
        } catch (error) {
            this.logger.error(`Failed to index template ${template.id}:`, error);
        }
    }

    /**
     * Extract searchable terms from text
     * @param {string} text - Text to analyze
     * @returns {Set<string>} Set of terms
     */
    extractTerms(text) {
        const terms = new Set();
        
        if (!text || typeof text !== 'string') {
            return terms;
        }
        
        // Clean and normalize text
        const normalized = text
            .toLowerCase()
            .replace(/[^\w\s-]/g, ' ') // Remove special chars except hyphens
            .replace(/\s+/g, ' ') // Collapse whitespace
            .trim();
        
        // Split into words
        const words = normalized.split(' ');
        
        words.forEach(word => {
            // Skip empty, short, or stop words
            if (word.length >= this.config.minQueryLength && !this.index.stopWords.has(word)) {
                terms.add(word);
                
                // Add word fragments for partial matching
                if (word.length > 3) {
                    for (let i = 2; i <= word.length - 1; i++) {
                        terms.add(word.substring(0, i));
                    }
                }
            }
        });
        
        return terms;
    }

    /**
     * Perform search
     * @param {string} query - Search query
     * @param {FilterCriteria} filters - Additional filters
     * @returns {Promise<Array<SearchResult>>} Search results
     */
    async performSearch(query, filters = {}) {
        const timerName = `Search:${query}`;
        performanceLogger.start(timerName);
        
        try {
            this.logger.debug(`Performing search: "${query}"`);
            
            // Update statistics
            this.stats.totalSearches++;
            
            // Validate query
            if (!query || query.trim().length < this.config.minQueryLength) {
                this.clearResults();
                return [];
            }
            
            // Check cache first
            const cacheKey = this.getCacheKey(query, filters);
            if (this.resultCache.has(cacheKey)) {
                this.stats.cacheHits++;
                const cached = this.resultCache.get(cacheKey);
                performanceLogger.end(timerName);
                return cached;
            }
            
            this.stats.cacheMisses++;
            
            // Extract search terms
            const terms = this.extractTerms(query);
            
            if (terms.size === 0) {
                this.clearResults();
                return [];
            }
            
            // Find matching templates
            const matches = this.findMatches(terms);
            
            // Calculate relevance scores
            const scored = this.scoreResults(matches, terms, query);
            
            // Apply additional filters
            const filtered = this.applyFilters(scored, filters);
            
            // Sort results
            const sorted = this.sortResults(filtered);
            
            // Limit results
            const limited = sorted.slice(0, this.config.maxResults);
            
            // Enhance with highlighting
            const enhanced = this.config.enableHighlighting ? 
                this.addHighlighting(limited, terms) : 
                limited;
            
            // Cache results
            this.cacheResults(cacheKey, enhanced);
            
            // Update state
            this.state.lastResults = enhanced;
            stateManager.set('filteredPrompts', enhanced.map(r => r.template));
            
            const searchTime = performanceLogger.end(timerName);
            this.updateAverageSearchTime(searchTime);
            
            this.logger.info(`Search completed: "${query}" - ${enhanced.length} results (${searchTime.toFixed(2)}ms)`);
            
            // Emit event
            this.dispatchEvent(new CustomEvent(AppEvents.SEARCH_COMPLETED, {
                detail: { 
                    query, 
                    results: enhanced, 
                    resultCount: enhanced.length,
                    searchTime 
                }
            }));
            
            return enhanced;
            
        } catch (error) {
            performanceLogger.end(timerName);
            this.logger.error(`Search failed for query "${query}":`, error);
            handleError(error);
            return [];
        }
    }

    /**
     * Find templates matching search terms
     * @param {Set<string>} terms - Search terms
     * @returns {Map<number, Set<string>>} Template ID to matching terms mapping
     */
    findMatches(terms) {
        const matches = new Map();
        
        terms.forEach(term => {
            // Exact matches
            if (this.index.terms.has(term)) {
                const templateIds = this.index.terms.get(term);
                templateIds.forEach(id => {
                    if (!matches.has(id)) {
                        matches.set(id, new Set());
                    }
                    matches.get(id).add(term);
                });
            }
            
            // Fuzzy matches (if enabled)
            if (this.config.enableFuzzySearch && term.length > 3) {
                this.index.terms.forEach((templateIds, indexTerm) => {
                    if (this.calculateSimilarity(term, indexTerm) >= this.config.fuzzyThreshold) {
                        templateIds.forEach(id => {
                            if (!matches.has(id)) {
                                matches.set(id, new Set());
                            }
                            matches.get(id).add(indexTerm);
                        });
                    }
                });
            }
        });
        
        return matches;
    }

    /**
     * Score search results by relevance
     * @param {Map<number, Set<string>>} matches - Matches mapping
     * @param {Set<string>} queryTerms - Original query terms
     * @param {string} originalQuery - Original query string
     * @returns {Array<SearchResult>} Scored results
     */
    scoreResults(matches, queryTerms, originalQuery) {
        const results = [];
        
        matches.forEach((matchedTerms, templateId) => {
            const document = this.index.documents.get(templateId);
            if (!document) return;
            
            // Calculate relevance score
            let score = 0;
            
            // Term frequency score
            const termFrequency = matchedTerms.size / queryTerms.size;
            score += termFrequency * 0.4;
            
            // Field-based scoring
            const nameMatch = this.checkFieldMatch(document.name, originalQuery);
            const contentMatch = this.checkFieldMatch(document.content, originalQuery);
            const descMatch = this.checkFieldMatch(document.description, originalQuery);
            const tagsMatch = document.tags.some(tag => 
                tag.toLowerCase().includes(originalQuery.toLowerCase())
            );
            
            // Weight different fields
            if (nameMatch.exact) score += 0.5;
            else if (nameMatch.partial) score += 0.3;
            
            if (contentMatch.exact) score += 0.2;
            else if (contentMatch.partial) score += 0.1;
            
            if (descMatch.exact) score += 0.15;
            else if (descMatch.partial) score += 0.05;
            
            if (tagsMatch) score += 0.25;
            
            // Boost favorites
            if (document.is_favorite) score += 0.1;
            
            // Recency boost
            const daysSinceUpdate = (Date.now() - new Date(document.updated_at)) / (1000 * 60 * 60 * 24);
            if (daysSinceUpdate < 7) score += 0.05;
            
            // Only include results above threshold
            if (score >= this.config.scoreThreshold) {
                results.push({
                    id: templateId,
                    template: State.getPrompts().find(t => t.id === templateId),
                    score,
                    matches: Array.from(matchedTerms),
                    matchDetails: {
                        nameMatch,
                        contentMatch,
                        descMatch,
                        tagsMatch
                    }
                });
            }
        });
        
        return results;
    }

    /**
     * Check field for query matches
     * @param {string} field - Field content
     * @param {string} query - Search query
     * @returns {Object} Match details
     */
    checkFieldMatch(field, query) {
        if (!field || !query) return { exact: false, partial: false };
        
        const fieldLower = field.toLowerCase();
        const queryLower = query.toLowerCase();
        
        return {
            exact: fieldLower === queryLower,
            partial: fieldLower.includes(queryLower)
        };
    }

    /**
     * Apply additional filters to results
     * @param {Array<SearchResult>} results - Search results
     * @param {FilterCriteria} filters - Filter criteria
     * @returns {Array<SearchResult>} Filtered results
     */
    applyFilters(results, filters) {
        if (!filters || Object.keys(filters).length === 0) {
            return results;
        }
        
        return results.filter(result => {
            const template = result.template;
            
            // Category filter
            if (filters.category && template.category !== filters.category) {
                return false;
            }
            
            // Tags filter
            if (filters.tags && filters.tags.length > 0) {
                const hasAllTags = filters.tags.every(tag => 
                    template.tags && template.tags.includes(tag)
                );
                if (!hasAllTags) return false;
            }
            
            // Favorites filter
            if (filters.favorites && !template.is_favorite) {
                return false;
            }
            
            // Date range filter
            if (filters.dateFrom || filters.dateTo) {
                const updatedDate = new Date(template.updated_at);
                if (filters.dateFrom && updatedDate < filters.dateFrom) return false;
                if (filters.dateTo && updatedDate > filters.dateTo) return false;
            }
            
            // Folder filter
            if (filters.folderId && template.folder_id !== filters.folderId) {
                return false;
            }
            
            return true;
        });
    }

    /**
     * Sort search results
     * @param {Array<SearchResult>} results - Results to sort
     * @returns {Array<SearchResult>} Sorted results
     */
    sortResults(results) {
        return results.sort((a, b) => {
            let comparison = 0;
            
            switch (this.state.sortBy) {
                case 'relevance':
                    comparison = b.score - a.score;
                    break;
                case 'name':
                    comparison = a.template.name.localeCompare(b.template.name);
                    break;
                case 'updated':
                    comparison = new Date(b.template.updated_at) - new Date(a.template.updated_at);
                    break;
                case 'created':
                    comparison = new Date(b.template.created_at) - new Date(a.template.created_at);
                    break;
                default:
                    comparison = b.score - a.score;
            }
            
            return this.state.sortDirection === 'desc' ? comparison : -comparison;
        });
    }

    /**
     * Add highlighting to search results
     * @param {Array<SearchResult>} results - Results to enhance
     * @param {Set<string>} terms - Search terms
     * @returns {Array<SearchResult>} Enhanced results
     */
    addHighlighting(results, terms) {
        return results.map(result => {
            const template = { ...result.template };
            const termArray = Array.from(terms);
            
            // Highlight matches in different fields
            template.nameHighlighted = this.highlightText(template.name, termArray);
            template.contentHighlighted = this.highlightText(template.content, termArray);
            template.descriptionHighlighted = this.highlightText(template.description, termArray);
            
            return {
                ...result,
                template
            };
        });
    }

    /**
     * Highlight search terms in text
     * @param {string} text - Text to highlight
     * @param {Array<string>} terms - Terms to highlight
     * @returns {string} Text with highlighted terms
     */
    highlightText(text, terms) {
        if (!text || !terms || terms.length === 0) return text;
        
        let highlighted = text;
        
        terms.forEach(term => {
            const regex = new RegExp(`(${this.escapeRegex(term)})`, 'gi');
            highlighted = highlighted.replace(regex, '<mark class="search-highlight">$1</mark>');
        });
        
        return highlighted;
    }

    /**
     * Calculate string similarity (Jaro-Winkler algorithm)
     * @param {string} s1 - First string
     * @param {string} s2 - Second string
     * @returns {number} Similarity score (0-1)
     */
    calculateSimilarity(s1, s2) {
        if (s1 === s2) return 1.0;
        
        const len1 = s1.length;
        const len2 = s2.length;
        
        if (len1 === 0 || len2 === 0) return 0.0;
        
        const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
        const s1Matches = new Array(len1).fill(false);
        const s2Matches = new Array(len2).fill(false);
        
        let matches = 0;
        let transpositions = 0;
        
        // Find matches
        for (let i = 0; i < len1; i++) {
            const start = Math.max(0, i - matchWindow);
            const end = Math.min(i + matchWindow + 1, len2);
            
            for (let j = start; j < end; j++) {
                if (s2Matches[j] || s1[i] !== s2[j]) continue;
                s1Matches[i] = true;
                s2Matches[j] = true;
                matches++;
                break;
            }
        }
        
        if (matches === 0) return 0.0;
        
        // Count transpositions
        let k = 0;
        for (let i = 0; i < len1; i++) {
            if (!s1Matches[i]) continue;
            while (!s2Matches[k]) k++;
            if (s1[i] !== s2[k]) transpositions++;
            k++;
        }
        
        const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;
        
        // Jaro-Winkler prefix bonus
        let prefix = 0;
        for (let i = 0; i < Math.min(len1, len2, 4); i++) {
            if (s1[i] === s2[i]) prefix++;
            else break;
        }
        
        return jaro + (0.1 * prefix * (1 - jaro));
    }

    /**
     * Clear search results
     */
    clearSearch() {
        this.state.currentQuery = '';
        this.state.lastResults = [];
        stateManager.set('filteredPrompts', State.getPrompts());
        
        this.dispatchEvent(new CustomEvent(AppEvents.SEARCH_CLEARED));
    }

    /**
     * Clear search results only
     */
    clearResults() {
        this.state.lastResults = [];
        stateManager.set('filteredPrompts', []);
    }

    /**
     * Apply filter
     * @param {string} filterType - Filter type
     */
    applyFilter(filterType) {
        const templates = State.getPrompts();
        let filtered;
        
        switch (filterType) {
            case 'favorites':
                filtered = templates.filter(t => t.is_favorite);
                break;
            case 'recent':
                filtered = templates
                    .slice()
                    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
                    .slice(0, 20);
                break;
            case 'all':
            default:
                filtered = templates;
                break;
        }
        
        stateManager.set('filteredPrompts', filtered);
    }

    /**
     * Set sort criteria
     * @param {string} sortBy - Sort field
     * @param {string} direction - Sort direction (asc/desc)
     */
    setSortCriteria(sortBy, direction = null) {
        this.state.sortBy = sortBy;
        if (direction) {
            this.state.sortDirection = direction;
        }
        
        // Re-sort current results if any
        if (this.state.lastResults.length > 0) {
            const sorted = this.sortResults(this.state.lastResults);
            this.state.lastResults = sorted;
            stateManager.set('filteredPrompts', sorted.map(r => r.template));
        }
    }

    /**
     * Get cache key for search
     * @param {string} query - Search query
     * @param {Object} filters - Filters
     * @returns {string} Cache key
     */
    getCacheKey(query, filters = {}) {
        const filterKey = Object.keys(filters)
            .sort()
            .map(key => `${key}:${filters[key]}`)
            .join('|');
        
        return `${query.toLowerCase().trim()}::${filterKey}`;
    }

    /**
     * Cache search results
     * @param {string} key - Cache key
     * @param {Array} results - Results to cache
     */
    cacheResults(key, results) {
        // Implement LRU cache behavior
        if (this.resultCache.size >= this.maxCacheSize) {
            const firstKey = this.resultCache.keys().next().value;
            this.resultCache.delete(firstKey);
        }
        
        this.resultCache.set(key, results);
    }

    /**
     * Update average search time
     * @param {number} searchTime - Search time in milliseconds
     */
    updateAverageSearchTime(searchTime) {
        const total = this.stats.totalSearches;
        const current = this.stats.averageSearchTime;
        this.stats.averageSearchTime = ((current * (total - 1)) + searchTime) / total;
    }

    /**
     * Escape regex special characters
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeRegex(text) {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Debounce function
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Get search statistics
     * @returns {Object} Search statistics
     */
    getStats() {
        return {
            ...this.stats,
            cacheSize: this.resultCache.size,
            maxCacheSize: this.maxCacheSize,
            hitRate: this.stats.totalSearches > 0 
                ? ((this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)) * 100).toFixed(2) + '%'
                : '0%',
            currentQuery: this.state.currentQuery,
            lastResultCount: this.state.lastResults.length
        };
    }

    /**
     * Clear search cache
     */
    clearCache() {
        this.resultCache.clear();
        this.logger.info('Search cache cleared');
    }

    /**
     * Reset search manager
     */
    reset() {
        this.clearSearch();
        this.clearCache();
        this.index.terms.clear();
        this.index.documents.clear();
        
        this.stats = {
            totalSearches: 0,
            averageSearchTime: 0,
            indexSize: 0,
            lastIndexUpdate: null,
            cacheHits: 0,
            cacheMisses: 0
        };
        
        this.logger.info('SearchManager reset');
    }
}

/**
 * Default search manager instance
 */
export const searchManager = new SearchManager();