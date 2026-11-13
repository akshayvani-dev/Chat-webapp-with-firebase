import { Router } from "express";
import authRouter from "./auth.routes.js";
import conversationsRouter from "./conversations.routes.js";
import usersRouter from "./users.routes.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});
router.use("/auth", authRouter);
router.use("/conversations", conversationsRouter);
router.use("/users", usersRouter);

export default router;
