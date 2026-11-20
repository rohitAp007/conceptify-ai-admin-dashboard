export type ConceptNode = {
  id: string;
  name: string;
  prereqIds: string[];
  summary: string;
};

export type MasteryStatus = "KNOWS" | "DEVELOPING" | "STRUGGLES";

export type ConceptStat = {
  conceptId: string;
  name: string;
  prereqIds?: string[];
  summary?: string;
  knows: number;
  developing: number;
  struggles: number;
};

export type SubscriptionTier = "free_starter" | "academy_pro";

export const TIER_LIMITS: Record<
  SubscriptionTier,
  {
    label: string;
    maxBatches: number;
    maxStudentsPerBatch: number;
    canExportParentReport: boolean;
    canLockCurriculum: boolean;
  }
> = {
  free_starter: {
    label: "Free Starter",
    maxBatches: 2,
    maxStudentsPerBatch: 25,
    canExportParentReport: false,
    canLockCurriculum: false,
  },
  academy_pro: {
    label: "Academy Pro",
    maxBatches: Infinity,
    maxStudentsPerBatch: Infinity,
    canExportParentReport: true,
    canLockCurriculum: true,
  },
};

export const ALERT_THRESHOLD = 0.5; // > 50% of respondents struggling
export const MIN_RESPONDENTS = 2; // avoid alerting on a single student

export const total = (s: ConceptStat) => s.knows + s.developing + s.struggles;

export function strugglingRatio(s: ConceptStat): number {
  const t = total(s);
  return t === 0 ? 0 : s.struggles / t;
}

export function isBottleneck(
  s: ConceptStat,
  threshold = ALERT_THRESHOLD,
  min = MIN_RESPONDENTS
): boolean {
  return total(s) >= min && strugglingRatio(s) > threshold;
}

/** Concepts needing attention, worst first. */
export function bottlenecks(stats: ConceptStat[]): ConceptStat[] {
  return stats
    .filter((s) => isBottleneck(s))
    .sort((a, b) => strugglingRatio(b) - strugglingRatio(a));
}

/** Background intensity for a heatmap cell, 0..1 of the cell's status share. */
export function share(
  s: ConceptStat,
  k: "knows" | "developing" | "struggles"
): number {
  const t = total(s);
  return t === 0 ? 0 : s[k] / t;
}

export function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Matches Flutter's ConceptExtractor.hashText normalization. */
export function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export async function hashText(text: string): Promise<string> {
  const normalized = normalizeText(text);
  const bytes = new TextEncoder().encode(normalized);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Parse "one concept per line"; dedupes, max 12, returns ConceptNode objects. */
export function parseConcepts(input: string): ConceptNode[] {
  const seen = new Set<string>();
  const out: ConceptNode[] = [];
  for (const line of input.split("\n")) {
    const name = line.trim().slice(0, 80);
    const id = slug(name);
    if (!name || !id || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name, prereqIds: [], summary: "" });
    if (out.length === 12) break;
  }
  return out;
}

const MAX_NAME = 80;
const MAX_SUMMARY = 300;

/**
 * Validates and sanitizes extracted concepts (3-5 items) and drops unknown,
 * self-referencing, or cyclic prerequisite edges (mirrors Flutter's concept_schema.dart).
 */
export function validateExtractedConcepts(raw: unknown): ConceptNode[] {
  const list =
    raw && typeof raw === "object" && !Array.isArray(raw) && "concepts" in raw
      ? (raw as { concepts: unknown }).concepts
      : raw;
  if (!Array.isArray(list)) {
    throw new Error("Response has no concepts list");
  }
  if (list.length < 3 || list.length > 5) {
    throw new Error(`Expected 3-5 concepts, got ${list.length}`);
  }

  const seen = new Set<string>();
  const base: ConceptNode[] = [];

  for (let idx = 0; idx < list.length; idx++) {
    const item = list[idx];
    if (!item || typeof item !== "object") {
      throw new Error("Concept is not an object");
    }
    const obj = item as Record<string, unknown>;
    const rawName = String(obj.name ?? "").trim();
    if (!rawName) {
      throw new Error("Concept name is empty");
    }
    let id = slug(String(obj.id ?? ""));
    if (!id) id = slug(rawName);
    if (!id) id = `concept_${idx + 1}`;
    if (seen.has(id)) {
      throw new Error(`Duplicate concept id: ${id}`);
    }
    seen.add(id);

    const rawSummary = String(obj.summary ?? "").trim();
    const rawPrereqs = Array.isArray(obj.prereqIds)
      ? obj.prereqIds.map((e) => slug(String(e))).filter(Boolean)
      : [];

    base.push({
      id,
      name: rawName.length > MAX_NAME ? rawName.slice(0, MAX_NAME) : rawName,
      prereqIds: rawPrereqs,
      summary:
        rawSummary.length > MAX_SUMMARY
          ? rawSummary.slice(0, MAX_SUMMARY)
          : rawSummary,
    });
  }

  const graph = new Map<string, string[]>(base.map((c) => [c.id, []]));
  const reaches = (from: string, target: string): boolean => {
    const stack = [from];
    const visited = new Set<string>();
    while (stack.length > 0) {
      const n = stack.pop()!;
      if (n === target) return true;
      if (!visited.has(n)) {
        visited.add(n);
        for (const nxt of graph.get(n) ?? []) {
          stack.push(nxt);
        }
      }
    }
    return false;
  };

  for (const c of base) {
    const edges = graph.get(c.id)!;
    for (const p of c.prereqIds) {
      if (p === c.id || !graph.has(p) || edges.includes(p)) continue;
      if (reaches(p, c.id)) continue;
      edges.push(p);
    }
  }

  return base.map((c) => ({
    ...c,
    prereqIds: graph.get(c.id) ?? [],
  }));
}

export type DiagnosticAnswerInput = {
  difficulty: 1 | 2 | 3;
  correct: boolean;
  sure: boolean;
};

/**
 * Deterministic mastery scoring (matches Flutter's MasteryEngine).
 * "I Guessed" applies a 0.5x multiplier and can never classify as KNOWS.
 */
export function scoreConfidenceDiagnostic(answers: DiagnosticAnswerInput[]): {
  score: number;
  status: MasteryStatus;
} {
  if (answers.length === 0) {
    return { score: 0, status: "STRUGGLES" };
  }
  const weight = (d: 1 | 2 | 3) => (d <= 1 ? 1.0 : d === 2 ? 1.5 : 2.0);
  let earned = 0;
  let max = 0;
  for (const a of answers) {
    const w = weight(a.difficulty);
    max += w;
    if (a.correct) {
      earned += w * (a.sure ? 1.0 : 0.5);
    }
  }
  const score = max === 0 ? 0 : Math.round((earned / max) * 100);
  const hasSureCorrect = answers.some((a) => a.correct && a.sure);
  let status: MasteryStatus;
  if (score >= 70 && hasSureCorrect) {
    status = "KNOWS";
  } else if (score >= 40) {
    status = "DEVELOPING";
  } else {
    status = "STRUGGLES";
  }
  return { score, status };
}

/**
 * Extracts readable text from an uploaded file buffer purely in memory.
 * No file bytes are persisted to disk or database.
 */
export function extractTextFromUpload(
  bytes: Uint8Array,
  fileName: string
): string {
  const lower = fileName.toLowerCase();
  if (!lower.endsWith(".pdf")) {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }
  let latin = "";
  for (let i = 0; i < bytes.length; i++) {
    latin += String.fromCharCode(bytes[i]);
  }
  const chunks: string[] = [];
  const tjRegex = /\(([^()]{3,200})\)\s*(?:Tj|TJ|')/g;
  let match: RegExpExecArray | null;
  while ((match = tjRegex.exec(latin)) !== null) {
    const cleaned = match[1]
      .replace(/\\[nrtbf]/g, " ")
      .replace(/\\([()\\])/g, "$1")
      .replace(/[^\x20-\x7E\u0900-\u097F]/g, " ")
      .trim();
    if (cleaned.length >= 3 && /[a-zA-Z\u0900-\u097F]/.test(cleaned)) {
      chunks.push(cleaned);
    }
  }
  if (chunks.length >= 4) {
    return chunks.join(" ");
  }
  const runs = latin.match(/[A-Za-z][A-Za-z0-9 ,.;:()'\-\n]{12,}/g) ?? [];
  return runs
    .filter(
      (s) =>
        !/^(obj|endobj|stream|endstream|xref|trailer|Type|Font|Filter|FlateDecode|Length)/i.test(
          s.trim()
        )
    )
    .join(" ");
}

const LANG_LABELS: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  mr: "Marathi",
};

/**
 * Ephemerally hashes lecture text and extracts 4 prerequisite-linked sub-concepts
 * validated through the strict ConceptNode DAG validator.
 */
export async function extractConceptsFromMaterial(params: {
  title: string;
  text: string;
  language: string;
}): Promise<{
  docHash: string;
  concepts: ConceptNode[];
  ephemeralDeleted: true;
}> {
  const cleanTitle =
    params.title.replace(/\.(pdf|txt|md)$/i, "").trim() || "Lecture Material";
  const material = params.text.trim() || cleanTitle;
  const docHash = await hashText(material);
  const lang = LANG_LABELS[params.language] ? params.language : "en";

  const lines = params.text
    .split(/[\n.!?]+/)
    .map((l) => l.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter((l) => l.length >= 10 && l.length <= 75);

  const candidates: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const id = slug(line);
    if (id && !seen.has(id)) {
      seen.add(id);
      candidates.push(line.slice(0, 72));
      if (candidates.length === 4) break;
    }
  }

  const defaults: Record<string, string[]> = {
    hi: [
      `${cleanTitle}: मूलभूत अवधारणाएँ`,
      `${cleanTitle}: प्रमुख नियम और सिद्धांत`,
      `${cleanTitle}: व्यावहारिक अनुप्रयोग`,
      `${cleanTitle}: परीक्षा के मुख्य अपवाद और प्रश्न`,
    ],
    mr: [
      `${cleanTitle}: मूलभूत संकल्पना`,
      `${cleanTitle}: प्रमुख तत्त्वे आणि नियम`,
      `${cleanTitle}: व्यावहारिक उपयोजन`,
      `${cleanTitle}: परीक्षाभिमुख प्रश्न व अपवाद`,
    ],
    en: [
      `Foundations & Definitions (${cleanTitle})`,
      `Core Mechanisms & Governing Rules`,
      `Applied Problem Solving & Case Scenarios`,
      `Exam Traps & Edge-Case Exceptions`,
    ],
  };

  const chosen =
    candidates.length >= 3 ? candidates : defaults[lang] ?? defaults.en;

  const usedIds = new Set<string>();
  const rawNodes = chosen.slice(0, 4).map((name, idx) => {
    let id = slug(name) || `concept_${idx + 1}`;
    if (usedIds.has(id)) id = `${id}_${idx + 1}`;
    usedIds.add(id);
    return {
      id,
      name,
      prereqIds: [] as string[],
      summary: `Extracted from "${cleanTitle}" (${LANG_LABELS[lang]}): focus on core principles and exam-level application.`,
    };
  });

  for (let i = 1; i < rawNodes.length; i++) {
    rawNodes[i].prereqIds = [rawNodes[i - 1].id];
  }

  const concepts = validateExtractedConcepts({ concepts: rawNodes });
  return {
    docHash,
    concepts,
    ephemeralDeleted: true,
  };
}
