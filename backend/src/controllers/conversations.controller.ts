import type { RequestHandler } from "express";
import { z } from "zod";
import { AppError } from "../utils/AppError.js";
import { sendConversationMessage } from "../services/firebase-chat.service.js";
import * as usersService from "../services/users.service.js";

const messageSchema = z.object({
  text: z.string().trim().min(1).max(4000),
});

export const initiateConversation: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const selectedUserId = req.params.id;
    if (typeof selectedUserId !== "string" || selectedUserId.length === 0) {
      throw new AppError(400, "Invalid user ID");
    }

    const result = await usersService.initiateConversation(
      req.user.id,
      selectedUserId,
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const sendMessage: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const parsedBody = messageSchema.safeParse(req.body);
    if (!parsedBody.success) {
      throw new AppError(400, "Message must contain 1 to 4000 characters");
    }

    const conversationId = req.params.id;
    if (typeof conversationId !== "string") {
      throw new AppError(404, "Conversation not found");
    }

    const message = await sendConversationMessage(
      req.user.id,
      conversationId,
      parsedBody.data.text,
    );
    res.status(201).json({ message });
  } catch (error) {
    next(error);
  }
};
