import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import AppError from "../utils/AppError";

const isTest = process.env.NODE_ENV === "test";

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  handler: (_req, _res, next) => {
    next(new AppError("Too many requests, please try again later", 429));
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const raw = req.body?.username;
    const username =
      typeof raw === "string" ? raw.slice(0, 64).toLowerCase() : "unknown";
    return `${ipKeyGenerator(req.ip ?? "")}:${username}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  handler: (_req, _res, next) => {
    next(new AppError("Too many failed attempts, please try again later", 429));
  },
});

// Must be mounted AFTER authMiddleWare: it keys on req.user.id and only falls
// back to the IP when the request is unauthenticated.
export const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req) =>
    req.user ? `user:${req.user.id}` : `ip:${ipKeyGenerator(req.ip ?? "")}`,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  handler: (_req, _res, next) => {
    next(new AppError("Too many failed attempts, please try again later", 429));
  },
});
