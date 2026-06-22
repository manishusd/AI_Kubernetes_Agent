"use client";

import { FormEvent, useEffect, useState } from "react";

import Dashboard from "./Dashboard";
import { getInsforgeClient, missingInsforgeEnv } from "../../services/insforge";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export default function AuthGate() {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

    const client = getInsforgeClient();
    if (!client) {
      setErrorMessage("InsForge auth is not configured.");
      return;
    }

    setIsSubmitting(true);
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message || "Login failed.");
      return;
    }

    const loggedInUser = (data as { user?: { email?: string } } | null)?.user;
    setUserEmail(loggedInUser?.email ?? email);
    setPassword("");
    setStatus("authenticated");
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
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-white px-4">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg"
        >
          {/* <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">InsForge Authentication</p> */}
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Sign in to continue</h1>
          <p className="mt-2 text-sm text-slate-600">Only authenticated users can run investigations and view diagnosis history.</p>

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

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>

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
            {isSubmitting ? "Signing in..." : "Login"}
          </button>
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
