import { Router } from "express";
import { auth } from "../auth";
import { eq } from "drizzle-orm";
import { db } from "../utils/database";
import { landlordRegistrationCodes } from "../db/schema";
import { betterAuthMiddleware } from "../middleware/betterAuthMiddleware";

const router = Router();

// Role validation function
const validateRole = (role: string) => {
  const allowedRoles = ["tenant", "landlord", "agent", "sale", "admin"];
  if (!allowedRoles.includes(role)) {
    throw new Error(`Invalid role: ${role}. Allowed roles are: ${allowedRoles.join(", ")}`);
  }
  if (role === "user") {
    throw new Error("The 'user' role is not allowed. Please select from: tenant, landlord, agent, or admin");
  }
};

// Custom auth routes for role-based registration (Better Auth handler is in index.ts)

// Custom auth routes for role-based registration
router.post("/register/landlord", async (req, res) => {
  try {
    const { email, password, name, phoneNumber, registrationCode } = req.body;
    
    // Validate role
    validateRole("landlord");
    
    // Verify registration code if provided
    if (registrationCode) {
      const codeRecordResult = await db.select().from(landlordRegistrationCodes).where(eq(landlordRegistrationCodes.code, registrationCode));
      const codeRecord = codeRecordResult[0];

      if (!codeRecord) {
        return res.status(400).json({ error: "Invalid registration code" });
      }

      if (codeRecord.isUsed) {
        return res.status(400).json({ error: "Registration code has already been used" });
      }
    }
    
    // Create user with landlord role
    const result = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name,
        role: "landlord",
        phoneNumber,
        callbackURL: `${process.env.CLIENT_URL}/auth/verify-email`,
      },
      headers: req.headers as any,
    });
    
    if (result.user) {
      // Email verification link is sent automatically by the auth system
      res.json({ 
        success: true, 
        message: "Landlord registration initiated. Please check your email for the verification link.",
        user: result.user
      });
    } else {
      res.status(400).json({ error: "Registration failed" });
    }
  } catch (error) {
    console.error("Landlord registration error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/register/agent", async (req, res) => {
  try {
    const { email, password, name, phoneNumber, registrationCode } = req.body;
    
    // Validate role
    validateRole("agent");
    
    // Verify agent registration code is required
    if (!registrationCode) {
      return res.status(400).json({ error: "Registration code is required for agent registration" });
    }
    
    // Verify registration code
    const codeRecordResult = await db.select().from(landlordRegistrationCodes).where(eq(landlordRegistrationCodes.code, registrationCode));
    const codeRecord = codeRecordResult[0];

    if (!codeRecord) {
      return res.status(400).json({ error: "Invalid registration code" });
    }

    if (codeRecord.isUsed) {
      return res.status(400).json({ error: "Registration code has already been used" });
    }
    
    // Create user with agent role
    const result = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name,
        role: "agent",
        phoneNumber,
        callbackURL: `${process.env.CLIENT_URL}/auth/verify-email`,
      },
      headers: req.headers as any,
    });
    
    if (result.user) {
      // Email verification link is sent automatically by the auth system
      res.json({ 
        success: true, 
        message: "Agent registration initiated. Please check your email for the verification link.",
        user: result.user
      });
    } else {
      res.status(400).json({ error: "Registration failed" });
    }
  } catch (error) {
    console.error("Agent registration error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/register/tenant", async (req, res) => {
  try {
    const { email, password, name, phoneNumber } = req.body;
    
    // Validate role
    validateRole("tenant");
    
    // Create user with tenant role
    const result = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name,
        role: "tenant",
        phoneNumber,
        callbackURL: `${process.env.CLIENT_URL}/auth/verify-email`,
      },
      headers: req.headers as any,
    });
    
    if (result.user) {
      // Email verification link is sent automatically by the auth system
      res.json({ 
        success: true, 
        message: "Tenant registration initiated. Please check your email for the verification link.",
        user: result.user
      });
    } else {
      res.status(400).json({ error: "Registration failed" });
    }
  } catch (error) {
    console.error("Tenant registration error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/register/admin", async (req, res) => {
  try {
    const { email, password, name, phoneNumber } = req.body;
    
    // Validate role
    validateRole("admin");
    
    // Validate admin email domain
    if (!email.endsWith('@homematch.ng')) {
      return res.status(400).json({ error: "Admin registration requires an @homematch.ng email address" });
    }
    
    // Create user with admin role
    const result = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name,
        role: "admin",
        phoneNumber,
        callbackURL: `${process.env.CLIENT_URL}/auth/verify-email`,
      },
      headers: req.headers as any,
    });
    
    if (result.user) {
      // Email verification link is sent automatically by the auth system
      res.json({ 
        success: true, 
        message: "Admin registration initiated. Please check your email for the verification link.",
        user: result.user
      });
    } else {
      res.status(400).json({ error: "Registration failed" });
    }
  } catch (error) {
    console.error("Admin registration error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Send OTP for email verification
router.post("/api/auth/send-verification-otp", async (req, res) => {
  try {
    res.status(410).json({ 
      error: "OTP verification is no longer supported. Please use email verification links instead." 
    });
  } catch (error) {
    console.error("Error in deprecated OTP endpoint:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Custom verify OTP endpoint (since we disabled the emailOTP plugin)
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({ error: "Email and OTP are required" });
    }
    
    // Since we're using verification links now, this endpoint is deprecated
    return res.status(400).json({ 
      error: "OTP verification is no longer supported. Please use email verification links instead." 
    });
    
  } catch (error) {
    console.error("Error in verify OTP:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Password reset with OTP
router.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const api: any = (auth as any).api;
    const payload = { body: { email, redirectTo: `${process.env.CLIENT_URL}/auth/reset-password` }, headers: req.headers as any };
    let result: any = null;
    if (typeof api?.forgetPassword === "function") {
      result = await api.forgetPassword(payload);
    } else if (typeof api?.forgotPassword === "function") {
      result = await api.forgotPassword(payload);
    } else if (typeof api?.resetPassword === "function") {
      // Some versions expose resetPassword for token-based flow initiation
      result = await api.resetPassword(payload);
    } else {
      throw new Error("Password reset API not available in current auth version");
    }
    if (result) {
      res.json({ success: true, message: "Password reset email sent" });
    } else {
      res.status(400).json({ error: "Failed to send reset email" });
    }
  } catch (error) {
    console.error("Password reset error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// General signup endpoint that routes to role-based registration
router.post("/signup", async (req, res) => {
  try {
    const { email, password, name, role, invitationCode } = req.body;
    
    // Validate required fields
    if (!email || !password || !name || !role) {
      return res.status(400).json({ 
        error: "Missing required fields: email, password, name, and role are required" 
      });
    }
    
    // Validate role
    try {
      validateRole(role);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
    
    // Verify registration code if provided for agent role
    if (role.toLowerCase() === "agent" && invitationCode) {
      // TODO: Implement registration code verification
    }
    
    // Create user with specified role
    const result = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name,
        role: role.toLowerCase(),
        phoneNumber: req.body.phoneNumber || "",
        callbackURL: `${process.env.CLIENT_URL}/auth/verify-email`,
      },
      headers: req.headers as any,
    });
    
    if (result.user) {
      // Since we're using verification links now, we don't send OTP
      // The verification link is sent automatically in the auth.ts after hook
      
      res.status(201).json({
        message: "User registered successfully. Please check your email for verification link.",
        user: {
          id: result.user.id,
          email: result.user.email,
          role: role.toLowerCase(),
          emailVerified: result.user.emailVerified
        }
      });
    } else {
      res.status(400).json({ error: "Registration failed" });
    }
    
  } catch (error: any) {
    console.error("Signup error:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    console.error("Error details:", JSON.stringify(error, null, 2));
    
    if (error.message?.includes("already exists")) {
      res.status(409).json({ error: "User with this email already exists" });
    } else {
      res.status(500).json({ error: "Internal server error", details: error.message });
    }
  }
});

// Get current user with role information
router.get("/session", betterAuthMiddleware(), async (req, res) => {
  try {
    const userType = req.user?.role || "tenant";
    
    // Log session information with userType and token to console
    console.log(`[SESSION_FETCH] Email: ${req.user?.email}, UserType: ${userType}, ID: ${req.user?.id}, Token: ${req.session?.token?.substring(0, 10)}...`);
    
    res.json({
      user: req.user,
      session: req.session,
      userType: userType,
      token: req.session?.token
    });
  } catch (error) {
    console.error("Session error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
