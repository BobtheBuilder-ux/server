"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auth = void 0;
const tslib_1 = require("tslib");
const better_auth_1 = require("better-auth");
const drizzle_1 = require("better-auth/adapters/drizzle");
const plugins_1 = require("better-auth/plugins");
const api_1 = require("better-auth/api");
const emailService_1 = require("./utils/emailService");
const database_1 = require("./utils/database");
const drizzle_orm_1 = require("drizzle-orm");
const crypto_1 = tslib_1.__importDefault(require("crypto"));
const betterAuthMiddleware_1 = require("./middleware/betterAuthMiddleware");
const defaultBaseURL = (() => {
    const port = process.env.PORT || "3031";
    const host = process.env.SERVER_HOST || "http://localhost";
    return `${host}:${port}/api/auth`;
})();
exports.auth = (0, better_auth_1.betterAuth)({
    baseURL: process.env.BETTER_AUTH_URL || defaultBaseURL,
    secret: process.env.BETTER_AUTH_SECRET || "your-secret-key-here",
    database: (0, drizzle_1.drizzleAdapter)(database_1.db, {
        provider: "pg",
        schema: {
            user: database_1.users,
            account: database_1.accounts,
            session: database_1.sessions,
            verification: database_1.verifications,
        },
    }),
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
        sendResetPassword: async ({ user, url }) => {
            let resetToken = "";
            try {
                const urlObj = new URL(url);
                const pathParts = urlObj.pathname.split('/');
                resetToken = pathParts[pathParts.length - 1];
            }
            catch (error) {
                console.error("Error parsing reset URL:", error);
                resetToken = url;
            }
            const clientResetLink = `${process.env.CLIENT_URL}/api/auth/reset-password/${resetToken}`;
            await (0, emailService_1.sendEmail)({
                to: user.email,
                subject: "Reset Your HomeMatch Password",
                body: `
          <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #059669; margin: 0;">HomeMatch</h1>
                <p style="color: #6b7280; margin: 5px 0 0 0;">Your Rental Platform</p>
              </div>
              
              <div style="background-color: #f9fafb; padding: 30px; border-radius: 8px;">
                <h2 style="color: #111827; margin: 0 0 20px 0;">Reset Your Password</h2>
                <p style="color: #374151; margin: 0 0 25px 0;">Click the button below to reset your password:</p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${clientResetLink}" style="background-color: #059669; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset Password</a>
                </div>
                
                <p style="color: #6b7280; font-size: 14px; margin: 20px 0 0 0;">If you didn't request this password reset, please ignore this email.</p>
                
                <p style="color: #6b7280; font-size: 12px; margin: 20px 0 0 0;">
                  This link will expire in 1 hour. If the button doesn't work, copy and paste this link into your browser:
                </p>
                <p style="color: #059669; font-size: 12px; word-break: break-all; margin: 10px 0;">
                  ${clientResetLink}
                </p>
              </div>
            </body>
          </html>
        `,
            });
        },
    },
    plugins: [
        (0, plugins_1.admin)(),
    ],
    user: {
        additionalFields: {
            role: {
                type: "string",
                required: false,
                defaultValue: "tenant",
            },
            phoneNumber: {
                type: "string",
                required: false,
            },
            isOnboardingComplete: {
                type: "boolean",
                required: false,
                defaultValue: false,
            },
            verificationInitiatedAt: {
                type: "date",
                required: false,
            },
        },
    },
    session: {
        expiresIn: 60 * 60 * 24 * 7,
        updateAge: 60 * 60 * 24,
    },
    advanced: {
        database: {
            generateId: () => {
                return crypto_1.default.randomUUID();
            },
        },
        useSecureCookies: process.env.NODE_ENV === 'production',
        defaultCookieAttributes: {
            sameSite: "lax",
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
            path: "/",
            domain: process.env.COOKIE_DOMAIN || undefined,
        },
    },
    trustedOrigins: [
        process.env.CLIENT_URL || "http://localhost:3000",
        "http://localhost:3000",
        "https://www.homematch.ng",
        "https://homematch.ng",
    ],
    hooks: {
        before: (0, api_1.createAuthMiddleware)(async (ctx) => {
            if (ctx.path === "/sign-up/email" && ctx.body?.role) {
                const allowedRoles = ["tenant", "landlord", "agent", "sale", "admin"];
                if (!allowedRoles.includes(ctx.body.role)) {
                    throw new Error(`Invalid role: ${ctx.body.role}. Allowed roles are: ${allowedRoles.join(", ")}`);
                }
                if (ctx.body.role === "user") {
                    throw new Error("The 'user' role is not allowed. Please select from: tenant, landlord, agent, or admin");
                }
            }
        }),
        after: (0, api_1.createAuthMiddleware)(async (ctx) => {
            if (ctx.path === "/sign-up/email" && ctx.context.returned) {
                const returned = ctx.context.returned;
                if (returned?.user?.id && returned?.user?.email) {
                    const user = returned.user;
                    const userRole = ctx.body?.role || "tenant";
                    const registrationSource = ctx.headers?.get('x-registration-source');
                    const landlordId = ctx.headers?.get('x-landlord-id');
                    const houseAddress = ctx.headers?.get('x-house-address');
                    console.log(`📝 Processing sign-up for user: ${user.email}`);
                    console.log(`📝 User role from body: ${userRole}`);
                    console.log(`📝 Registration source: ${registrationSource}`);
                    await database_1.db.update(database_1.users)
                        .set({ verificationInitiatedAt: new Date() })
                        .where((0, drizzle_orm_1.eq)(database_1.users.id, user.id));
                    try {
                        console.log(`🏗️ Creating user profile for role: ${userRole}`);
                        await (0, betterAuthMiddleware_1.createUserProfile)(user.id, userRole);
                        console.log(`✅ User profile created successfully for role: ${userRole}`);
                    }
                    catch (error) {
                        console.error(`❌ Failed to create user profile for role: ${userRole}`, error);
                    }
                    const verificationToken = crypto_1.default.randomBytes(32).toString("hex");
                    const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
                    await database_1.db.update(database_1.users)
                        .set({
                        verificationToken,
                        verificationTokenExpiresAt,
                    })
                        .where((0, drizzle_orm_1.eq)(database_1.users.id, user.id));
                    const verificationLink = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;
                    try {
                        console.log(`📧 Attempting to send verification email to: ${user.email}`);
                        console.log(`🔗 Verification link: ${verificationLink}`);
                        let emailSubject = "Verify Your HomeMatch Account";
                        let emailBody = "";
                        if (registrationSource === 'landlord-link') {
                            emailSubject = "Welcome to HomeMatch - Verify Your Tenant Account";
                            emailBody = `
                <html>
                  <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                      <h1 style="color: #059669; margin: 0;">HomeMatch</h1>
                      <p style="color: #6b7280; margin: 5px 0 0 0;">Your Rental Platform</p>
                    </div>
                    
                    <div style="background-color: #f9fafb; padding: 30px; border-radius: 8px;">
                      <h2 style="color: #111827; margin: 0 0 20px 0;">Welcome to Your New Home!</h2>
                      <p style="color: #374151; margin: 0 0 25px 0;">
                        Your landlord has invited you to join HomeMatch for your rental at <strong>${houseAddress}</strong>. 
                        Please click the button below to verify your email address and activate your tenant account.
                      </p>
                      
                      <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
                        <h3 style="color: #065f46; margin: 0 0 10px 0;">🏠 Your Rental Property:</h3>
                        <p style="color: #374151; margin: 0; font-weight: 500;">${houseAddress}</p>
                      </div>
                      
                      <div style="text-align: center; margin: 30px 0;">
                        <a href="${verificationLink}" 
                           style="background-color: #059669; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                          Verify Email & Access Your Account
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
                        This invitation was sent by your landlord. If you believe this is an error, please contact support.
                      </p>
                    </div>
                  </body>
                </html>
              `;
                        }
                        else {
                            emailBody = `
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
              `;
                        }
                        await (0, emailService_1.sendEmail)({
                            to: user.email,
                            subject: emailSubject,
                            body: emailBody
                        });
                        console.log(`✅ Verification email sent successfully to: ${user.email}`);
                    }
                    catch (error) {
                        console.error(`❌ Failed to send verification email to: ${user.email}`, error);
                    }
                }
            }
        }),
    },
});
