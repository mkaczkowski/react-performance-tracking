import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createLogger, getLogLevel, LOG_PREFIX, logger, setLogLevel } from '@/utils/logger';

describe('logger', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Reset to default log level before each test
    setLogLevel('info');
  });

  describe('LOG_PREFIX', () => {
    it('should be [Performance]', () => {
      expect(LOG_PREFIX).toBe('[Performance]');
    });
  });

  describe('setLogLevel / getLogLevel', () => {
    it('should return default log level as info', () => {
      expect(getLogLevel()).toBe('info');
    });

    it('should change log level to silent', () => {
      setLogLevel('silent');
      expect(getLogLevel()).toBe('silent');
    });

    it('should change log level to error', () => {
      setLogLevel('error');
      expect(getLogLevel()).toBe('error');
    });

    it('should change log level to warn', () => {
      setLogLevel('warn');
      expect(getLogLevel()).toBe('warn');
    });

    it('should change log level to debug', () => {
      setLogLevel('debug');
      expect(getLogLevel()).toBe('debug');
    });
  });

  describe('createLogger', () => {
    it('should create logger with default Performance prefix', () => {
      const customLogger = createLogger();
      customLogger.info('test message');
      expect(consoleLogSpy).toHaveBeenCalledWith('[Performance] test message');
    });

    it('should create logger with custom prefix', () => {
      const customLogger = createLogger('CustomPrefix');
      customLogger.info('test message');
      expect(consoleLogSpy).toHaveBeenCalledWith('[CustomPrefix] test message');
    });

    it('should pass additional arguments to console methods', () => {
      const customLogger = createLogger();
      const extraData = { key: 'value' };
      customLogger.info('test message', extraData, 123);
      expect(consoleLogSpy).toHaveBeenCalledWith('[Performance] test message', extraData, 123);
    });
  });

  describe('default logger instance', () => {
    it('should have Performance prefix', () => {
      logger.info('test');
      expect(consoleLogSpy).toHaveBeenCalledWith('[Performance] test');
    });
  });

  describe('log level filtering', () => {
    describe('silent level', () => {
      beforeEach(() => {
        setLogLevel('silent');
      });

      it('should not log error messages', () => {
        logger.error('error message');
        expect(consoleErrorSpy).not.toHaveBeenCalled();
      });

      it('should not log warn messages', () => {
        logger.warn('warn message');
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });

      it('should not log info messages', () => {
        logger.info('info message');
        expect(consoleLogSpy).not.toHaveBeenCalled();
      });

      it('should not log debug messages', () => {
        logger.debug('debug message');
        expect(consoleLogSpy).not.toHaveBeenCalled();
      });
    });

    describe('error level', () => {
      beforeEach(() => {
        setLogLevel('error');
      });

      it('should log error messages', () => {
        logger.error('error message');
        expect(consoleErrorSpy).toHaveBeenCalledWith('[Performance] error message');
      });

      it('should not log warn messages', () => {
        logger.warn('warn message');
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });

      it('should not log info messages', () => {
        logger.info('info message');
        expect(consoleLogSpy).not.toHaveBeenCalled();
      });

      it('should not log debug messages', () => {
        logger.debug('debug message');
        expect(consoleLogSpy).not.toHaveBeenCalled();
      });
    });

    describe('warn level', () => {
      beforeEach(() => {
        setLogLevel('warn');
      });

      it('should log error messages', () => {
        logger.error('error message');
        expect(consoleErrorSpy).toHaveBeenCalledWith('[Performance] error message');
      });

      it('should log warn messages', () => {
        logger.warn('warn message');
        expect(consoleWarnSpy).toHaveBeenCalledWith('[Performance] warn message');
      });

      it('should not log info messages', () => {
        logger.info('info message');
        expect(consoleLogSpy).not.toHaveBeenCalled();
      });

      it('should not log debug messages', () => {
        logger.debug('debug message');
        expect(consoleLogSpy).not.toHaveBeenCalled();
      });
    });

    describe('info level (default)', () => {
      beforeEach(() => {
        setLogLevel('info');
      });

      it('should log error messages', () => {
        logger.error('error message');
        expect(consoleErrorSpy).toHaveBeenCalledWith('[Performance] error message');
      });

      it('should log warn messages', () => {
        logger.warn('warn message');
        expect(consoleWarnSpy).toHaveBeenCalledWith('[Performance] warn message');
      });

      it('should log info messages', () => {
        logger.info('info message');
        expect(consoleLogSpy).toHaveBeenCalledWith('[Performance] info message');
      });

      it('should not log debug messages', () => {
        logger.debug('debug message');
        expect(consoleLogSpy).not.toHaveBeenCalled();
      });
    });

    describe('debug level', () => {
      beforeEach(() => {
        setLogLevel('debug');
      });

      it('should log error messages', () => {
        logger.error('error message');
        expect(consoleErrorSpy).toHaveBeenCalledWith('[Performance] error message');
      });

      it('should log warn messages', () => {
        logger.warn('warn message');
        expect(consoleWarnSpy).toHaveBeenCalledWith('[Performance] warn message');
      });

      it('should log info messages', () => {
        logger.info('info message');
        expect(consoleLogSpy).toHaveBeenCalledWith('[Performance] info message');
      });

      it('should log debug messages with DEBUG marker', () => {
        logger.debug('debug message');
        expect(consoleLogSpy).toHaveBeenCalledWith('[Performance] [DEBUG] debug message');
      });
    });
  });

  describe('runtime log level changes', () => {
    it('should respect level changes at runtime', () => {
      // Start with info level
      setLogLevel('info');
      logger.info('should appear');
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);

      // Change to silent
      setLogLevel('silent');
      logger.info('should not appear');
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);

      // Change back to info
      setLogLevel('info');
      logger.info('should appear again');
      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
    });

    it('should affect all logger instances', () => {
      const logger1 = createLogger('Logger1');
      const logger2 = createLogger('Logger2');

      setLogLevel('info');
      logger1.info('message 1');
      logger2.info('message 2');
      expect(consoleLogSpy).toHaveBeenCalledTimes(2);

      setLogLevel('silent');
      logger1.info('message 3');
      logger2.info('message 4');
      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('multiple arguments', () => {
    it('should pass all arguments to error', () => {
      const error = new Error('test error');
      logger.error('Failed:', error, { context: 'test' });
      expect(consoleErrorSpy).toHaveBeenCalledWith('[Performance] Failed:', error, {
        context: 'test',
      });
    });

    it('should pass all arguments to warn', () => {
      logger.warn('Warning:', 'detail', 123);
      expect(consoleWarnSpy).toHaveBeenCalledWith('[Performance] Warning:', 'detail', 123);
    });

    it('should pass all arguments to info', () => {
      logger.info('Info:', { data: true }, [1, 2, 3]);
      expect(consoleLogSpy).toHaveBeenCalledWith('[Performance] Info:', { data: true }, [1, 2, 3]);
    });

    it('should pass all arguments to debug', () => {
      setLogLevel('debug');
      logger.debug('Debug:', { verbose: true });
      expect(consoleLogSpy).toHaveBeenCalledWith('[Performance] [DEBUG] Debug:', { verbose: true });
    });
  });

  describe('edge cases', () => {
    it('should handle empty message', () => {
      logger.info('');
      expect(consoleLogSpy).toHaveBeenCalledWith('[Performance] ');
    });

    it('should handle undefined additional args', () => {
      logger.info('message', undefined, null);
      expect(consoleLogSpy).toHaveBeenCalledWith('[Performance] message', undefined, null);
    });

    it('should handle special characters in prefix', () => {
      const specialLogger = createLogger('Test:Module/Sub');
      specialLogger.info('test');
      expect(consoleLogSpy).toHaveBeenCalledWith('[Test:Module/Sub] test');
    });
  });
});
