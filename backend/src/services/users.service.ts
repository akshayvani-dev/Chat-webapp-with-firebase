import { prisma } from "../config/prisma.js";

export type ListUsersOptions = {
  page: number;
  limit: number;
};

export async function listUsers(
  excludedUserId: string,
  { page, limit }: ListUsersOptions,
) {
  const where = { id: { not: excludedUserId } };
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: publicUserSelect,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
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

const publicUserSelect = {
  id: true,
  name: true,
} as const;
