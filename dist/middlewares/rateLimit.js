"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimit = rateLimit;
const buckets = new Map();
const DEFAULT_WINDOW_MS = 60000;
const DEFAULT_MAX = 5;
function rateLimit({ windowMs = DEFAULT_WINDOW_MS, max = DEFAULT_MAX } = {}) {
    return (req, res, next) => {
        const ip = (req.ip || req.headers["x-forwarded-for"]?.toString() || "unknown");
        const key = `${ip}:${req.path}`;
        const now = Date.now();
        const existing = buckets.get(key);
        if (!existing || now > existing.resetAt) {
            buckets.set(key, { count: 1, resetAt: now + windowMs });
            return next();
        }
        if (existing.count >= max) {
            const retryAfter = Math.max(0, existing.resetAt - now);
            res.setHeader("Retry-After", Math.ceil(retryAfter / 1000).toString());
            return res.status(429).json({ message: "Too many verification attempts. Please try again shortly." });
        }
        existing.count += 1;
        buckets.set(key, existing);
        next();
    };
}
