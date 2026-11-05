import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import {
  signinSchema,
  signupSchema,
  validateBody,
} from "../validators/auth.validator.js";

const router = Router();

router.post("/signup", validateBody(signupSchema), authController.signup);
router.post("/signin", validateBody(signinSchema), authController.signin);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);
router.get("/me", authenticate, authController.me);

export default router;
