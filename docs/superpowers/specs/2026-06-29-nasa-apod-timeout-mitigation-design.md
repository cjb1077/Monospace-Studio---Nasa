# Design Spec: NASA APOD API Timeout Mitigation

## Overview
Users experience timeouts or API unavailability when requesting random APOD dates in rapid succession (back-to-back clicks). This is caused by:
1. Client-side navigation triggers without throttling, spamming requests to `/api/apod`.
2. The server-side walkback loop executing multiple rapid API calls to NASA without delays.
3. NASA rate limits (429) or transient server load causing errors that fail immediately without retries.

This document describes the design to mitigate timeouts using:
- Client-side navigation button cooldown.
- Server-side walkback throttling.
- Server-side NASA API request retries with exponential backoff.

---

## Detailed Design

### 1. Client-Side Button Cooldown
We will implement an `isCooldown` state in `src/app/page.tsx` that triggers when any date-changing navigation control is clicked:
- When a fetch starts, set `isCooldown` to `true`.
- Start a timer to set `isCooldown` to `false` after **1500ms**.
- Disable all navigation buttons (Yesterday, Today, Random, and Flanking Steppers ◀ / ▶) while `loading || isCooldown` is true.

This client-side change guarantees that a user cannot submit another request for at least 1.5 seconds, even if the current request finishes instantly (e.g., from cache or quick errors).

### 2. Server-Side Walkback Throttling
In `src/lib/nasa/apod.ts`, during the walkback loop inside `fetchApod()`, when a non-image (e.g. video) day or failure triggers a walkback to the previous day:
- We will insert a **500ms** delay before triggering the next `fetch()` request.
- This prevents hitting NASA's servers with up to 8 back-to-back requests in a split second.

### 3. Server-Side NASA API Retry with Backoff
In `src/lib/nasa/apod.ts`, we will implement a retry helper `withNasaRetry()` similar to `withRetry()` in `src/lib/llm/chat.ts`:
- Catches rate limiting (`429`) and server errors (`502`, `503`, `504`).
- Retries up to **3 times** with exponential backoff (e.g., 500ms on first retry, 1000ms on second, 2000ms on third).
- Utilized by both `fetchApod()` (each individual fetch attempt) and `downloadImage()`.

---

## Proposed Changes

### [MODIFY] [apod.ts](file:///d:/AI/Bootcamp/week3-cjb1077/src/lib/nasa/apod.ts)
- Add `withNasaRetry()` utility.
- Refactor `fetchApod()` individual fetch execution to use `withNasaRetry()`.
- Add a 500ms delay in the walkback loop after the first attempt.
- Refactor `downloadImage()` execution to use `withNasaRetry()`.

### [MODIFY] [page.tsx](file:///d:/AI/Bootcamp/week3-cjb1077/src/app/page.tsx)
- Add `isCooldown` state.
- Set `isCooldown` to `true` inside `fetchApodData()`, clearing it after a 1.5s timeout.
- Update navigation and submit buttons to disable when `loading || isCooldown` is true.

---

## Verification Plan

### Automated Tests
- Run existing NASA and API unit tests:
  ```powershell
  npx vitest tests/nasa.test.ts --run
  npx vitest tests/api-apod.test.ts --run
  ```
- Add unit tests verifying `withNasaRetry` behavior and throttling.

### Manual Verification
- Run Next.js server locally and click the Random button. Verify the button stays disabled for at least 1.5 seconds, even if the API responds faster or fails.
- Verify walkback delay handles non-image days properly without causing errors.
- Confirm console logs do not show any unhandled errors.
