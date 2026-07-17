"use client";

import { FormEvent, useState } from "react";
import { login } from "@/lib/api";

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username.trim(), password);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-white/8 bg-[#141414] p-8"
      >
        <p className="mb-1 text-[12px] font-medium tracking-[0.2em] text-white/40 uppercase">
          Choppr
        </p>
        <h1 className="mb-1 text-2xl font-semibold tracking-[-0.04em] text-white">
          Metrics
        </h1>
        <p className="mb-8 text-sm text-white/45">
          Sign in with your metrics credentials.
        </p>

        <label className="mb-4 block">
          <span className="mb-1.5 block text-[12px] text-white/40">Username</span>
          <input
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full rounded-[14px] border border-white/8 bg-[#1e1e1e] px-3 py-2.5 text-white outline-none placeholder:text-white/25 focus:border-white/20"
          />
        </label>

        <label className="mb-6 block">
          <span className="mb-1.5 block text-[12px] text-white/40">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-[14px] border border-white/8 bg-[#1e1e1e] px-3 py-2.5 text-white outline-none placeholder:text-white/25 focus:border-white/20"
          />
        </label>

        {error && (
          <p className="mb-4 rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-sm text-white/70">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-white py-2.5 font-semibold text-black transition hover:bg-white/90 disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
