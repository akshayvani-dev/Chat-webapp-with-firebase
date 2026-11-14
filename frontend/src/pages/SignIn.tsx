import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { logout, signIn } from "../apis/auth.api";
import { getErrorMessage } from "../apis/axiosInstance";
import {
  signInWithFirebaseCustomToken,
  type FirebaseClientUser,
} from "../config/firebase";
import { useAppDispatch } from "../store/hooks";
import { clearUser, setFirebaseUser, setUser } from "../store/authSlice";
import { clearSessionFlag, setSessionFlag } from "../utils/sessionFlag";
import {
  signInSchema,
  type SignInFormValues,
} from "../schemas/auth.schema";

const inputClassName =
  "mt-2 block w-full rounded-xl border border-frosted-blue bg-white px-4 py-3 text-sm text-deep-twilight outline-none transition placeholder:text-bright-teal-blue focus:border-bright-teal-blue focus:ring-4 focus:ring-bright-teal-blue/10";

export default function SignIn() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [serverError, setServerError] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    mode: "onChange",
  });

  const onSubmit = async (values: SignInFormValues) => {
    setServerError("");
    try {
      const { user, firebaseCustomToken } = await signIn(values);
      let firebaseUser: FirebaseClientUser;
      try {
        firebaseUser = await signInWithFirebaseCustomToken(firebaseCustomToken);
      } catch (error) {
        console.error("Firebase sign-in failed after backend sign-in", error);
        try {
          await logout();
        } catch (logoutError) {
          console.error(
            "Unable to clear the backend session after Firebase sign-in failed",
            logoutError,
          );
        }
        clearSessionFlag();
        dispatch(clearUser());
        throw new Error(
          "Backend sign-in succeeded, but Firebase sign-in failed. Please try again.",
          { cause: error },
        );
      }
      setSessionFlag();
      dispatch(setUser(user));
      dispatch(setFirebaseUser(firebaseUser));
      navigate("/dashboard/chat_room");
    } catch (error) {
      const message = getErrorMessage(error);
      setServerError(
        message === "Something went wrong" && error instanceof Error
          ? error.message
          : message,
      );
    }
  };

  return (
    <main className="auth-grainy-background flex min-h-screen items-center justify-center px-4 py-10 text-deep-twilight">
      <section className="w-full max-w-md rounded-3xl border border-frosted-blue/80 bg-white p-7 shadow-[0_24px_70px_-35px_rgba(3,4,94,0.38)] sm:p-10">
        <div className="mb-8">
          <p className="mb-2 text-sm font-semibold tracking-wide text-bright-teal-blue">
            WELCOME BACK
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Sign in to Chat App</h1>
          <p className="mt-2 text-sm leading-6 text-bright-teal-blue">
            Pick up where you left off.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div>
            <label className="text-sm font-medium text-deep-twilight" htmlFor="email">
              Email address
            </label>
            <input
              {...register("email")}
              autoComplete="email"
              className={inputClassName}
              id="email"
              type="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-error" : undefined}
              placeholder="you@example.com"
            />
            {errors.email && (
              <p className="mt-1.5 text-sm text-red-700" id="email-error" role="alert">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-deep-twilight" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <input
                {...register("password")}
                autoComplete="current-password"
                className={`${inputClassName} pr-12`}
                id="password"
                type={isPasswordVisible ? "text" : "password"}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "password-error" : undefined}
                placeholder="Your password"
              />
              <button
                className="absolute inset-y-0 right-2 flex w-10 items-center justify-center rounded-lg text-bright-teal-blue hover:text-deep-twilight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bright-teal-blue/40"
                type="button"
                aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                aria-pressed={isPasswordVisible}
                onClick={() => setIsPasswordVisible((visible) => !visible)}
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {isPasswordVisible ? (
                    <>
                      <path d="M3 3l18 18" />
                      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                      <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 8.5 4 9.5 7-.4 1.2-1.2 2.3-2.2 3.3" />
                      <path d="M6.2 6.2C4.3 7.4 3 9.1 2.5 12c.5 2 3.7 7 9.5 7 1.2 0 2.3-.2 3.3-.6" />
                    </>
                  ) : (
                    <>
                      <path d="M2.5 12s3.2-7 9.5-7 9.5 7 9.5 7-3.2 7-9.5 7-9.5-7-9.5-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  )}
                </svg>
              </button>
            </div>
            {errors.password && (
              <p className="mt-1.5 text-sm text-red-700" id="password-error" role="alert">
                {errors.password.message}
              </p>
            )}
          </div>

          {serverError && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
              {serverError}
            </p>
          )}

          <button
            className="w-full rounded-xl bg-deep-twilight px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-bright-teal-blue focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-bright-teal-blue/25 disabled:cursor-not-allowed disabled:bg-frosted-blue"
            type="submit"
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-7 text-center text-sm text-bright-teal-blue">
          Don&apos;t have an account?{" "}
          <Link className="font-semibold text-deep-twilight hover:underline" to="/signup">
            Sign up
          </Link>
        </p>
      </section>
    </main>
  );
}
