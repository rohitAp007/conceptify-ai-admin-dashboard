"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Guard, { GuardMeta } from "@/components/Guard";
import { Batch, createStarterBatch, getStats, listBatches } from "@/lib/data";
import { bottlenecks, ConceptStat, TIER_LIMITS } from "@/lib/heatmap";

const LANG_NAMES: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  mr: "Marathi",
};

function List({ uid, meta }: { uid: string; meta: GuardMeta }) {
  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [statsMap, setStatsMap] = useState<Record<string, ConceptStat[]>>({});
  const [search, setSearch] = useState("");
  const [trackFilter, setTrackFilter] = useState<"all" | "competitive" | "academic">("all");
  const [examFilter, setExamFilter] = useState("ALL");
  const [err, setErr] = useState("");

  useEffect(() => {
    listBatches(uid)
      .then(async (list) => {
        setBatches(list);
        const entries = await Promise.all(
          list.map(async (b) => [b.id, await getStats(b)] as const)
        );
        setStatsMap(Object.fromEntries(entries));
      })
      .catch(() => setErr("Could not load batches."));
  }, [uid]);

  const limits = TIER_LIMITS[meta.tier];
  const totalStudents =
    batches?.reduce((acc, b) => acc + b.memberCount, 0) ?? 0;
  const totalConcepts =
    batches?.reduce((acc, b) => acc + b.concepts.length, 0) ?? 0;
  const totalBottlenecks =
    batches?.reduce(
      (acc, b) => acc + bottlenecks(statsMap[b.id] ?? []).length,
      0
    ) ?? 0;
  const atBatchCap =
    batches !== null &&
    limits.maxBatches !== Infinity &&
    batches.length >= limits.maxBatches;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Coaching Batch Dashboard</h1>
          <p className="text-sm text-gray-500">
            Track concept mastery gaps across cohorts before mock tests.
          </p>
        </div>
        <Link
          href="/batches/new"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-95"
        >
          + New Batch
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs text-gray-500">Active Batches</div>
          <div className="mt-1 text-2xl font-bold">
            {batches?.length ?? 0}
            <span className="text-sm font-normal text-gray-400">
              {" "}
              / {limits.maxBatches === Infinity ? "∞" : limits.maxBatches}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-gray-500">{limits.label}</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs text-gray-500">Students Assessed</div>
          <div className="mt-1 text-2xl font-bold">{totalStudents}</div>
          <div className="mt-1 text-[11px] text-gray-500">
            Cap:{" "}
            {limits.maxStudentsPerBatch === Infinity
              ? "Unlimited"
              : `${limits.maxStudentsPerBatch}/batch`}
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs text-gray-500">Sub-Concepts Monitored</div>
          <div className="mt-1 text-2xl font-bold">{totalConcepts}</div>
          <div className="mt-1 text-[11px] text-gray-500">
            DAG prerequisite-mapped
          </div>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
          <div className="text-xs font-medium text-red-700">
            &gt;50% Bottleneck Alerts
          </div>
          <div className="mt-1 text-2xl font-bold text-red-700">
            {totalBottlenecks}
          </div>
          <div className="mt-1 text-[11px] text-red-600">
            Needs immediate revision
          </div>
        </div>
      </div>

      {atBatchCap && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <span>
            <b>Free Starter limit reached:</b> You have {batches?.length} active
            batches (max {limits.maxBatches}). Upgrade to Academy Pro for
            unlimited batches, curriculum-locked AI, and parent PDF reports.
          </span>
          <button
            type="button"
            onClick={() => meta.switchTier("academy_pro")}
            className="rounded-lg bg-amber-700 px-3 py-1 text-xs font-medium text-white"
          >
            Switch to Academy Pro
          </button>
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        {(
          [
            ["all", "All Tracks"],
            ["competitive", "Competitive Exams"],
            ["academic", "School & College"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setTrackFilter(k);
              setExamFilter("ALL");
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              trackFilter === k
                ? "bg-gray-900 text-white"
                : "border bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search batches by title or concept…"
          className="flex-1 rounded-lg border bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
        <div className="flex flex-wrap gap-1.5">
          {["ALL", "UPSC", "MPSC", "GATE", "NEET", "School (Class 8-12)", "Engineering / B.Tech"].map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setExamFilter(ex)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                examFilter === ex
                  ? "bg-brand text-white"
                  : "border bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {err && <p className="text-red-600">{err}</p>}
      {batches === null && !err && <p className="text-gray-500">Loading…</p>}
      {batches?.length === 0 && (
        <div className="rounded-xl border bg-white p-6 text-center">
          <p className="text-sm text-gray-600">
            No batches in Firestore yet. Create a batch from your lecture notes
            or launch a starter UPSC batch to test with the student app.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Link
              href="/batches/new"
              className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white"
            >
              + Create Custom Batch
            </Link>
            <button
              type="button"
              onClick={async () => {
                await createStarterBatch(uid);
                const list = await listBatches(uid);
                setBatches(list);
              }}
              className="rounded-lg border px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              Create Starter UPSC Batch
            </button>
          </div>
        </div>
      )}

      <ul className="space-y-3">
        {batches
          ?.filter(
            (b) =>
              trackFilter === "all" ||
              (b.trackType ?? "competitive") === trackFilter
          )
          .filter((b) => examFilter === "ALL" || b.exam === examFilter)
          .filter(
            (b) =>
              !search.trim() ||
              b.title.toLowerCase().includes(search.trim().toLowerCase()) ||
              b.concepts.some((c) =>
                c.name.toLowerCase().includes(search.trim().toLowerCase())
              )
          )
          .map((b) => {
          const alerts = bottlenecks(statsMap[b.id] ?? []);
          const cap = limits.maxStudentsPerBatch;
          const pct =
            cap === Infinity ? 100 : Math.min(100, (b.memberCount / cap) * 100);
          return (
            <li key={b.id}>
              <Link
                href={`/batches/${b.id}`}
                className="block rounded-xl border bg-white p-4 transition hover:border-brand hover:shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-gray-900">
                        {b.title}
                      </span>
                      <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-brand">
                        {b.exam}
                      </span>
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                        {LANG_NAMES[b.language] ?? b.language}
                      </span>
                      {b.curriculumLocked && (
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                          Curriculum-Locked AI
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <span>{b.concepts.length} sub-concepts</span>
                      {b.docHash && (
                        <span className="font-mono">
                          SHA-256: {b.docHash.slice(0, 12)}…
                        </span>
                      )}
                      {b.instituteName && <span>{b.instituteName}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {alerts.length > 0 && (
                      <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                        {alerts.length} bottleneck{alerts.length > 1 ? "s" : ""}
                      </span>
                    )}
                    <span className="text-xs font-medium text-brand">
                      View Heatmap →
                    </span>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs text-gray-500">
                    <span>
                      {b.memberCount} students joined
                      {cap !== Infinity ? ` / ${cap} Free Starter cap` : ""}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export default function Page() {
  return <Guard>{(uid, meta) => <List uid={uid} meta={meta} />}</Guard>;
}
