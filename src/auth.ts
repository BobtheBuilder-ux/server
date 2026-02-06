import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { emailOTP } from "better-auth/plugins";
import { createAuthMiddleware } from "better-auth/api";
import { sendEmail } from "./utils/emailService";
import { db, users, accounts, sessions, verifications } from "./utils/database";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { createUserProfile } from "./middleware/betterAuthMiddleware";

const defaultBaseURL = (() => {
  const port = process.env.PORT || "3031";
  const host = process.env.SERVER_HOST || "http://localhost";
  return `${host}:${port}/api/auth`;
})();

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || defaultBaseURL,
  secret: process.env.BETTER_AUTH_SECRET || "your-secret-key-here",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      account: accounts,
      session: sessions,
      verification: verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      // Extract token from Better Auth's reset URL
      // Better Auth generates URLs like: http://server:port/api/auth/reset-password/TOKEN?callbackURL=...
      // We need to extract just the token and create our own client-side URL
      
      let resetToken = "";
      try {
        // Parse the URL to extract the token
        const urlObj = new URL(url);
        // The token is the last part of the pathname
        const pathParts = urlObj.pathname.split('/');
        resetToken = pathParts[pathParts.length - 1];
      } catch (error) {
        console.error("Error parsing reset URL:", error);
        resetToken = url; // Fallback to the full URL if parsing fails
      }

      // Construct the client-side reset password link
      const clientResetLink = `${process.env.CLIENT_URL}/api/auth/reset-password/${resetToken}`;

      await sendEmail({
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
    admin(),
    // Disable emailOTP plugin since we're using custom verification links
    // emailOTP({
    //   overrideDefaultEmailVerification: true,
    //   async sendVerificationOTP({ email, otp, type: _type }) {
    //     await sendEmail({
    //       to: email,
    //       subject: "Your HomeMatch Verification Code",
    //       body: `
    //         <html>
    //           <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    //             <div style="text-align: center; margin-bottom: 30px;">
    //               <h1 style="color: #059669; margin: 0;">HomeMatch</h1>
    //               <p style="color: #6b7280; margin: 5px 0 0 0;">Your Rental Platform</p>
    //             </div>
                
    //             <div style="background-color: #f9fafb; padding: 30px; border-radius: 8px; text-align: center;">
    //               <h2 style="color: #111827; margin: 0 0 20px 0;">Verification Code</h2>
    //               <p style="color: #374151; margin: 0 0 25px 0;">Use this code to complete your verification:</p>
                  
    //               <div style="background-color: #059669; color: white; font-size: 32px; font-weight: bold; padding: 20px; border-radius: 8px; letter-spacing: 8px; margin: 20px 0;">
    //                 ${otp}
    //               </div>
                  
    //               <p style="color: #6b7280; font-size: 14px; margin: 20px 0 0 0;">This code will expire in 10 minutes.</p>
    //             </div>
                
    //             <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
    //               <p style="color: #6b7280; font-size: 12px; margin: 0;">If you didn't request this code, please ignore this email.</p>
    //             </div>
    //           </body>
    //         </html>
    //       `
    //     });
    //   },
    // }),
  ],
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false, // Make role optional to prevent 422 errors
        defaultValue: "tenant", // Set default role
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
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  advanced: {
    database: {
      generateId: () => {
        // Generate custom ID format if needed
        return crypto.randomUUID();
      },
    },
    useSecureCookies: process.env.NODE_ENV === 'production', // Only use secure cookies in production
    defaultCookieAttributes: {
      sameSite: "lax", // Allow cross-site session access
      secure: process.env.NODE_ENV === 'production', // Only enforce HTTPS in production
      httpOnly: true,
      path: "/",
      domain: process.env.COOKIE_DOMAIN || undefined, // Allow cross-domain if specified
    },
  },
  trustedOrigins: [
    process.env.CLIENT_URL || "http://localhost:3000",
    "http://localhost:3000",
    "https://www.homematch.ng",
    "https://homematch.ng",
  ],
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // Validate role assignment during registration
      if (ctx.path === "/sign-up/email" && ctx.body?.role) {
        const allowedRoles = ["tenant", "landlord", "agent", "sale", "admin", "blogger"];
        if (!allowedRoles.includes(ctx.body.role)) {
          throw new Error(`Invalid role: ${ctx.body.role}. Allowed roles are: ${allowedRoles.join(", ")}`);
        }
        
        // Explicitly prevent 'user' role assignment
        if (ctx.body.role === "user") {
          throw new Error("The 'user' role is not allowed. Please select from: tenant, landlord, agent, or admin");
        }
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      // Skip post-registration hooks for admin-created users (handled in controller)
      if (ctx.headers?.get("x-admin-create") === "true") {
        return;
      }
      
      if (ctx.path === "/sign-up/email" && ctx.context.returned) {
        const returned = ctx.context.returned as any;
        
        if (returned?.user?.id && returned?.user?.email) {
          const user = returned.user;
          const userRole = ctx.body?.role || "tenant"; // Get role from request body
          const registrationSource = ctx.headers?.get('x-registration-source');
          const landlordId = ctx.headers?.get('x-landlord-id');
          const houseAddress = ctx.headers?.get('x-house-address');
          
          console.log(`📝 Processing sign-up for user: ${user.email}`);
          console.log(`📝 User role from body: ${userRole}`);
          console.log(`📝 Registration source: ${registrationSource}`);
        
          // Set verification initiated timestamp when user signs up
          await db.update(users)
            .set({ verificationInitiatedAt: new Date() })
            .where(eq(users.id, user.id));
          
          // Create user profile based on role
          try {
            console.log(`🏗️ Creating user profile for role: ${userRole}`);
            await createUserProfile(user.id, userRole);
            console.log(`✅ User profile created successfully for role: ${userRole}`);
          } catch (error) {
            console.error(`❌ Failed to create user profile for role: ${userRole}`, error);
            // Don't throw the error to prevent user registration from failing
          }
          
          // Generate and send verification link for new users
          const verificationToken = crypto.randomBytes(32).toString("hex");
          const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
          
          await db.update(users)
            .set({
              verificationToken,
              verificationTokenExpiresAt,
            })
            .where(eq(users.id, user.id));
          
          // Send verification email
          const verificationLink = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;
          
          try {
            console.log(`📧 Attempting to send verification email to: ${user.email}`);
            console.log(`🔗 Verification link: ${verificationLink}`);
            
            // Different email content based on registration source
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
            } else {
              // Regular registration email
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
            
            await sendEmail({
              to: user.email,
              subject: emailSubject,
              body: emailBody
            });
            
            console.log(`✅ Verification email sent successfully to: ${user.email}`);
          } catch (error) {
            console.error(`❌ Failed to send verification email to: ${user.email}`, error);
            // Don't throw the error to prevent user registration from failing
          }
        }
      }
      
      // Remove OTP-related hooks since we're using verification links
      // if (ctx.path === "/send-verification-otp" && ctx.body?.email) {
      //   // Update verification initiated timestamp when OTP is sent
      //   await db.update(users)
      //     .set({ verificationInitiatedAt: new Date() })
      //     .where(eq(users.email, ctx.body.email));
      // }
      
      // if (ctx.path === "/email-otp/check-verification-otp") {
      //   console.log("OTP verification hook triggered", {
      //     path: ctx.path,
      //     body: ctx.body
      //   });
        
      //   // Get email from request body
      //   const email = ctx.body?.email;
        
      //   if (email) {
      //     // Update email verification status when OTP is successfully verified
      //     await db.update(users)
      //       .set({ emailVerified: true })
      //       .where(eq(users.email, email));
      //     console.log(`Email verified for email: ${email}`);
      //   } else {
      //     console.log("No email found in OTP verification request");
      //   }
      // }
    }),
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
