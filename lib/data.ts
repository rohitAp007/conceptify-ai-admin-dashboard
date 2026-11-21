import { initializeApp, getApps } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth, signOut, updateProfile } from "firebase/auth";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db, firebaseConfig } from "./firebase";
import type {
  ConceptNode,
  ConceptStat,
  MasteryStatus,
  SubscriptionTier,
} from "./heatmap";

export type TrackType = "competitive" | "academic";

export type Batch = {
  id: string;
  teacherUid: string;
  title: string;
  trackType?: TrackType;
  department?: string;
  exam: string;
  language: string;
  docHash?: string;
  curriculumLocked?: boolean;
  instituteName?: string;
  concepts: ConceptNode[];
  assignedStudentUids?: string[];
  memberCount: number;
  createdAt?: string;
};

export type NewBatch = Omit<Batch, "id" | "memberCount">;

export type BatchMember = {
  uid: string;
  studentName: string;
  email: string;
  conceptStatuses: Record<string, MasteryStatus>;
  conceptScores: Record<string, number>;
  guessCount: number;
  answerCount: number;
  lastActiveAt?: string;
};

const LS_TIER = "conceptify_teacher_tier";
const LS_INSTITUTE = "conceptify_institute_name";

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
  return localStorage.getItem(LS_INSTITUTE) ?? "Sankalp IAS & MPSC Academy";
}

export function setInstituteName(name: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(LS_INSTITUTE, name.trim() || "Conceptify Partner Academy");
  }
}

export async function createBatch(b: NewBatch): Promise<string> {
  const ref = await addDoc(collection(db, "batches"), {
    ...b,
    trackType: b.trackType ?? "competitive",
    assignedStudentUids: b.assignedStudentUids ?? [],
    memberCount: 0,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function createStarterBatch(teacherUid: string): Promise<string> {
  return createBatch({
    teacherUid,
    title: "UPSC CSE Prelims — Fundamental Rights & Writs",
    trackType: "competitive",
    exam: "UPSC",
    language: "en",
    curriculumLocked: true,
    instituteName: getInstituteName(),
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
    ],
  });
}

export async function listBatches(teacherUid: string): Promise<Batch[]> {
  const snap = await getDocs(
    query(collection(db, "batches"), where("teacherUid", "==", teacherUid))
  );
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Batch, "id">),
  }));
}

export async function getBatch(id: string): Promise<Batch | null> {
  const s = await getDoc(doc(db, "batches", id));
  return s.exists() ? { id: s.id, ...(s.data() as Omit<Batch, "id">) } : null;
}

export async function getStats(batch: Batch): Promise<ConceptStat[]> {
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

/** Real-time Firestore listener so the Teacher Heatmap updates live as students submit. */
export function subscribeBatchStats(
  batch: Batch,
  onUpdate: (stats: ConceptStat[]) => void
): () => void {
  return onSnapshot(collection(db, "batches", batch.id, "stats"), (snap) => {
    const byId = new Map(snap.docs.map((d) => [d.id, d.data()]));
    onUpdate(
      batch.concepts.map((c) => {
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
      })
    );
  });
}

/** Real-time listener for individual enrolled students & guess-rate analytics. */
export function subscribeBatchMembers(
  batchId: string,
  onUpdate: (members: BatchMember[]) => void
): () => void {
  return onSnapshot(collection(db, "batches", batchId, "members"), (snap) => {
    const list: BatchMember[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        uid: d.id,
        studentName: String(data.studentName ?? data.email ?? d.id),
        email: String(data.email ?? ""),
        conceptStatuses: (data.conceptStatuses ?? {}) as Record<string, MasteryStatus>,
        conceptScores: (data.conceptScores ?? {}) as Record<string, number>,
        guessCount: Number(data.guessCount ?? 0),
        answerCount: Number(data.answerCount ?? 0),
        lastActiveAt: data.lastActiveAt?.toDate
          ? data.lastActiveAt.toDate().toISOString()
          : data.lastActiveAt
          ? String(data.lastActiveAt)
          : undefined,
      };
    });
    onUpdate(list);
  });
}

/**
 * Provisions a student Firebase Auth account (email + password) using a secondary
 * Firebase App instance so the logged-in Teacher stays signed in, then assigns
 * the student to the batch in Firestore.
 */
export async function provisionStudentForBatch(params: {
  batchId: string;
  studentName: string;
  email: string;
  password: string;
  exam: string;
  language: string;
}): Promise<{ uid: string; email: string; password: string; studentName: string }> {
  const secApp =
    getApps().find((a) => a.name === "provisioner") ??
    initializeApp(firebaseConfig, "provisioner");
  const secAuth = getAuth(secApp);
  const { getFirestore: getSecFs } = await import("firebase/firestore");
  const secDb = getSecFs(secApp);

  const cleanEmail = params.email.trim();
  const cleanName = params.studentName.trim() || cleanEmail.split("@")[0];
  const cred = await createUserWithEmailAndPassword(
    secAuth,
    cleanEmail,
    params.password
  );
  const studentUid = cred.user.uid;
  await updateProfile(cred.user, { displayName: cleanName });

  await setDoc(doc(secDb, "users", studentUid), {
    uid: studentUid,
    role: "student",
    displayName: cleanName,
    preferredLanguage: params.language || "en",
    targetExam: params.exam || "GENERAL",
    subscriptionTier: "free",
    assignedBatchIds: [params.batchId],
    streakDays: 0,
    createdAt: serverTimestamp(),
  });
  await signOut(secAuth);

  await updateDoc(doc(db, "batches", params.batchId), {
    assignedStudentUids: arrayUnion(studentUid),
    memberCount: increment(1),
  });

  await setDoc(doc(db, "batches", params.batchId, "members", studentUid), {
    uid: studentUid,
    studentName: cleanName,
    email: cleanEmail,
    conceptStatuses: {},
    conceptScores: {},
    guessCount: 0,
    answerCount: 0,
    enrolledAt: serverTimestamp(),
  });

  return {
    uid: studentUid,
    email: cleanEmail,
    password: params.password,
    studentName: cleanName,
  };
}

export async function recordStudentDiagnostic(
  batchId: string,
  conceptId: string,
  status: MasteryStatus
): Promise<void> {
  const key = status.toLowerCase() as "knows" | "developing" | "struggles";
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
}

export async function isTeacher(uid: string): Promise<boolean> {
  const s = await getDoc(doc(db, "users", uid));
  if (!s.exists()) return true;
  return s.data().role === "teacher" || s.data().role === "admin";
}
