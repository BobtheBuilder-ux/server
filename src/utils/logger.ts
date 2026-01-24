import fs from 'fs';
import path from 'path';

export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  data?: any;
  userId?: string;
  email?: string;
}

class Logger {
  private logDir: string;
  private logFile: string;

  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.logFile = path.join(this.logDir, 'user-cleanup.log');
    this.ensureLogDirectory();
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    const { timestamp, level, message, data, userId, email } = entry;
    let logLine = `[${timestamp}] ${level}: ${message}`;
    
    if (userId) {
      logLine += ` | UserId: ${userId}`;
    }
    
    if (email) {
      logLine += ` | Email: ${email}`;
    }
    
    if (data) {
      logLine += ` | Data: ${JSON.stringify(data)}`;
    }
    
    return logLine + '\n';
  }

  private writeLog(entry: LogEntry): void {
    try {
      const logLine = this.formatLogEntry(entry);
      fs.appendFileSync(this.logFile, logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  public info(message: string, data?: any, userId?: string, email?: string): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message,
      data,
      userId,
      email
    };
    
    console.log(`[INFO] ${message}`, data ? data : '');
    this.writeLog(entry);
  }

  public warn(message: string, data?: any, userId?: string, email?: string): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'WARN',
      message,
      data,
      userId,
      email
    };
    
    console.warn(`[WARN] ${message}`, data ? data : '');
    this.writeLog(entry);
  }

  public error(message: string, error?: any, userId?: string, email?: string): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message,
      data: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error,
      userId,
      email
    };
    
    console.error(`[ERROR] ${message}`, error);
    this.writeLog(entry);
  }

  public logUserDeletion(userId: string, email: string, reason: 'verification_timeout' | 'page_refresh', success: boolean, error?: any): void {
    if (success) {
      this.info(
        `User account deleted successfully - Reason: ${reason}`,
        { reason, deletedAt: new Date().toISOString() },
        userId,
        email
      );
    } else {
      this.error(
        `Failed to delete user account - Reason: ${reason}`,
        error,
        userId,
        email
      );
    }
  }

  public logCleanupRun(foundUsers: number, deletedUsers: number, errors: number): void {
    this.info(
      'Cleanup service run completed',
      {
        foundExpiredUsers: foundUsers,
        successfullyDeleted: deletedUsers,
        errors: errors,
        runAt: new Date().toISOString()
      }
    );
  }
}

export const logger = new Logger();