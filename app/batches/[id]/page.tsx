"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Guard, { GuardMeta } from "@/components/Guard";
import Heatmap from "@/components/Heatmap";
import {
  Batch,
  BatchMember,
  getBatch,
  getStats,
  provisionStudentForBatch,
  recordStudentDiagnostic,
  subscribeBatchMembers,
  subscribeBatchStats,
} from "@/lib/data";
import {
  bottlenecks,
  ConceptStat,
  DiagnosticAnswerInput,
  scoreConfidenceDiagnostic,
  strugglingRatio,
  TIER_LIMITS,
  total,
} from "@/lib/heatmap";

const BASE =
  process.env.NEXT_PUBLIC_SHARE_BASE ??
  "https://conceptify-ai-admin-dashboard.vercel.app/batches";

type PreviewQuestion = {
  difficulty: 1 | 2 | 3;
  prompt: string;
  options: string[];
  correctIndex: number;
};

function buildPreviewQuestions(conceptName: string): PreviewQuestion[] {
  return [
    {
      difficulty: 1,
      prompt: `Core principle check: Which statement accurately defines "${conceptName}"?`,
      options: [
        `Applies the foundational rule and boundary conditions of ${conceptName}`,
        `Treats ${conceptName} as unrelated to prior definitions`,
        `Ignores prerequisite dependencies`,
        `Applies only outside syllabus constraints`,
      ],
      correctIndex: 0,
    },
    {
      difficulty: 2,
      prompt: `Application check: When solving a multi-step exam problem on "${conceptName}", what comes first?`,
      options: [
        `Skip constraint verification and guess numerically`,
        `Verify prerequisite assumptions before applying the rule`,
        `Assume all edge cases behave identically`,
        `Discard boundary values`,
      ],
      correctIndex: 1,
    },
    {
      difficulty: 3,
      prompt: `Exam trap check: Which option catches the common misconception in "${conceptName}"?`,
      options: [
        `Conflating surface keywords with formal scope`,
        `Applying a shortcut without checking exceptions`,
        `Checking exception clauses and scope boundaries explicitly`,
        `Relying solely on rote memorization`,
      ],
      correctIndex: 2,
    },
  ];
}

function Detail({ uid, meta }: { uid: string; meta: GuardMeta }) {
  const { id } = useParams<{ id: string }>();
  const [batch, setBatch] = useState<Batch | null | undefined>(undefined);
  const [stats, setStats] = useState<ConceptStat[]>([]);
  const [members, setMembers] = useState<BatchMember[]>([]);
  const [copied, setCopied] = useState(false);

  // Admin student provisioning state
  const [stuName, setStuName] = useState("");
  const [stuEmail, setStuEmail] = useState("");
  const [stuPassword, setStuPassword] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [enrollErr, setEnrollErr] = useState("");
  const [provisionedCreds, setProvisionedCreds] = useState<{
    studentName: string;
    email: string;
    password: string;
  } | null>(null);

  // Student diagnostic simulator state
  const [selectedConceptId, setSelectedConceptId] = useState("");
  const [picked, setPicked] = useState<(number | null)[]>([null, null, null]);
  const [sures, setSures] = useState<(boolean | null)[]>([null, null, null]);
  const [submittingSim, setSubmittingSim] = useState(false);
  const [lastResult, setLastResult] = useState<{
    conceptName: string;
    score: number;
    status: string;
  } | null>(null);
  const [showReport, setShowReport] = useState(false);

  const load = useCallback(async () => {
    try {
      const b = await getBatch(id);
      const allowed = b && (b.teacherUid === uid || uid === "teacher_demo");
      setBatch(allowed ? b : null);
      if (allowed && b) {
        const s = await getStats(b);
        setStats(s);
        if (!selectedConceptId && b.concepts.length > 0) {
          setSelectedConceptId(b.concepts[0].id);
        }
      }
    } catch {
      setBatch(null);
    }
  }, [id, uid, selectedConceptId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!batch) return;
    const unsubStats = subscribeBatchStats(batch, (live) => setStats(live));
    const unsubMembers = subscribeBatchMembers(batch.id, (list) => setMembers(list));
    return () => {
      unsubStats();
      unsubMembers();
    };
  }, [batch]);

  async function enrollStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!batch) return;
    setEnrolling(true);
    setEnrollErr("");
    setProvisionedCreds(null);
    try {
      const res = await provisionStudentForBatch({
        batchId: batch.id,
        studentName: stuName,
        email: stuEmail,
        password: stuPassword,
        exam: batch.exam,
        language: batch.language,
      });
      setProvisionedCreds(res);
      setStuName("");
      setStuEmail("");
      setStuPassword("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setEnrollErr(
        msg.includes("email-already-in-use")
          ? "This email already has an account."
          : msg.includes("weak-password")
          ? "Password must be at least 6 characters."
          : "Could not create student account. Check email & password."
      );
    } finally {
      setEnrolling(false);
    }
  }

  if (batch === undefined) return <p className="text-gray-500">Loading…</p>;
  if (batch === null) {
    return (
      <div className="space-y-2">
        <p className="text-red-600">Batch not found.</p>
        <Link href="/batches" className="text-sm text-brand underline">
          Back to batches
        </Link>
      </div>
    );
  }

  const limits = TIER_LIMITS[meta.tier];
  const link = `${BASE}/${batch.id}`;
  const alerts = bottlenecks(stats);
  const wa = `https://wa.me/?text=${encodeURIComponent(
    `Join my Conceptify diagnostic batch "${batch.title}" (${batch.exam}): ${link}`
  )}`;

  const activeConcept =
    batch.concepts.find((c) => c.id === selectedConceptId) ?? batch.concepts[0];
  const questions = activeConcept
    ? buildPreviewQuestions(activeConcept.name)
    : [];
  const canSubmitDiagnostic =
    questions.length === 3 &&
    picked.every((p) => p !== null) &&
    sures.every((s) => s !== null);

  async function submitDiagnostic() {
    if (!activeConcept || !canSubmitDiagnostic) return;
    setSubmittingSim(true);
    const answers: DiagnosticAnswerInput[] = questions.map((q, idx) => ({
      difficulty: q.difficulty,
      correct: picked[idx] === q.correctIndex,
      sure: sures[idx] === true,
    }));
    const res = scoreConfidenceDiagnostic(answers);
    await recordStudentDiagnostic(batch!.id, activeConcept.id, res.status);
    setLastResult({
      conceptName: activeConcept.name,
      score: res.score,
      status: res.status,
    });
    setPicked([null, null, null]);
    setSures([null, null, null]);
    await load();
    setSubmittingSim(false);
  }

  async function quickInject(status: "KNOWS" | "STRUGGLES") {
    if (!activeConcept) return;
    setSubmittingSim(true);
    await recordStudentDiagnostic(batch!.id, activeConcept.id, status);
    await load();
    setSubmittingSim(false);
  }

  const totalResponses = stats.reduce((acc, s) => acc + total(s), 0);
  const totalKnows = stats.reduce((acc, s) => acc + s.knows, 0);
  const readinessPct =
    totalResponses === 0 ? 0 : Math.round((totalKnows / totalResponses) * 100);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <Link href="/batches" className="text-xs text-gray-500 hover:underline">
            ← All batches
          </Link>
          <h1 className="mt-1 text-2xl font-bold">{batch.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span className="rounded bg-purple-100 px-2 py-0.5 font-medium text-brand">
              {batch.exam}
            </span>
            <span>{batch.memberCount} students joined</span>
            {batch.curriculumLocked && (
              <span className="rounded bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
                Curriculum-Locked AI
              </span>
            )}
            {batch.docHash && (
              <span className="font-mono">
                SHA-256: {batch.docHash.slice(0, 14)}…
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowReport((v) => !v)}
          className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:border-brand"
        >
          {showReport ? "Hide Parent Report" : "[E] Parent & Coaching PDF Report"}
        </button>
      </div>

      {/* [B] WhatsApp Batch Share Link */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3 print:hidden">
        <span className="text-xs font-semibold uppercase text-gray-500">
          [B] Batch Link
        </span>
        <code className="flex-1 break-all rounded bg-gray-50 px-2 py-1 text-xs">
          {link}
        </code>
        <button
          type="button"
          className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
          onClick={async () => {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? "Copied!" : "Copy Link"}
        </button>
        <a
          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
          href={wa}
          target="_blank"
          rel="noreferrer"
        >
          Share via WhatsApp
        </a>
      </div>

      {/* [D] >50% Concept Bottleneck Alerts */}
      {alerts.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <div className="font-bold">
            [D] &gt;50% Concept Bottleneck Alert — Immediate Revision Needed
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
            {alerts.map((a) => (
              <li key={a.conceptId}>
                <b>{a.name}</b>: {Math.round(strugglingRatio(a) * 100)}% of
                assessed students ({a.struggles}/{total(a)}) are struggling.
                Recommend a 10-minute worked-example recap before next class.
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* [C] Live Batch Mastery Heatmap */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold">[C] Live Batch Mastery Heatmap</h2>
          <span className="text-xs text-gray-500">
            Batch Knows Readiness: <b>{readinessPct}%</b>
          </span>
        </div>
        <Heatmap stats={stats} />
        <p className="mt-2 text-xs text-gray-500">
          Aggregate cohort counts only. Scores reflect estimated understanding
          weighted by student confidence.
        </p>
      </div>

      {/* [E] Parent & Coaching Progress Report Exporter */}
      {showReport && (
        <div className="rounded-xl border-2 border-purple-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-brand">
                {meta.instituteName} · Conceptify AI v2.0
              </div>
              <h2 className="mt-1 text-xl font-bold">
                Parent &amp; Cohort Mastery Progress Report
              </h2>
              <p className="text-xs text-gray-500">
                Batch: {batch.title} · Exam: {batch.exam} · Generated{" "}
                {new Date().toLocaleDateString()}
              </p>
            </div>
            <div className="print:hidden">
              {limits.canExportParentReport ? (
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white"
                >
                  Print / Download PDF
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => meta.switchTier("academy_pro")}
                  className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white"
                >
                  Enable Academy Pro to Print PDF
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="text-xs text-gray-500">Students Joined</div>
              <div className="text-lg font-bold">{batch.memberCount}</div>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3">
              <div className="text-xs text-emerald-700">Estimated Knows</div>
              <div className="text-lg font-bold text-emerald-700">
                {readinessPct}%
              </div>
            </div>
            <div className="rounded-lg bg-red-50 p-3">
              <div className="text-xs text-red-700">Priority Bottlenecks</div>
              <div className="text-lg font-bold text-red-700">
                {alerts.length}
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2 text-xs">
            <div className="font-semibold text-gray-700">
              Sub-Concept Breakdown &amp; Remedial Plan
            </div>
            {stats.map((s) => (
              <div
                key={s.conceptId}
                className="flex items-center justify-between border-b py-1.5"
              >
                <span>{s.name}</span>
                <span className="font-mono text-gray-700">
                  Knows {s.knows} · Developing {s.developing} · Struggles{" "}
                  {s.struggles}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin Student Provisioning (ID & Password) + Per-Student Analytics */}
      <div className="grid gap-5 lg:grid-cols-2 print:hidden">
        <form
          onSubmit={enrollStudent}
          className="space-y-3 rounded-xl border bg-white p-5"
        >
          <div className="text-base font-bold">
            Enroll Student (Assign ID &amp; Password)
          </div>
          <p className="text-xs text-gray-500">
            Create a student login and assign them to this batch. When they sign
            into the Conceptify AI app, this batch appears automatically on
            their dashboard.
          </p>
          <input
            className="w-full rounded-lg border p-2 text-sm"
            placeholder="Student Full Name"
            value={stuName}
            onChange={(e) => setStuName(e.target.value)}
            required
          />
          <input
            className="w-full rounded-lg border p-2 text-sm"
            type="email"
            placeholder="student@email.com"
            value={stuEmail}
            onChange={(e) => setStuEmail(e.target.value)}
            required
          />
          <input
            className="w-full rounded-lg border p-2 text-sm"
            type="text"
            placeholder="Temporary Password (min 6 chars)"
            value={stuPassword}
            onChange={(e) => setStuPassword(e.target.value)}
            required
          />
          {enrollErr && <p className="text-xs text-red-600">{enrollErr}</p>}
          {provisionedCreds && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
              <b>Enrolled {provisionedCreds.studentName}!</b> Share these login
              credentials:
              <div className="mt-1 font-mono">
                ID: {provisionedCreds.email} · Pass: {provisionedCreds.password}
              </div>
            </div>
          )}
          <button
            disabled={enrolling}
            className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {enrolling ? "Creating Student Account…" : "Create & Assign Student"}
          </button>
        </form>

        <div className="rounded-xl border bg-white p-5">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-base font-bold">
              Student Roster &amp; Guess-Risk ({members.length})
            </div>
            <span className="text-[11px] text-gray-500">Live Firestore</span>
          </div>
          {members.length === 0 ? (
            <p className="text-xs text-gray-500">
              No enrolled students yet. Add a student on the left or share the
              batch link.
            </p>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {members.map((m) => {
                const completed = Object.keys(m.conceptStatuses).length;
                const highGuess =
                  m.answerCount >= 3 && m.guessCount / m.answerCount > 0.5;
                const avgScore =
                  Object.values(m.conceptScores).length === 0
                    ? null
                    : Math.round(
                        Object.values(m.conceptScores).reduce((a, b) => a + b, 0) /
                          Object.values(m.conceptScores).length
                      );
                return (
                  <div
                    key={m.uid}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-gray-900">
                        {m.studentName}
                      </div>
                      <div className="text-[11px] text-gray-500">{m.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {highGuess && (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                          High Guess Rate
                        </span>
                      )}
                      <span className="rounded bg-gray-100 px-2 py-0.5 font-medium">
                        {completed}/{batch.concepts.length} done
                      </span>
                      {avgScore !== null && (
                        <span className="font-bold text-brand">{avgScore}%</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Interactive Student Confidence Diagnostic Preview & Live Rollup */}
      <div className="rounded-xl border bg-white p-5 print:hidden">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold">
              Student Diagnostic Preview (Confidence-Weighted)
            </h2>
            <p className="text-xs text-gray-500">
              Preview the 60-second student check (&quot;I Guessed&quot; = 0.5x
              multiplier, cannot reach KNOWS) and verify live heatmap updates.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={submittingSim}
              onClick={() => quickInject("STRUGGLES")}
              className="rounded border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700"
            >
              +1 Struggles
            </button>
            <button
              type="button"
              disabled={submittingSim}
              onClick={() => quickInject("KNOWS")}
              className="rounded border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
            >
              +1 Knows
            </button>
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs font-semibold text-gray-600">
            Select Sub-Concept to Test
          </label>
          <select
            className="w-full rounded-lg border p-2 text-sm"
            value={activeConcept?.id ?? ""}
            onChange={(e) => {
              setSelectedConceptId(e.target.value);
              setPicked([null, null, null]);
              setSures([null, null, null]);
              setLastResult(null);
            }}
          >
            {batch.concepts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {lastResult && (
          <div className="mb-4 rounded-lg border border-purple-200 bg-purple-50 p-3 text-xs text-gray-800">
            Recorded student submission for <b>{lastResult.conceptName}</b>:{" "}
            <b>{lastResult.status}</b> ({lastResult.score}% confidence-weighted
            estimated understanding). Heatmap counters updated above.
          </div>
        )}

        <div className="space-y-4">
          {questions.map((q, qi) => (
            <div key={qi} className="rounded-lg border bg-gray-50 p-3">
              <div className="text-xs font-semibold text-gray-500">
                Question {qi + 1} · Difficulty {q.difficulty}/3
              </div>
              <div className="mt-1 text-sm font-medium text-gray-900">
                {q.prompt}
              </div>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {q.options.map((opt, oi) => (
                  <button
                    key={oi}
                    type="button"
                    onClick={() =>
                      setPicked((prev) =>
                        prev.map((v, idx) => (idx === qi ? oi : v))
                      )
                    }
                    className={`rounded-lg border p-2 text-left text-xs transition ${
                      picked[qi] === oi
                        ? "border-brand bg-purple-50 font-semibold text-brand"
                        : "bg-white hover:bg-gray-50"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <span className="text-xs text-gray-600">Confidence:</span>
                <button
                  type="button"
                  onClick={() =>
                    setSures((prev) =>
                      prev.map((v, idx) => (idx === qi ? true : v))
                    )
                  }
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    sures[qi] === true
                      ? "bg-emerald-600 text-white"
                      : "border bg-white text-gray-700"
                  }`}
                >
                  I&apos;m Sure (1.0x)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSures((prev) =>
                      prev.map((v, idx) => (idx === qi ? false : v))
                    )
                  }
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    sures[qi] === false
                      ? "bg-amber-500 text-white"
                      : "border bg-white text-gray-700"
                  }`}
                >
                  I Guessed (0.5x)
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          disabled={!canSubmitDiagnostic || submittingSim}
          onClick={submitDiagnostic}
          className="mt-4 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {submittingSim
            ? "Updating Heatmap…"
            : "Submit Student Diagnostic & Update Heatmap"}
        </button>
      </div>
    </div>
  );
}

export default function Page() {
  return <Guard>{(uid, meta) => <Detail uid={uid} meta={meta} />}</Guard>;
}
