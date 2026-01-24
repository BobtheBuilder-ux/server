"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const tslib_1 = require("tslib");
const fs_1 = tslib_1.__importDefault(require("fs"));
const path_1 = tslib_1.__importDefault(require("path"));
class Logger {
    constructor() {
        this.logDir = path_1.default.join(process.cwd(), 'logs');
        this.logFile = path_1.default.join(this.logDir, 'user-cleanup.log');
        this.ensureLogDirectory();
    }
    ensureLogDirectory() {
        if (!fs_1.default.existsSync(this.logDir)) {
            fs_1.default.mkdirSync(this.logDir, { recursive: true });
        }
    }
    formatLogEntry(entry) {
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
    writeLog(entry) {
        try {
            const logLine = this.formatLogEntry(entry);
            fs_1.default.appendFileSync(this.logFile, logLine);
        }
        catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }
    info(message, data, userId, email) {
        const entry = {
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
    warn(message, data, userId, email) {
        const entry = {
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
    error(message, error, userId, email) {
        const entry = {
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
    logUserDeletion(userId, email, reason, success, error) {
        if (success) {
            this.info(`User account deleted successfully - Reason: ${reason}`, { reason, deletedAt: new Date().toISOString() }, userId, email);
        }
        else {
            this.error(`Failed to delete user account - Reason: ${reason}`, error, userId, email);
        }
    }
    logCleanupRun(foundUsers, deletedUsers, errors) {
        this.info('Cleanup service run completed', {
            foundExpiredUsers: foundUsers,
            successfullyDeleted: deletedUsers,
            errors: errors,
            runAt: new Date().toISOString()
        });
    }
}
exports.logger = new Logger();
