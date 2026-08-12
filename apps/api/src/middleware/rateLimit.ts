import rateLimit from "express-rate-limit";

/** Generous limit for authenticated dashboard/API traffic. */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
});

/** Stricter limit for public, unauthenticated endpoints (widget config + response submission). */
export const publicRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

/** Very strict limit for auth endpoints to slow down credential stuffing / brute force. */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});
