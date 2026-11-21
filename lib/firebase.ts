import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    "AIzaSyA9l9giYupihGkrYxy3VZIWg09MIDuZuvs",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    "conceptifyai.firebaseapp.com",
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "conceptifyai",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
    "1:1014715717484:web:f62a40c0f360ec69044549",
};

export const MOCK_MODE = false;

const app = getApps()[0] ?? initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
