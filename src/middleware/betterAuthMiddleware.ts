import { Request, Response, NextFunction } from "express";
import { auth } from "../auth";
import { eq } from "drizzle-orm";
import { db } from "../utils/database";
import { users, landlords, tenants, agents, admins, saleUsers, bloggers } from "../db/schema";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
        email: string;
        name?: string;
        isAdmin?: boolean;
      };
      session?: {
        id: string;
        userId: string;
        expires: Date;
      };
    }
  }
}

export const betterAuthMiddleware = (allowedRoles?: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get session from Better Auth
      const session = await auth.api.getSession({
        headers: req.headers as any,
      });

      if (!session || !session.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Check if email is verified
      if (!session.user.emailVerified) {
        return res.status(401).json({ error: "Email verification required" });
      }

      // Get user with role information
      const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
      
      // Get profile information
      const [landlordProfile] = await db.select().from(landlords).where(eq(landlords.userId, session.user.id)).limit(1);
      const [tenantProfile] = await db.select().from(tenants).where(eq(tenants.userId, session.user.id)).limit(1);
      const [agentProfile] = await db.select().from(agents).where(eq(agents.userId, session.user.id)).limit(1);
      const [adminProfile] = await db.select().from(admins).where(eq(admins.userId, session.user.id)).limit(1);
      const [saleProfile] = await db.select().from(saleUsers).where(eq(saleUsers.userId, session.user.id)).limit(1);
      const [bloggerProfile] = await db.select().from(bloggers).where(eq(bloggers.userId, session.user.id)).limit(1);

      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Determine user role based on profile relationships
      let userRole = user.role || "tenant";
      if (adminProfile) userRole = "admin";
      else if (landlordProfile) userRole = "landlord";
      else if (agentProfile) userRole = "agent";
      else if (saleProfile) userRole = "sale";
      else if (bloggerProfile) userRole = "blogger";
      else if (tenantProfile) userRole = "tenant";

      // Check role permissions
      if (allowedRoles && !allowedRoles.includes(userRole)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      // Attach user and session to request
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
    } catch (error) {
      console.error("Authentication middleware error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  };
};

// Helper function to get user role from profiles
export const getUserRole = async (userId: string): Promise<string> => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    
    if (!user) return "tenant";

    // Check for profile relationships
    const [adminProfile] = await db.select().from(admins).where(eq(admins.userId, userId)).limit(1);
    const [landlordProfile] = await db.select().from(landlords).where(eq(landlords.userId, userId)).limit(1);
    const [agentProfile] = await db.select().from(agents).where(eq(agents.userId, userId)).limit(1);
    const [saleProfile] = await db.select().from(saleUsers).where(eq(saleUsers.userId, userId)).limit(1);
    const [tenantProfile] = await db.select().from(tenants).where(eq(tenants.userId, userId)).limit(1);
    const [bloggerProfile] = await db.select().from(bloggers).where(eq(bloggers.userId, userId)).limit(1);

    if (adminProfile) return "admin";
    if (landlordProfile) return "landlord";
    if (agentProfile) return "agent";
    if (saleProfile) return "sale";
    if (bloggerProfile) return "blogger";
    if (tenantProfile) return "tenant";

    return user.role || "tenant";
  } catch (error) {
    console.error("Error getting user role:", error);
    return "tenant";
  }
};

// Helper function to create profile based on role
export const createUserProfile = async (userId: string, role: string, additionalData: any = {}) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new Error("User not found");

    switch (role) {
      case "landlord":
        await db.insert(landlords).values({
          cognitoId: user.legacyCognitoId || userId, // Use legacy ID or new ID
          userId: userId,
          name: user.name || "",
          email: user.email,
          phoneNumber: user.phoneNumber || "",
          ...additionalData,
        });
        break;

      case "tenant":
        await db.insert(tenants).values({
          cognitoId: user.legacyCognitoId || userId,
          userId: userId,
          name: user.name || "",
          email: user.email,
          phoneNumber: user.phoneNumber || "",
          ...additionalData,
        });
        break;

      case "agent":
        await db.insert(agents).values({
          cognitoId: user.legacyCognitoId || userId,
          userId: userId,
          name: user.name || "",
          email: user.email,
          phoneNumber: user.phoneNumber,
          ...additionalData,
        });
        break;

      case "sale":
        await db.insert(saleUsers).values({
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
        await db.insert(admins).values({
          cognitoId: user.legacyCognitoId || userId,
          userId: userId,
          name: user.name || "",
          email: user.email,
          phoneNumber: user.phoneNumber,
          ...additionalData,
        });
        break;
      case "blogger":
        await db.insert(bloggers).values({
          userId: userId,
          displayName: user.name || user.email.split("@")[0],
          bio: additionalData?.bio || "",
          avatarUrl: additionalData?.avatarUrl || user.image || "",
        });
        break;
    }

    // Update user role
    await db.update(users)
      .set({ role })
      .where(eq(users.id, userId));
  } catch (error) {
    console.error("Error creating user profile:", error);
    throw error;
  }
};
