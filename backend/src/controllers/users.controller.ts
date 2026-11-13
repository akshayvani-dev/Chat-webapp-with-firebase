import type { RequestHandler } from "express";
import { AppError } from "../utils/AppError.js";
import * as usersService from "../services/users.service.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

function parsePositiveInteger(
  value: unknown,
  field: string,
  defaultValue: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  if (value === undefined) {
    return defaultValue;
  }

  if (
    typeof value !== "string" ||
    !/^[1-9]\d*$/.test(value) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) > maximum
  ) {
    throw new AppError(400, `Invalid ${field}`);
  }

  return Number(value);
}

export const list: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const page = parsePositiveInteger(req.query.page, "page", DEFAULT_PAGE);
    const limit = parsePositiveInteger(
      req.query.limit,
      "limit",
      DEFAULT_LIMIT,
      MAX_LIMIT,
    );
    const result = await usersService.listUsers(req.user.id, { page, limit });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getById: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const userId = req.params.id;
    if (typeof userId !== "string" || userId.length === 0) {
      throw new AppError(400, "Invalid user ID");
    }

    const user = await usersService.getUserById(userId, req.user.id);
    if (!user || user.id === req.user.id) {
      throw new AppError(404, "User not found");
    }

    res.status(200).json({ user });
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
