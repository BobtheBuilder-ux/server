import dotenv from "dotenv";

/* CONFIGURATIONS */
dotenv.config();

import express from "express";
import { createServer } from "http";
import bodyParser from "body-parser";
// @ts-ignore - compression types may not be available
const compression = require('compression');
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { databaseService } from "./utils/database";
// import { socketService } from "./services/socketService"; // Removed for Better Auth migration
/* ROUTE IMPORT */
import tenantRoutes from "./routes/tenantRoutes";
import publicTenantRoutes from "./routes/publicTenantRoutes";
import landlordRoutes from "./routes/landlordRoutes";
import propertyRoutes from "./routes/propertyRoutes";
import leaseRoutes from "./routes/leaseRoutes";
import applicationRoutes from "./routes/applicationRoutes";
import { betterAuthMiddleware } from "./middleware/betterAuthMiddleware";
import adminRoutes from "./routes/adminRoutes";
import publicAdminRoutes from "./routes/publicAdminRoutes";
import publicAgentRoutes from "./routes/publicAgentRoutes";
import agentRoutes from "./routes/agentRoutes";
import surveyRoutes from "./routes/surveyRoutes";
import paymentRoutes from "./routes/paymentRoutes";
import inspectionRoutes from "./routes/inspectionRoutes";
import emailRoutes from "./routes/emailRoutes";
import earningsRoutes from "./routes/earningsRoutes";
import jobRoutes from "./routes/jobRoutes";
import uploadRoutes from "./routes/uploadRoutes";
import cloudinaryUploadRoutes from "./routes/cloudinaryUploadRoutes";
import agentPropertyRoutes from "./routes/agentPropertyRoutes";
import notificationRoutes from "./routes/notifications";
import smsRoutes from "./routes/sms";
import cronRoutes from "./routes/cronRoutes";
import authRoutes from "./routes/auth";
import emailVerificationRoutes from "./routes/emailVerification";
import { CronJobService } from "./services/cronJobService";
import { auth } from "./auth";
import { toNodeHandler } from "better-auth/node";
import verifyRoutes from "./routes/verifyRoutes";
import saleRoutes from "./routes/saleRoutes";
import publicLandlordAcquisitionRoutes from "./routes/publicLandlordAcquisitionRoutes";
import landlordAcquisitionRoutes from "./routes/landlordAcquisitionRoutes";

const app = express();
const server = createServer(app);

// Initialize database connection
databaseService.connect().catch(console.error);


// Initialize cron job service for rent reminders
const cronJobService = new CronJobService();
cronJobService.initializeJobs();

// Memory-efficient configurations
app.use(express.json({ limit: '10mb' }));
app.use(compression({ level: 6, threshold: 1024 })); // Compress responses > 1KB
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
app.use(morgan("combined", {
  skip: (_req, res) => res.statusCode < 400 // Only log errors in production
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: false, limit: '10mb' }));

// Update CORS configuration
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
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
  })
);

/* ROUTES */
app.get("/", (_req, res) => {
  res.json({
    message: "HomeMatch API is running!",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development"
  });
});

/* HEALTH CHECK */
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// VerifyMe identity verification
app.use("/verify", verifyRoutes);

app.use("/applications", applicationRoutes);
app.use("/properties", propertyRoutes);
app.use("/leases", leaseRoutes);
app.use("/payments", paymentRoutes);
app.use("/tenants", publicTenantRoutes); // Public tenant routes (no auth required)
app.use(
  "/inspections",
  betterAuthMiddleware(["tenant", "landlord", "agent", "admin"]),
  inspectionRoutes
);
app.use(
  "/tenants",
  betterAuthMiddleware(["tenant", "landlord", "agent", "admin"]),
  tenantRoutes
);
app.use("/landlords", betterAuthMiddleware(["landlord", "admin"]), landlordRoutes);
// Admin routes with exception for admin creation
// Public admin routes (no authentication required)
app.use("/admin", publicAdminRoutes);
app.use("/agent", publicAgentRoutes);
app.use("/surveys", surveyRoutes);
// Protected admin routes (authentication required)
app.use("/admin", betterAuthMiddleware(["admin", "agent"]), adminRoutes);
app.use("/agent", betterAuthMiddleware(["agent"]), agentRoutes);
app.use("/emails", emailRoutes);
app.use("/earnings", betterAuthMiddleware(["landlord", "admin"]), earningsRoutes);
app.use("/jobs", jobRoutes);
app.use("/uploads", uploadRoutes);
app.use("/cloudinary", cloudinaryUploadRoutes);
app.use("/agent-properties", betterAuthMiddleware(["admin", "agent"]), agentPropertyRoutes);
app.use("/notifications", notificationRoutes);
app.use("/sales", saleRoutes);
// Landlord acquisition intake (public submit) and admin management
app.use("/landlord-acquisitions", publicLandlordAcquisitionRoutes);
app.use("/landlord-acquisitions", landlordAcquisitionRoutes);
app.use("/sms", smsRoutes);
app.use("/cron", betterAuthMiddleware(["admin"]), cronRoutes);
app.use("/api/auth", authRoutes); // Custom auth routes (must come before Better Auth handler)
app.use("/api/email-verification", emailVerificationRoutes); // Email verification routes
app.all("/api/auth/*", toNodeHandler(auth)); // Better Auth core handler - catch-all route

/* SERVER */
const port = Number(process.env.PORT);

// Memory optimization for 512MB instance
if (process.env.NODE_ENV === 'production') {
  // Force garbage collection more frequently
  if (global.gc) {
    setInterval(() => {
      (global as any).gc();
    }, 30000); // Every 30 seconds
  }
  
  // Set memory usage warnings
  process.on('warning', (warning) => {
    if (warning.name === 'MaxListenersExceededWarning') {
      console.warn('Memory warning:', warning.message);
    }
  });
}

// Socket service removed for Better Auth migration
// socketService.initialize(server);

server.listen(port, "0.0.0.0", () => {
  console.log(`🚀 HomeMatch Real Estate API Server started`);
  console.log(`📡 Server listening on host: 0.0.0.0`);
  console.log(`🔌 Server running on port: ${port}`);
  console.log(`🌐 Health check available at: http://0.0.0.0:${port}/health`);
  console.log(`🔐 Better Auth server initialized`);
  console.log(`💾 Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  console.log(`✅ Server ready to accept connections`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await databaseService.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await databaseService.disconnect();
  process.exit(0);
});

// Handle uncaught exceptions (temporarily disabled to prevent crashes)
// process.on('uncaughtException', (error) => {
//   console.error('Uncaught Exception:', error);
//   process.exit(1);
// });

// process.on('unhandledRejection', (reason, promise) => {
//   console.error('Unhandled Rejection at:', promise, 'reason:', reason);
//   process.exit(1);
// });

// Log errors without crashing
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception (non-fatal):', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection (non-fatal) at:', promise, 'reason:', reason);
});
