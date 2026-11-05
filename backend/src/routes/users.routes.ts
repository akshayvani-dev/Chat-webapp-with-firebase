import { Router } from "express";
import * as usersController from "../controllers/users.controller.js";
import { authenticate } from "../middlewares/authenticate.js";

const router = Router();

router.get("/", authenticate, usersController.list);

export default router;
