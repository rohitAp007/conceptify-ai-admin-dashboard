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
    return onAuthStateChanged(auth, async (u) => {
      if (u && !(await isTeacher(u.uid))) {
        setForbidden(true);
        await signOut(auth);
        setUid(null);
        setEmail(null);
      } else {
        setForbidden(false);
        setUid(u?.uid ?? null);
        setEmail(u?.email ?? null);
      }
      setLoading(false);
    });
  }, []);

  const login = async (e: string, pw: string) => {
    await signInWithEmailAndPassword(auth, e, pw);
  };

  const signup = async (e: string, pw: string, displayName: string) => {
    const cred = await createUserWithEmailAndPassword(auth, e, pw);
    if (displayName.trim()) {
      await updateProfile(cred.user, { displayName: displayName.trim() });
    }
    await setDoc(doc(db, "users", cred.user.uid), {
      uid: cred.user.uid,
      role: "teacher",
      displayName: displayName.trim() || e.split("@")[0],
      preferredLanguage: "en",
      targetExam: "GENERAL",
      subscriptionTier: "free",
      streakDays: 0,
      createdAt: serverTimestamp(),
    });
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthCtx.Provider
      value={{ uid, email, loading, forbidden, login, signup, logout }}
    >
      {children}
    </AuthCtx.Provider>
  );
}
