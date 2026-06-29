# Image Downloader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `downloadImage(url)` server-side function in `src/lib/nasa/apod.ts` with timeout (10s) and content-type validation, and verify it via automated unit tests.

**Architecture:** Use native `fetch` with `AbortController` on the server, check `res.ok`, validate content-type headers, retrieve response as `arrayBuffer`, and return as `Buffer.from(arrayBuffer)`.

**Tech Stack:** Node.js, Next.js (App Router / TypeScript), Vitest.

## Global Constraints
- All external calls must happen server-side; keys must never reach the client.
- The `downloadImage` function must handle timeouts (10s limit) and throw typed `ApodError`s on failure.
- If content-type is missing or not an image type, throw `ApodError` with code `NASA_DOWN` and status `502`.
- If fetch fails or status is not ok, throw `ApodError` with code `NASA_DOWN` and status mapping to the HTTP status.

---

### Task 1: Add Unit Tests for `downloadImage` in `tests/nasa.test.ts`

**Files:**
- Modify: [nasa.test.ts](file:///d:/AI%20Bootcamp/week3-cjb1077/tests/nasa.test.ts#L248-L250)

**Interfaces:**
- Consumes: None.
- Produces: Mocks and assertions for `downloadImage` behavior.

- [ ] **Step 1: Write the failing tests**
  Add a new `describe("downloadImage", ...)` suite at the end of `tests/nasa.test.ts` (importing `downloadImage` from `../src/lib/nasa/apod`):
  
  ```typescript
  import { fetchApod, ApodError, downloadImage } from "../src/lib/nasa/apod"; // Update imports at the top
  ```

  And add tests:
  ```typescript
  describe("downloadImage", () => {
    const originalFetch = global.fetch;
    const mockFetch = vi.fn();

    beforeEach(() => {
      global.fetch = mockFetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
      mockFetch.mockReset();
    });

    it("should successfully download an image and return a Buffer", async () => {
      const mockBuffer = Buffer.from("fake-image-bytes");
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "image/jpeg" }),
        arrayBuffer: async () => mockBuffer.buffer,
      });

      const buffer = await downloadImage("https://example.com/starry.jpg");
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.toString()).toBe("fake-image-bytes");
    });

    it("should throw an ApodError with code NASA_DOWN and status 502 if response content-type is invalid", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
      });

      await expect(downloadImage("https://example.com/not-an-image.html")).rejects.toThrowError(
        new ApodError("Invalid image content type: text/html.", "NASA_DOWN", 502)
      );
    });

    it("should throw an ApodError with code NASA_DOWN and the HTTP status if status is not ok", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      await expect(downloadImage("https://example.com/missing.jpg")).rejects.toThrowError(
        new ApodError("Image download failed with status 404: Not Found.", "NASA_DOWN", 404)
      );
    });

    it("should throw an ApodError with code NASA_DOWN and status 504 on timeout (AbortError)", async () => {
      const abortError = new Error("The user aborted a request.");
      abortError.name = "AbortError";
      mockFetch.mockRejectedValue(abortError);

      await expect(downloadImage("https://example.com/timeout.jpg")).rejects.toThrowError(
        new ApodError("NASA APOD API request timed out.", "NASA_DOWN", 504)
      );
    });
  });
  ```

- [ ] **Step 2: Run tests to verify they fail**
  Run: `npx vitest tests/nasa.test.ts --run`
  Expected: Compile error because `downloadImage` is not defined/exported.

- [ ] **Step 3: Add minimal export stub in `src/lib/nasa/apod.ts`**
  Add the following stub to `src/lib/nasa/apod.ts`:
  ```typescript
  export async function downloadImage(url: string): Promise<Buffer> {
    throw new Error("Not implemented");
  }
  ```

- [ ] **Step 4: Run tests again to verify they fail dynamically**
  Run: `npx vitest tests/nasa.test.ts --run`
  Expected: FAIL with "Not implemented" or assertion failure.

- [ ] **Step 5: Implement `downloadImage` in `src/lib/nasa/apod.ts`**
  ```typescript
  export async function downloadImage(url: string): Promise<Buffer> {
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
  }
  ```

- [ ] **Step 6: Run tests to verify they pass**
  Run: `npx vitest tests/nasa.test.ts --run`
  Expected: PASS all 19 tests.

- [ ] **Step 7: Commit changes**
  Run `git add tests/nasa.test.ts src/lib/nasa/apod.ts`
  Run `git commit -m "feat: implement and verify downloadImage function (resolves #7)"`
