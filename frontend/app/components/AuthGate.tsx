"use client";

import { FormEvent, useEffect, useState } from "react";

import Dashboard from "./Dashboard";
import { getInsforgeClient, missingInsforgeEnv } from "../../services/insforge";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";
type AuthView = "sign-in" | "sign-up" | "forgot-password" | "verify-email" | "reset-password";

export default function AuthGate() {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [view, setView] = useState<AuthView>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const initSession = async () => {
      const client = getInsforgeClient();
      if (!client) {
        setErrorMessage("InsForge auth is not configured. Set NEXT_PUBLIC_INSFORGE_URL and NEXT_PUBLIC_INSFORGE_ANON_KEY.");
        setStatus("unauthenticated");
        return;
      }

      const { data, error } = await client.auth.getCurrentUser();
      if (error) {
        setStatus("unauthenticated");
        return;
      }

      const currentUser = (data as { user?: { email?: string } } | null)?.user;
      if (!currentUser) {
        setStatus("unauthenticated");
        return;
      }

      setUserEmail(currentUser.email ?? "");
      setStatus("authenticated");
    };

    initSession();
  }, []);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    const client = getInsforgeClient();
    if (!client) {
      setErrorMessage("InsForge auth is not configured.");
      return;
    }

    setIsSubmitting(true);
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    setIsSubmitting(false);

    if (error) {
      if (/verification required|email not verified|verify/i.test(error.message || "")) {
        setInfoMessage("Email verification is required. Enter the OTP sent to your inbox.");
        setView("verify-email");
      }
      setErrorMessage(error.message || "Login failed.");
      return;
    }

    const loggedInUser = (data as { user?: { email?: string } } | null)?.user;
    setUserEmail(loggedInUser?.email ?? email);
    setPassword("");
    setStatus("authenticated");
  };

  const handleSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    const client = getInsforgeClient();
    if (!client) {
      setErrorMessage("InsForge auth is not configured.");
      return;
    }

    setIsSubmitting(true);
    const { error } = await client.auth.signUp({
      email,
      password,
      redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
    });
    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message || "Sign up failed.");
      return;
    }

    setInfoMessage("Account created. If verification is enabled, check your email before signing in.");
    setPassword("");
    setView("verify-email");
  };

  const handleVerifyEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    const client = getInsforgeClient();
    if (!client) {
      setErrorMessage("InsForge auth is not configured.");
      return;
    }

    setIsSubmitting(true);
    const { error } = await client.auth.verifyEmail({
      email,
      otp: verificationCode,
    });
    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message || "Email verification failed.");
      return;
    }

    setVerificationCode("");
    setPassword("");
    setInfoMessage("Email verified successfully. Please sign in with your email and password.");
    setView("sign-in");
  };

  const handleResendVerificationCode = async () => {
    setErrorMessage(null);
    setInfoMessage(null);

    const client = getInsforgeClient();
    if (!client) {
      setErrorMessage("InsForge auth is not configured.");
      return;
    }

    setIsSubmitting(true);
    const { error } = await client.auth.resendVerificationEmail({
      email,
      redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
    });
    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message || "Could not resend verification code.");
      return;
    }

    setInfoMessage("A fresh verification code has been sent to your inbox.");
  };

  const handleForgotPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    const client = getInsforgeClient();
    if (!client) {
      setErrorMessage("InsForge auth is not configured.");
      return;
    }

    setIsSubmitting(true);
    const { error } = await client.auth.sendResetPasswordEmail({
      email,
      redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
    });
    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message || "Could not send reset email.");
      return;
    }

    setInfoMessage("Reset code sent. Enter the OTP and your new password below.");
    setView("reset-password");
  };

  const handleResetPasswordWithCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    const client = getInsforgeClient();
    if (!client) {
      setErrorMessage("InsForge auth is not configured.");
      return;
    }

    setIsSubmitting(true);

    const { data: exchangeData, error: exchangeError } = await client.auth.exchangeResetPasswordToken({
      email,
      code: resetCode,
    });

    if (exchangeError) {
      setIsSubmitting(false);
      setErrorMessage(exchangeError.message || "Invalid or expired reset code.");
      return;
    }

    const resetToken = (exchangeData as { token?: string } | null)?.token;
    if (!resetToken) {
      setIsSubmitting(false);
      setErrorMessage("Could not exchange reset code. Please request a new code and try again.");
      return;
    }

    const { error } = await client.auth.resetPassword({
      otp: resetToken,
      newPassword: password,
    });
    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message || "Password reset failed.");
      return;
    }

    setInfoMessage("Password updated successfully. You can now sign in with your new password.");
    setResetCode("");
    setPassword("");
    setView("sign-in");
  };

  const switchView = (nextView: AuthView) => {
    setView(nextView);
    setErrorMessage(null);
    setInfoMessage(null);
    setPassword("");
    if (nextView !== "verify-email") {
      setVerificationCode("");
    }
    if (nextView !== "reset-password") {
      setResetCode("");
    }
  };

  const handleSignOut = async () => {
    const client = getInsforgeClient();
    if (!client) {
      setStatus("unauthenticated");
      return;
    }

    await client.auth.signOut();
    setStatus("unauthenticated");
    setUserEmail("");
  };

  if (status === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-600 shadow-sm">
          Checking session...
        </div>
      </main>
    );
  }

  if (status !== "authenticated") {
    const title =
      view === "sign-up"
        ? "Create your account"
        : view === "verify-email"
          ? "Verify your email"
        : view === "reset-password"
          ? "Set a new password"
        : view === "forgot-password"
          ? "Reset your password"
          : "Sign in to continue";

    const subtitle =
      view === "sign-up"
        ? "Create a small account to run investigations and view diagnosis history."
        : view === "verify-email"
          ? "Enter the OTP sent to your email to finish account verification."
        : view === "reset-password"
          ? "Enter the reset OTP from email and choose a new password."
        : view === "forgot-password"
          ? "Enter your email and we will send a password reset OTP."
          : "Only authenticated users can run investigations and view diagnosis history.";

    const submitLabel =
      view === "sign-up"
        ? isSubmitting
          ? "Creating account..."
          : "Sign up"
        : view === "verify-email"
          ? isSubmitting
            ? "Verifying..."
            : "Verify email"
        : view === "reset-password"
          ? isSubmitting
            ? "Resetting password..."
            : "Set new password"
        : view === "forgot-password"
          ? isSubmitting
            ? "Sending reset code..."
            : "Send reset code"
          : isSubmitting
            ? "Signing in..."
            : "Login";

    const passwordLabel = view === "reset-password" ? "New password" : "Password";

    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-white px-4">
        <form
          onSubmit={
            view === "sign-up"
              ? handleSignUp
              : view === "verify-email"
                ? handleVerifyEmail
              : view === "reset-password"
                ? handleResetPasswordWithCode
              : view === "forgot-password"
                ? handleForgotPassword
                : handleLogin
          }
          className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg"
        >
          {/* <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">InsForge Authentication</p> */}
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{title}</h1>
          <p className="mt-2 text-sm text-slate-600">{subtitle}</p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            {(view === "sign-in" || view === "sign-up" || view === "reset-password") && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2" htmlFor="password">
                  {passwordLabel}
                </label>
                <input
                  id="password"
                  type="password"
                  required={view === "sign-in" || view === "sign-up" || view === "reset-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
            )}

            {view === "verify-email" && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2" htmlFor="verification-code">
                  Verification code (OTP)
                </label>
                <input
                  id="verification-code"
                  type="text"
                  inputMode="numeric"
                  required
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
            )}

            {view === "reset-password" && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2" htmlFor="reset-code">
                  Reset code (OTP)
                </label>
                <input
                  id="reset-code"
                  type="text"
                  inputMode="numeric"
                  required
                  value={resetCode}
                  onChange={(event) => setResetCode(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
            )}
          </div>

          {infoMessage && (
            <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {infoMessage}
            </p>
          )}

          {(errorMessage || missingInsforgeEnv) && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage || "Missing NEXT_PUBLIC_INSFORGE_URL or NEXT_PUBLIC_INSFORGE_ANON_KEY."}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || missingInsforgeEnv}
            className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitLabel}
          </button>

          <div className="mt-4 flex items-center justify-between text-sm">
            {view === "sign-in" ? (
              <>
                <button
                  type="button"
                  onClick={() => switchView("sign-up")}
                  className="font-medium text-blue-700 hover:text-blue-800"
                >
                  Create account
                </button>
                <button
                  type="button"
                  onClick={() => switchView("forgot-password")}
                  className="font-medium text-slate-600 hover:text-slate-800"
                >
                  Forgot password?
                </button>
              </>
            ) : view === "verify-email" ? (
              <>
                <button
                  type="button"
                  onClick={handleResendVerificationCode}
                  disabled={isSubmitting || missingInsforgeEnv || !email}
                  className="font-medium text-slate-600 hover:text-slate-800 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  Resend OTP
                </button>
                <button
                  type="button"
                  onClick={() => switchView("sign-in")}
                  className="font-medium text-blue-700 hover:text-blue-800"
                >
                  Back to sign in
                </button>
              </>
            ) : view === "reset-password" ? (
              <>
                <button
                  type="button"
                  onClick={() => switchView("forgot-password")}
                  className="font-medium text-slate-600 hover:text-slate-800"
                >
                  Send new code
                </button>
                <button
                  type="button"
                  onClick={() => switchView("sign-in")}
                  className="font-medium text-blue-700 hover:text-blue-800"
                >
                  Back to sign in
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => switchView("sign-in")}
                className="font-medium text-blue-700 hover:text-blue-800"
              >
                Back to sign in
              </button>
            )}
          </div>
        </form>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-8 pt-4">
        <p className="text-sm text-slate-600">Signed in as {userEmail || "user"}</p>
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Logout
        </button>
      </div>
      <Dashboard />
    </div>
  );
}
