# Developer Decisions & Running Notes — Monospace Studio

This file logs chronological developer notes, design decisions, architectural assumptions, and fallback strategies chosen during the implementation of the ASCII Art Studio project.

---

## 1. Initial Setup & Onboarding (2026-06-28)
* **Status:** Onboarding Complete.
* **Objective:** Get up to speed on the project scope and set up the foundation documentation files.
* **Findings:** The repository currently contains design files, spec docs, UI mockups, and Mermaid diagrams but no source code. Setup begins with initializing the developer `README.md` and this `NOTES.md` log.

---

## 2. Core Architectural Decisions

### 2.1 Decoupled Service-Oriented Architecture (SOA)
* **Decision:** We separate API routes and client views from the core domain services located in `src/lib/`.
* **Rationale:** Decoupling ensures that helper libraries (like the deterministic ASCII converter and NASA APOD client) can be unit-tested in isolation without mocking Next.js router boundaries.

### 2.2 Text-Only AI Style Direction
* **Decision:** LLM Feature 1 (ASCII style parameter selection) will perform inference based purely on the APOD title and explanation text instead of executing vision-based analysis on the image pixels.
* **Rationale:**
  - Preserves $0 API cost using instruct text models.
  - Decreases latency (vision models add significant processing time).
  - Eliminates the need to upload binary images or construct multipart payloads.

### 2.3 Server-Side Supabase Caching (`cached_apods`)
* **Decision:** We implement a `cached_apods` table to cache the converted ASCII art and LLM responses for each requested date.
* **Rationale:**
  - Mitigates NASA APOD hourly rate-limiting restrictions.
  - Prevents redundant, repetitive LLM execution fees.
  - Improves client-side page load speed to sub-100ms for cached dates.

### 2.4 Pinned LLM Models
* **Decision:** 
  - **Local Development:** LM Studio running `qwen/qwen2.5-27b-instruct`.
  - **Production/Demo:** FAU Trussed proxy running `cogito:14b`.
* **Rationale:** Instruct-based models behave reliably in JSON mode. "Thinking" models (e.g. Qwen 3.x) return reasoning tags and empty content strings, causing JSON parsing failures.

### 2.5 Auth & RLS Model
* **Decision:** Implement cookie-based JWT token authentication using Next.js Edge Middleware. Enforce strict Postgres RLS policies:
  - Users can read their own renders or any render explicitly set to `is_public = true`.
  - Users can only write/insert renders under their own `user_id`.
  - Users can only delete their own renders.

---

## 3. Assumptions Registry

| Assumption Area | Description & Decision |
| :--- | :--- |
| **Font Geometries** | Terminal monospace fonts are taller than they are wide. To prevent vertical stretching of the ASCII output, we assume a ~2:1 aspect ratio and halve the calculated height relative to the width. |
| **NASA API Stability** | We assume the NASA API might occasionally fail or rate-limit us. We resolve this by caching results and implementing a 7-day walkback loop plus a starry starry night fallback image. |
| **Supabase Client Scope** | The service role key is reserved strictly for database setup and administrative functions. The client browser must interact using the Supabase anonymous key only, filtered by user-specific JWTs. |

---

## 4. Fallback Strategy Summary

If downstream services fail or return malformed/timed-out responses, we apply the following graceful degradation paths:

1. **NASA APOD Media Outage:**
   - *Video type:* Walk back up to 7 days to retrieve a valid image.
   - *Full outage:* Fall back to the pre-rendered starry sky image (`starry.png`) and log `usedFallbackImage: true`.
2. **Style LLM Failure:**
   - Fall back to: `charSet: "standard"`, `density: 0.6`, `invert: false`.
   - Log `aiStyleUsed: false`.
3. **Caption LLM Failure:**
   - Fall back to: `caption` set to the first sentence of the APOD explanation text.
   - `funFact` set to `""` (empty string).
   - Log `aiCaptionUsed: false`.

---

## 5. GitHub Project & Issue Syncing (2026-06-28)
* **Status:** Complete.
* **Findings & Decisions:** 
  - Checked alignment between `IMPLEMENTATION.md` and GitHub issues. Identified a minor consolidation in Phase 2 (Issues 9 and 10 consolidate tasks 2.1-2.4).
  - Investigated GitHub project visibility. The "ASCII Art Studio" project was created under the user namespace `cjb1077` (Project 3) rather than the organization `FAU-AI-HootCamp-Summer-2026` namespace, which is why it wasn't visible in the repository's Projects tab.
  - Programmatically synced and added all 27 open issues to the project board.
  - Noted that the user will need to manually link the personal project to the organization repository via the GitHub Web UI.

---

## 6. Planning Validation & Alignment (2026-06-29)
* **Status:** Complete.
* **Findings & Decisions:**
  - Conducted a comprehensive planning validation check on all specs, plans, and diagrams.
  - Identified a critical discrepancy where the `cached_apods` caching table and query logic were detailed in design specs and sequence diagrams but omitted from `IMPLEMENTATION.md`'s database definition and build plan.
  - Clarified with the user and decided to make caching a core feature of the build plan.
  - Updated `IMPLEMENTATION.md` database schema (Section 8) and task items (Section 9, Phase 3.4 and Phase 5.2) to incorporate the `cached_apods` table, query caching logic, and schema migration step.

---

## 7. Phase 0 — Project Bootstrap (2026-06-29)
* **Status:** Complete (Issues #1, #2, #3, #4 closed).
* **Findings & Decisions:**
  - `create-next-app` cannot scaffold into a non-empty directory. Resolved by scaffolding into a temp `nextjs-scaffold/` subdirectory, copying the generated files (`src/`, `public/`, `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `next-env.d.ts`, `package-lock.json`) into the project root, then removing the temp directory.
  - Package name updated from `nextjs-scaffold` to `monospace-studio`.
  - Added Vitest 3.x + `@vitejs/plugin-react` + `tsx` devDependencies to `package.json`.
  - Created `vitest.config.ts` (node environment, `tests/**/*.{test,spec}.{ts,tsx}` glob, `@/*` alias).
  - Created `tests/smoke.test.ts` — trivial passing assertion to confirm Vitest is wired.
  - `.env.local.example` was already complete and accurate; no changes needed.
  - `.gitignore` was already correct; no changes needed.
* **Verification Results:**
  - `npm test` → 1 passed, 0 failed ✅
  - `npm run build` → compiled and generated static pages successfully ✅
  - `git status` → clean working tree after commit `ef7df68` ✅
* **Commit:** `feat: scaffold Next.js App Router TypeScript app with Vitest (resolves #1, #2, #3)`

---

## 8. Phase 1 — NASA APOD Integration (2026-06-29)
* **Status:** In Progress (Tasks 1.1 and 1.2 Complete).
* **Findings & Decisions:**
  - **Task 1.1 [Issue 5]** Complete. Created `src/lib/types.ts` for interfaces and `src/lib/nasa/apod.ts` containing the custom error classes, date validators, and fetch function. Added a 10s fetch timeout and typed error mappings.
  - Added unit test suite `tests/nasa.test.ts` to fully cover validation and response handling under Vitest.
  - Added CLI smoke test runner `scripts/test-fetch-apod.ts` to test live calls.
  - **Task 1.2 [Issue 6]** Complete. Implemented date walkback logic (up to 7 days) in `fetchApod()` using safe UTC-based date calculations. Created a default starry sky image asset `/public/starry.png` (from a custom generated asset) to serve as a high-quality visual placeholder if walkback limit is exceeded or earliest date (1995-06-16) is crossed.
  - Added 3 new unit tests in `tests/nasa.test.ts` asserting:
    1. Walkback correctly finds the first image day when encountering videos.
    2. Fallback values with `usedFallbackImage: true` are returned if 7 attempts are exceeded.
    3. Walkback stops and returns fallback if date decrements past the launch date `1995-06-16`.
* **Verification Results:**
  - `npx vitest tests/nasa.test.ts --run` → 15 tests passed ✅
  - `npx tsx scripts/test-fetch-apod.ts` (with NASA DEMO_KEY) → Live APOD details fetched and logged successfully ✅

  - **Task 1.3 [Issue 7]** Complete. Implemented `downloadImage(url)` in `src/lib/nasa/apod.ts` using native `fetch` with `AbortController` (10s timeout) and content-type validation (requiring `image/`). Added 4 corresponding unit tests to `tests/nasa.test.ts` covering successful download, invalid content-type, non-200 HTTP statuses, and timeouts.
* **Verification Results:**
  - `npx vitest tests/nasa.test.ts --run` → 18 tests passed (including 4 new downloadImage tests) ✅
  - `npx vitest --run` → 19 tests passed ✅
