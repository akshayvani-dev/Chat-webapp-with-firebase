import axiosInstance from "./axiosInstance";
import type { DirectoryUser, ListedUser } from "../types/chat.types";

type UsersResponse = {
  users: ListedUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type UserResponse = {
  user: DirectoryUser;
};

export type InitiateConversationResponse = {
  conversationId: string;
  chatInitiated: true;
};

export async function getUsers(
  page: number,
  limit = 10,
): Promise<UsersResponse> {
  const response = await axiosInstance.get<UsersResponse>("/users", {
    params: { page, limit },
  });
  return response.data;
}

export async function getUserById(id: string): Promise<DirectoryUser> {
  const response = await axiosInstance.get<UserResponse>(
    `/users/${encodeURIComponent(id)}`,
  );
  return response.data.user;
}

export async function initiateConversation(
  userId: string,
): Promise<InitiateConversationResponse> {
  const response = await axiosInstance.post<InitiateConversationResponse>(
    `/users/${encodeURIComponent(userId)}/conversation`,
  );
  return response.data;
}
