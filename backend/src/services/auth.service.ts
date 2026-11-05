import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import type { AuthenticatedUser } from "../types/auth.js";
import { AppError } from "../utils/AppError.js";
import {
  refreshTokenMaxAgeMs,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt.js";
import type { SigninInput, SignupInput } from "../validators/auth.validator.js";

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
  updatedAt: true,
} as const;

type AuthSession = {
  user: AuthenticatedUser;
  accessToken: string;
  refreshToken: string;
};

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function createTokenPair(userId: string): Pick<AuthSession, "accessToken" | "refreshToken"> {
  return {
    accessToken: signAccessToken(userId),
    refreshToken: signRefreshToken(userId),
  };
}

async function storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + refreshTokenMaxAgeMs),
    },
  });
}

function isDuplicateEmailError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function signup(input: SignupInput): Promise<AuthSession> {
  const password = await bcrypt.hash(input.password, 12);
  const email = input.email.toLowerCase();

  try {
    return await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: { name: input.name, email, password },
        select: publicUserSelect,
      });
      const tokens = createTokenPair(user.id);

      await transaction.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: hashRefreshToken(tokens.refreshToken),
          expiresAt: new Date(Date.now() + refreshTokenMaxAgeMs),
        },
      });

      return { user, ...tokens };
    });
  } catch (error) {
    if (isDuplicateEmailError(error)) {
      throw new AppError(409, "An account with this email already exists");
    }
    throw error;
  }
}

export async function signin(input: SigninInput): Promise<AuthSession> {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });

  if (!user || !(await bcrypt.compare(input.password, user.password))) {
    throw new AppError(401, "Invalid email or password");
  }

  const tokens = createTokenPair(user.id);
  await storeRefreshToken(user.id, tokens.refreshToken);

  const { password: _password, ...publicUser } = user;
  return { user: publicUser, ...tokens };
}

export async function refresh(refreshToken: unknown): Promise<AuthSession> {
  if (typeof refreshToken !== "string" || refreshToken.length === 0) {
    throw new AppError(401, "Invalid or expired refresh token");
  }

  const payload = verifyRefreshToken(refreshToken);
  const tokenHash = hashRefreshToken(refreshToken);
  const result = await prisma.$transaction(async (transaction) => {
    const storedToken = await transaction.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!storedToken || storedToken.userId !== payload.userId) {
      return { kind: "invalid" as const };
    }

    if (storedToken.revokedAt) {
      await transaction.refreshToken.updateMany({
        where: { userId: storedToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return { kind: "reused" as const };
    }

    const now = new Date();
    if (storedToken.expiresAt <= now) {
      await transaction.refreshToken.updateMany({
        where: { id: storedToken.id, revokedAt: null },
        data: { revokedAt: now },
      });
      return { kind: "invalid" as const };
    }

    const revoked = await transaction.refreshToken.updateMany({
      where: {
        id: storedToken.id,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { revokedAt: now },
    });

    if (revoked.count !== 1) {
      await transaction.refreshToken.updateMany({
        where: { userId: storedToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return { kind: "reused" as const };
    }

    const user = await transaction.user.findUnique({
      where: { id: storedToken.userId },
      select: publicUserSelect,
    });
    if (!user) {
      return { kind: "invalid" as const };
    }

    const tokens = createTokenPair(user.id);
    await transaction.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashRefreshToken(tokens.refreshToken),
        expiresAt: new Date(Date.now() + refreshTokenMaxAgeMs),
      },
    });

    return { kind: "success" as const, user, ...tokens };
  });

  if (result.kind === "reused") {
    throw new AppError(401, "Refresh token reuse detected");
  }
  if (result.kind === "invalid") {
    throw new AppError(401, "Invalid or expired refresh token");
  }

  return result;
}

export async function logout(refreshToken: unknown): Promise<void> {
  if (typeof refreshToken !== "string" || refreshToken.length === 0) {
    return;
  }

  await prisma.refreshToken.updateMany({
    where: {
      tokenHash: hashRefreshToken(refreshToken),
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
}

export async function findUserById(
  userId: string,
): Promise<AuthenticatedUser | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: publicUserSelect,
  });
}
