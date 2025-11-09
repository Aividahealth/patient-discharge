/**
 * Structured logging utility for Cloud Functions
 * Outputs JSON logs compatible with Cloud Logging
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

interface LogEntry {
  severity: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

class Logger {
  private component: string;

  constructor(component: string) {
    this.component = component;
  }

  private log(severity: LogLevel, message: string, metadata: Record<string, unknown> = {}): void {
    const entry: LogEntry = {
      severity,
      message,
      timestamp: new Date().toISOString(),
      component: this.component,
      ...metadata,
    };

    // Output as JSON for Cloud Logging
    console.log(JSON.stringify(entry));
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  warning(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.WARNING, message, metadata);
  }

  error(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    const errorMetadata = error
      ? {
          error: {
            message: error.message,
            name: error.name,
            stack: error.stack,
          },
          ...metadata,
        }
      : metadata;

    this.log(LogLevel.ERROR, message, errorMetadata);
  }

  critical(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    const errorMetadata = error
      ? {
          error: {
            message: error.message,
            name: error.name,
            stack: error.stack,
          },
          ...metadata,
        }
      : metadata;

    this.log(LogLevel.CRITICAL, message, errorMetadata);
  }
}

export function createLogger(component: string): Logger {
  return new Logger(component);
}
