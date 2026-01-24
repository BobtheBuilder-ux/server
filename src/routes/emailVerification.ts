import { Router } from "express";
import { db, users } from "../utils/database";
import { eq, and, gt } from "drizzle-orm";
import crypto from "crypto";
import { sendEmail } from "../utils/emailService";
import { z } from "zod";

const router = Router();

// Validation schemas
const generateVerificationLinkSchema = z.object({
  email: z.string().email(),
});

const validateTokenSchema = z.object({
  token: z.string().min(1),
});

const resendVerificationLinkSchema = z.object({
  email: z.string().email(),
});

// Generate and send verification link
router.post("/generate-verification-link", async (req, res) => {
  try {
    const { email } = generateVerificationLinkSchema.parse(req.body);

    // Find user by email
    const user = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (!user.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const userData = user[0];

    // Check if user is already verified
    if (userData.emailVerified) {
      return res.status(400).json({ error: "Email is already verified" });
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Update user with verification token
    await db.update(users)
      .set({
        verificationToken,
        verificationTokenExpiresAt,
        verificationInitiatedAt: new Date(),
      })
      .where(eq(users.id, userData.id));

    // Create verification link
    const verificationLink = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;

    // Send verification email
    await sendEmail({
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

  } catch (error: any) {
    console.error("Error generating verification link:", error);
    if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.issues });
      }
    res.status(500).json({ error: "Internal server error" });
  }
});

// Validate verification token
router.post("/validate-token", async (req, res) => {
  try {
    const { token } = validateTokenSchema.parse(req.body);

    // Find user by verification token
    const user = await db.select()
      .from(users)
      .where(
        and(
          eq(users.verificationToken, token),
          gt(users.verificationTokenExpiresAt, new Date())
        )
      )
      .limit(1);

    if (!user.length) {
      return res.status(400).json({ 
        error: "Invalid or expired verification token",
        expired: true
      });
    }

    const userData = user[0];

    // Check if already verified
    if (userData.emailVerified) {
      return res.status(400).json({ 
        error: "Email is already verified",
        alreadyVerified: true
      });
    }

    // Update user as verified and clear verification token
    await db.update(users)
      .set({
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpiresAt: null,
        verificationResendCount: 0,
        verificationLastResendAt: null,
      })
      .where(eq(users.id, userData.id));

    res.json({ 
      success: true, 
      message: "Email verified successfully",
      user: {
        id: userData.id,
        email: userData.email,
        emailVerified: true
      }
    });

  } catch (error: any) {
    console.error("Error validating token:", error);
    if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.issues });
      }
    res.status(500).json({ error: "Internal server error" });
  }
});

// Resend verification link with rate limiting
router.post("/resend-verification-link", async (req, res) => {
  try {
    const { email } = resendVerificationLinkSchema.parse(req.body);

    // Find user by email
    const user = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (!user.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const userData = user[0];

    // Check if user is already verified
    if (userData.emailVerified) {
      return res.status(400).json({ error: "Email is already verified" });
    }

    // Rate limiting: Check if user has exceeded resend limit (3 per hour)
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

    // Reset count if more than an hour has passed
    const newResendCount = (lastResendAt && lastResendAt > oneHourAgo) ? resendCount + 1 : 1;

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Update user with new verification token and resend tracking
    await db.update(users)
      .set({
        verificationToken,
        verificationTokenExpiresAt,
        verificationResendCount: newResendCount,
        verificationLastResendAt: new Date(),
        verificationInitiatedAt: new Date(),
      })
      .where(eq(users.id, userData.id));

    // Create verification link
    const verificationLink = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;

    // Send verification email
    await sendEmail({
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

  } catch (error: any) {
    console.error("Error resending verification link:", error);
    if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.issues });
      }
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;