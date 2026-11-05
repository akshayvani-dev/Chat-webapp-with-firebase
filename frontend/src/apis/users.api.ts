import axiosInstance from "./axiosInstance";
import type { DirectoryUser } from "../types/chat.types";

type UsersResponse = {
  users: DirectoryUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
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
