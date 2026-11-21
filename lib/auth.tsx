"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { isTeacher } from "./data";

type Ctx = {
  uid: string | null;
  email: string | null;
  loading: boolean;
  forbidden: boolean;
  login: (email: string, pw: string) => Promise<void>;
  signup: (email: string, pw: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthCtx = createContext<Ctx>(null as unknown as Ctx);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [uid, setUid] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const fbAuth = auth;
    return onAuthStateChanged(fbAuth, async (u) => {
      try {
        if (u) {
          const ok = await isTeacher(u.uid).catch(() => true);
          if (!ok) {
            setForbidden(true);
            await signOut(fbAuth);
            setUid(null);
            setEmail(null);
          } else {
            setForbidden(false);
            setUid(u.uid);
            setEmail(u.email ?? null);
          }
        } else {
          setUid(null);
          setEmail(null);
        }
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const login = async (e: string, pw: string) => {
    if (!auth) throw new Error("Firebase is not configured.");
    const cred = await signInWithEmailAndPassword(auth, e.trim(), pw);
    const ok = await isTeacher(cred.user.uid).catch(() => true);
    if (!ok) {
      setForbidden(true);
      await signOut(auth);
      throw new Error("auth/not-a-teacher");
    }
    setForbidden(false);
    setUid(cred.user.uid);
    setEmail(cred.user.email ?? e.trim());
  };

  const signup = async (e: string, pw: string, displayName: string) => {
    if (!auth || !db) throw new Error("Firebase is not configured.");
    const cleanEmail = e.trim();
    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, pw);
    const name = displayName.trim() || cleanEmail.split("@")[0];
    await updateProfile(cred.user, { displayName: name });
    await setDoc(doc(db, "users", cred.user.uid), {
      uid: cred.user.uid,
      role: "teacher",
      displayName: name,
      preferredLanguage: "en",
      targetExam: "GENERAL",
      subscriptionTier: "free",
      streakDays: 0,
      createdAt: serverTimestamp(),
    });
    setForbidden(false);
    setUid(cred.user.uid);
    setEmail(cred.user.email ?? cleanEmail);
  };

  const logout = async () => {
    if (!auth) return;
    await signOut(auth);
    setUid(null);
    setEmail(null);
  };

  return (
    <AuthCtx.Provider
      value={{ uid, email, loading, forbidden, login, signup, logout }}
    >
      {children}
    </AuthCtx.Provider>
  );
}
