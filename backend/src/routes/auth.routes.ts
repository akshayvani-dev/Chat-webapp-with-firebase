import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import {
  authLimiter,
  authStrictLimiter,
} from "../middlewares/rateLimiter.js";
import {
  signinSchema,
  signupSchema,
  validateBody,
} from "../validators/auth.validator.js";

const router = Router();

// Apply general rate limit to all auth endpoints
router.use(authLimiter);

// Protect sensitive endpoints against brute force attacks
router.post(
  "/signup",
  authStrictLimiter,
  validateBody(signupSchema),
  authController.signup,
);
router.post(
  "/signin",
  authStrictLimiter,
  validateBody(signinSchema),
  authController.signin,
);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);
router.get("/me", authenticate, authController.me);

export default router;
