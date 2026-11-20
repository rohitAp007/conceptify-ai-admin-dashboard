"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Guard, { GuardMeta } from "@/components/Guard";
import { createBatch, listBatches } from "@/lib/data";
import {
  ConceptNode,
  extractConceptsFromMaterial,
  extractTextFromUpload,
  parseConcepts,
  TIER_LIMITS,
} from "@/lib/heatmap";

function Form({ uid, meta }: { uid: string; meta: GuardMeta }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [exam, setExam] = useState("UPSC");
  const [language, setLanguage] = useState("en");
  const [notesText, setNotesText] = useState("");
  const [conceptsText, setConceptsText] = useState("");
  const [extractedNodes, setExtractedNodes] = useState<ConceptNode[] | null>(
    null
  );
  const [docHash, setDocHash] = useState<string | undefined>(undefined);
  const [ephemeralNotice, setEphemeralNotice] = useState("");
  const [curriculumLocked, setCurriculumLocked] = useState(false);
  const [existingCount, setExistingCount] = useState(0);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const limits = TIER_LIMITS[meta.tier];

  useEffect(() => {
    listBatches(uid)
      .then((list) => setExistingCount(list.length))
      .catch(() => setExistingCount(0));
  }, [uid]);

  useEffect(() => {
    if (!limits.canLockCurriculum) setCurriculumLocked(false);
  }, [limits.canLockCurriculum]);

  const manualConcepts = parseConcepts(conceptsText);
  const activeConcepts: ConceptNode[] =
    extractedNodes &&
    manualConcepts.length === extractedNodes.length &&
    manualConcepts.every((m, idx) => m.name === extractedNodes[idx].name)
      ? extractedNodes
      : manualConcepts;

  async function runExtraction(rawText: string, sourceLabel: string) {
    setExtracting(true);
    setErr("");
    try {
      const res = await extractConceptsFromMaterial({
        title: title.trim() || sourceLabel,
        text: rawText,
        language,
      });
      setDocHash(res.docHash);
      setExtractedNodes(res.concepts);
      setConceptsText(res.concepts.map((c) => c.name).join("\n"));
      if (!title.trim()) {
        setTitle(sourceLabel.replace(/\.(pdf|txt|md)$/i, ""));
      }
      setEphemeralNotice(
        `Raw file processed in memory & discarded (SHA-256: ${res.docHash.slice(
          0,
          16
        )}…). ${res.concepts.length} prerequisite-linked sub-concepts ready.`
      );
    } catch {
      setErr("Could not extract sub-concepts from the uploaded material.");
    } finally {
      setExtracting(false);
    }
  }

  async function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    const extracted = extractTextFromUpload(
      new Uint8Array(buffer),
      file.name
    );
    setNotesText(extracted.slice(0, 6000));
    await runExtraction(extracted, file.name);
    e.target.value = "";
  }

  const atLimit =
    limits.maxBatches !== Infinity && existingCount >= limits.maxBatches;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (atLimit) {
      return setErr(
        `Free Starter allows max ${limits.maxBatches} active batches. Switch to Academy Pro in the top bar.`
      );
    }
    if (!title.trim()) return setErr("Give the batch a title.");
    if (activeConcepts.length < 3) {
      return setErr("Add at least 3 sub-concepts (or extract from lecture notes).");
    }
    setBusy(true);
    setErr("");
    try {
      const id = await createBatch({
        teacherUid: uid,
        title: title.trim(),
        exam,
        language,
        docHash,
        curriculumLocked: limits.canLockCurriculum ? curriculumLocked : false,
        instituteName: meta.instituteName,
        concepts: activeConcepts,
      });
      router.replace(`/batches/${id}`);
    } catch {
      setErr("Could not create the batch.");
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Create Coaching Batch</h1>
        <p className="text-sm text-gray-500">
          Upload lecture PDF/notes to extract sub-concepts ephemerally and
          generate a WhatsApp diagnostic link.
        </p>
      </div>

      {atLimit && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <span>
            <b>Batch limit reached ({existingCount}/{limits.maxBatches}):</b>{" "}
            Free Starter supports up to 2 active batches.
          </span>
          <button
            type="button"
            onClick={() => meta.switchTier("academy_pro")}
            className="rounded-lg bg-amber-700 px-3 py-1 text-xs font-medium text-white"
          >
            Unlock Academy Pro
          </button>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4 rounded-xl border bg-white p-5">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">
            Batch Title
          </label>
          <input
            className="w-full rounded-lg border p-2.5 text-sm"
            placeholder="e.g. UPSC Polity — Fundamental Rights & Writs"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">
              Target Exam
            </label>
            <select
              className="w-full rounded-lg border p-2.5 text-sm"
              value={exam}
              onChange={(e) => setExam(e.target.value)}
            >
              {["UPSC", "MPSC", "GATE", "NEET", "GENERAL"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">
              Batch Language
            </label>
            <select
              className="w-full rounded-lg border p-2.5 text-sm"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="en">English</option>
              <option value="hi">Hindi (हिन्दी)</option>
              <option value="mr">Marathi (मराठी)</option>
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-dashed border-purple-300 bg-purple-50/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                [A] Ephemeral Lecture PDF / Notes Extractor
              </div>
              <p className="text-xs text-gray-600">
                Files are parsed in browser memory, SHA-256 hashed, and never
                saved.
              </p>
            </div>
            <label className="cursor-pointer rounded-lg border border-brand bg-white px-3 py-1.5 text-xs font-semibold text-brand hover:bg-purple-50">
              {extracting ? "Extracting…" : "Upload PDF / TXT / MD"}
              <input
                type="file"
                accept=".pdf,.txt,.md"
                onChange={onFilePick}
                className="hidden"
                disabled={extracting}
              />
            </label>
          </div>

          <textarea
            className="mt-3 h-24 w-full rounded-lg border bg-white p-2.5 text-xs"
            placeholder="Or paste lecture notes / syllabus outline here and click Extract Sub-Concepts..."
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-gray-500">
              Privacy invariant: raw material is discarded after extraction.
            </span>
            <button
              type="button"
              disabled={extracting || (!notesText.trim() && !title.trim())}
              onClick={() =>
                runExtraction(notesText || title, title || "Lecture Notes")
              }
              className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
            >
              Extract Sub-Concepts
            </button>
          </div>
        </div>

        {ephemeralNotice && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800">
            {ephemeralNotice}
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">
            Sub-Concepts (one per line, 3–12)
          </label>
          <textarea
            className="h-32 w-full rounded-lg border p-2.5 text-sm"
            placeholder={
              "Article 12 & 13: Definition of State\nRight to Equality (Art. 14–18)\nConstitutional Remedies (Art. 32 vs 226)"
            }
            value={conceptsText}
            onChange={(e) => setConceptsText(e.target.value)}
          />
          <p className="mt-1 text-xs text-gray-500">
            {activeConcepts.length} sub-concepts ready.
          </p>
        </div>

        <label className="flex items-start gap-2.5 rounded-lg border bg-gray-50 p-3 text-sm">
          <input
            type="checkbox"
            checked={curriculumLocked}
            disabled={!limits.canLockCurriculum}
            onChange={(e) => setCurriculumLocked(e.target.checked)}
            className="mt-0.5"
          />
          <div>
            <div className="font-medium text-gray-900">
              Curriculum-Locked AI Guardrails{" "}
              {!limits.canLockCurriculum && (
                <span className="ml-1 rounded bg-purple-100 px-1.5 py-0.5 text-[11px] text-brand">
                  Academy Pro
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500">
              Restricts student explanations and trap MCQs strictly to your
              institute&apos;s lecture concepts.
            </div>
          </div>
        </label>

        {err && <p className="text-sm text-red-600">{err}</p>}
        <button
          disabled={busy || atLimit}
          className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create Batch & Generate WhatsApp Link"}
        </button>
      </form>
    </div>
  );
}

export default function Page() {
  return <Guard>{(uid, meta) => <Form uid={uid} meta={meta} />}</Guard>;
}
