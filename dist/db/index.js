"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseService = exports.DatabaseService = exports.db = void 0;
const tslib_1 = require("tslib");
const node_postgres_1 = require("drizzle-orm/node-postgres");
const pg_1 = require("pg");
const schema = tslib_1.__importStar(require("./schema"));
const relations = tslib_1.__importStar(require("./relations"));
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});
exports.db = (0, node_postgres_1.drizzle)(pool, {
    schema: { ...schema, ...relations },
    logger: process.env.NODE_ENV === 'development'
});
class DatabaseService {
    constructor() {
        this.db = exports.db;
    }
    static getInstance() {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService();
        }
        return DatabaseService.instance;
    }
    async disconnect() {
        await pool.end();
    }
    async healthCheck() {
        try {
            const client = await pool.connect();
            await client.query('SELECT 1');
            client.release();
            return true;
        }
        catch (error) {
            console.error('Database health check failed:', error);
            return false;
        }
    }
}
exports.DatabaseService = DatabaseService;
exports.databaseService = DatabaseService.getInstance();
tslib_1.__exportStar(require("./schema"), exports);
tslib_1.__exportStar(require("./relations"), exports);
