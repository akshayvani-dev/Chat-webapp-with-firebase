import type { Response } from "express";
import { env } from "../config/env.js";
import {
  accessTokenMaxAgeMs,
  refreshTokenMaxAgeMs,
} from "./jwt.js";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.COOKIE_SECURE,
  path: "/",
};

export function setAuthCookies(
  response: Response,
  accessToken: string,
  refreshToken: string,
): void {
  response.cookie("accessToken", accessToken, {
    ...cookieOptions,
    maxAge: accessTokenMaxAgeMs,
  });
  response.cookie("refreshToken", refreshToken, {
    ...cookieOptions,
    maxAge: refreshTokenMaxAgeMs,
  });
}

export function clearAuthCookies(response: Response): void {
  response.clearCookie("accessToken", cookieOptions);
  response.clearCookie("refreshToken", cookieOptions);
}
