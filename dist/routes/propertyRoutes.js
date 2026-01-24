"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const express_1 = tslib_1.__importDefault(require("express"));
const propertyControllers_1 = require("../controllers/propertyControllers");
const leaseControllers_1 = require("../controllers/leaseControllers");
const multer_1 = tslib_1.__importDefault(require("multer"));
const betterAuthMiddleware_1 = require("../middleware/betterAuthMiddleware");
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024,
    },
    fileFilter: (_req, file, cb) => {
        const allowedTypes = [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'image/webp',
            'video/mp4',
            'video/mpeg',
            'video/quicktime',
            'video/x-msvideo',
            'video/webm'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(null, false);
        }
    }
});
const router = express_1.default.Router();
router.get("/", propertyControllers_1.getProperties);
router.get("/:id", propertyControllers_1.getProperty);
router.get("/:propertyId/leases", (0, betterAuthMiddleware_1.betterAuthMiddleware)(["landlord", "tenant", "admin"]), leaseControllers_1.getPropertyLeases);
router.post("/", (0, betterAuthMiddleware_1.betterAuthMiddleware)(["landlord"]), upload.fields([
    { name: 'photos', maxCount: 20 },
    { name: 'video', maxCount: 1 }
]), propertyControllers_1.createProperty);
exports.default = router;
