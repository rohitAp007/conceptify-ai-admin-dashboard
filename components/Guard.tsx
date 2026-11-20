"use client";
import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { getInstituteName, getTeacherTier, setTeacherTier } from "@/lib/data";
import { MOCK_MODE } from "@/lib/firebase";
import { SubscriptionTier, TIER_LIMITS } from "@/lib/heatmap";

export type GuardMeta = {
  tier: SubscriptionTier;
  instituteName: string;
  switchTier: (t: SubscriptionTier) => void;
};

export default function Guard({
  children,
}: {
  children: (uid: string, meta: GuardMeta) => ReactNode;
}) {
  const { uid, loading, email, logout } = useAuth();
  const router = useRouter();
  const [tier, setTierState] = useState<SubscriptionTier>("free_starter");
  const [instituteName, setInstitute] = useState("Sankalp IAS & MPSC Academy");

  useEffect(() => {
    setTierState(getTeacherTier());
    setInstitute(getInstituteName());
  }, []);

  useEffect(() => {
    if (!loading && !uid) router.replace("/login");
  }, [loading, uid, router]);

  if (loading || !uid) return <p className="p-8 text-gray-500">Loading…</p>;

  const switchTier = (next: SubscriptionTier) => {
    setTeacherTier(next);
    setTierState(next);
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-4 print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/batches" className="text-xl font-bold text-brand">
            Conceptify Coaching Intelligence
          </Link>
          <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-brand">
            {instituteName}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
          <div className="flex items-center rounded-lg border bg-white p-0.5">
            {(["free_starter", "academy_pro"] as SubscriptionTier[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => switchTier(t)}
                className={`rounded-md px-2 py-1 font-medium transition ${
                  tier === t
                    ? "bg-brand text-white"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {TIER_LIMITS[t].label}
              </button>
            ))}
          </div>
          {MOCK_MODE ? (
            <span className="rounded bg-slate-100 px-2 py-1 font-medium text-slate-700">
              Local Workspace
            </span>
          ) : (
            <span className="rounded bg-emerald-50 px-2 py-1 font-medium text-emerald-700">
              Live Firebase
            </span>
          )}
          <span className="hidden sm:inline">{email}</span>
          <button type="button" onClick={logout} className="underline">
            Sign out
          </button>
        </div>
      </header>
      {children(uid, { tier, instituteName, switchTier })}
    </div>
  );
}
