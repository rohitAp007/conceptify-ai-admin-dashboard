"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { MOCK_MODE } from "@/lib/firebase";

export default function Login() {
  const { login, forbidden } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await login(email, pw);
      router.replace("/batches");
    } catch {
      setErr("Could not sign in. Check your email and password.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto mt-20 max-w-md rounded-2xl border bg-white p-7 shadow-sm">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand">
        Conceptify AI v2.0
      </div>
      <h1 className="mb-1 text-2xl font-bold text-gray-900">
        Coaching &amp; Teacher Portal
      </h1>
      <p className="mb-5 text-sm text-gray-500">
        {MOCK_MODE
          ? "Local workspace active. Sign in with your email to manage batches and heatmaps."
          : "Sign in with your Conceptify teacher account."}
      </p>
      {forbidden && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">
          This account does not have teacher access.
        </p>
      )}
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Email address
          </label>
          <input
            className="w-full rounded-lg border p-2.5 text-sm focus:border-brand focus:outline-none"
            type="email"
            placeholder="faculty@academy.in"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required={!MOCK_MODE}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Password
          </label>
          <input
            className="w-full rounded-lg border p-2.5 text-sm focus:border-brand focus:outline-none"
            type="password"
            placeholder="••••••••"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            required={!MOCK_MODE}
          />
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button
          disabled={busy}
          className="w-full rounded-lg bg-brand p-2.5 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in to Portal"}
        </button>
      </form>
    </main>
  );
}
