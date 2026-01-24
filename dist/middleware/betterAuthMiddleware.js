"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUserProfile = exports.getUserRole = exports.betterAuthMiddleware = void 0;
const auth_1 = require("../auth");
const drizzle_orm_1 = require("drizzle-orm");
const database_1 = require("../utils/database");
const schema_1 = require("../db/schema");
const betterAuthMiddleware = (allowedRoles) => {
    return async (req, res, next) => {
        try {
            const session = await auth_1.auth.api.getSession({
                headers: req.headers,
            });
            if (!session || !session.user) {
                return res.status(401).json({ error: "Authentication required" });
            }
            if (!session.user.emailVerified) {
                return res.status(401).json({ error: "Email verification required" });
            }
            const [user] = await database_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, session.user.id)).limit(1);
            const [landlordProfile] = await database_1.db.select().from(schema_1.landlords).where((0, drizzle_orm_1.eq)(schema_1.landlords.userId, session.user.id)).limit(1);
            const [tenantProfile] = await database_1.db.select().from(schema_1.tenants).where((0, drizzle_orm_1.eq)(schema_1.tenants.userId, session.user.id)).limit(1);
            const [agentProfile] = await database_1.db.select().from(schema_1.agents).where((0, drizzle_orm_1.eq)(schema_1.agents.userId, session.user.id)).limit(1);
            const [adminProfile] = await database_1.db.select().from(schema_1.admins).where((0, drizzle_orm_1.eq)(schema_1.admins.userId, session.user.id)).limit(1);
            const [saleProfile] = await database_1.db.select().from(schema_1.saleUsers).where((0, drizzle_orm_1.eq)(schema_1.saleUsers.userId, session.user.id)).limit(1);
            if (!user) {
                return res.status(401).json({ error: "User not found" });
            }
            let userRole = user.role || "tenant";
            if (adminProfile)
                userRole = "admin";
            else if (landlordProfile)
                userRole = "landlord";
            else if (agentProfile)
                userRole = "agent";
            else if (saleProfile)
                userRole = "sale";
            else if (tenantProfile)
                userRole = "tenant";
            if (allowedRoles && !allowedRoles.includes(userRole)) {
                return res.status(403).json({ error: "Insufficient permissions" });
            }
            req.user = {
                id: user.id,
                email: user.email,
                name: user.name || undefined,
                role: userRole,
                isAdmin: userRole === "admin",
            };
            req.session = {
                id: session.session.id,
                userId: session.user.id,
                expires: new Date(session.session.expiresAt),
            };
            next();
        }
        catch (error) {
            console.error("Authentication middleware error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };
};
exports.betterAuthMiddleware = betterAuthMiddleware;
const getUserRole = async (userId) => {
    try {
        const [user] = await database_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId)).limit(1);
        if (!user)
            return "tenant";
        const [adminProfile] = await database_1.db.select().from(schema_1.admins).where((0, drizzle_orm_1.eq)(schema_1.admins.userId, userId)).limit(1);
        const [landlordProfile] = await database_1.db.select().from(schema_1.landlords).where((0, drizzle_orm_1.eq)(schema_1.landlords.userId, userId)).limit(1);
        const [agentProfile] = await database_1.db.select().from(schema_1.agents).where((0, drizzle_orm_1.eq)(schema_1.agents.userId, userId)).limit(1);
        const [saleProfile] = await database_1.db.select().from(schema_1.saleUsers).where((0, drizzle_orm_1.eq)(schema_1.saleUsers.userId, userId)).limit(1);
        const [tenantProfile] = await database_1.db.select().from(schema_1.tenants).where((0, drizzle_orm_1.eq)(schema_1.tenants.userId, userId)).limit(1);
        if (adminProfile)
            return "admin";
        if (landlordProfile)
            return "landlord";
        if (agentProfile)
            return "agent";
        if (saleProfile)
            return "sale";
        if (tenantProfile)
            return "tenant";
        return user.role || "tenant";
    }
    catch (error) {
        console.error("Error getting user role:", error);
        return "tenant";
    }
};
exports.getUserRole = getUserRole;
const createUserProfile = async (userId, role, additionalData = {}) => {
    try {
        const [user] = await database_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId)).limit(1);
        if (!user)
            throw new Error("User not found");
        switch (role) {
            case "landlord":
                await database_1.db.insert(schema_1.landlords).values({
                    cognitoId: user.legacyCognitoId || userId,
                    userId: userId,
                    name: user.name || "",
                    email: user.email,
                    phoneNumber: user.phoneNumber || "",
                    ...additionalData,
                });
                break;
            case "tenant":
                await database_1.db.insert(schema_1.tenants).values({
                    cognitoId: user.legacyCognitoId || userId,
                    userId: userId,
                    name: user.name || "",
                    email: user.email,
                    phoneNumber: user.phoneNumber || "",
                    ...additionalData,
                });
                break;
            case "agent":
                await database_1.db.insert(schema_1.agents).values({
                    cognitoId: user.legacyCognitoId || userId,
                    userId: userId,
                    name: user.name || "",
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    ...additionalData,
                });
                break;
            case "sale":
                await database_1.db.insert(schema_1.saleUsers).values({
                    cognitoId: user.legacyCognitoId || userId,
                    userId: userId,
                    name: user.name || "",
                    email: user.email,
                    phoneNumber: user.phoneNumber || "",
                    displayRoleName: "Land/Property Sale",
                    ...additionalData,
                });
                break;
            case "admin":
                await database_1.db.insert(schema_1.admins).values({
                    cognitoId: user.legacyCognitoId || userId,
                    userId: userId,
                    name: user.name || "",
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    ...additionalData,
                });
                break;
        }
        await database_1.db.update(schema_1.users)
            .set({ role })
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId));
    }
    catch (error) {
        console.error("Error creating user profile:", error);
        throw error;
    }
};
exports.createUserProfile = createUserProfile;
