import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { hasSessionFlag } from "../utils/sessionFlag";
import type { User } from "../types/auth.types";
import type { FirebaseClientUser } from "../config/firebase";

export type AuthStatus =
  | "idle"
  | "loading"
  | "authenticated"
  | "unauthenticated";

export type AuthState = {
  user: User | null;
  firebaseUser: FirebaseClientUser | null;
  status: AuthStatus;
};

const initialState: AuthState = {
  user: null,
  firebaseUser: null,
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
    setFirebaseUser(state, action: PayloadAction<FirebaseClientUser>) {
      state.firebaseUser = action.payload;
    },
    clearFirebaseUser(state) {
      state.firebaseUser = null;
    },
    clearUser(state) {
      state.user = null;
      state.firebaseUser = null;
      state.status = "unauthenticated";
    },
    setAuthLoading(state) {
      state.user = null;
      state.status = "loading";
    },
  },
});

export const {
  clearUser,
  clearFirebaseUser,
  setAuthLoading,
  setFirebaseUser,
  setUser,
} = authSlice.actions;
export default authSlice.reducer;
