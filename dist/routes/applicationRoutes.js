"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const express_1 = tslib_1.__importDefault(require("express"));
const multer_1 = tslib_1.__importDefault(require("multer"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const applicationControllers_1 = require("../controllers/applicationControllers");
const router = express_1.default.Router();
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
    fileFilter: (_req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'image/jpeg',
            'image/jpg',
            'image/png',
            'text/plain'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Invalid file type. Only documents and images are allowed.'));
        }
    }
});
router.post("/with-files", (0, authMiddleware_1.authMiddleware)(["tenant"]), upload.fields([
    { name: 'idDocument', maxCount: 1 },
    { name: 'incomeProof', maxCount: 1 }
]), applicationControllers_1.createApplicationWithFiles);
router.get("/check", (0, authMiddleware_1.authMiddleware)(["tenant"]), applicationControllers_1.checkExistingApplication);
router.get("/check-deadlines", (0, authMiddleware_1.authMiddleware)(["admin"]), applicationControllers_1.checkPaymentDeadlines);
router.post("/", (0, authMiddleware_1.authMiddleware)(["tenant"]), applicationControllers_1.createApplication);
router.put("/:id/status", (0, authMiddleware_1.authMiddleware)(["admin"]), applicationControllers_1.updateApplicationStatus);
router.get("/", (0, authMiddleware_1.authMiddleware)(["landlord", "tenant", "admin"]), applicationControllers_1.getApplications);
router.get("/:id", (0, authMiddleware_1.authMiddleware)(["landlord", "tenant", "admin"]), applicationControllers_1.getApplication);
exports.default = router;
