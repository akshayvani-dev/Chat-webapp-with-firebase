import type { RequestHandler } from "express";
import { z } from "zod";
import { AppError } from "../utils/AppError.js";

export const signupSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  password: z.string().min(8),
});

export const signinSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type SigninInput = z.infer<typeof signinSchema>;

export function validateBody<T extends z.ZodType>(schema: T): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      next(
        new AppError(
          400,
          result.error.issues.map((issue) => issue.message).join(", "),
        ),
      );
      return;
    }

    req.body = result.data;
    next();
  };
}
