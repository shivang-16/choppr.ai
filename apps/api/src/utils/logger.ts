import winston from "winston";
import { Logtail } from "@logtail/node";
import { LogtailTransport } from "@logtail/winston";
import { config } from "dotenv";
import { getRequestContext } from "./requestContext.js";

config();

/**
 * Logger Configuration
 * 
 * This logger is designed to work in multiple environments:
 * 
 * 1. Development (without BetterStack):
 *    - Only console transport with colorized output
 *    - No external logging service required
 * 
 * 2. Development/Production (with BetterStack):
 *    - Console transport + BetterStack transport
 *    - Requires BETTERSTACK_SOURCE_TOKEN and BETTERSTACK_INGESTING_HOST
 * 
 * 3. Production (without BetterStack):
 *    - Console transport with JSON format
 *    - Suitable for container logs or other log aggregation
 * 
 * Environment Variables:
 * - BETTERSTACK_SOURCE_TOKEN: Optional, enables BetterStack logging
 * - BETTERSTACK_INGESTING_HOST: Optional, BetterStack endpoint
 * - NODE_ENV: Affects console log formatting
 * - LOG_LEVEL: Controls log verbosity (default: silly)
 */

// Use standard Winston log levels for better BetterStack filtering
// These levels are: error: 0, warn: 1, info: 2, http: 3, verbose: 4, debug: 5, silly: 6
const logLevels = winston.config.npm.levels;

// Define colors for standard Winston levels
winston.addColors({
  error: "red",
  warn: "yellow", 
  info: "green",
  http: "magenta",
  verbose: "cyan",
  debug: "blue",
  silly: "grey",
});

// Inject per-request context (user email, requestId, etc.) into every log line.
const requestContextFormat = winston.format((info) => {
  const ctx = getRequestContext();
  if (ctx.requestId) info.requestId = ctx.requestId;
  if (ctx.method) info.method = ctx.method;
  if (ctx.path) info.path = ctx.path;
  if (ctx.userId) info.userId = ctx.userId;
  if (ctx.userEmail) info.userEmail = ctx.userEmail;
  return info;
});

class Logger {
  private winstonLogger: winston.Logger;

  private enrichMeta(meta?: Record<string, unknown>): Record<string, unknown> {
    const ctx = getRequestContext();
    const base: Record<string, unknown> = {};

    if (ctx.requestId) base.requestId = ctx.requestId;
    if (ctx.method) base.method = ctx.method;
    if (ctx.path) base.path = ctx.path;
    if (ctx.userId) base.userId = ctx.userId;
    if (ctx.userEmail) base.userEmail = ctx.userEmail;

    if (!meta) return base;
    if (meta instanceof Error) {
      return {
        ...base,
        error: meta.message,
        stack: meta.stack,
      };
    }

    return { ...base, ...meta };
  }

  constructor() {
    // Create transports array
    const transports: winston.transport[] = [];
    
    // Only add BetterStack transport if environment variables are provided
    if (process.env.BETTERSTACK_SOURCE_TOKEN && process.env.BETTERSTACK_INGESTING_HOST) {
      const logtail = new Logtail(process.env.BETTERSTACK_SOURCE_TOKEN, {
        endpoint: `https://${process.env.BETTERSTACK_INGESTING_HOST}`,
      });
      transports.push(new LogtailTransport(logtail));
    }
    
    // Always add console transport, but with different formatting for production vs development
    if (process.env.NODE_ENV === "production") {
      // Simple JSON format for production console logs
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
            winston.format.json()
          ),
        })
      );
    } else {
      // Colorized and formatted for development
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize({ all: true }),
            winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
              return `[${timestamp}] ${level}: ${message}${metaStr}`;
            })
          ),
        })
      );
    }

    // Ensure we have at least one transport (fallback to console if none configured)
    if (transports.length === 0) {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
            winston.format.simple()
          ),
        })
      );
    }

    this.winstonLogger = winston.createLogger({
      levels: logLevels,
      level: process.env.LOG_LEVEL || "silly", // allow all levels by default
      format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.errors({ stack: true }),
        requestContextFormat(),
        winston.format.json()
      ),
      transports,
    });
  }

  // Standard Winston log level methods
  error(message: string, meta?: any): void {
    this.winstonLogger.error(message, this.enrichMeta(meta));
  }

  warn(message: string, meta?: any): void {
    this.winstonLogger.warn(message, this.enrichMeta(meta));
  }

  info(message: string, meta?: any): void {
    this.winstonLogger.info(message, this.enrichMeta(meta));
  }

  http(message: string, meta?: any): void {
    this.winstonLogger.http(message, this.enrichMeta(meta));
  }

  verbose(message: string, meta?: any): void {
    this.winstonLogger.verbose(message, this.enrichMeta(meta));
  }

  debug(message: string, meta?: any): void {
    this.winstonLogger.debug(message, this.enrichMeta(meta));
  }

  silly(message: string, meta?: any): void {
    this.winstonLogger.silly(message, this.enrichMeta(meta));
  }

  // Generic log method
  log(level: string, message: string, meta?: any): void {
    this.winstonLogger.log(level, message, this.enrichMeta(meta));
  }

  // Get the underlying Winston logger instance for express-winston
  getWinstonInstance(): winston.Logger {
    return this.winstonLogger;
  }
}

// Export a singleton instance
export const logger = new Logger();

// Export the Winston instance for express-winston compatibility
export const winstonLogger = logger.getWinstonInstance();
