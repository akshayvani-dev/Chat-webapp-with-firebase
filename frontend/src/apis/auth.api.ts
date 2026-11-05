import axiosInstance from "./axiosInstance";
import type {
  AuthResponse,
  SignInPayload,
  SignUpPayload,
} from "../types/auth.types";

export async function signUp(payload: SignUpPayload): Promise<AuthResponse> {
  const response = await axiosInstance.post<AuthResponse>("/auth/signup", payload);
  return response.data;
}

export async function signIn(payload: SignInPayload): Promise<AuthResponse> {
  const response = await axiosInstance.post<AuthResponse>("/auth/signin", payload);
  return response.data;
}

export async function getMe(): Promise<AuthResponse> {
  const response = await axiosInstance.get<AuthResponse>("/auth/me");
  return response.data;
}

export async function logout(): Promise<void> {
  await axiosInstance.post<void>("/auth/logout");
}
