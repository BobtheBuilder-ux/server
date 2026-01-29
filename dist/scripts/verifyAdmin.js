"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const dotenv_1 = tslib_1.__importDefault(require("dotenv"));
dotenv_1.default.config();
const database_1 = require("../utils/database");
const drizzle_orm_1 = require("drizzle-orm");
async function verifyAdmin() {
    try {
        console.log("Verifying admin user...");
        const result = await database_1.db.update(database_1.users)
            .set({ emailVerified: true })
            .where((0, drizzle_orm_1.eq)(database_1.users.email, "admin@homematch.ng"))
            .returning();
        if (result.length > 0) {
            console.log("Admin user verified successfully:", result[0].email);
        }
        else {
            console.log("Admin user not found.");
        }
    }
    catch (error) {
        console.error("Error verifying admin:", error);
    }
    finally {
        process.exit(0);
    }
}
verifyAdmin();
