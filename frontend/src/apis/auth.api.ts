import axiosInstance from "./axiosInstance";
import type {
  AuthResponse,
  FirebaseAuthResponse,
  SignInPayload,
  SignUpPayload,
} from "../types/auth.types";

export async function signUp(
  payload: SignUpPayload,
): Promise<FirebaseAuthResponse> {
  const response = await axiosInstance.post<FirebaseAuthResponse>(
    "/auth/signup",
    payload,
  );
  return response.data;
}

export async function signIn(
  payload: SignInPayload,
): Promise<FirebaseAuthResponse> {
  const response = await axiosInstance.post<FirebaseAuthResponse>(
    "/auth/signin",
    payload,
  );
  return response.data;
}

export async function getMe(): Promise<AuthResponse> {
  const response = await axiosInstance.get<AuthResponse>("/auth/me");
  return response.data;
}

export async function logout(): Promise<void> {
  await axiosInstance.post<void>("/auth/logout");
}
