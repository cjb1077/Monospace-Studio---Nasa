import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchApod, ApodError, downloadImage, withNasaRetry } from "../src/lib/nasa/apod";

/** Builds a science.nasa.gov apod-basic entry (image file lives in hdurl). */
function nasaEntry(overrides: Record<string, unknown> = {}) {
  return {
    date: "2023-01-01",
    title: "Test APOD Title",
    explanation:
      "<strong>Explanation:</strong> Test APOD <a href=\"https://example.com\">explanation</a> text.<br><br><strong>Tomorrow's picture: </strong>Something else",
    media_type: "image",
    url: "https://science.nasa.gov/image-article/apod-test/",
    hdurl: "https://assets.science.nasa.gov/test.jpg?w=1600",
    ...overrides,
  };
}

describe("NASA APOD API integration", () => {
  const originalFetch = global.fetch;
  const mockFetch = vi.fn();

  beforeEach(() => {
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    mockFetch.mockReset();
  });

  describe("withNasaRetry", () => {
    it("should succeed immediately on success", async () => {
      let calls = 0;
      const result = await withNasaRetry(async () => {
        calls++;
        return "success";
      });
      expect(result).toBe("success");
      expect(calls).toBe(1);
    });

    it("should retry on 429/502/503/504 and succeed if later attempt succeeds", async () => {
      let calls = 0;
      const result = await withNasaRetry(async () => {
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
        withNasaRetry(async () => {
          calls++;
          throw new ApodError("Bad request", "BAD_DATE", 400);
        })
      ).rejects.toThrow("Bad request");
      expect(calls).toBe(1);
    });
  });

  describe("Date validation", () => {
    it("should throw a BAD_DATE error for invalid date format", async () => {
      await expect(fetchApod("2026-6-28")).rejects.toThrowError(
        new ApodError("Invalid date format. Expected YYYY-MM-DD.", "BAD_DATE", 400)
      );
      await expect(fetchApod("not-a-date")).rejects.toThrowError(
        new ApodError("Invalid date format. Expected YYYY-MM-DD.", "BAD_DATE", 400)
      );
    });

    it("should throw a BAD_DATE error for out-of-range dates (before earliest date)", async () => {
      await expect(fetchApod("1995-06-15")).rejects.toThrowError(
        new ApodError("Date must be on or after 1995-06-16.", "BAD_DATE", 400)
      );
    });

    it("should throw a BAD_DATE error for future dates", async () => {
      await expect(fetchApod("2050-01-01")).rejects.toThrowError(
        new ApodError("Date cannot be in the future.", "BAD_DATE", 400)
      );
    });

    it("should allow valid dates in range", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => nasaEntry(),
      });

      const data = await fetchApod("2023-01-01");
      expect(data.date).toBe("2023-01-01");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://science.nasa.gov/wp-json/wp/v2/apod-basic/230101",
        expect.any(Object)
      );
    });
  });

  describe("API Fetch and Error Handling", () => {
    it("should parse and return valid image APOD response", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () =>
          nasaEntry({
            date: "2026-06-28",
            title: "The Stars &amp; Above",
            copyright: "<a href=\"https://example.com\">NASA</a>",
          }),
      });

      const result = await fetchApod("2026-06-28");
      expect(result).toEqual({
        date: "2026-06-28",
        title: "The Stars & Above",
        explanation: "Test APOD explanation text.",
        media_type: "image",
        url: "https://assets.science.nasa.gov/test.jpg?w=1600",
        copyright: "NASA",
        service_version: "v1",
      });
    });

    it("should request the newest entry when no date is given and unwrap the list", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [nasaEntry({ date: "2026-10-15" })],
      });

      const result = await fetchApod();
      expect(result.date).toBe("2026-10-15");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://science.nasa.gov/wp-json/wp/v2/apod-basic?per_page=1",
        expect.any(Object)
      );
    });

    it("should throw NOT_FOUND when NASA has no entry for the requested date", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      await expect(fetchApod("2023-01-01")).rejects.toMatchObject({
        code: "NOT_FOUND",
        status: 404,
      });
    });

    it("should retry a transient 403 bot challenge and then succeed", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 403, statusText: "Forbidden" })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => nasaEntry() });

      const result = await fetchApod("2023-01-01");
      expect(result.title).toBe("Test APOD Title");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should throw a NASA_RATE_LIMIT error on 429 status code", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
      });

      await expect(fetchApod()).rejects.toThrowError(
        new ApodError("NASA API rate limit exceeded.", "NASA_RATE_LIMIT", 429)
      );
    });

    it("should parse NASA error messages if returned from the API", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({
          msg: "Custom NASA error message",
        }),
      });

      await expect(fetchApod()).rejects.toThrowError(
        new ApodError("Custom NASA error message", "NASA_DOWN", 400)
      );
    });

    it("should throw a NASA_DOWN error if properties are missing in response", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          title: "Only Title",
        }),
      });

      await expect(fetchApod()).rejects.toThrowError(
        new ApodError("Incomplete response from NASA APOD API.", "NASA_DOWN", 502)
      );
    });

    it("should handle network level fetch failures gracefully", async () => {
      mockFetch.mockRejectedValue(new Error("Network connection failed"));

      await expect(fetchApod()).rejects.toThrowError(
        new ApodError("Network connection failed", "NASA_DOWN", 502)
      );
    });

    it("should handle fetch timeouts gracefully", async () => {
      const abortError = new Error("The user aborted a request.");
      abortError.name = "AbortError";
      mockFetch.mockRejectedValue(abortError);

      await expect(fetchApod()).rejects.toThrowError(
        new ApodError("NASA APOD API request timed out.", "NASA_DOWN", 504)
      );
    });
  });

  describe("Date Walkback and Fallbacks", () => {
    it("should walk back to find a valid image when media_type is video", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () =>
            nasaEntry({ date: "2026-06-28", title: "Space Video", media_type: "video", hdurl: "" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => nasaEntry({ date: "2026-06-27", title: "Space Image" }),
        });

      const result = await fetchApod("2026-06-28");
      expect(result.date).toBe("2026-06-27");
      expect(result.media_type).toBe("image");
      expect(result.title).toBe("Space Image");
      expect(result.usedFallbackImage).toBeUndefined();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should return fallback starry image after 7 walkback attempts", async () => {
      for (let i = 0; i < 8; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () =>
              nasaEntry({ date: `2026-06-${28 - i}`, title: `Video Day ${i}`, media_type: "video", hdurl: "" }),
        });
      }

      const result = await fetchApod("2026-06-28");
      expect(result.title).toBe("Default Starry Sky");
      expect(result.usedFallbackImage).toBe(true);
      expect(result.date).toBe("2026-06-28");
      expect(mockFetch).toHaveBeenCalledTimes(8);
    });

    it("should stop walkback and return fallback starry image if earliest date reached", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () =>
            nasaEntry({ date: "1995-06-17", title: "Early Video 1", media_type: "video", hdurl: "" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () =>
            nasaEntry({ date: "1995-06-16", title: "Early Video 2", media_type: "video", hdurl: "" }),
        });

      const result = await fetchApod("1995-06-17");
      expect(result.title).toBe("Default Starry Sky");
      expect(result.usedFallbackImage).toBe(true);
      expect(result.date).toBe("1995-06-17");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

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
        arrayBuffer: async () => mockBuffer.buffer.slice(mockBuffer.byteOffset, mockBuffer.byteOffset + mockBuffer.byteLength),
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
        new ApodError("Image download failed with status 404: Not Found", "NASA_DOWN", 404)
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
});
