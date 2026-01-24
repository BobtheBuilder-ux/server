"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const dotenv_1 = tslib_1.__importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = tslib_1.__importDefault(require("express"));
const http_1 = require("http");
const body_parser_1 = tslib_1.__importDefault(require("body-parser"));
const compression = require('compression');
const cors_1 = tslib_1.__importDefault(require("cors"));
const helmet_1 = tslib_1.__importDefault(require("helmet"));
const morgan_1 = tslib_1.__importDefault(require("morgan"));
const database_1 = require("./utils/database");
const tenantRoutes_1 = tslib_1.__importDefault(require("./routes/tenantRoutes"));
const publicTenantRoutes_1 = tslib_1.__importDefault(require("./routes/publicTenantRoutes"));
const landlordRoutes_1 = tslib_1.__importDefault(require("./routes/landlordRoutes"));
const propertyRoutes_1 = tslib_1.__importDefault(require("./routes/propertyRoutes"));
const leaseRoutes_1 = tslib_1.__importDefault(require("./routes/leaseRoutes"));
const applicationRoutes_1 = tslib_1.__importDefault(require("./routes/applicationRoutes"));
const betterAuthMiddleware_1 = require("./middleware/betterAuthMiddleware");
const adminRoutes_1 = tslib_1.__importDefault(require("./routes/adminRoutes"));
const publicAdminRoutes_1 = tslib_1.__importDefault(require("./routes/publicAdminRoutes"));
const publicAgentRoutes_1 = tslib_1.__importDefault(require("./routes/publicAgentRoutes"));
const agentRoutes_1 = tslib_1.__importDefault(require("./routes/agentRoutes"));
const surveyRoutes_1 = tslib_1.__importDefault(require("./routes/surveyRoutes"));
const paymentRoutes_1 = tslib_1.__importDefault(require("./routes/paymentRoutes"));
const inspectionRoutes_1 = tslib_1.__importDefault(require("./routes/inspectionRoutes"));
const emailRoutes_1 = tslib_1.__importDefault(require("./routes/emailRoutes"));
const earningsRoutes_1 = tslib_1.__importDefault(require("./routes/earningsRoutes"));
const jobRoutes_1 = tslib_1.__importDefault(require("./routes/jobRoutes"));
const uploadRoutes_1 = tslib_1.__importDefault(require("./routes/uploadRoutes"));
const cloudinaryUploadRoutes_1 = tslib_1.__importDefault(require("./routes/cloudinaryUploadRoutes"));
const agentPropertyRoutes_1 = tslib_1.__importDefault(require("./routes/agentPropertyRoutes"));
const notifications_1 = tslib_1.__importDefault(require("./routes/notifications"));
const sms_1 = tslib_1.__importDefault(require("./routes/sms"));
const cronRoutes_1 = tslib_1.__importDefault(require("./routes/cronRoutes"));
const auth_1 = tslib_1.__importDefault(require("./routes/auth"));
const emailVerification_1 = tslib_1.__importDefault(require("./routes/emailVerification"));
const cronJobService_1 = require("./services/cronJobService");
const auth_2 = require("./auth");
const node_1 = require("better-auth/node");
const verifyRoutes_1 = tslib_1.__importDefault(require("./routes/verifyRoutes"));
const saleRoutes_1 = tslib_1.__importDefault(require("./routes/saleRoutes"));
const publicLandlordAcquisitionRoutes_1 = tslib_1.__importDefault(require("./routes/publicLandlordAcquisitionRoutes"));
const landlordAcquisitionRoutes_1 = tslib_1.__importDefault(require("./routes/landlordAcquisitionRoutes"));
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
database_1.databaseService.connect().catch(console.error);
const cronJobService = new cronJobService_1.CronJobService();
cronJobService.initializeJobs();
app.use(express_1.default.json({ limit: '10mb' }));
app.use(compression({ level: 6, threshold: 1024 }));
app.use((0, helmet_1.default)());
app.use(helmet_1.default.crossOriginResourcePolicy({ policy: "cross-origin" }));
app.use((0, morgan_1.default)("combined", {
    skip: (_req, res) => res.statusCode < 400
}));
app.use(body_parser_1.default.json({ limit: '10mb' }));
app.use(body_parser_1.default.urlencoded({ extended: false, limit: '10mb' }));
app.use((0, cors_1.default)({
    origin: process.env.NODE_ENV === "production"
        ? [
            process.env.FRONTEND_URL || "https://homematch.ng",
            "https://www.homematch.ng",
            "https://homematch.ng",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            /https:\/\/.*\.vercel\.app$/,
            /https:\/\/.*\.netlify\.app$/
        ]
        : true,
    credentials: true,
}));
app.get("/", (_req, res) => {
    res.json({
        message: "HomeMatch API is running!",
        version: "1.0.0",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development"
    });
});
app.get("/health", (_req, res) => {
    res.status(200).json({
        status: "OK",
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});
app.use("/verify", verifyRoutes_1.default);
app.use("/applications", applicationRoutes_1.default);
app.use("/properties", propertyRoutes_1.default);
app.use("/leases", leaseRoutes_1.default);
app.use("/payments", paymentRoutes_1.default);
app.use("/tenants", publicTenantRoutes_1.default);
app.use("/inspections", (0, betterAuthMiddleware_1.betterAuthMiddleware)(["tenant", "landlord", "agent", "admin"]), inspectionRoutes_1.default);
app.use("/tenants", (0, betterAuthMiddleware_1.betterAuthMiddleware)(["tenant", "landlord", "agent", "admin"]), tenantRoutes_1.default);
app.use("/landlords", (0, betterAuthMiddleware_1.betterAuthMiddleware)(["landlord", "admin"]), landlordRoutes_1.default);
app.use("/admin", publicAdminRoutes_1.default);
app.use("/agent", publicAgentRoutes_1.default);
app.use("/surveys", surveyRoutes_1.default);
app.use("/admin", (0, betterAuthMiddleware_1.betterAuthMiddleware)(["admin", "agent"]), adminRoutes_1.default);
app.use("/agent", (0, betterAuthMiddleware_1.betterAuthMiddleware)(["agent"]), agentRoutes_1.default);
app.use("/emails", emailRoutes_1.default);
app.use("/earnings", (0, betterAuthMiddleware_1.betterAuthMiddleware)(["landlord", "admin"]), earningsRoutes_1.default);
app.use("/jobs", jobRoutes_1.default);
app.use("/uploads", uploadRoutes_1.default);
app.use("/cloudinary", cloudinaryUploadRoutes_1.default);
app.use("/agent-properties", (0, betterAuthMiddleware_1.betterAuthMiddleware)(["admin", "agent"]), agentPropertyRoutes_1.default);
app.use("/notifications", notifications_1.default);
app.use("/sales", saleRoutes_1.default);
app.use("/landlord-acquisitions", publicLandlordAcquisitionRoutes_1.default);
app.use("/landlord-acquisitions", landlordAcquisitionRoutes_1.default);
app.use("/sms", sms_1.default);
app.use("/cron", (0, betterAuthMiddleware_1.betterAuthMiddleware)(["admin"]), cronRoutes_1.default);
app.use("/api/auth", auth_1.default);
app.use("/api/email-verification", emailVerification_1.default);
app.all("/api/auth/*", (0, node_1.toNodeHandler)(auth_2.auth));
const port = Number(process.env.PORT);
if (process.env.NODE_ENV === 'production') {
    if (global.gc) {
        setInterval(() => {
            global.gc();
        }, 30000);
    }
    process.on('warning', (warning) => {
        if (warning.name === 'MaxListenersExceededWarning') {
            console.warn('Memory warning:', warning.message);
        }
    });
}
server.listen(port, "0.0.0.0", () => {
    console.log(`🚀 HomeMatch Real Estate API Server started`);
    console.log(`📡 Server listening on host: 0.0.0.0`);
    console.log(`🔌 Server running on port: ${port}`);
    console.log(`🌐 Health check available at: http://0.0.0.0:${port}/health`);
    console.log(`🔐 Better Auth server initialized`);
    console.log(`💾 Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
    console.log(`✅ Server ready to accept connections`);
});
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');
    await database_1.databaseService.disconnect();
    process.exit(0);
});
process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully');
    await database_1.databaseService.disconnect();
    process.exit(0);
});
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception (non-fatal):', error);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection (non-fatal) at:', promise, 'reason:', reason);
});
