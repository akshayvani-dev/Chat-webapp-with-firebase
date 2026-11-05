import axiosInstance from "./axiosInstance";
import type { DirectoryUser } from "../types/chat.types";

type UsersResponse = {
  users: DirectoryUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type UserResponse = {
  user: DirectoryUser;
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
