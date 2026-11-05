import { configureStore } from "@reduxjs/toolkit";
import { registerOnAuthFailure } from "../apis/axiosInstance";
import { clearUser } from "./authSlice";
import authReducer from "./authSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

registerOnAuthFailure(() => {
  store.dispatch(clearUser());
  window.location.replace("/signin");
});
