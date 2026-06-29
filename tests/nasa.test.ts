import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchApod, ApodError } from "../src/lib/nasa/apod";

describe("NASA APOD API integration", () => {
  const originalApiKey = process.env.NASA_API_KEY;
  const originalFetch = global.fetch;
  const mockFetch = vi.fn();

  beforeEach(() => {
    process.env.NASA_API_KEY = "test_api_key";
    global.fetch = mockFetch;
  });

  afterEach(() => {
    process.env.NASA_API_KEY = originalApiKey;
    global.fetch = originalFetch;
    mockFetch.mockReset();
  });

  describe("API Key check", () => {
    it("should throw a SERVER error if NASA_API_KEY is not configured", async () => {
      delete process.env.NASA_API_KEY;
      await expect(fetchApod()).rejects.toThrowError(
        new ApodError("NASA_API_KEY is not configured.", "SERVER", 500)
      );
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
        json: async () => ({
          date: "2023-01-01",
          title: "Test APOD Title",
          explanation: "Test APOD Explanation text.",
          media_type: "image",
          url: "https://example.com/image.jpg",
          service_version: "v1",
        }),
      });

      const data = await fetchApod("2023-01-01");
      expect(data.date).toBe("2023-01-01");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.nasa.gov/planetary/apod?api_key=test_api_key&date=2023-01-01",
        expect.any(Object)
      );
    });
  });

  describe("API Fetch and Error Handling", () => {
    it("should parse and return valid image APOD response", async () => {
      const mockResponse = {
        date: "2026-06-28",
        title: "The Stars Above",
        explanation: "Beautiful view of the starry sky.",
        media_type: "image",
        url: "https://example.com/apod.jpg",
        copyright: "NASA",
        service_version: "v1",
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await fetchApod("2026-06-28");
      expect(result).toEqual(mockResponse);
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
          json: async () => ({
            date: "2026-06-28",
            title: "Space Video",
            explanation: "Some explanation",
            media_type: "video",
            url: "https://example.com/video.mp4",
            service_version: "v1",
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            date: "2026-06-27",
            title: "Space Image",
            explanation: "Beautiful space image explanation",
            media_type: "image",
            url: "https://example.com/image.png",
            service_version: "v1",
          }),
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
          json: async () => ({
            date: `2026-06-${28 - i}`,
            title: `Video Day ${i}`,
            explanation: "Prose explaining video",
            media_type: "video",
            url: "https://example.com/video.mp4",
            service_version: "v1",
          }),
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
          json: async () => ({
            date: "1995-06-17",
            title: "Early Video 1",
            explanation: "Some early video",
            media_type: "video",
            url: "https://example.com/video.mp4",
            service_version: "v1",
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            date: "1995-06-16",
            title: "Early Video 2",
            explanation: "Some early video",
            media_type: "video",
            url: "https://example.com/video.mp4",
            service_version: "v1",
          }),
        });

      const result = await fetchApod("1995-06-17");
      expect(result.title).toBe("Default Starry Sky");
      expect(result.usedFallbackImage).toBe(true);
      expect(result.date).toBe("1995-06-17");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
