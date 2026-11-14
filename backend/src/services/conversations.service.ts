import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";

export type ListConversationsOptions = {
  page: number;
  limit: number;
};

export type RecentConversation = {
  conversationId: string;
  userId: string;
  name: string;
  lastMessage: string | null;
  lastMessageAt: Date | null;
};

export async function listRecentConversations(
  authenticatedUserId: string,
  { page, limit }: ListConversationsOptions,
) {
  const [conversations, total] = await Promise.all([
    prisma.$queryRaw<RecentConversation[]>(Prisma.sql`
      SELECT
        c."id"::text AS "conversationId",
        u."id" AS "userId",
        u."name",
        c."last_message" AS "lastMessage",
        c."last_message_at" AS "lastMessageAt"
      FROM "conversations" AS c
      JOIN "users" AS u
        ON u."id" = (
          SELECT participant::text
          FROM unnest(c."participants") AS participant
          WHERE participant <> ${authenticatedUserId}::uuid
          LIMIT 1
        )
      WHERE c."participants" @> ARRAY[${authenticatedUserId}::uuid]
      ORDER BY c."last_message_at" DESC NULLS LAST, c."created_at" DESC
      OFFSET ${(page - 1) * limit}
      LIMIT ${limit}
    `),
    prisma.conversation.count({
      where: { participants: { has: authenticatedUserId } },
    }),
  ]);

  return {
    conversations,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
