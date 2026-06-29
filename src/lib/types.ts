export interface NasaApodResponse {
  date: string;
  explanation: string;
  hdurl?: string;
  media_type: string;
  service_version: string;
  title: string;
  url: string;
  copyright?: string;
}

export interface ApodSource {
  title: string;
  date: string;
  imageUrl: string;
  copyright: string | null;
  explanation: string;
}

export interface AsciiStyle {
  charSet: "standard" | "fine" | "blocky";
  density: number; // 0.4 - 0.9
  invert: boolean;
}

export interface LlmStyleResponse extends AsciiStyle {
  reasoning: string;
}

export interface LlmCaptionResponse {
  caption: string; // <= 140 chars
  funFact: string; // <= 200 chars
}

export interface ApodApiResponse {
  ok: boolean;
  source?: ApodSource;
  ascii?: string;
  style?: AsciiStyle;
  caption?: string;
  funFact?: string;
  aiStyleUsed?: boolean;
  aiCaptionUsed?: boolean;
  usedFallbackImage?: boolean;
  error?: string;
  code?: string;
}

export type ErrorCode =
  | "BAD_DATE"
  | "NASA_DOWN"
  | "NASA_RATE_LIMIT"
  | "LLM_DOWN"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "SERVER";

export interface ApiErrorResponse {
  ok: false;
  error: string;
  code: ErrorCode;
}
