import { NasaApodResponse, ErrorCode } from "../types";

export class ApodError extends Error {
  constructor(message: string, public code: ErrorCode, public status: number = 400) {
    super(message);
    this.name = "ApodError";
  }
}

export async function withNasaRetry<T>(fn: () => Promise<T>): Promise<T> {
  // 403: science.nasa.gov's bot protection intermittently challenges bursts
  const RETRYABLE_STATUS = new Set([403, 429, 502, 503, 504]);
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

export function validateDate(dateStr: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new ApodError("Invalid date format. Expected YYYY-MM-DD.", "BAD_DATE", 400);
  }
  const parsedDate = new Date(dateStr + "T00:00:00");
  if (isNaN(parsedDate.getTime())) {
    throw new ApodError("Invalid date.", "BAD_DATE", 400);
  }
  const earliest = new Date("1995-06-16T00:00:00");
  if (parsedDate < earliest) {
    throw new ApodError("Date must be on or after 1995-06-16.", "BAD_DATE", 400);
  }
  
  // Get current date in US Eastern Time
  const todayStr = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  const todayDateObj = new Date(todayStr);
  const todayYear = todayDateObj.getFullYear();
  const todayMonth = String(todayDateObj.getMonth() + 1).padStart(2, "0");
  const todayDay = String(todayDateObj.getDate()).padStart(2, "0");
  const todayStrFormatted = `${todayYear}-${todayMonth}-${todayDay}`;
  const todayDate = new Date(todayStrFormatted + "T00:00:00");

  if (parsedDate > todayDate) {
    throw new ApodError("Date cannot be in the future.", "BAD_DATE", 400);
  }
}

function decrementDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// NASA moved APOD from api.nasa.gov/planetary/apod to a WordPress REST endpoint
// (no API key). Entries are addressable by YYMMDD id; with no id the list is
// returned newest-first.
const APOD_BASE_URL = "https://science.nasa.gov/wp-json/wp/v2/apod-basic";
const APOD_TIMEOUT_MS = 20000; // the endpoint regularly takes 10-18s uncached

interface RawApodEntry {
  date?: string;
  title?: string;
  explanation?: string;
  media_type?: string;
  copyright?: string;
  url?: string;
  hdurl?: string;
}

function toYymmdd(dateStr: string): string {
  return dateStr.slice(2).replace(/-/g, "");
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

function htmlToText(html: string): string {
  // Block-level breaks become spaces; inline tags (links, emphasis) vanish so
  // punctuation stays attached to the word before it.
  const text = html.replace(/<(br|\/p|\/div)\b[^>]*>/gi, " ").replace(/<[^>]*>/g, "");
  return decodeEntities(text).replace(/\s+/g, " ").trim();
}

/**
 * Maps a science.nasa.gov entry onto the NasaApodResponse shape the rest of the
 * app already uses. `explanation` is HTML there (with a leading "Explanation:"
 * label and a trailing "Tomorrow's picture" teaser), and the image file is in
 * `hdurl` — `url` is the article page.
 */
function normalizeApod(raw: RawApodEntry): NasaApodResponse {
  const explanationHtml = (raw.explanation ?? "").split(/<br\s*\/?>\s*<br\s*\/?>\s*<strong>\s*Tomorrow/i)[0];
  const explanation = htmlToText(explanationHtml).replace(/^Explanation:\s*/i, "");
  const title = htmlToText(raw.title ?? "");
  const isImage = raw.media_type === "image";
  const url = isImage ? raw.hdurl ?? "" : raw.url ?? "";

  if (!raw.date || !title || !explanation || !raw.media_type || !url) {
    throw new ApodError("Incomplete response from NASA APOD API.", "NASA_DOWN", 502);
  }

  const copyright = raw.copyright ? htmlToText(raw.copyright) : undefined;
  return {
    date: raw.date,
    title,
    explanation,
    media_type: raw.media_type,
    url,
    ...(copyright ? { copyright } : {}),
    service_version: "v1",
  };
}

export async function fetchApod(date?: string): Promise<NasaApodResponse> {
  if (date) {
    validateDate(date);
  }

  let currentDate = date;
  let attempts = 0;
  const maxAttempts = 8; // Initial + 7 walkback attempts
  let originalRequestedDate = date;

  while (attempts < maxAttempts) {
    const url = currentDate
      ? `${APOD_BASE_URL}/${toYymmdd(currentDate)}`
      : `${APOD_BASE_URL}?per_page=1`;

    if (attempts > 0) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const data = await withNasaRetry(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), APOD_TIMEOUT_MS);
      try {
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        clearTimeout(timeoutId);

        if (res.status === 429) {
          throw new ApodError("NASA API rate limit exceeded.", "NASA_RATE_LIMIT", 429);
        }

        if (res.status === 404 && currentDate) {
          throw new ApodError(`No APOD found for ${currentDate}.`, "NOT_FOUND", 404);
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
          } catch {
            // ignore JSON parsing errors for error bodies
          }
          throw new ApodError(errMsg, "NASA_DOWN", res.status);
        }

        const body = (await res.json()) as RawApodEntry | RawApodEntry[];
        const entry = Array.isArray(body) ? body[0] : body;
        if (!entry) {
          throw new ApodError("Incomplete response from NASA APOD API.", "NASA_DOWN", 502);
        }
        return normalizeApod(entry);
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

    // Stop if we decrement before the earliest allowed date
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


