/**
 * @fileoverview Centralized API client for Prompt Editor v2.0
 * @description Handles all HTTP requests with error handling, retry logic, and consistent response processing
 */

import { logger, createLogger, performanceLogger } from '../utils/logger.js';
import { handleError, createError, ErrorType, ErrorCode } from '../utils/errorHandler.js';
import { ApiEndpoints, AppConstants } from '../config/constants.js';

/**
 * @typedef {Object} ApiResponse
 * @property {boolean} success - Request success status
 * @property {any} data - Response data
 * @property {string} message - Response message
 * @property {number} status - HTTP status code
 * @property {Object} headers - Response headers
 */

/**
 * @typedef {Object} RequestConfig
 * @property {string} method - HTTP method
 * @property {Object} headers - Request headers
 * @property {any} body - Request body
 * @property {number} timeout - Request timeout in milliseconds
 * @property {boolean} retry - Whether to retry on failure
 * @property {number} retryAttempts - Number of retry attempts
 * @property {number} retryDelay - Delay between retries in milliseconds
 */

/**
 * Centralized API Client class
 */
export class ApiClient {
    /**
     * Create a new ApiClient instance
     * @param {Object} config - Client configuration
     */
    constructor(config = {}) {
        this.logger = createLogger('ApiClient');
        this.baseUrl = config.baseUrl || '/api';
        this.timeout = config.timeout || AppConstants.API_TIMEOUT || 10000;
        this.retryAttempts = config.retryAttempts || 3;
        this.retryDelay = config.retryDelay || 1000;
        
        // Default headers
        this.defaultHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...config.headers
        };
        
        // Request interceptors
        this.requestInterceptors = [];
        this.responseInterceptors = [];
        
        // Statistics
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            lastRequestTime: null
        };
        
        this.logger.info('ApiClient initialized', {
            baseUrl: this.baseUrl,
            timeout: this.timeout,
            retryAttempts: this.retryAttempts
        });
    }

    /**
     * Add request interceptor
     * @param {Function} interceptor - Interceptor function
     */
    addRequestInterceptor(interceptor) {
        this.requestInterceptors.push(interceptor);
    }

    /**
     * Add response interceptor
     * @param {Function} interceptor - Interceptor function
     */
    addResponseInterceptor(interceptor) {
        this.responseInterceptors.push(interceptor);
    }

    /**
     * Build full URL from endpoint
     * @param {string} endpoint - API endpoint
     * @param {Object} params - Query parameters
     * @returns {string} Full URL
     */
    buildUrl(endpoint, params = {}) {
        const url = new URL(endpoint, window.location.origin + this.baseUrl);
        
        // Add query parameters
        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== undefined) {
                url.searchParams.append(key, params[key]);
            }
        });
        
        return url.toString();
    }

    /**
     * Apply request interceptors
     * @param {RequestConfig} config - Request configuration
     * @returns {RequestConfig} Modified configuration
     */
    async applyRequestInterceptors(config) {
        let modifiedConfig = { ...config };
        
        for (const interceptor of this.requestInterceptors) {
            try {
                modifiedConfig = await interceptor(modifiedConfig) || modifiedConfig;
            } catch (error) {
                this.logger.warn('Request interceptor failed:', error);
            }
        }
        
        return modifiedConfig;
    }

    /**
     * Apply response interceptors
     * @param {Response} response - Fetch response
     * @returns {Response} Modified response
     */
    async applyResponseInterceptors(response) {
        let modifiedResponse = response;
        
        for (const interceptor of this.responseInterceptors) {
            try {
                modifiedResponse = await interceptor(modifiedResponse) || modifiedResponse;
            } catch (error) {
                this.logger.warn('Response interceptor failed:', error);
            }
        }
        
        return modifiedResponse;
    }

    /**
     * Make HTTP request with retry logic
     * @param {string} endpoint - API endpoint
     * @param {RequestConfig} config - Request configuration
     * @returns {Promise<ApiResponse>} API response
     */
    async request(endpoint, config = {}) {
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const timerName = `API Request: ${config.method || 'GET'} ${endpoint}`;
        
        // Update statistics
        this.stats.totalRequests++;
        this.stats.lastRequestTime = new Date().toISOString();
        
        // Start performance timer
        performanceLogger.start(timerName);
        
        // Build request configuration
        const requestConfig = {
            method: 'GET',
            headers: { ...this.defaultHeaders },
            timeout: this.timeout,
            retry: true,
            retryAttempts: this.retryAttempts,
            retryDelay: this.retryDelay,
            ...config
        };
        
        // Apply request interceptors
        const finalConfig = await this.applyRequestInterceptors(requestConfig);
        
        this.logger.debug(`Making API request [${requestId}]:`, {
            endpoint,
            method: finalConfig.method,
            headers: finalConfig.headers
        });
        
        let lastError = null;
        let attempts = 0;
        const maxAttempts = finalConfig.retry ? finalConfig.retryAttempts + 1 : 1;
        
        while (attempts < maxAttempts) {
            attempts++;
            
            try {
                const response = await this.makeRequest(endpoint, finalConfig, requestId);
                
                // Update success statistics
                this.stats.successfulRequests++;
                const responseTime = performanceLogger.end(timerName);
                this.updateAverageResponseTime(responseTime);
                
                this.logger.debug(`API request successful [${requestId}]:`, {
                    status: response.status,
                    attempts,
                    responseTime: `${responseTime.toFixed(2)}ms`
                });
                
                return response;
                
            } catch (error) {
                lastError = error;
                
                this.logger.warn(`API request attempt ${attempts} failed [${requestId}]:`, error);
                
                // Check if we should retry
                if (attempts < maxAttempts && this.shouldRetry(error)) {
                    const delay = finalConfig.retryDelay * Math.pow(2, attempts - 1); // Exponential backoff
                    this.logger.info(`Retrying request [${requestId}] in ${delay}ms...`);
                    await this.sleep(delay);
                    continue;
                }
                
                break;
            }
        }
        
        // All attempts failed
        this.stats.failedRequests++;
        performanceLogger.end(timerName);
        
        const apiError = createError(
            `API request failed after ${attempts} attempts: ${lastError.message}`,
            this.getErrorCode(lastError),
            ErrorType.API,
            {
                endpoint,
                method: finalConfig.method,
                attempts,
                requestId
            },
            lastError
        );
        
        this.logger.error(`API request failed [${requestId}]:`, apiError);
        handleError(apiError);
        
        throw apiError;
    }

    /**
     * Make actual HTTP request
     * @param {string} endpoint - API endpoint
     * @param {RequestConfig} config - Request configuration
     * @param {string} requestId - Request ID for tracking
     * @returns {Promise<ApiResponse>} API response
     */
    async makeRequest(endpoint, config, requestId) {
        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout);
        
        try {
            // Build URL
            const url = endpoint.startsWith('http') ? endpoint : this.buildUrl(endpoint);
            
            // Prepare fetch options
            const fetchOptions = {
                method: config.method,
                headers: config.headers,
                signal: controller.signal
            };
            
            // Add body for non-GET requests
            if (config.body && config.method !== 'GET') {
                if (typeof config.body === 'object') {
                    fetchOptions.body = JSON.stringify(config.body);
                } else {
                    fetchOptions.body = config.body;
                }
            }
            
            // Make request
            let response = await fetch(url, fetchOptions);
            
            // Apply response interceptors
            response = await this.applyResponseInterceptors(response);
            
            // Clear timeout
            clearTimeout(timeoutId);
            
            // Process response
            return await this.processResponse(response, requestId);
            
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw createError(
                    'Request timeout',
                    ErrorCode.TIMEOUT,
                    ErrorType.NETWORK,
                    { timeout: config.timeout },
                    error
                );
            }
            
            throw this.processNetworkError(error);
        }
    }

    /**
     * Process fetch response
     * @param {Response} response - Fetch response
     * @param {string} requestId - Request ID
     * @returns {Promise<ApiResponse>} Processed response
     */
    async processResponse(response, requestId) {
        const apiResponse = {
            success: response.ok,
            status: response.status,
            headers: Object.fromEntries(response.headers.entries()),
            data: null,
            message: ''
        };
        
        try {
            // Try to parse JSON response
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                apiResponse.data = await response.json();
            } else {
                apiResponse.data = await response.text();
            }
            
            // Handle error responses
            if (!response.ok) {
                const errorMessage = apiResponse.data?.message || 
                                   apiResponse.data?.error || 
                                   `HTTP ${response.status}: ${response.statusText}`;
                
                throw createError(
                    errorMessage,
                    this.getHttpErrorCode(response.status),
                    ErrorType.API,
                    {
                        status: response.status,
                        statusText: response.statusText,
                        data: apiResponse.data,
                        requestId
                    }
                );
            }
            
            // Set success message
            apiResponse.message = apiResponse.data?.message || 'Request successful';
            
            return apiResponse;
            
        } catch (error) {
            if (error instanceof Error && error.code) {
                throw error; // Re-throw our custom errors
            }
            
            throw createError(
                'Failed to process response',
                ErrorCode.API_ERROR,
                ErrorType.API,
                { 
                    status: response.status,
                    requestId
                },
                error
            );
        }
    }

    /**
     * Process network error
     * @param {Error} error - Network error
     * @returns {Error} Processed error
     */
    processNetworkError(error) {
        if (error.message.includes('Failed to fetch')) {
            return createError(
                'Network connection failed',
                ErrorCode.NETWORK_ERROR,
                ErrorType.NETWORK,
                null,
                error
            );
        }
        
        return createError(
            `Network error: ${error.message}`,
            ErrorCode.NETWORK_ERROR,
            ErrorType.NETWORK,
            null,
            error
        );
    }

    /**
     * Determine if request should be retried
     * @param {Error} error - Request error
     * @returns {boolean} Whether to retry
     */
    shouldRetry(error) {
        // Don't retry on client errors (4xx) except for specific cases
        if (error.code === ErrorCode.UNAUTHORIZED || 
            error.code === ErrorCode.NOT_FOUND) {
            return false;
        }
        
        // Retry on network errors and server errors (5xx)
        return error.type === ErrorType.NETWORK || 
               error.code === ErrorCode.SERVER_ERROR ||
               error.code === ErrorCode.TIMEOUT;
    }

    /**
     * Get error code from HTTP status
     * @param {number} status - HTTP status code
     * @returns {string} Error code
     */
    getHttpErrorCode(status) {
        const errorCodes = {
            400: ErrorCode.API_ERROR,
            401: ErrorCode.UNAUTHORIZED,
            404: ErrorCode.NOT_FOUND,
            500: ErrorCode.SERVER_ERROR,
            502: ErrorCode.SERVER_ERROR,
            503: ErrorCode.SERVER_ERROR,
            504: ErrorCode.TIMEOUT
        };
        
        return errorCodes[status] || ErrorCode.API_ERROR;
    }

    /**
     * Get error code from error object
     * @param {Error} error - Error object
     * @returns {string} Error code
     */
    getErrorCode(error) {
        if (error.code) return error.code;
        if (error.name === 'AbortError') return ErrorCode.TIMEOUT;
        if (error.message.includes('fetch')) return ErrorCode.NETWORK_ERROR;
        return ErrorCode.API_ERROR;
    }

    /**
     * Update average response time
     * @param {number} responseTime - Response time in milliseconds
     */
    updateAverageResponseTime(responseTime) {
        const total = this.stats.successfulRequests;
        const current = this.stats.averageResponseTime;
        this.stats.averageResponseTime = ((current * (total - 1)) + responseTime) / total;
    }

    /**
     * Sleep for specified duration
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise} Sleep promise
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * GET request
     * @param {string} endpoint - API endpoint
     * @param {Object} params - Query parameters
     * @param {RequestConfig} config - Request configuration
     * @returns {Promise<ApiResponse>} API response
     */
    async get(endpoint, params = {}, config = {}) {
        const url = Object.keys(params).length > 0 ? this.buildUrl(endpoint, params) : endpoint;
        return this.request(url, { ...config, method: 'GET' });
    }

    /**
     * POST request
     * @param {string} endpoint - API endpoint
     * @param {any} data - Request data
     * @param {RequestConfig} config - Request configuration
     * @returns {Promise<ApiResponse>} API response
     */
    async post(endpoint, data = null, config = {}) {
        return this.request(endpoint, { 
            ...config, 
            method: 'POST', 
            body: data 
        });
    }

    /**
     * PUT request
     * @param {string} endpoint - API endpoint
     * @param {any} data - Request data
     * @param {RequestConfig} config - Request configuration
     * @returns {Promise<ApiResponse>} API response
     */
    async put(endpoint, data = null, config = {}) {
        return this.request(endpoint, { 
            ...config, 
            method: 'PUT', 
            body: data 
        });
    }

    /**
     * DELETE request
     * @param {string} endpoint - API endpoint
     * @param {RequestConfig} config - Request configuration
     * @returns {Promise<ApiResponse>} API response
     */
    async delete(endpoint, config = {}) {
        return this.request(endpoint, { 
            ...config, 
            method: 'DELETE' 
        });
    }

    /**
     * PATCH request
     * @param {string} endpoint - API endpoint
     * @param {any} data - Request data
     * @param {RequestConfig} config - Request configuration
     * @returns {Promise<ApiResponse>} API response
     */
    async patch(endpoint, data = null, config = {}) {
        return this.request(endpoint, { 
            ...config, 
            method: 'PATCH', 
            body: data 
        });
    }

    /**
     * Get API statistics
     * @returns {Object} API statistics
     */
    getStats() {
        return {
            ...this.stats,
            successRate: this.stats.totalRequests > 0 
                ? (this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(2) + '%'
                : '0%'
        };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            lastRequestTime: null
        };
        this.logger.info('API statistics reset');
    }
}

/**
 * Default API client instance
 */
export const apiClient = new ApiClient();

/**
 * Template API methods
 */
export const TemplateAPI = {
    /**
     * Get all templates with optional filters
     * @param {Object} filters - Filter parameters
     * @returns {Promise<ApiResponse>} Templates response
     */
    getAll(filters = {}) {
        return apiClient.get(ApiEndpoints.TEMPLATES, filters);
    },

    /**
     * Get template by ID
     * @param {string|number} id - Template ID
     * @returns {Promise<ApiResponse>} Template response
     */
    getById(id) {
        return apiClient.get(`${ApiEndpoints.TEMPLATES}/${id}`);
    },

    /**
     * Create new template
     * @param {Object} templateData - Template data
     * @returns {Promise<ApiResponse>} Create response
     */
    create(templateData) {
        return apiClient.post(ApiEndpoints.TEMPLATES, templateData);
    },

    /**
     * Update existing template
     * @param {string|number} id - Template ID
     * @param {Object} templateData - Updated template data
     * @returns {Promise<ApiResponse>} Update response
     */
    update(id, templateData) {
        return apiClient.put(`${ApiEndpoints.TEMPLATES}/${id}`, templateData);
    },

    /**
     * Delete template
     * @param {string|number} id - Template ID
     * @returns {Promise<ApiResponse>} Delete response
     */
    delete(id) {
        return apiClient.delete(`${ApiEndpoints.TEMPLATES}/${id}`);
    },

    /**
     * Toggle template favorite status
     * @param {string|number} id - Template ID
     * @param {boolean} isFavorite - Favorite status
     * @returns {Promise<ApiResponse>} Favorite response
     */
    toggleFavorite(id, isFavorite) {
        return apiClient.put(`${ApiEndpoints.TEMPLATES}/${id}/favorite`, { 
            is_favorite: isFavorite 
        });
    },

    /**
     * Get favorite templates
     * @returns {Promise<ApiResponse>} Favorites response
     */
    getFavorites() {
        return apiClient.get(ApiEndpoints.TEMPLATES, { favorites: true });
    },

    /**
     * Duplicate template
     * @param {string|number} id - Template ID
     * @param {Object} overrides - Property overrides
     * @returns {Promise<ApiResponse>} Duplicate response
     */
    duplicate(id, overrides = {}) {
        return apiClient.post(`${ApiEndpoints.TEMPLATES}/${id}/duplicate`, overrides);
    }
};

/**
 * Folder API methods
 */
export const FolderAPI = {
    /**
     * Get all folders
     * @returns {Promise<ApiResponse>} Folders response
     */
    getAll() {
        return apiClient.get(ApiEndpoints.FOLDERS);
    },

    /**
     * Create new folder
     * @param {Object} folderData - Folder data
     * @returns {Promise<ApiResponse>} Create response
     */
    create(folderData) {
        return apiClient.post(ApiEndpoints.FOLDERS, folderData);
    },

    /**
     * Update folder
     * @param {string|number} id - Folder ID
     * @param {Object} folderData - Updated folder data
     * @returns {Promise<ApiResponse>} Update response
     */
    update(id, folderData) {
        return apiClient.put(`${ApiEndpoints.FOLDERS}/${id}`, folderData);
    },

    /**
     * Delete folder
     * @param {string|number} id - Folder ID
     * @returns {Promise<ApiResponse>} Delete response
     */
    delete(id) {
        return apiClient.delete(`${ApiEndpoints.FOLDERS}/${id}`);
    }
};