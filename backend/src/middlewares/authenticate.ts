import type { RequestHandler } from "express";
import { AppError } from "../utils/AppError.js";
import { verifyAccessToken } from "../utils/jwt.js";
import { findUserById } from "../services/auth.service.js";

export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const token = req.cookies?.accessToken;

    if (typeof token !== "string" || token.length === 0) {
      throw new AppError(401, "Unauthorized");
    }

    const payload = verifyAccessToken(token);
    const user = await findUserById(payload.userId);
    if (!user) {
      throw new AppError(401, "Unauthorized");
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
