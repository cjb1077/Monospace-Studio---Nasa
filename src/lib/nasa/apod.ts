import { NasaApodResponse, ErrorCode } from "../types";

export class ApodError extends Error {
  constructor(message: string, public code: ErrorCode, public status: number = 400) {
    super(message);
    this.name = "ApodError";
  }
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

export async function fetchApod(date?: string): Promise<NasaApodResponse> {
  const apiKey = process.env.NASA_API_KEY;
  if (!apiKey) {
    throw new ApodError("NASA_API_KEY is not configured.", "SERVER", 500);
  }

  if (date) {
    validateDate(date);
  }

  let url = `https://api.nasa.gov/planetary/apod?api_key=${apiKey}`;
  if (date) {
    url += `&date=${date}`;
  }

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
      } catch {
        // ignore JSON parsing errors for error bodies
      }
      throw new ApodError(errMsg, "NASA_DOWN", res.status);
    }

    const data = await res.json() as NasaApodResponse;
    if (!data.url || !data.title || !data.explanation || !data.media_type) {
      throw new ApodError("Incomplete response from NASA APOD API.", "NASA_DOWN", 502);
    }

    return data;
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
}
