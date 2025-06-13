import winston from 'winston';
import path from 'path';

const logDir = path.join(process.cwd(), 'logs');

// Ensure log directory exists
import fs from 'fs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Custom format for structured logging
const customFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.align(),
  winston.format.printf(info => {
    const { timestamp, level, message, ...extra } = info;
    const extraStr = Object.keys(extra).length ? JSON.stringify(extra, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${extraStr}`;
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  defaultMeta: { service: 'mado-orchestrator' },
  transports: [
    // File transport for errors
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Console transport
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    }),
  ],
});

// Agent-specific logger
export class AgentLogger {
  private agentLogger: winston.Logger;

  constructor(agentId: string) {
    this.agentLogger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.label({ label: agentId })
      ),
      defaultMeta: { service: 'mado-agent', agentId },
      transports: [
        new winston.transports.File({
          filename: path.join(logDir, `agent-${agentId}.log`),
          maxsize: 5242880, // 5MB
          maxFiles: 3,
        }),
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: 'HH:mm:ss' }),
            winston.format.printf(info => {
              return `${info.timestamp} [${agentId}] ${info.level}: ${info.message}`;
            })
          ),
        }),
      ],
    });
  }

  debug(message: string, meta?: any): void {
    this.agentLogger.debug(message, meta);
  }

  info(message: string, meta?: any): void {
    this.agentLogger.info(message, meta);
  }

  warn(message: string, meta?: any): void {
    this.agentLogger.warn(message, meta);
  }

  error(message: string, error?: Error | any): void {
    this.agentLogger.error(message, error);
  }
}

// Performance logger for metrics
export class PerformanceLogger {
  private startTimes: Map<string, number> = new Map();

  startTimer(operation: string): void {
    this.startTimes.set(operation, Date.now());
  }

  endTimer(operation: string, metadata?: any): void {
    const startTime = this.startTimes.get(operation);
    if (startTime) {
      const duration = Date.now() - startTime;
      logger.info(`Performance: ${operation} completed`, {
        operation,
        duration: `${duration}ms`,
        ...metadata,
      });
      this.startTimes.delete(operation);
    }
  }

  logMetric(metric: string, value: number, unit: string, metadata?: any): void {
    logger.info(`Metric: ${metric}`, {
      metric,
      value,
      unit,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  }
}

export const performanceLogger = new PerformanceLogger();

// Structured logging helpers
export const logHelpers = {
  agentAction: (agentId: string, action: string, metadata?: any) => {
    logger.info(`Agent action: ${action}`, {
      agentId,
      action,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  },

  taskEvent: (taskId: string, event: string, metadata?: any) => {
    logger.info(`Task event: ${event}`, {
      taskId,
      event,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  },

  systemEvent: (event: string, metadata?: any) => {
    logger.info(`System event: ${event}`, {
      event,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  },

  error: (context: string, error: Error, metadata?: any) => {
    logger.error(`Error in ${context}`, {
      context,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  },

  audit: (action: string, userId?: string, metadata?: any) => {
    logger.info(`Audit: ${action}`, {
      action,
      userId,
      timestamp: new Date().toISOString(),
      type: 'audit',
      ...metadata,
    });
  },
};

export default logger;