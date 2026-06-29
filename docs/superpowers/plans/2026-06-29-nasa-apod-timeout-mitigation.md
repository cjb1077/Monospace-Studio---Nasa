# NASA APOD Timeout Mitigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent NASA APOD API timeouts and availability failures on rapid back-to-back requests by adding a client-side button cooldown (1.5s), a server-side walkback request throttle (500ms delay), and server-side request retries with exponential backoff on transient errors.

**Architecture:** 
- Add `withNasaRetry()` helper to `src/lib/nasa/apod.ts` to retry on 429, 502, 503, 504 errors up to 3 times.
- Update `fetchApod()` and `downloadImage()` to execute API calls through `withNasaRetry()`.
- Add a 500ms throttle delay in the walkback loop of `fetchApod()`.
- Add `isCooldown` state in `src/app/page.tsx` that keeps navigation buttons disabled for 1.5 seconds after a request is initiated.

**Tech Stack:** Next.js App Router, TypeScript, Vitest

## Global Constraints
- Keep changes scoped to the current task. Don't expand scope or refactor unrelated code.
- Commit per completed task with a message referencing the task description.
- Trim text sent to the LLM. Cap NASA APOD explanation at 1,500 characters (already implemented).
- Every external call is wrapped with try/catch, timeout, and a typed result (already implemented, we are enhancing this).

---

### Task 1: Implement `withNasaRetry` Helper and Tests

**Files:**
- Modify: `src/lib/nasa/apod.ts`
- Modify: `tests/nasa.test.ts`

**Interfaces:**
- Produces: `withNasaRetry<T>(fn: () => Promise<T>): Promise<T>` - retry helper function with backoff.

- [ ] **Step 1: Add tests for `withNasaRetry` in `tests/nasa.test.ts`**
  Add unit tests asserting:
  - `withNasaRetry` succeeds immediately if the function resolves on first attempt.
  - `withNasaRetry` retries on rate limits (429) and gateway errors (502, 503, 504) and succeeds if a later attempt resolves.
  - `withNasaRetry` propagates non-retryable errors (e.g. 400 Bad Request) immediately without retrying.
  - `withNasaRetry` fails and propagates the last error if all 3 attempts fail.
  
  Test code to append to `tests/nasa.test.ts`:
  ```typescript
  describe("withNasaRetry", () => {
    it("should succeed immediately on success", async () => {
      let calls = 0;
      const result = await (withNasaRetry as any)(async () => {
        calls++;
        return "success";
      });
      expect(result).toBe("success");
      expect(calls).toBe(1);
    });

    it("should retry on 429/502/503/504 and succeed if later attempt succeeds", async () => {
      let calls = 0;
      const result = await (withNasaRetry as any)(async () => {
        calls++;
        if (calls < 2) {
          throw new ApodError("Rate limit", "NASA_RATE_LIMIT", 429);
        }
        return "recovered";
      });
      expect(result).toBe("recovered");
      expect(calls).toBe(2);
    });

    it("should propagate non-retryable errors immediately", async () => {
      let calls = 0;
      await expect(
        (withNasaRetry as any)(async () => {
          calls++;
          throw new ApodError("Bad request", "BAD_DATE", 400);
        })
      ).rejects.toThrow("Bad request");
      expect(calls).toBe(1);
    });
  });
  ```

- [ ] **Step 2: Run vitest to verify new tests fail**
  Run: `npx vitest tests/nasa.test.ts --run`
  Expected: Failure indicating `withNasaRetry` is not defined.

- [ ] **Step 3: Implement `withNasaRetry` in `src/lib/nasa/apod.ts`**
  Add implementation at the top of `src/lib/nasa/apod.ts`:
  ```typescript
  async function withNasaRetry<T>(fn: () => Promise<T>): Promise<T> {
    const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);
    const MAX_ATTEMPTS = 3;
    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        lastError = err;
        const status = err instanceof ApodError ? err.status : (err as { status?: number })?.status;
        if (status !== undefined && RETRYABLE_STATUS.has(status)) {
          const wait = 500 * Math.pow(2, attempt); // 500ms, 1000ms, 2000ms
          await new Promise((resolve) => setTimeout(resolve, wait));
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  }
  ```
  Make sure to export `withNasaRetry` temporarily or test it locally within the module scope.

- [ ] **Step 4: Run vitest to verify retry tests pass**
  Run: `npx vitest tests/nasa.test.ts --run`
  Expected: All tests pass.

- [ ] **Step 5: Commit changes**
  Run: `git add src/lib/nasa/apod.ts tests/nasa.test.ts`
  Run: `git commit -m "feat: implement withNasaRetry helper and unit tests"`

---

### Task 2: Refactor `fetchApod()` and `downloadImage()` and Implement Walkback Delay

**Files:**
- Modify: `src/lib/nasa/apod.ts`

**Interfaces:**
- Consumes: `withNasaRetry` helper.

- [ ] **Step 1: Refactor `fetchApod()` and `downloadImage()`**
  Update `fetchApod` to use the helper. Refactor the inner fetch code into a separate helper or inline within `withNasaRetry`:
  ```typescript
  export async function fetchApod(date?: string): Promise<NasaApodResponse> {
    const apiKey = process.env.NASA_API_KEY;
    if (!apiKey) {
      throw new ApodError("NASA_API_KEY is not configured.", "SERVER", 500);
    }

    if (date) {
      validateDate(date);
    }

    let currentDate = date;
    let attempts = 0;
    const maxAttempts = 8;
    let originalRequestedDate = date;

    while (attempts < maxAttempts) {
      let url = `https://api.nasa.gov/planetary/apod?api_key=${apiKey}`;
      if (currentDate) {
        url += `&date=${currentDate}`;
      }

      // Add a 500ms walkback throttle delay for attempts > 0
      if (attempts > 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      const data = await withNasaRetry(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
        try {
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (res.status === 429) {
            throw new ApodError("NASA API rate limit exceeded.", "NASA_RATE_LIMIT", 429);
          }

          if (!res.ok) {
            let errMsg = `NASA API error: ${res.statusText}`;
            try {
              const errorData = await res.json();
              if (errorData.msg) {
                errMsg = errorData.msg;
              } else if (errorData.error?.message) {
                errMsg = errorData.error.message;
              }
            } catch {}
            throw new ApodError(errMsg, "NASA_DOWN", res.status);
          }

          const parsed = await res.json() as NasaApodResponse;
          if (!parsed.url || !parsed.title || !parsed.explanation || !parsed.media_type) {
            throw new ApodError("Incomplete response from NASA APOD API.", "NASA_DOWN", 502);
          }
          return parsed;
        } catch (error: any) {
          clearTimeout(timeoutId);
          if (error instanceof ApodError) {
            throw error;
          }
          if (error.name === "AbortError") {
            throw new ApodError("NASA APOD API request timed out.", "NASA_DOWN", 504);
          }
          throw new ApodError(error.message || "Failed to contact NASA APOD API.", "NASA_DOWN", 502);
        }
      });

      if (!originalRequestedDate) {
        originalRequestedDate = data.date;
      }

      if (data.media_type === "image") {
        return data;
      }

      attempts++;
      if (attempts >= maxAttempts) {
        break;
      }

      currentDate = decrementDate(data.date);

      const earliest = new Date("1995-06-16T00:00:00");
      const parsedCurrent = new Date(currentDate + "T00:00:00");
      if (parsedCurrent < earliest) {
        break;
      }
    }

    return {
      date: originalRequestedDate || new Date().toISOString().split("T")[0],
      title: "Default Starry Sky",
      explanation: "NASA APOD did not return a valid image within the walkback period. Showing default starry sky visualization.",
      media_type: "image",
      url: "/starry.png",
      service_version: "v1",
      usedFallbackImage: true,
    };
  }
  ```

  Update `downloadImage` in `src/lib/nasa/apod.ts`:
  ```typescript
  export async function downloadImage(url: string): Promise<Buffer> {
    return withNasaRetry(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!res.ok) {
          throw new ApodError(`Image download failed with status ${res.status}: ${res.statusText}`, "NASA_DOWN", res.status);
        }

        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.startsWith("image/")) {
          throw new ApodError(`Invalid image content type: ${contentType || "unknown"}.`, "NASA_DOWN", 502);
        }

        const arrayBuffer = await res.arrayBuffer();
        return Buffer.from(arrayBuffer);
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error instanceof ApodError) {
          throw error;
        }
        if (error.name === "AbortError") {
          throw new ApodError("NASA APOD API request timed out.", "NASA_DOWN", 504);
        }
        throw new ApodError(error.message || "Failed to download image from NASA.", "NASA_DOWN", 502);
      }
    });
  }
  ```

- [ ] **Step 2: Run all vitest suites to confirm no regressions**
  Run: `npx vitest --run`
  Expected: All tests pass.

- [ ] **Step 3: Commit changes**
  Run: `git add src/lib/nasa/apod.ts`
  Run: `git commit -m "feat: refactor fetchApod and downloadImage to use retries and add walkback throttle"`

---

### Task 3: Client-Side UI Cooldown Throttling

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add `isCooldown` state in `src/app/page.tsx`**
  At the top of the Home component:
  ```typescript
  const [isCooldown, setIsCooldown] = useState(false);
  ```

- [ ] **Step 2: Trigger cooldown state in `fetchApodData`**
  Inside `fetchApodData` at `src/app/page.tsx`, set the cooldown:
  ```typescript
  const fetchApodData = async (targetDate: string, overrides: AsciiStyle | null) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setIsCooldown(true); // Start cooldown
    setError(null);

    // Clear cooldown after 1500ms
    setTimeout(() => {
      setIsCooldown(false);
    }, 1500);

    try {
      let url = `/api/apod?date=${targetDate}`;
  ```

- [ ] **Step 3: Update button elements to use cooldown state**
  In the UI code in `src/app/page.tsx`:
  - `Prev Day` button: `disabled={loading || isCooldown || isMinDate}`
  - `Next Day` button: `disabled={loading || isCooldown || isToday}`
  - `📅 Today` button: `disabled={loading || isCooldown || isToday}`
  - `⬅️ Yesterday` button: `disabled={loading || isCooldown || isMinDate}`
  - `🎲 Random` button: `disabled={loading || isCooldown}`
  - `Generate Cosmic Art` submit button: `disabled={loading || isCooldown}`

- [ ] **Step 4: Verify Next.js build succeeds**
  Run: `npm run build`
  Expected: Build finishes cleanly.

- [ ] **Step 5: Run all tests to make sure client components or tests aren't broken**
  Run: `npx vitest --run`
  Expected: All tests pass.

- [ ] **Step 6: Commit changes**
  Run: `git add src/app/page.tsx`
  Run: `git commit -m "feat: implement client-side UI cooldown for navigation buttons"`
