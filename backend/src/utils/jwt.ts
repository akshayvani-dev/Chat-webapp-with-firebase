import { randomUUID } from "node:crypto";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "./AppError.js";

type UserTokenPayload = JwtPayload & { userId: string };
type RefreshTokenPayload = UserTokenPayload & { jti: string };

function durationSeconds(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) {
    throw new Error("Invalid token expiration configuration");
  }

  const amount = Number(match[1]);
  const unitSeconds: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };

  return amount * unitSeconds[match[2]];
}

export const accessTokenMaxAgeMs =
  durationSeconds(env.JWT_ACCESS_EXPIRES_IN) * 1000;
export const refreshTokenMaxAgeMs =
  durationSeconds(env.JWT_REFRESH_EXPIRES_IN) * 1000;

export function signAccessToken(userId: string): string {
  return jwt.sign(
    { userId },
    env.JWT_ACCESS_SECRET,
    { expiresIn: durationSeconds(env.JWT_ACCESS_EXPIRES_IN) },
  );
}

export function signRefreshToken(userId: string): string {
  return jwt.sign(
    { userId, jti: randomUUID() },
    env.JWT_REFRESH_SECRET,
    { expiresIn: durationSeconds(env.JWT_REFRESH_EXPIRES_IN) },
  );
}

function verifyToken(
  token: string,
  secret: string,
  ignoreExpiration = false,
): JwtPayload {
  try {
    const payload = ignoreExpiration
      ? jwt.verify(token, secret, { ignoreExpiration: true })
      : jwt.verify(token, secret);
    if (typeof payload === "string") {
      throw new Error("Invalid token payload");
    }
    return payload;
  } catch {
    throw new AppError(401, "Invalid or expired token");
  }
}

export function verifyAccessToken(token: string): UserTokenPayload {
  const payload = verifyToken(token, env.JWT_ACCESS_SECRET);
  if (typeof payload.userId !== "string") {
    throw new AppError(401, "Invalid or expired token");
  }
  return { ...payload, userId: payload.userId };
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const payload = verifyToken(token, env.JWT_REFRESH_SECRET, true);
  if (typeof payload.userId !== "string" || typeof payload.jti !== "string") {
    throw new AppError(401, "Invalid or expired token");
  }
  return { ...payload, userId: payload.userId, jti: payload.jti };
}
