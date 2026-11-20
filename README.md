# Conceptify Teacher Portal

Dedicated TypeScript + Next.js (Node.js) web dashboard for tutors and coaching institutes, sharing the same Firebase project and Firestore schema as the Conceptify AI Flutter app.

## Local Development
```bash
npm install
cp .env.example .env.local   # fill with Firebase Web config for live Firestore
npm run dev                  # http://localhost:3001
npm test && npm run typecheck && npm run build
```

## Deploy on Hostinger via GitHub
1. Push the `teacher_portal/` directory to a GitHub repository.
2. In **Hostinger hPanel → Websites → Add Website → Node.js / Next.js Web App**, connect your GitHub repository.
3. Use these build settings:
   - **Framework Preset:** Next.js
   - **Build Command:** `npm run build`
   - **Start Command:** `npm run start`
   - **Node Version:** 20.x
4. Add your Firebase Web environment variables in Hostinger's Environment Variables panel:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
   - `NEXT_PUBLIC_SHARE_BASE` (e.g. `https://conceptify.app/batch`)
5. Trigger deploy — Hostinger will build and serve the dashboard automatically on every `git push`.

## Core Capabilities
- Teacher sign-in (`users/{uid}.role == "teacher"`)
- Ephemeral lecture PDF / notes concept decomposition (SHA-256 hashed, raw files discarded in memory)
- WhatsApp Batch Link generator (`conceptify.app/batch/{batchId}`)
- Real-time Batch Mastery Heatmap (`Knows / Developing / Struggles`) with `>50%` bottleneck alerts
- Academy Pro tier: unlimited batches, Curriculum-Locked AI guardrails, and print-ready Parent & Cohort PDF reports
