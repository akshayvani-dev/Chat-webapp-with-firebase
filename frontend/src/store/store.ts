import { configureStore } from "@reduxjs/toolkit";
import { registerOnAuthFailure } from "../apis/axiosInstance";
import { clearUser } from "./authSlice";
import authReducer from "./authSlice";
import { signOutFromFirebase } from "../config/firebase";

export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

registerOnAuthFailure(() => {
  store.dispatch(clearUser());
  void signOutFromFirebase().catch((error: unknown) => {
    console.error("Unable to clear the Firebase session after auth failure", error);
  });
  window.location.replace("/signin");
});
