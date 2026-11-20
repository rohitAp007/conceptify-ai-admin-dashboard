"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth, MOCK_MODE } from "./firebase";
import { isTeacher } from "./data";

type Ctx = {
  uid: string | null;
  email: string | null;
  loading: boolean;
  forbidden: boolean;
  login: (email: string, pw: string) => Promise<void>;
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
    if (MOCK_MODE || !auth) {
      const u = localStorage.getItem("mock_uid");
      if (u) { setUid(u); setEmail(u + "@demo.local"); }
      setLoading(false);
      return;
    }
    const fbAuth = auth;
    return onAuthStateChanged(fbAuth, async (u) => {
      if (u && !(await isTeacher(u.uid))) {
        setForbidden(true); await signOut(fbAuth); setUid(null); setEmail(null);
      } else {
        setForbidden(false); setUid(u?.uid ?? null); setEmail(u?.email ?? null);
      }
      setLoading(false);
    });
  }, []);

  const login = async (e: string, pw: string) => {
    if (MOCK_MODE || !auth) {
      const id = "teacher_demo";
      localStorage.setItem("mock_uid", id); setUid(id); setEmail(e || id + "@demo.local");
      return;
    }
    await signInWithEmailAndPassword(auth, e, pw);
  };
  const logout = async () => {
    if (MOCK_MODE || !auth) { localStorage.removeItem("mock_uid"); setUid(null); return; }
    await signOut(auth);
  };

  return <AuthCtx.Provider value={{ uid, email, loading, forbidden, login, logout }}>{children}</AuthCtx.Provider>;
}
