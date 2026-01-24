"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRolePrivileges = exports.hasPrivilege = exports.authMiddleware = exports.AdminPrivilege = void 0;
const auth_1 = require("../auth");
var AdminPrivilege;
(function (AdminPrivilege) {
    AdminPrivilege["USER_MANAGEMENT"] = "user_management";
    AdminPrivilege["PROPERTY_MANAGEMENT"] = "property_management";
    AdminPrivilege["FINANCIAL_MANAGEMENT"] = "financial_management";
    AdminPrivilege["SYSTEM_SETTINGS"] = "system_settings";
    AdminPrivilege["ANALYTICS_ACCESS"] = "analytics_access";
    AdminPrivilege["AGENT_MANAGEMENT"] = "agent_management";
    AdminPrivilege["TASK_MANAGEMENT"] = "task_management";
    AdminPrivilege["SUPER_ADMIN"] = "super_admin";
})(AdminPrivilege || (exports.AdminPrivilege = AdminPrivilege = {}));
const ROLE_PRIVILEGES = {
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
    tenant: []
};
const authMiddleware = (allowedRoles, requiredPrivileges) => {
    return async (req, res, next) => {
        console.log('Better Auth middleware called for:', req.method, req.path);
        try {
            const session = await auth_1.auth.api.getSession({
                headers: req.headers
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
            req.user = {
                id: user.id,
                role: userRole,
                email: user.email,
                name: user.name,
                isAdmin: userRole === 'admin'
            };
            const hasRoleAccess = allowedRoles.includes(userRole.toLowerCase());
            console.log('Has role access:', hasRoleAccess);
            if (!hasRoleAccess) {
                console.log('Access denied for role:', userRole);
                res.status(403).json({ message: "Access Denied - Insufficient role permissions" });
                return;
            }
            if (requiredPrivileges && requiredPrivileges.length > 0) {
                const userPrivileges = ROLE_PRIVILEGES[userRole.toLowerCase()] || [];
                const hasPrivilegeAccess = requiredPrivileges.every(privilege => userPrivileges.includes(privilege));
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
        }
        catch (error) {
            console.error("Auth middleware error:", error);
            res.status(500).json({ message: "Authentication error" });
            return;
        }
    };
};
exports.authMiddleware = authMiddleware;
const hasPrivilege = (userRole, privilege) => {
    const userPrivileges = ROLE_PRIVILEGES[userRole.toLowerCase()] || [];
    return userPrivileges.includes(privilege);
};
exports.hasPrivilege = hasPrivilege;
const getRolePrivileges = (userRole) => {
    return ROLE_PRIVILEGES[userRole.toLowerCase()] || [];
};
exports.getRolePrivileges = getRolePrivileges;
