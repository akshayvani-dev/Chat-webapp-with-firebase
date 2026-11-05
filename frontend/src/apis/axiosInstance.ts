import axios from "axios";
import { clearSessionFlag } from "../utils/sessionFlag";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

type RetriableRequestConfig = NonNullable<
  Parameters<typeof axiosInstance.request>[0]
> & {
  _retry?: boolean;
};

let refreshPromise: Promise<void> | null = null;
let onAuthFailure: (() => void) | null = null;

export function registerOnAuthFailure(callback: () => void): void {
  onAuthFailure = callback;
}

function isExcludedAuthRequest(url: string | undefined): boolean {
  return /(?:^|\/)auth\/(?:signin|signup|refresh|me)\/?(?:[?#]|$)/.test(
    url ?? "",
  );
}

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (
      !axios.isAxiosError(error) ||
      error.response?.status !== 401 ||
      !error.config
    ) {
      throw error;
    }

    const originalRequest = error.config as RetriableRequestConfig;
    if (originalRequest._retry || isExcludedAuthRequest(originalRequest.url)) {
      throw error;
    }

    originalRequest._retry = true;
    if (!refreshPromise) {
      refreshPromise = axiosInstance
        .post<void>("/auth/refresh")
        .then(() => undefined)
        .catch((refreshError: unknown) => {
          clearSessionFlag();
          onAuthFailure?.();
          throw refreshError;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }

    await refreshPromise;
    return axiosInstance.request(originalRequest);
  },
);

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: unknown }>(error)) {
    const message = error.response?.data?.message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return "Something went wrong";
}

export default axiosInstance;
