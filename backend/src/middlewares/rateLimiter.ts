import { rateLimit } from "express-rate-limit";

/**
 * General rate limiter for all auth routes.
 * Allows up to 100 requests per 15 minutes per IP.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Max 100 requests per windowMs
  standardHeaders: "draft-8", // Return standard `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  message: {
    message: "Too many requests, please try again after 15 minutes.",
  },
});

/**
 * Stricter rate limiter specifically for sensitive auth actions (signin / signup)
 * to prevent brute force and credential stuffing attacks.
 * Allows up to 10 attempts per 15 minutes per IP.
 */
export const authStrictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // Max 10 attempts per windowMs
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    message: "Too many authentication attempts, please try again after 15 minutes.",
  },
});
