import { Router } from "express";
import {
  initiateConversation,
  sendMessage,
} from "../controllers/conversations.controller.js";
import { authenticate } from "../middlewares/authenticate.js";

const router = Router();

router.post("/:id", authenticate, initiateConversation);
router.post("/:id/messages", authenticate, sendMessage);

export default router;
