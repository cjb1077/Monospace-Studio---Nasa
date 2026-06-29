# Design Spec: Project README and NOTES.md Setup

**Date:** 2026-06-28  
**Status:** Under Review  
**Author:** AI Pair Programmer (Antigravity)

---

## 1. Goal
The goal of this task is to create the core documentation files `README.md` and `NOTES.md` in the workspace root, as required by the project specifications in [AGENTS.md](file:///d:/AI%20Bootcamp/week3-cjb1077/AGENTS.md). 

These documents will establish:
1. The developer setup guide, environment variable definitions, and CLI execution instructions.
2. Complete documentation of the API contracts (endpoints, parameters, responses, and error shapes).
3. AI feature details, prompts, fallback mechanisms, and token cost estimations.
4. An initial project log, assumptions registry, and key design decisions in `NOTES.md`.

---

## 2. Proposed Changes

### [README.md](file:///d:/AI%20Bootcamp/week3-cjb1077/README.md) [NEW]
A comprehensive single-file developer guide located in the project root containing:
* **Overview:** Description of the ASCII Art Studio app architecture.
* **Setup Guide:** Local installation, database setup, and LM Studio/Trussed instructions.
* **Environment Variables:** Documenting `NASA_API_KEY`, Supabase credentials, and LLM configuration keys.
* **AI Features:** Detailed explanation of Style Direction and Themed Captions, validation constraints, and retry mechanics.
* **API Cost Estimates:** A structured section showing why local/course proxies are $0, but also detailing the token count math and formula for paid OpenAI-compatible endpoints.
* **API Endpoint Docs:** Documenting all API routes (`/api/apod`, `/api/renders`, `/api/renders/[id]`) with request/response shapes, headers, and error codes.
* **Testing:** How to run unit and integration tests.
* **Demo Video Link:** A placeholder for the demo walkthrough.

### [NOTES.md](file:///d:/AI%20Bootcamp/week3-cjb1077/NOTES.md) [NEW]
A running developer log located in the project root containing:
* **Decision Log:** Tracking architectural decisions like decoupled SOA, text-only style inputs, and db-level caching.
* **Assumptions Registry:** Documenting assumptions around rate limits, JWT auth, and image processing aspect ratios.
* **Fallback Strategy Summary:** Log of default values used when external APIs are offline or return malformed JSON.

---

## 3. Verification Plan
* Validate that both files are written to the workspace root.
* Perform a self-review check to ensure no incomplete sections or placeholders exist (except for the explicitly noted demo video link).
* Commit both files to git.
