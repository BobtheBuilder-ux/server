import type { Request, Response, NextFunction } from "express";

type Key = string;
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<Key, Bucket>();
const DEFAULT_WINDOW_MS = 60_000; // 1 minute
const DEFAULT_MAX = 5; // 5 requests per minute

export function rateLimit({ windowMs = DEFAULT_WINDOW_MS, max = DEFAULT_MAX }: { windowMs?: number; max?: number } = {}) {
  return (req: Request, res: Response, next: NextFunction) => {
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