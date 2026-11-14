import axiosInstance from "./axiosInstance";
import type { RecentConversation } from "../types/chat.types";

type RecentConversationsResponse = {
  conversations: RecentConversation[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export async function getRecentConversations(
  page: number,
  limit = 10,
): Promise<RecentConversationsResponse> {
  const response = await axiosInstance.get<RecentConversationsResponse>(
    "/conversations",
    { params: { page, limit } },
  );
  return response.data;
}
