# Bid Tender Writer — AI-Powered Government Tender & Bidding Copilot
Publish link: https://bidco-author.ai.studio/
Bid Tender Writer is a full-stack SaaS platform built with React, TypeScript, Tailwind CSS, Express, Google Gemini (`@google/genai`), and Firebase (Authentication & Firestore).

## Core Capabilities
1. **Authentication & Organization Management**: Google Sign-In and Email/Password auth flows with isolated multi-tenant company procurement profiles, financial metrics, certifications, and RBAC team members.
2. **Database-Backed AI Dashboard**: Real-time KPIs, workflow pipeline charts, industry sector rings, 30-day submission deadlines, and next-best-action recommendations.
3. **Smart Tender Discovery**: Multi-facet tender search with clearly labeled `DEMO DATA` reference records and server-side connector architecture for GeM, CPPP/eProcure, and Document AI.
4. **AI Tender Document Analyzer & RAG**: PDF upload, page-aware text extraction (with Gemini multimodal OCR fallback for scanned PDFs), semantic chunking, `gemini-embedding-2` vector indexing, cited structured reports, and interactive RAG Q&A.
5. **Evidence-Based Eligibility Checker**: Compares tender requirements against the registered company profile using strict determinations (`Eligible`, `Potentially Eligible`, `Ineligible`, `Insufficient Information`) without arbitrary percentage scores.
6. **Bid Tender Writer Proposal Studio**: Generates and regenerates tailored tender proposals, marks missing company data with `[USER INPUT REQUIRED]`, verifies compliance, tracks versions, and exports real `.docx` and `.pdf` files.
7. **Financial & Risk Intelligence**: Transparent cost/margin scenario calculator and severity-ranked contract risk analyzer (`Low`, `Medium`, `High`, `Critical`) with clause citations.

## Setup & Deployment
1. Configure environment variables (see `.env.example`):
   - `GEMINI_API_KEY`: Required on server-side for Gemini AI and embeddings.
   - `GEM_PORTAL_API_ENDPOINT`, `GEM_PORTAL_API_KEY`, `CPPP_FEED_ENDPOINT`, `DOCUMENT_AI_PROCESSOR_ID`: Optional external portal/OCR integrations.
2. Install dependencies: `npm install`
3. Run locally: `npm run dev` (serves Express API + Vite on port `3000`)
4. Run automated tests: `node --test firestore.rules.test.ts`
5. Build & start production server (e.g., Google Cloud Run):
   - `npm run build`
   - `NODE_ENV=production npm start`
