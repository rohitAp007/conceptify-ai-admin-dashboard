import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const cfg = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** No API key configured -> run on local mock data. */
export const MOCK_MODE = !cfg.apiKey;

const app = MOCK_MODE ? null : getApps()[0] ?? initializeApp(cfg);
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
