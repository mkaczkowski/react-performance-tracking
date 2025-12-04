/**
 * Log levels for the logger.
 * - silent: No output
 * - error: Only errors
 * - warn: Errors and warnings
 * - info: Errors, warnings, and info messages
 * - debug: All messages including debug
 */
export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

/**
 * Logger interface.
 */
export type Logger = {
  error: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  debug: (message: string, ...args: unknown[]) => void;
};

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

/** Current log level. Can be changed at runtime. */
let currentLogLevel: LogLevel = 'info';

/**
 * Sets the global log level.
 * @param level - The desired log level
 */
export const setLogLevel = (level: LogLevel): void => {
  currentLogLevel = level;
};

/**
 * Gets the current log level.
 */
export const getLogLevel = (): LogLevel => currentLogLevel;

/**
 * Checks if a message at the given level should be logged.
 */
const shouldLog = (level: LogLevel): boolean => {
  return LOG_LEVEL_PRIORITY[level] <= LOG_LEVEL_PRIORITY[currentLogLevel];
};

/**
 * Creates a logger with a specific prefix.
 * @param prefix - Prefix to prepend to all messages (default: 'Performance')
 */
export const createLogger = (prefix = 'Performance'): Logger => {
  const formattedPrefix = `[${prefix}]`;

  return {
    error: (message: string, ...args: unknown[]) => {
      if (shouldLog('error')) {
        console.error(`${formattedPrefix} ${message}`, ...args);
      }
    },
    warn: (message: string, ...args: unknown[]) => {
      if (shouldLog('warn')) {
        console.warn(`${formattedPrefix} ${message}`, ...args);
      }
    },
    info: (message: string, ...args: unknown[]) => {
      if (shouldLog('info')) {
        console.log(`${formattedPrefix} ${message}`, ...args);
      }
    },
    debug: (message: string, ...args: unknown[]) => {
      if (shouldLog('debug')) {
        console.log(`${formattedPrefix} [DEBUG] ${message}`, ...args);
      }
    },
  };
};

/** Default logger instance with 'Performance' prefix */
export const logger = createLogger();

/** Default log prefix for direct console output */
export const LOG_PREFIX = '[Performance]';
