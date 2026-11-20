import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db, MOCK_MODE } from "./firebase";
import type {
  ConceptNode,
  ConceptStat,
  MasteryStatus,
  SubscriptionTier,
} from "./heatmap";

export type Batch = {
  id: string;
  teacherUid: string;
  title: string;
  exam: string;
  language: string;
  docHash?: string;
  curriculumLocked?: boolean;
  instituteName?: string;
  concepts: ConceptNode[];
  memberCount: number;
  createdAt?: string;
};

export type NewBatch = Omit<Batch, "id" | "memberCount">;

const LS_BATCHES = "conceptify_mock_batches_v2";
const LS_STATS_PREFIX = "conceptify_mock_stats_";
const LS_TIER = "conceptify_teacher_tier";
const LS_INSTITUTE = "conceptify_institute_name";

const SEED_BATCHES: Batch[] = [
  {
    id: "upsc_polity_writs",
    teacherUid: "teacher_demo",
    title: "UPSC CSE Prelims — Laxmikanth Polity: Fundamental Rights & Writs",
    exam: "UPSC",
    language: "en",
    docHash: "a8f4c19e22b04d3187e914f52e77a12b49904c2c1d67e81234a5bc67d89ef012",
    curriculumLocked: true,
    instituteName: "Sankalp IAS Academy, Pune",
    memberCount: 24,
    createdAt: "2026-11-18T09:30:00.000Z",
    concepts: [
      {
        id: "art_12_13_state_definition",
        name: "Article 12 & 13: Definition of State & Judicial Review",
        prereqIds: [],
        summary:
          "Covers statutory vs non-statutory bodies under Art. 12 and doctrine of eclipse/severability under Art. 13.",
      },
      {
        id: "art_14_21_equality_liberty",
        name: "Right to Equality (Art. 14–18) & Life/Liberty (Art. 21)",
        prereqIds: ["art_12_13_state_definition"],
        summary:
          "Distinguishes rule of law, reasonable classification, and procedure established by law vs due process.",
      },
      {
        id: "art_32_vs_226_writs",
        name: "Constitutional Remedies & Writ Jurisdiction (Art. 32 vs 226)",
        prereqIds: ["art_14_21_equality_liberty"],
        summary:
          "Compares Habeas Corpus, Mandamus, Prohibition, Certiorari, and Quo Warranto across SC and High Courts.",
      },
      {
        id: "fr_limitations_martial_law",
        name: "Exceptions to Fundamental Rights (Art. 33, 34 & 31A–31C)",
        prereqIds: ["art_32_vs_226_writs"],
        summary:
          "Armed forces restrictions, martial law indemnity, and Ninth Schedule judicial review post-I.R. Coelho.",
      },
    ],
  },
  {
    id: "mpsc_fiscal_policy_mr",
    teacherUid: "teacher_demo",
    title: "MPSC Rajyaseva — महाराष्ट्राची अर्थव्यवस्था आणि सार्वजनिक वित्त",
    exam: "MPSC",
    language: "mr",
    docHash: "c3e918d77a2140fe88c1b5490b771a99335e8b4f1029384756abcdef01234567",
    curriculumLocked: true,
    instituteName: "सह्याद्री स्पर्धा परीक्षा केंद्र",
    memberCount: 22,
    createdAt: "2026-11-19T11:15:00.000Z",
    concepts: [
      {
        id: "maharashtra_revenue_sources",
        name: "राज्याचे कर व करेतर महसुली स्रोत (SGST आणि मुद्रांक शुल्क)",
        prereqIds: [],
        summary:
          "महाराष्ट्राच्या महसुली उत्पन्नातील SGST, व्हॅट, राज्य उत्पादन शुल्क आणि मुद्रांक शुल्काचा वाटा.",
      },
      {
        id: "revenue_vs_capital_budget",
        name: "महसुली व भांडवली अर्थसंकल्पातील तफावत",
        prereqIds: ["maharashtra_revenue_sources"],
        summary:
          "महसुली खर्च विरुद्ध भांडवली गुंतवणूक आणि विकासकामांवरील परिणाम.",
      },
      {
        id: "fiscal_deficit_frbm_act",
        name: "राजकोषीय तूट आणि FRBM कायदा मर्यादा",
        prereqIds: ["revenue_vs_capital_budget"],
        summary:
          "GSDP च्या तुलनेत ३% राजकोषीय तूट मर्यादा, प्राथमिक तूट व कर्ज-GSDP गुणोत्तर.",
      },
      {
        id: "finance_commission_devolution",
        name: "१६ वा वित्त आयोग व केंद्र-राज्य कर वाटप",
        prereqIds: ["fiscal_deficit_frbm_act"],
        summary:
          "उभे व आडवे कर हस्तांतरण निकष आणि स्थानिक स्वराज्य संस्थांना अनुदान.",
      },
    ],
  },
  {
    id: "gate_cs_deadlocks",
    teacherUid: "teacher_demo",
    title: "GATE CS — Operating Systems: Deadlocks & Banker's Algorithm",
    exam: "GATE",
    language: "en",
    docHash: "f901b22d8c734e1199a01b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8091a2b3c4",
    curriculumLocked: false,
    instituteName: "Vector GATE CS",
    memberCount: 19,
    createdAt: "2026-11-20T06:00:00.000Z",
    concepts: [
      {
        id: "coffman_conditions",
        name: "Four Coffman Necessary Conditions for Deadlock",
        prereqIds: [],
        summary:
          "Mutual exclusion, hold-and-wait, no preemption, and circular wait conditions.",
      },
      {
        id: "rag_single_multi_instance",
        name: "Resource Allocation Graph (Single vs Multi-Instance Cycles)",
        prereqIds: ["coffman_conditions"],
        summary:
          "Cycle implies deadlock for single-instance resources, but is only necessary for multi-instance.",
      },
      {
        id: "bankers_safety_algorithm",
        name: "Banker's Safety Algorithm & Need Matrix Traces",
        prereqIds: ["rag_single_multi_instance"],
        summary:
          "Finding safe sequences, evaluating resource-request grants, and O(m*n^2) complexity.",
      },
      {
        id: "deadlock_recovery_prevention",
        name: "Deadlock Prevention vs Avoidance vs Recovery Trade-offs",
        prereqIds: ["bankers_safety_algorithm"],
        summary:
          "Resource ordering, rollback costs, and starvation risks in victim selection.",
      },
    ],
  },
];

const SEED_STATS: Record<string, ConceptStat[]> = {
  upsc_polity_writs: [
    {
      conceptId: "art_12_13_state_definition",
      name: "Article 12 & 13: Definition of State & Judicial Review",
      prereqIds: [],
      summary: SEED_BATCHES[0].concepts[0].summary,
      knows: 17,
      developing: 5,
      struggles: 2,
    },
    {
      conceptId: "art_14_21_equality_liberty",
      name: "Right to Equality (Art. 14–18) & Life/Liberty (Art. 21)",
      prereqIds: ["art_12_13_state_definition"],
      summary: SEED_BATCHES[0].concepts[1].summary,
      knows: 11,
      developing: 8,
      struggles: 5,
    },
    {
      conceptId: "art_32_vs_226_writs",
      name: "Constitutional Remedies & Writ Jurisdiction (Art. 32 vs 226)",
      prereqIds: ["art_14_21_equality_liberty"],
      summary: SEED_BATCHES[0].concepts[2].summary,
      knows: 3,
      developing: 5,
      struggles: 16,
    },
    {
      conceptId: "fr_limitations_martial_law",
      name: "Exceptions to Fundamental Rights (Art. 33, 34 & 31A–31C)",
      prereqIds: ["art_32_vs_226_writs"],
      summary: SEED_BATCHES[0].concepts[3].summary,
      knows: 4,
      developing: 6,
      struggles: 14,
    },
  ],
  mpsc_fiscal_policy_mr: [
    {
      conceptId: "maharashtra_revenue_sources",
      name: "राज्याचे कर व करेतर महसुली स्रोत (SGST आणि मुद्रांक शुल्क)",
      prereqIds: [],
      summary: SEED_BATCHES[1].concepts[0].summary,
      knows: 14,
      developing: 5,
      struggles: 3,
    },
    {
      conceptId: "revenue_vs_capital_budget",
      name: "महसुली व भांडवली अर्थसंकल्पातील तफावत",
      prereqIds: ["maharashtra_revenue_sources"],
      summary: SEED_BATCHES[1].concepts[1].summary,
      knows: 8,
      developing: 9,
      struggles: 5,
    },
    {
      conceptId: "fiscal_deficit_frbm_act",
      name: "राजकोषीय तूट आणि FRBM कायदा मर्यादा",
      prereqIds: ["revenue_vs_capital_budget"],
      summary: SEED_BATCHES[1].concepts[2].summary,
      knows: 3,
      developing: 5,
      struggles: 14,
    },
    {
      conceptId: "finance_commission_devolution",
      name: "१६ वा वित्त आयोग व केंद्र-राज्य कर वाटप",
      prereqIds: ["fiscal_deficit_frbm_act"],
      summary: SEED_BATCHES[1].concepts[3].summary,
      knows: 7,
      developing: 8,
      struggles: 7,
    },
  ],
  gate_cs_deadlocks: [
    {
      conceptId: "coffman_conditions",
      name: "Four Coffman Necessary Conditions for Deadlock",
      prereqIds: [],
      summary: SEED_BATCHES[2].concepts[0].summary,
      knows: 15,
      developing: 3,
      struggles: 1,
    },
    {
      conceptId: "rag_single_multi_instance",
      name: "Resource Allocation Graph (Single vs Multi-Instance Cycles)",
      prereqIds: ["coffman_conditions"],
      summary: SEED_BATCHES[2].concepts[1].summary,
      knows: 7,
      developing: 6,
      struggles: 6,
    },
    {
      conceptId: "bankers_safety_algorithm",
      name: "Banker's Safety Algorithm & Need Matrix Traces",
      prereqIds: ["rag_single_multi_instance"],
      summary: SEED_BATCHES[2].concepts[2].summary,
      knows: 2,
      developing: 5,
      struggles: 12,
    },
    {
      conceptId: "deadlock_recovery_prevention",
      name: "Deadlock Prevention vs Avoidance vs Recovery Trade-offs",
      prereqIds: ["bankers_safety_algorithm"],
      summary: SEED_BATCHES[2].concepts[3].summary,
      knows: 8,
      developing: 7,
      struggles: 4,
    },
  ],
};

function ensureSeeded(): Batch[] {
  if (typeof window === "undefined") return SEED_BATCHES;
  const raw = localStorage.getItem(LS_BATCHES);
  if (!raw) {
    localStorage.setItem(LS_BATCHES, JSON.stringify(SEED_BATCHES));
    for (const [batchId, stats] of Object.entries(SEED_STATS)) {
      localStorage.setItem(`${LS_STATS_PREFIX}${batchId}`, JSON.stringify(stats));
    }
    return SEED_BATCHES;
  }
  try {
    return JSON.parse(raw) as Batch[];
  } catch {
    return SEED_BATCHES;
  }
}

export function getTeacherTier(): SubscriptionTier {
  if (typeof window === "undefined") return "free_starter";
  const v = localStorage.getItem(LS_TIER);
  return v === "academy_pro" ? "academy_pro" : "free_starter";
}

export function setTeacherTier(tier: SubscriptionTier): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(LS_TIER, tier);
  }
}

export function getInstituteName(): string {
  if (typeof window === "undefined") return "Sankalp IAS & MPSC Academy";
  return (
    localStorage.getItem(LS_INSTITUTE) ?? "Sankalp IAS & MPSC Academy"
  );
}

export function setInstituteName(name: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(LS_INSTITUTE, name.trim() || "Conceptify Partner Academy");
  }
}

export async function createBatch(b: NewBatch): Promise<string> {
  if (MOCK_MODE || !db) {
    const existing = ensureSeeded();
    const id = `batch_${Math.random().toString(36).slice(2, 8)}`;
    const created: Batch = {
      ...b,
      id,
      memberCount: 0,
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem(LS_BATCHES, JSON.stringify([created, ...existing]));
    const initialStats: ConceptStat[] = b.concepts.map((c) => ({
      conceptId: c.id,
      name: c.name,
      prereqIds: c.prereqIds,
      summary: c.summary,
      knows: 0,
      developing: 0,
      struggles: 0,
    }));
    localStorage.setItem(`${LS_STATS_PREFIX}${id}`, JSON.stringify(initialStats));
    return id;
  }
  const ref = await addDoc(collection(db, "batches"), {
    ...b,
    memberCount: 0,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listBatches(teacherUid: string): Promise<Batch[]> {
  if (MOCK_MODE || !db) {
    return ensureSeeded().filter(
      (b) => b.teacherUid === teacherUid || teacherUid === "teacher_demo"
    );
  }
  const snap = await getDocs(
    query(collection(db, "batches"), where("teacherUid", "==", teacherUid))
  );
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Batch, "id">),
  }));
}

export async function getBatch(id: string): Promise<Batch | null> {
  if (MOCK_MODE || !db) {
    return ensureSeeded().find((b) => b.id === id) ?? null;
  }
  const s = await getDoc(doc(db, "batches", id));
  return s.exists() ? { id: s.id, ...(s.data() as Omit<Batch, "id">) } : null;
}

export async function getStats(batch: Batch): Promise<ConceptStat[]> {
  if (MOCK_MODE || !db) {
    ensureSeeded();
    const raw =
      typeof window !== "undefined"
        ? localStorage.getItem(`${LS_STATS_PREFIX}${batch.id}`)
        : null;
    const saved: ConceptStat[] = raw ? JSON.parse(raw) : [];
    const byId = new Map(saved.map((s) => [s.conceptId, s]));
    return batch.concepts.map((c) => {
      const existing = byId.get(c.id);
      return {
        conceptId: c.id,
        name: c.name,
        prereqIds: c.prereqIds,
        summary: c.summary,
        knows: existing?.knows ?? 0,
        developing: existing?.developing ?? 0,
        struggles: existing?.struggles ?? 0,
      };
    });
  }
  const snap = await getDocs(collection(db, "batches", batch.id, "stats"));
  const byId = new Map(snap.docs.map((d) => [d.id, d.data()]));
  return batch.concepts.map((c) => {
    const d = byId.get(c.id);
    return {
      conceptId: c.id,
      name: c.name,
      prereqIds: c.prereqIds,
      summary: c.summary,
      knows: Number(d?.knows ?? 0),
      developing: Number(d?.developing ?? 0),
      struggles: Number(d?.struggles ?? 0),
    };
  });
}

export async function recordStudentDiagnostic(
  batchId: string,
  conceptId: string,
  status: MasteryStatus
): Promise<void> {
  const key = status.toLowerCase() as "knows" | "developing" | "struggles";

  if (MOCK_MODE || !db) {
    const batches = ensureSeeded();
    const idx = batches.findIndex((b) => b.id === batchId);
    if (idx === -1) return;
    const batch = batches[idx];
    const currentStats = await getStats(batch);
    const updatedStats = currentStats.map((s) =>
      s.conceptId === conceptId ? { ...s, [key]: s[key] + 1 } : s
    );
    localStorage.setItem(
      `${LS_STATS_PREFIX}${batchId}`,
      JSON.stringify(updatedStats)
    );
    batches[idx] = { ...batch, memberCount: batch.memberCount + 1 };
    localStorage.setItem(LS_BATCHES, JSON.stringify(batches));
    return;
  }

  const statRef = doc(db, "batches", batchId, "stats", conceptId);
  const batchRef = doc(db, "batches", batchId);
  await runTransaction(db, async (tx) => {
    const statSnap = await tx.get(statRef);
    const prev = statSnap.exists() ? statSnap.data() : {};
    tx.set(
      statRef,
      {
        knows: Number(prev.knows ?? 0) + (key === "knows" ? 1 : 0),
        developing: Number(prev.developing ?? 0) + (key === "developing" ? 1 : 0),
        struggles: Number(prev.struggles ?? 0) + (key === "struggles" ? 1 : 0),
      },
      { merge: true }
    );
    tx.update(batchRef, { memberCount: increment(1) });
  });
  await setDoc(
    doc(db, "batches", batchId, "members", `anon_${Date.now()}`),
    { [conceptId]: status },
    { merge: true }
  ).catch(() => undefined);
}

export async function isTeacher(uid: string): Promise<boolean> {
  if (MOCK_MODE || !db) return true;
  const s = await getDoc(doc(db, "users", uid));
  return s.exists() && s.data().role === "teacher";
}
