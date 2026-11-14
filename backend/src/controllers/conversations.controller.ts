import type { RequestHandler } from "express";
import { z } from "zod";
import { AppError } from "../utils/AppError.js";
import {
  deleteConversationMessage,
  editConversationMessage,
  sendConversationMessage,
} from "../services/firebase-chat.service.js";
import * as usersService from "../services/users.service.js";
import * as conversationsService from "../services/conversations.service.js";

const messageSchema = z.object({
  text: z.string().trim().min(1).max(4000),
});

const paginationSchema = z.object({
  page: z.string().regex(/^[1-9]\d*$/).optional(),
  limit: z.string().regex(/^[1-9]\d*$/).optional(),
});

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

export const listRecent: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const parsedQuery = paginationSchema.safeParse(req.query);
    if (!parsedQuery.success) {
      throw new AppError(400, "Invalid pagination parameters");
    }

    const page = Number(parsedQuery.data.page ?? DEFAULT_PAGE);
    const limit = Number(parsedQuery.data.limit ?? DEFAULT_LIMIT);
    if (
      !Number.isSafeInteger(page) ||
      !Number.isSafeInteger(limit) ||
      limit > MAX_LIMIT
    ) {
      throw new AppError(400, "Invalid pagination parameters");
    }

    const result = await conversationsService.listRecentConversations(
      req.user.id,
      { page, limit },
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

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

export const editMessage: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const parsedBody = messageSchema.safeParse(req.body);
    if (!parsedBody.success) {
      throw new AppError(400, "Message must contain 1 to 4000 characters");
    }

    const { id: conversationId, messageId } = req.params;
    if (typeof conversationId !== "string" || typeof messageId !== "string") {
      throw new AppError(404, "Message not found");
    }

    const message = await editConversationMessage(
      req.user.id,
      conversationId,
      messageId,
      parsedBody.data.text,
    );
    res.status(200).json({ message });
  } catch (error) {
    next(error);
  }
};

export const deleteMessage: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const { id: conversationId, messageId } = req.params;
    if (typeof conversationId !== "string" || typeof messageId !== "string") {
      throw new AppError(404, "Message not found");
    }

    const lastMessage = await deleteConversationMessage(
      req.user.id,
      conversationId,
      messageId,
    );
    res.status(200).json({ lastMessage });
  } catch (error) {
    next(error);
  }
};
