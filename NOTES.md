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
