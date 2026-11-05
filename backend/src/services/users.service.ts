import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/AppError.js";

export type ListUsersOptions = {
  page: number;
  limit: number;
};

export type ListedUser = {
  id: string;
  name: string;
  chatInitiated: boolean;
  conversationId: string | null;
};

export async function listUsers(
  excludedUserId: string,
  { page, limit }: ListUsersOptions,
) {
  const where = { id: { not: excludedUserId } };
  const [users, total] = await Promise.all([
    prisma.$queryRaw<ListedUser[]>(Prisma.sql`
      SELECT
        u."id",
        u."name",
        (c."id" IS NOT NULL) AS "chatInitiated",
        c."id"::text AS "conversationId"
      FROM "users" AS u
      LEFT JOIN "conversations" AS c
        ON c."participants" @> ARRAY[u."id"::uuid]
        AND c."participants" @> ARRAY[${excludedUserId}::uuid]
      WHERE u."id" <> ${excludedUserId}
      ORDER BY u."name" ASC, u."id" ASC
      OFFSET ${(page - 1) * limit}
      LIMIT ${limit}
    `),
    prisma.user.count({ where }),
  ]);

  return {
    users,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getUserById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: publicUserSelect,
  });
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function initiateConversation(
  authenticatedUserId: string,
  selectedUserId: string,
): Promise<{ conversationId: string; chatInitiated: true }> {
  if (!uuidPattern.test(selectedUserId)) {
    throw new AppError(400, "Invalid user ID");
  }
  const normalizedSelectedUserId = selectedUserId.toLowerCase();
  if (authenticatedUserId.toLowerCase() === normalizedSelectedUserId) {
    throw new AppError(400, "Cannot start a conversation with yourself");
  }

  return prisma.$transaction(async (transaction) => {
    const [authenticatedUser, selectedUser] = await Promise.all([
      transaction.user.findUnique({
        where: { id: authenticatedUserId },
        select: { id: true },
      }),
      transaction.user.findUnique({
        where: { id: normalizedSelectedUserId },
        select: { id: true },
      }),
    ]);

    if (!authenticatedUser || !selectedUser) {
      throw new AppError(404, "User not found");
    }

    const participants = [authenticatedUser.id, selectedUser.id]
      .map((id) => id.toLowerCase())
      .sort();
    const [conversation] = await transaction.$queryRaw<
      Array<{ conversationId: string }>
    >(Prisma.sql`
      INSERT INTO "conversations" ("id", "participants")
      VALUES (
        gen_random_uuid(),
        ARRAY[${participants[0]}::uuid, ${participants[1]}::uuid]
      )
      ON CONFLICT ("participants")
      DO UPDATE SET "participants" = EXCLUDED."participants"
      RETURNING "id"::text AS "conversationId"
    `);

    if (!conversation) {
      throw new Error("Conversation upsert returned no row");
    }

    return {
      conversationId: conversation.conversationId,
      chatInitiated: true,
    };
  });
}

const publicUserSelect = {
  id: true,
  name: true,
} as const;
