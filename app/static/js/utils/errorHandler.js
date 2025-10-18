/**
 * @fileoverview Error handling utilities for Prompt Editor v2.0
 * @description Centralized error handling, validation, and user feedback system
 */

import { logger, createLogger } from './logger.js';
import { AppConstants, AppEvents } from '../config/constants.js';

/**
 * @typedef {Object} ErrorInfo
 * @property {string} code - Error code
 * @property {string} message - Error message
 * @property {string} type - Error type
 * @property {any} context - Additional context
 * @property {Error} originalError - Original error object
 * @property {string} timestamp - Error timestamp
 */

/**
 * Error types enumeration
 * @readonly
 * @enum {string}
 */
export const ErrorType = {
    VALIDATION: 'VALIDATION',
    NETWORK: 'NETWORK', 
    API: 'API',
    UI: 'UI',
    STATE: 'STATE',
    STORAGE: 'STORAGE',
    UNKNOWN: 'UNKNOWN'
};

/**
 * Error codes enumeration
 * @readonly
 * @enum {string}
 */
export const ErrorCode = {
    // Validation errors
    REQUIRED_FIELD: 'REQUIRED_FIELD',
    INVALID_FORMAT: 'INVALID_FORMAT',
    DUPLICATE_NAME: 'DUPLICATE_NAME',
    
    // Network errors
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT: 'TIMEOUT',
    CONNECTION_LOST: 'CONNECTION_LOST',
    
    // API errors
    API_ERROR: 'API_ERROR',
    UNAUTHORIZED: 'UNAUTHORIZED',
    NOT_FOUND: 'NOT_FOUND',
    SERVER_ERROR: 'SERVER_ERROR',
    
    // UI errors
    ELEMENT_NOT_FOUND: 'ELEMENT_NOT_FOUND',
    RENDER_ERROR: 'RENDER_ERROR',
    EVENT_ERROR: 'EVENT_ERROR',
    
    // State errors
    STATE_ERROR: 'STATE_ERROR',
    INVALID_STATE: 'INVALID_STATE',
    
    // Storage errors
    STORAGE_ERROR: 'STORAGE_ERROR',
    QUOTA_EXCEEDED: 'QUOTA_EXCEEDED'
};

/**
 * Custom Application Error class
 */
export class AppError extends Error {
    /**
     * Create a new AppError
     * @param {string} message - Error message
     * @param {string} code - Error code
     * @param {string} type - Error type
     * @param {any} context - Additional context
     * @param {Error} originalError - Original error
     */
    constructor(message, code = ErrorCode.UNKNOWN, type = ErrorType.UNKNOWN, context = null, originalError = null) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.type = type;
        this.context = context;
        this.originalError = originalError;
        this.timestamp = new Date().toISOString();
        
        // Maintain stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AppError);
        }
    }

    /**
     * Convert error to JSON representation
     * @returns {Object} JSON representation
     */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            type: this.type,
            context: this.context,
            timestamp: this.timestamp,
            stack: this.stack
        };
    }
}

/**
 * Error Handler class for centralized error management
 */
export class ErrorHandler extends EventTarget {
    /**
     * Create a new ErrorHandler
     */
    constructor() {
        super();
        this.logger = createLogger('ErrorHandler');
        this.errorHistory = [];
        this.maxHistorySize = 100;
        this.errorCounts = new Map();
        
        // Set up global error handlers
        this.setupGlobalHandlers();
        
        this.logger.info('ErrorHandler initialized');
    }

    /**
     * Set up global error handlers
     */
    setupGlobalHandlers() {
        // Handle uncaught JavaScript errors
        window.addEventListener('error', (event) => {
            this.handle(new AppError(
                `Uncaught error: ${event.message}`,
                ErrorCode.UNKNOWN,
                ErrorType.UNKNOWN,
                {
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno
                },
                event.error
            ));
        });

        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.handle(new AppError(
                `Unhandled promise rejection: ${event.reason}`,
                ErrorCode.UNKNOWN,
                ErrorType.UNKNOWN,
                { reason: event.reason },
                event.reason instanceof Error ? event.reason : null
            ));
        });
    }

    /**
     * Handle an error
     * @param {Error|AppError} error - Error to handle
     * @param {boolean} silent - Whether to suppress user notifications
     */
    handle(error, silent = false) {
        let appError;
        
        if (error instanceof AppError) {
            appError = error;
        } else {
            // Convert regular Error to AppError
            appError = new AppError(
                error.message,
                this.getErrorCode(error),
                this.getErrorType(error),
                null,
                error
            );
        }

        // Add to history
        this.addToHistory(appError);
        
        // Update error counts
        this.updateErrorCounts(appError);
        
        // Log the error
        this.logError(appError);
        
        // Emit error event
        this.dispatchEvent(new CustomEvent(AppEvents.ERROR_OCCURRED, {
            detail: { error: appError, silent }
        }));
        
        // Show user notification if not silent
        if (!silent) {
            this.showUserError(appError);
        }
    }

    /**
     * Get error code based on error characteristics
     * @param {Error} error - Original error
     * @returns {string} Error code
     */
    getErrorCode(error) {
        if (error.name === 'TypeError') return ErrorCode.INVALID_FORMAT;
        if (error.name === 'ReferenceError') return ErrorCode.ELEMENT_NOT_FOUND;
        if (error.name === 'NetworkError') return ErrorCode.NETWORK_ERROR;
        if (error.message.includes('fetch')) return ErrorCode.NETWORK_ERROR;
        if (error.message.includes('timeout')) return ErrorCode.TIMEOUT;
        
        return ErrorCode.UNKNOWN;
    }

    /**
     * Get error type based on error characteristics
     * @param {Error} error - Original error
     * @returns {string} Error type
     */
    getErrorType(error) {
        if (error.name === 'ValidationError') return ErrorType.VALIDATION;
        if (error.name === 'NetworkError' || error.message.includes('fetch')) return ErrorType.NETWORK;
        if (error.message.includes('DOM') || error.message.includes('element')) return ErrorType.UI;
        
        return ErrorType.UNKNOWN;
    }

    /**
     * Add error to history
     * @param {AppError} error - Error to add
     */
    addToHistory(error) {
        this.errorHistory.push(error);
        
        // Trim history if needed
        if (this.errorHistory.length > this.maxHistorySize) {
            this.errorHistory = this.errorHistory.slice(-this.maxHistorySize);
        }
    }

    /**
     * Update error occurrence counts
     * @param {AppError} error - Error to count
     */
    updateErrorCounts(error) {
        const key = `${error.type}:${error.code}`;
        const count = this.errorCounts.get(key) || 0;
        this.errorCounts.set(key, count + 1);
    }

    /**
     * Log error with appropriate level
     * @param {AppError} error - Error to log
     */
    logError(error) {
        const context = {
            code: error.code,
            type: error.type,
            context: error.context,
            timestamp: error.timestamp
        };

        switch (error.type) {
            case ErrorType.VALIDATION:
                this.logger.warn(`Validation Error: ${error.message}`, context);
                break;
            case ErrorType.NETWORK:
            case ErrorType.API:
                this.logger.error(`${error.type} Error: ${error.message}`, context);
                break;
            default:
                this.logger.error(`Application Error: ${error.message}`, context);
        }

        // Log original error stack if available
        if (error.originalError && error.originalError.stack) {
            this.logger.debug('Original error stack:', error.originalError.stack);
        }
    }

    /**
     * Show error to user
     * @param {AppError} error - Error to show
     */
    showUserError(error) {
        const message = this.getUserFriendlyMessage(error);
        
        // Try to show in UI notification system
        if (window.NotificationManager) {
            window.NotificationManager.showError(message);
        } else {
            // Fallback to console
            console.error('User Error:', message);
        }
    }

    /**
     * Get user-friendly error message
     * @param {AppError} error - Error object
     * @returns {string} User-friendly message
     */
    getUserFriendlyMessage(error) {
        const messages = {
            [ErrorCode.REQUIRED_FIELD]: 'Ce champ est requis.',
            [ErrorCode.INVALID_FORMAT]: 'Le format saisi est invalide.',
            [ErrorCode.DUPLICATE_NAME]: 'Ce nom existe déjà.',
            [ErrorCode.NETWORK_ERROR]: 'Erreur de connexion. Veuillez réessayer.',
            [ErrorCode.TIMEOUT]: 'Délai d\'attente dépassé. Veuillez réessayer.',
            [ErrorCode.API_ERROR]: 'Erreur du serveur. Veuillez réessayer plus tard.',
            [ErrorCode.NOT_FOUND]: 'Élément introuvable.',
            [ErrorCode.STORAGE_ERROR]: 'Erreur de sauvegarde. Veuillez réessayer.',
            [ErrorCode.ELEMENT_NOT_FOUND]: 'Élément de l\'interface introuvable.'
        };

        return messages[error.code] || 'Une erreur inattendue s\'est produite.';
    }

    /**
     * Get error statistics
     * @returns {Object} Error statistics
     */
    getStats() {
        const stats = {
            totalErrors: this.errorHistory.length,
            errorsByType: {},
            errorsByCode: {},
            recentErrors: this.errorHistory.slice(-10),
            topErrors: []
        };

        // Count by type
        for (const error of this.errorHistory) {
            stats.errorsByType[error.type] = (stats.errorsByType[error.type] || 0) + 1;
            stats.errorsByCode[error.code] = (stats.errorsByCode[error.code] || 0) + 1;
        }

        // Get top errors
        stats.topErrors = Array.from(this.errorCounts.entries())
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([key, count]) => ({ key, count }));

        return stats;
    }

    /**
     * Clear error history
     */
    clearHistory() {
        this.errorHistory = [];
        this.errorCounts.clear();
        this.logger.info('Error history cleared');
    }
}

/**
 * Validation utilities
 */
export class Validator {
    /**
     * Validate required field
     * @param {any} value - Value to validate
     * @param {string} fieldName - Field name for error message
     * @throws {AppError} If validation fails
     */
    static required(value, fieldName) {
        if (value === null || value === undefined || value === '') {
            throw new AppError(
                `${fieldName} est requis`,
                ErrorCode.REQUIRED_FIELD,
                ErrorType.VALIDATION,
                { fieldName, value }
            );
        }
    }

    /**
     * Validate string length
     * @param {string} value - String to validate
     * @param {number} minLength - Minimum length
     * @param {number} maxLength - Maximum length
     * @param {string} fieldName - Field name
     * @throws {AppError} If validation fails
     */
    static stringLength(value, minLength, maxLength, fieldName) {
        if (typeof value !== 'string') {
            throw new AppError(
                `${fieldName} doit être une chaîne de caractères`,
                ErrorCode.INVALID_FORMAT,
                ErrorType.VALIDATION,
                { fieldName, value, expectedType: 'string' }
            );
        }

        if (value.length < minLength || value.length > maxLength) {
            throw new AppError(
                `${fieldName} doit contenir entre ${minLength} et ${maxLength} caractères`,
                ErrorCode.INVALID_FORMAT,
                ErrorType.VALIDATION,
                { fieldName, length: value.length, minLength, maxLength }
            );
        }
    }

    /**
     * Validate email format
     * @param {string} email - Email to validate
     * @throws {AppError} If validation fails
     */
    static email(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new AppError(
                'Format d\'email invalide',
                ErrorCode.INVALID_FORMAT,
                ErrorType.VALIDATION,
                { email }
            );
        }
    }
}

/**
 * Default error handler instance
 */
export const errorHandler = new ErrorHandler();

/**
 * Convenience function to handle errors
 * @param {Error|AppError} error - Error to handle
 * @param {boolean} silent - Whether to suppress notifications
 */
export const handleError = (error, silent = false) => {
    errorHandler.handle(error, silent);
};

/**
 * Create a new AppError
 * @param {string} message - Error message
 * @param {string} code - Error code
 * @param {string} type - Error type
 * @param {any} context - Additional context
 * @returns {AppError} New AppError instance
 */
export const createError = (message, code, type, context) => {
    return new AppError(message, code, type, context);
};

/**
 * Async error wrapper function
 * @param {Function} fn - Async function to wrap
 * @param {string} context - Context description
 * @returns {Function} Wrapped function
 */
export const asyncErrorHandler = (fn, context) => {
    return async (...args) => {
        try {
            return await fn(...args);
        } catch (error) {
            handleError(new AppError(
                `Error in ${context}: ${error.message}`,
                ErrorCode.UNKNOWN,
                ErrorType.UNKNOWN,
                { context, args: args.length },
                error
            ));
            throw error;
        }
    };
};