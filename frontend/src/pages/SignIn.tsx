import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { signIn } from "../apis/auth.api";
import { getErrorMessage } from "../apis/axiosInstance";
import { useAppDispatch } from "../store/hooks";
import { setUser } from "../store/authSlice";
import { setSessionFlag } from "../utils/sessionFlag";
import {
  signInSchema,
  type SignInFormValues,
} from "../schemas/auth.schema";

const inputClassName =
  "mt-2 block w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10";

export default function SignIn() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [serverError, setServerError] = useState("");
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
      const { user } = await signIn(values);
      setSessionFlag();
      dispatch(setUser(user));
      navigate("/dashboard/chat_room");
    } catch (error) {
      setServerError(getErrorMessage(error));
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f5f2] px-4 py-10 text-stone-900">
      <section className="w-full max-w-md rounded-3xl border border-stone-200/80 bg-white p-7 shadow-[0_24px_70px_-35px_rgba(41,37,36,0.28)] sm:p-10">
        <div className="mb-8">
          <div className="mb-7 flex size-11 items-center justify-center rounded-2xl bg-emerald-900 text-lg font-bold text-white">
            E
          </div>
          <p className="mb-2 text-sm font-semibold tracking-wide text-emerald-800">
            WELCOME BACK
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Sign in to Ember</h1>
          <p className="mt-2 text-sm leading-6 text-stone-500">
            Pick up where you left off.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div>
            <label className="text-sm font-medium text-stone-700" htmlFor="email">
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
            <label className="text-sm font-medium text-stone-700" htmlFor="password">
              Password
            </label>
            <input
              {...register("password")}
              autoComplete="current-password"
              className={inputClassName}
              id="password"
              type="password"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "password-error" : undefined}
              placeholder="Your password"
            />
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
            className="w-full rounded-xl bg-emerald-900 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-700/25 disabled:cursor-not-allowed disabled:bg-stone-300"
            type="submit"
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-7 text-center text-sm text-stone-500">
          Don&apos;t have an account?{" "}
          <Link className="font-semibold text-emerald-900 hover:underline" to="/signup">
            Sign up
          </Link>
        </p>
      </section>
    </main>
  );
}
