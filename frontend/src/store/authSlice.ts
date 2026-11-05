import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { hasSessionFlag } from "../utils/sessionFlag";
import type { User } from "../types/auth.types";

export type AuthStatus =
  | "idle"
  | "loading"
  | "authenticated"
  | "unauthenticated";

export type AuthState = {
  user: User | null;
  status: AuthStatus;
};

const initialState: AuthState = {
  user: null,
  status: hasSessionFlag() ? "loading" : "unauthenticated",
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload;
      state.status = "authenticated";
    },
    clearUser(state) {
      state.user = null;
      state.status = "unauthenticated";
    },
    setAuthLoading(state) {
      state.user = null;
      state.status = "loading";
    },
  },
});

export const { clearUser, setAuthLoading, setUser } = authSlice.actions;
export default authSlice.reducer;
