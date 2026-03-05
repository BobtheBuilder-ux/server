"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../auth");
const drizzle_orm_1 = require("drizzle-orm");
const database_1 = require("../utils/database");
const schema_1 = require("../db/schema");
const betterAuthMiddleware_1 = require("../middleware/betterAuthMiddleware");
const router = (0, express_1.Router)();
const validateRole = (role) => {
    const allowedRoles = ["tenant", "landlord", "agent", "sale", "admin"];
    if (!allowedRoles.includes(role)) {
        throw new Error(`Invalid role: ${role}. Allowed roles are: ${allowedRoles.join(", ")}`);
    }
    if (role === "user") {
        throw new Error("The 'user' role is not allowed. Please select from: tenant, landlord, agent, or admin");
    }
};
router.post("/register/landlord", async (req, res) => {
    try {
        const { email, password, name, phoneNumber, registrationCode } = req.body;
        validateRole("landlord");
        if (registrationCode) {
            const codeRecordResult = await database_1.db.select().from(schema_1.landlordRegistrationCodes).where((0, drizzle_orm_1.eq)(schema_1.landlordRegistrationCodes.code, registrationCode));
            const codeRecord = codeRecordResult[0];
            if (!codeRecord) {
                return res.status(400).json({ error: "Invalid registration code" });
            }
            if (codeRecord.isUsed) {
                return res.status(400).json({ error: "Registration code has already been used" });
            }
        }
        const result = await auth_1.auth.api.signUpEmail({
            body: {
                email,
                password,
                name,
                role: "landlord",
                phoneNumber,
                callbackURL: `${process.env.CLIENT_URL}/auth/verify-email`,
            },
            headers: req.headers,
        });
        if (result.user) {
            res.json({
                success: true,
                message: "Landlord registration initiated. Please check your email for the verification link.",
                user: result.user
            });
        }
        else {
            res.status(400).json({ error: "Registration failed" });
        }
    }
    catch (error) {
        console.error("Landlord registration error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.post("/register/agent", async (req, res) => {
    try {
        const { email, password, name, phoneNumber, registrationCode } = req.body;
        validateRole("agent");
        if (!registrationCode) {
            return res.status(400).json({ error: "Registration code is required for agent registration" });
        }
        const codeRecordResult = await database_1.db.select().from(schema_1.landlordRegistrationCodes).where((0, drizzle_orm_1.eq)(schema_1.landlordRegistrationCodes.code, registrationCode));
        const codeRecord = codeRecordResult[0];
        if (!codeRecord) {
            return res.status(400).json({ error: "Invalid registration code" });
        }
        if (codeRecord.isUsed) {
            return res.status(400).json({ error: "Registration code has already been used" });
        }
        const result = await auth_1.auth.api.signUpEmail({
            body: {
                email,
                password,
                name,
                role: "agent",
                phoneNumber,
                callbackURL: `${process.env.CLIENT_URL}/auth/verify-email`,
            },
            headers: req.headers,
        });
        if (result.user) {
            res.json({
                success: true,
                message: "Agent registration initiated. Please check your email for the verification link.",
                user: result.user
            });
        }
        else {
            res.status(400).json({ error: "Registration failed" });
        }
    }
    catch (error) {
        console.error("Agent registration error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.post("/register/tenant", async (req, res) => {
    try {
        const { email, password, name, phoneNumber } = req.body;
        validateRole("tenant");
        const result = await auth_1.auth.api.signUpEmail({
            body: {
                email,
                password,
                name,
                role: "tenant",
                phoneNumber,
                callbackURL: `${process.env.CLIENT_URL}/auth/verify-email`,
            },
            headers: req.headers,
        });
        if (result.user) {
            res.json({
                success: true,
                message: "Tenant registration initiated. Please check your email for the verification link.",
                user: result.user
            });
        }
        else {
            res.status(400).json({ error: "Registration failed" });
        }
    }
    catch (error) {
        console.error("Tenant registration error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.post("/register/admin", async (req, res) => {
    try {
        const { email, password, name, phoneNumber } = req.body;
        validateRole("admin");
        if (!email.endsWith('@homematch.ng')) {
            return res.status(400).json({ error: "Admin registration requires an @homematch.ng email address" });
        }
        const result = await auth_1.auth.api.signUpEmail({
            body: {
                email,
                password,
                name,
                role: "admin",
                phoneNumber,
                callbackURL: `${process.env.CLIENT_URL}/auth/verify-email`,
            },
            headers: req.headers,
        });
        if (result.user) {
            res.json({
                success: true,
                message: "Admin registration initiated. Please check your email for the verification link.",
                user: result.user
            });
        }
        else {
            res.status(400).json({ error: "Registration failed" });
        }
    }
    catch (error) {
        console.error("Admin registration error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.post("/api/auth/send-verification-otp", async (req, res) => {
    try {
        res.status(410).json({
            error: "OTP verification is no longer supported. Please use email verification links instead."
        });
    }
    catch (error) {
        console.error("Error in deprecated OTP endpoint:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.post("/verify-otp", async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ error: "Email and OTP are required" });
        }
        return res.status(400).json({
            error: "OTP verification is no longer supported. Please use email verification links instead."
        });
    }
    catch (error) {
        console.error("Error in verify OTP:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.post("/api/auth/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;
        const api = auth_1.auth.api;
        const payload = { body: { email, redirectTo: `${process.env.CLIENT_URL}/auth/reset-password` }, headers: req.headers };
        let result = null;
        if (typeof api?.forgetPassword === "function") {
            result = await api.forgetPassword(payload);
        }
        else if (typeof api?.forgotPassword === "function") {
            result = await api.forgotPassword(payload);
        }
        else if (typeof api?.resetPassword === "function") {
            result = await api.resetPassword(payload);
        }
        else {
            throw new Error("Password reset API not available in current auth version");
        }
        if (result) {
            res.json({ success: true, message: "Password reset email sent" });
        }
        else {
            res.status(400).json({ error: "Failed to send reset email" });
        }
    }
    catch (error) {
        console.error("Password reset error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
router.post("/signin", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }
        const result = await auth_1.auth.api.signInEmail({
            body: {
                email,
                password,
            },
            headers: req.headers,
        });
        if (result && result.user) {
            const [dbUser] = await database_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, result.user.id)).limit(1);
            const userRole = dbUser?.role || "tenant";
            const [userAccount] = await database_1.db.select().from(schema_1.accounts).where((0, drizzle_orm_1.eq)(schema_1.accounts.userId, result.user.id)).limit(1);
            const dbAccessToken = userAccount?.accessToken || null;
            console.log(`[SIGNIN_SUCCESS] Email: ${result.user.email}, Role: ${userRole}, ID: ${result.user.id}`);
            res.json({
                message: "Signed in successfully",
                user: {
                    ...result.user,
                    role: userRole
                },
                accessToken: dbAccessToken || result.token,
                token: result.token,
                userType: userRole
            });
        }
        else {
            res.status(401).json({ error: "Invalid email or password" });
        }
    }
    catch (error) {
        console.error("Signin error:", error);
        res.status(401).json({ error: error.message || "Authentication failed" });
    }
});
router.post("/signup", async (req, res) => {
    try {
        const { email, password, name, role, invitationCode } = req.body;
        if (!email || !password || !name || !role) {
            return res.status(400).json({
                error: "Missing required fields: email, password, name, and role are required"
            });
        }
        try {
            validateRole(role);
        }
        catch (error) {
            return res.status(400).json({ error: error.message });
        }
        if (role.toLowerCase() === "agent" && invitationCode) {
        }
        const result = await auth_1.auth.api.signUpEmail({
            body: {
                email,
                password,
                name,
                role: role.toLowerCase(),
                phoneNumber: req.body.phoneNumber || "",
                callbackURL: `${process.env.CLIENT_URL}/auth/verify-email`,
            },
            headers: req.headers,
        });
        if (result.user) {
            res.status(201).json({
                message: "User registered successfully. Please check your email for verification link.",
                user: {
                    id: result.user.id,
                    email: result.user.email,
                    role: role.toLowerCase(),
                    emailVerified: result.user.emailVerified
                }
            });
        }
        else {
            res.status(400).json({ error: "Registration failed" });
        }
    }
    catch (error) {
        console.error("Signup error:", error);
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
        console.error("Error details:", JSON.stringify(error, null, 2));
        if (error.message?.includes("already exists")) {
            res.status(409).json({ error: "User with this email already exists" });
        }
        else {
            res.status(500).json({ error: "Internal server error", details: error.message });
        }
    }
});
router.get("/session", (0, betterAuthMiddleware_1.betterAuthMiddleware)(), async (req, res) => {
    try {
        const userType = req.user?.role || "tenant";
        console.log(`[SESSION_FETCH] Email: ${req.user?.email}, UserType: ${userType}, ID: ${req.user?.id}, Token: ${req.session?.token?.substring(0, 10)}...`);
        res.json({
            user: req.user,
            session: req.session,
            userType: userType,
            token: req.session?.token
        });
    }
    catch (error) {
        console.error("Session error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
exports.default = router;
