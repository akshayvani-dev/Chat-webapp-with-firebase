import type { ErrorRequestHandler } from "express";
import { AppError } from "../utils/AppError.js";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const message =
    error instanceof AppError ? error.message : "Internal server error";

  if (!(error instanceof AppError)) {
    console.error(
      "Unhandled application error",
      error instanceof Error ? error.name : "Unknown error",
    );
  }

  res.status(statusCode).json({ message });
};
