"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const express_1 = require("express");
const database_1 = require("../utils/database");
const drizzle_orm_1 = require("drizzle-orm");
const crypto_1 = tslib_1.__importDefault(require("crypto"));
const emailService_1 = require("../utils/emailService");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
const generateVerificationLinkSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
});
const validateTokenSchema = zod_1.z.object({
    token: zod_1.z.string().min(1),
});
const resendVerificationLinkSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
});
router.post("/generate-verification-link", async (req, res) => {
    try {
        const { email } = generateVerificationLinkSchema.parse(req.body);
        const user = await database_1.db.select().from(database_1.users).where((0, drizzle_orm_1.eq)(database_1.users.email, email)).limit(1);
        if (!user.length) {
            return res.status(404).json({ error: "User not found" });
        }
        const userData = user[0];
        if (userData.emailVerified) {
            return res.status(400).json({ error: "Email is already verified" });
        }
        const verificationToken = crypto_1.default.randomBytes(32).toString("hex");
        const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await database_1.db.update(database_1.users)
            .set({
            verificationToken,
            verificationTokenExpiresAt,
            verificationInitiatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(database_1.users.id, userData.id));
        const verificationLink = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;
        await (0, emailService_1.sendEmail)({
            to: email,
            subject: "Verify Your HomeMatch Account",
            body: `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #059669; margin: 0;">HomeMatch</h1>
              <p style="color: #6b7280; margin: 5px 0 0 0;">Your Rental Platform</p>
            </div>
            
            <div style="background-color: #f9fafb; padding: 30px; border-radius: 8px;">
              <h2 style="color: #111827; margin: 0 0 20px 0;">Verify Your Email Address</h2>
              <p style="color: #374151; margin: 0 0 25px 0;">
                Welcome to HomeMatch! Please click the button below to verify your email address and activate your account.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationLink}" 
                   style="background-color: #059669; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                  Verify Email Address
                </a>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; margin: 20px 0 0 0;">
                This link will expire in 24 hours. If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="color: #059669; font-size: 14px; word-break: break-all; margin: 10px 0;">
                ${verificationLink}
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                If you didn't create an account with HomeMatch, please ignore this email.
              </p>
            </div>
          </body>
        </html>
      `
        });
        res.json({
            success: true,
            message: "Verification link sent successfully",
            expiresAt: verificationTokenExpiresAt
        });
    }
    catch (error) {
        console.error("Error generating verification link:", error);
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: "Invalid request data", details: error.issues });
        }
        res.status(500).json({ error: "Internal server error" });
    }
});
router.post("/validate-token", async (req, res) => {
    try {
        const { token } = validateTokenSchema.parse(req.body);
        const user = await database_1.db.select()
            .from(database_1.users)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.users.verificationToken, token), (0, drizzle_orm_1.gt)(database_1.users.verificationTokenExpiresAt, new Date())))
            .limit(1);
        if (!user.length) {
            return res.status(400).json({
                error: "Invalid or expired verification token",
                expired: true
            });
        }
        const userData = user[0];
        if (userData.emailVerified) {
            return res.status(400).json({
                error: "Email is already verified",
                alreadyVerified: true
            });
        }
        await database_1.db.update(database_1.users)
            .set({
            emailVerified: true,
            verificationToken: null,
            verificationTokenExpiresAt: null,
            verificationResendCount: 0,
            verificationLastResendAt: null,
        })
            .where((0, drizzle_orm_1.eq)(database_1.users.id, userData.id));
        res.json({
            success: true,
            message: "Email verified successfully",
            user: {
                id: userData.id,
                email: userData.email,
                emailVerified: true
            }
        });
    }
    catch (error) {
        console.error("Error validating token:", error);
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: "Invalid request data", details: error.issues });
        }
        res.status(500).json({ error: "Internal server error" });
    }
});
router.post("/resend-verification-link", async (req, res) => {
    try {
        const { email } = resendVerificationLinkSchema.parse(req.body);
        const user = await database_1.db.select().from(database_1.users).where((0, drizzle_orm_1.eq)(database_1.users.email, email)).limit(1);
        if (!user.length) {
            return res.status(404).json({ error: "User not found" });
        }
        const userData = user[0];
        if (userData.emailVerified) {
            return res.status(400).json({ error: "Email is already verified" });
        }
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const resendCount = userData.verificationResendCount || 0;
        const lastResendAt = userData.verificationLastResendAt;
        if (lastResendAt && lastResendAt > oneHourAgo && resendCount >= 3) {
            const timeUntilReset = new Date(lastResendAt.getTime() + 60 * 60 * 1000);
            return res.status(429).json({
                error: "Rate limit exceeded. You can request a new verification link after one hour.",
                retryAfter: timeUntilReset
            });
        }
        const newResendCount = (lastResendAt && lastResendAt > oneHourAgo) ? resendCount + 1 : 1;
        const verificationToken = crypto_1.default.randomBytes(32).toString("hex");
        const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await database_1.db.update(database_1.users)
            .set({
            verificationToken,
            verificationTokenExpiresAt,
            verificationResendCount: newResendCount,
            verificationLastResendAt: new Date(),
            verificationInitiatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(database_1.users.id, userData.id));
        const verificationLink = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;
        await (0, emailService_1.sendEmail)({
            to: email,
            subject: "Verify Your HomeMatch Account",
            body: `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #059669; margin: 0;">HomeMatch</h1>
              <p style="color: #6b7280; margin: 5px 0 0 0;">Your Rental Platform</p>
            </div>
            
            <div style="background-color: #f9fafb; padding: 30px; border-radius: 8px;">
              <h2 style="color: #111827; margin: 0 0 20px 0;">Verify Your Email Address</h2>
              <p style="color: #374151; margin: 0 0 25px 0;">
                Please click the button below to verify your email address and activate your account.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationLink}" 
                   style="background-color: #059669; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                  Verify Email Address
                </a>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; margin: 20px 0 0 0;">
                This link will expire in 24 hours. If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="color: #059669; font-size: 14px; word-break: break-all; margin: 10px 0;">
                ${verificationLink}
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                If you didn't create an account with HomeMatch, please ignore this email.
              </p>
              <p style="color: #6b7280; font-size: 12px; margin: 5px 0 0 0;">
                Resend attempts remaining: ${3 - newResendCount}
              </p>
            </div>
          </body>
        </html>
      `
        });
        res.json({
            success: true,
            message: "Verification link resent successfully",
            expiresAt: verificationTokenExpiresAt,
            resendCount: newResendCount,
            remainingResends: 3 - newResendCount
        });
    }
    catch (error) {
        console.error("Error resending verification link:", error);
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: "Invalid request data", details: error.issues });
        }
        res.status(500).json({ error: "Internal server error" });
    }
});
exports.default = router;
