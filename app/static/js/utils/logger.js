/**
 * @fileoverview Centralized logging system for Prompt Editor v2.0
 * @description Replaces scattered console.log calls with a structured logging system
 */

/**
 * Log levels enumeration
 * @readonly
 * @enum {number}
 */
export const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4
};

/**
 * Logger configuration
 * @typedef {Object} LoggerConfig
 * @property {LogLevel} level - Minimum log level to display
 * @property {boolean} timestamp - Whether to include timestamps
 * @property {boolean} colors - Whether to use console colors
 * @property {string} prefix - Prefix for all log messages
 */

/**
 * Centralized Logger class for consistent logging across the application
 */
export class Logger {
    /**
     * Create a new Logger instance
     * @param {LoggerConfig} config - Logger configuration
     */
    constructor(config = {}) {
        this.level = config.level ?? LogLevel.INFO;
        this.timestamp = config.timestamp ?? true;
        this.colors = config.colors ?? true;
        this.prefix = config.prefix ?? '[PromptEditor]';
        
        // Color schemes for different log levels
        this.colorSchemes = {
            [LogLevel.DEBUG]: { 
                color: '#6B7280', 
                background: '#F9FAFB',
                emoji: '🔍'
            },
            [LogLevel.INFO]: { 
                color: '#2563EB', 
                background: '#EFF6FF',
                emoji: 'ℹ️'
            },
            [LogLevel.WARN]: { 
                color: '#D97706', 
                background: '#FFFBEB',
                emoji: '⚠️'
            },
            [LogLevel.ERROR]: { 
                color: '#DC2626', 
                background: '#FEF2F2',
                emoji: '❌'
            }
        };
    }

    /**
     * Format log message with timestamp and prefix
     * @param {LogLevel} level - Log level
     * @param {string} message - Log message
     * @param {Array} args - Additional arguments
     * @returns {Array} Formatted message parts
     */
    formatMessage(level, message, args) {
        const parts = [];
        const scheme = this.colorSchemes[level];
        
        if (this.colors && scheme) {
            // Styled prefix with emoji
            parts.push(
                `%c${scheme.emoji} ${this.prefix}`,
                `color: ${scheme.color}; background: ${scheme.background}; padding: 2px 6px; border-radius: 3px; font-weight: bold;`
            );
        } else {
            parts.push(`${this.prefix}`);
        }

        if (this.timestamp) {
            const time = new Date().toISOString().split('T')[1].split('.')[0];
            if (this.colors) {
                parts.push(
                    `%c[${time}]`,
                    'color: #6B7280; font-size: 0.9em;'
                );
            } else {
                parts.push(`[${time}]`);
            }
        }

        // Add the main message
        if (this.colors && scheme) {
            parts.push(`%c${message}`, `color: ${scheme.color};`);
        } else {
            parts.push(message);
        }

        // Add additional arguments
        if (args.length > 0) {
            parts.push(...args);
        }

        return parts;
    }

    /**
     * Check if log level should be displayed
     * @param {LogLevel} level - Log level to check
     * @returns {boolean} Whether to display this log level
     */
    shouldLog(level) {
        return level >= this.level && this.level !== LogLevel.NONE;
    }

    /**
     * Log debug message
     * @param {string} message - Message to log
     * @param {...any} args - Additional arguments
     */
    debug(message, ...args) {
        if (this.shouldLog(LogLevel.DEBUG)) {
            const parts = this.formatMessage(LogLevel.DEBUG, message, args);
            console.debug(...parts);
        }
    }

    /**
     * Log info message
     * @param {string} message - Message to log
     * @param {...any} args - Additional arguments
     */
    info(message, ...args) {
        if (this.shouldLog(LogLevel.INFO)) {
            const parts = this.formatMessage(LogLevel.INFO, message, args);
            console.info(...parts);
        }
    }

    /**
     * Log warning message
     * @param {string} message - Message to log
     * @param {...any} args - Additional arguments
     */
    warn(message, ...args) {
        if (this.shouldLog(LogLevel.WARN)) {
            const parts = this.formatMessage(LogLevel.WARN, message, args);
            console.warn(...parts);
        }
    }

    /**
     * Log error message
     * @param {string} message - Message to log
     * @param {...any} args - Additional arguments
     */
    error(message, ...args) {
        if (this.shouldLog(LogLevel.ERROR)) {
            const parts = this.formatMessage(LogLevel.ERROR, message, args);
            console.error(...parts);
        }
    }

    /**
     * Create a scoped logger for a specific module
     * @param {string} module - Module name
     * @returns {Logger} New logger instance with module prefix
     */
    createModuleLogger(module) {
        return new Logger({
            level: this.level,
            timestamp: this.timestamp,
            colors: this.colors,
            prefix: `${this.prefix}:${module}`
        });
    }

    /**
     * Set log level dynamically
     * @param {LogLevel} level - New log level
     */
    setLevel(level) {
        this.level = level;
        this.debug(`Log level changed to ${Object.keys(LogLevel)[level]}`);
    }

    /**
     * Enable/disable colors
     * @param {boolean} enabled - Whether to enable colors
     */
    setColors(enabled) {
        this.colors = enabled;
    }

    /**
     * Enable/disable timestamps
     * @param {boolean} enabled - Whether to enable timestamps
     */
    setTimestamp(enabled) {
        this.timestamp = enabled;
    }
}

/**
 * Default logger instance for the application
 */
export const logger = new Logger({
    level: LogLevel.INFO,
    timestamp: true,
    colors: true,
    prefix: '[PromptEditor]'
});

/**
 * Create specialized loggers for different modules
 */
export const createLogger = (module) => logger.createModuleLogger(module);

/**
 * Performance logging utility
 */
export class PerformanceLogger {
    constructor(logger) {
        this.logger = logger;
        this.timers = new Map();
    }

    /**
     * Start a performance timer
     * @param {string} name - Timer name
     */
    start(name) {
        this.timers.set(name, performance.now());
        this.logger.debug(`⏱️ Performance timer '${name}' started`);
    }

    /**
     * End a performance timer and log the result
     * @param {string} name - Timer name
     * @returns {number} Elapsed time in milliseconds
     */
    end(name) {
        const startTime = this.timers.get(name);
        if (!startTime) {
            this.logger.warn(`⏱️ Performance timer '${name}' not found`);
            return 0;
        }

        const elapsed = performance.now() - startTime;
        this.timers.delete(name);
        
        this.logger.info(`⏱️ Performance timer '${name}' finished: ${elapsed.toFixed(2)}ms`);
        return elapsed;
    }

    /**
     * Measure the execution time of a function
     * @param {string} name - Operation name
     * @param {Function} fn - Function to measure
     * @returns {Promise<any>} Function result
     */
    async measure(name, fn) {
        this.start(name);
        try {
            const result = await fn();
            this.end(name);
            return result;
        } catch (error) {
            this.end(name);
            this.logger.error(`⏱️ Performance timer '${name}' failed:`, error);
            throw error;
        }
    }
}

/**
 * Default performance logger instance
 */
export const performanceLogger = new PerformanceLogger(logger);

/**
 * Development mode helpers
 */
export const DevLogger = {
    /**
     * Enable debug mode (shows all logs)
     */
    enableDebug() {
        logger.setLevel(LogLevel.DEBUG);
        logger.info('🔧 Debug mode enabled - showing all logs');
    },

    /**
     * Enable production mode (errors and warnings only)
     */
    enableProduction() {
        logger.setLevel(LogLevel.WARN);
        logger.info('🚀 Production mode enabled - errors and warnings only');
    },

    /**
     * Disable all logging
     */
    disableLogging() {
        logger.setLevel(LogLevel.NONE);
    }
};