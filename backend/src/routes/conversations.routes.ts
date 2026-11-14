import { Router } from "express";
import {
  deleteMessage,
  editMessage,
  initiateConversation,
  listRecent,
  sendMessage,
} from "../controllers/conversations.controller.js";
import { authenticate } from "../middlewares/authenticate.js";

const router = Router();

router.get("/", authenticate, listRecent);
router.post("/:id", authenticate, initiateConversation);
router.post("/:id/messages", authenticate, sendMessage);
router.put("/:id/messages/:messageId", authenticate, editMessage);
router.delete("/:id/messages/:messageId", authenticate, deleteMessage);

export default router;
