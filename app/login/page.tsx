"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { FIREBASE_READY } from "@/lib/firebase";

export default function Login() {
  const { uid, loading, login, signup, forbidden } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && uid) {
      router.replace("/batches");
    }
  }, [loading, uid, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      if (mode === "signup") {
        await signup(email, pw, name);
      } else {
        await login(email, pw);
      }
      router.replace("/batches");
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("not-a-teacher")) {
        setErr("This account is registered as a student. Create a Teacher account instead.");
      } else if (msg.includes("email-already-in-use")) {
        setErr("This email is already registered. Switch to Sign In.");
      } else if (msg.includes("weak-password")) {
        setErr("Password must be at least 6 characters.");
      } else if (msg.includes("invalid-credential") || msg.includes("user-not-found") || msg.includes("wrong-password")) {
        setErr("Invalid email or password. If you are new, click 'Create Teacher Account' above.");
      } else if (msg.includes("operation-not-allowed")) {
        setErr("Email/Password sign-in is disabled in Firebase Console → Authentication → Sign-in method.");
      } else if (msg.includes("Firebase is not configured")) {
        setErr("Firebase environment variables are missing in Vercel settings.");
      } else {
        setErr(`Sign-in error: ${msg}`);
      }
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto mt-20 max-w-md rounded-2xl border bg-white p-7 shadow-sm">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand">
        Conceptify AI v2.0 · Live Firebase
      </div>
      <h1 className="mb-1 text-2xl font-bold text-gray-900">
        Coaching &amp; Teacher Portal
      </h1>
      <p className="mb-4 text-sm text-gray-500">
        Connected to Conceptify Cloud Firestore. Batches created here are
        instantly joinable in the student app.
      </p>

      <div className="mb-4 grid grid-cols-2 rounded-lg border bg-gray-50 p-1 text-xs font-medium">
        <button
          type="button"
          onClick={() => {
            setMode("login");
            setErr("");
          }}
          className={`rounded-md py-1.5 ${
            mode === "login" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("signup");
            setErr("");
          }}
          className={`rounded-md py-1.5 ${
            mode === "signup" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
          }`}
        >
          Create Teacher Account
        </button>
      </div>

      {!FIREBASE_READY && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
          Firebase environment variables are not set. Add{" "}
          <code>NEXT_PUBLIC_FIREBASE_*</code> in Vercel / Hostinger settings
          and redeploy.
        </p>
      )}

      {forbidden && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">
          This account is registered as a student. Create a new teacher account
          to access the coaching dashboard.
        </p>
      )}

      <form onSubmit={submit} className="space-y-3">
        {mode === "signup" && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Teacher / Academy Name
            </label>
            <input
              className="w-full rounded-lg border p-2.5 text-sm focus:border-brand focus:outline-none"
              type="text"
              placeholder="Prof. Deshmukh / Sankalp Academy"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
        )}
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
            required
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
            required
          />
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button
          disabled={busy}
          className="w-full rounded-lg bg-brand p-2.5 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-50"
        >
          {busy
            ? "Please wait…"
            : mode === "signup"
            ? "Create Teacher Account"
            : "Sign in to Portal"}
        </button>
      </form>
    </main>
  );
}
