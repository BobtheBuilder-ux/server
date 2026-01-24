"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const express_1 = tslib_1.__importDefault(require("express"));
const adminControllers_1 = require("../controllers/adminControllers");
const router = express_1.default.Router();
router.post("/agents", adminControllers_1.createAgent);
exports.default = router;
