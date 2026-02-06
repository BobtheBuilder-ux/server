"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const dotenv_1 = tslib_1.__importDefault(require("dotenv"));
dotenv_1.default.config();
const database_1 = require("./utils/database");
const schema_1 = require("./db/schema");
async function checkUser() {
    const userId = "seed-landlord-1769276353720";
    console.log(`Checking for user with ID: ${userId}`);
    try {
        const allUsers = await database_1.db.select().from(schema_1.users).limit(5);
        console.log("First 5 users:", allUsers.map(u => ({ id: u.id, email: u.email, role: u.role })));
    }
    catch (error) {
        console.error("Error checking user:", error);
    }
    process.exit(0);
}
checkUser();
