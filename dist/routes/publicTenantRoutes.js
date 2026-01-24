"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const express_1 = tslib_1.__importDefault(require("express"));
const tenantControllers_1 = require("../controllers/tenantControllers");
const router = express_1.default.Router();
router.get("/validate-link/:registrationLink", tenantControllers_1.validateLandlordRegistrationLink);
router.post("/register-via-link", tenantControllers_1.createTenantViaLandlordLink);
exports.default = router;
