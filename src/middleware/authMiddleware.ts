import { Request, Response, NextFunction } from "express";
import { auth } from "../auth";

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
    }
  }
}

// Admin privilege levels
export enum AdminPrivilege {
  USER_MANAGEMENT = 'user_management',
  PROPERTY_MANAGEMENT = 'property_management',
  FINANCIAL_MANAGEMENT = 'financial_management',
  SYSTEM_SETTINGS = 'system_settings',
  ANALYTICS_ACCESS = 'analytics_access',
  AGENT_MANAGEMENT = 'agent_management',
  TASK_MANAGEMENT = 'task_management',
  SUPER_ADMIN = 'super_admin'
}

// Role-based privilege mapping
const ROLE_PRIVILEGES: Record<string, AdminPrivilege[]> = {
  admin: [
    AdminPrivilege.USER_MANAGEMENT,
    AdminPrivilege.PROPERTY_MANAGEMENT,
    AdminPrivilege.FINANCIAL_MANAGEMENT,
    AdminPrivilege.SYSTEM_SETTINGS,
    AdminPrivilege.ANALYTICS_ACCESS,
    AdminPrivilege.AGENT_MANAGEMENT,
    AdminPrivilege.TASK_MANAGEMENT,
    AdminPrivilege.SUPER_ADMIN
  ],
  agent: [
    AdminPrivilege.PROPERTY_MANAGEMENT,
    AdminPrivilege.TASK_MANAGEMENT
  ],
  landlord: [
    AdminPrivilege.PROPERTY_MANAGEMENT
  ],
  blogger: [
    AdminPrivilege.ANALYTICS_ACCESS // Bloggers might need some access, adjust as needed
  ],
  tenant: []
};

export const authMiddleware = (allowedRoles: string[], requiredPrivileges?: AdminPrivilege[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    console.log('Better Auth middleware called for:', req.method, req.path);
    
    try {
      // Get session from Better Auth
      const session = await auth.api.getSession({
        headers: req.headers as any
      });

      if (!session) {
        console.log('No valid session found');
        res.status(401).json({ message: "Unauthorized - No valid session" });
        return;
      }

      const user = session.user;
      const userRole = user.role || 'tenant';
      
      console.log('User session found:', { id: user.id, role: userRole, email: user.email });
      console.log('Allowed roles:', allowedRoles);
      
      // Set user info in request
      req.user = {
        id: user.id,
        role: userRole,
        email: user.email,
        name: user.name,
        isAdmin: userRole === 'admin'
      };

      // Check role-based access
      const hasRoleAccess = allowedRoles.includes(userRole.toLowerCase());
      console.log('Has role access:', hasRoleAccess);
      
      if (!hasRoleAccess) {
        console.log('Access denied for role:', userRole);
        res.status(403).json({ message: "Access Denied - Insufficient role permissions" });
        return;
      }

      // Check privilege-based access if required
      if (requiredPrivileges && requiredPrivileges.length > 0) {
        const userPrivileges = ROLE_PRIVILEGES[userRole.toLowerCase()] || [];
        const hasPrivilegeAccess = requiredPrivileges.every(privilege => 
          userPrivileges.includes(privilege)
        );
        
        console.log('Required privileges:', requiredPrivileges);
        console.log('User privileges:', userPrivileges);
        console.log('Has privilege access:', hasPrivilegeAccess);
        
        if (!hasPrivilegeAccess) {
          console.log('Access denied - insufficient privileges');
          res.status(403).json({ 
            message: "Access Denied - Insufficient privileges",
            requiredPrivileges,
            userPrivileges
          });
          return;
        }
      }

      console.log('Auth middleware passed, calling next()');
      next();
    } catch (error) {
      console.error("Auth middleware error:", error);
      res.status(500).json({ message: "Authentication error" });
      return;
    }
  };
};

// Helper function to check if user has specific privilege
export const hasPrivilege = (userRole: string, privilege: AdminPrivilege): boolean => {
  const userPrivileges = ROLE_PRIVILEGES[userRole.toLowerCase()] || [];
  return userPrivileges.includes(privilege);
};

// Helper function to get all privileges for a role
export const getRolePrivileges = (userRole: string): AdminPrivilege[] => {
  return ROLE_PRIVILEGES[userRole.toLowerCase()] || [];
};
