"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const express_1 = tslib_1.__importDefault(require("express"));
const landlordAcquisitionController_1 = require("../controllers/landlordAcquisitionController");
const router = express_1.default.Router();
router.post("/", landlordAcquisitionController_1.submitAcquisition);
exports.default = router;
