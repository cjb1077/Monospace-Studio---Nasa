# APOD Integration and Database Caching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the NASA APOD client, image downloading, ASCII conversion, and the two AI features (style configuration selection + themed captioning) into the `/api/apod` Next.js route, and back it with Supabase-based database caching to optimize latency and handle API rate limits.

**Architecture:** 
1. Check the database `cached_apods` table first for a cached result.
2. If hit, return the mapped result instantly.
3. If miss, fetch from NASA APOD (which handles date validation and walkbacks to image dates).
4. Perform a second cache check using the actual resolved date.
5. If hit, return it.
6. If miss, download image/fallback, decode, convert to ASCII, run AI features (style/caption), write back to database cache, and return response.

**Tech Stack:** Next.js (App Router), TypeScript, Supabase Admin SDK, Vitest.

## Global Constraints
- Env vars `NASA_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are server-side only.
- Trim APOD explanation to ~1,500 characters before sending to the LLM.
- If style/caption LLM calls fail, fall back to default style or first sentence explanation, returning with the correct `aiStyleUsed: false` and `aiCaptionUsed: false` flags.
- Endpoint must document exact response fields including `usedFallbackImage`, `aiStyleUsed`, and `aiCaptionUsed`.
- Save all cache entries with appropriate snake_case schema columns.

---

### Task 1: Create Integration Tests in `tests/api-apod.test.ts`

**Files:**
- Create: `tests/api-apod.test.ts`

**Interfaces:**
- Consumes: `src/app/api/apod/route.ts` `GET` handler.
- Produces: Integration tests covering cache hits, cache misses, walkback date hits, and fallback operations.

- [ ] **Step 1: Write integration tests**
  Create the test file `tests/api-apod.test.ts` with the following content:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "../src/app/api/apod/route";
import { NextRequest } from "next/server";

// Mock Supabase admin client
const mockSingle = vi.fn();
const mockEq = vi.fn(() => ({ single: mockSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockInsert = vi.fn();
const mockFrom = vi.fn((table: string) => {
  if (table === "cached_apods") {
    return {
      select: mockSelect,
      insert: mockInsert,
    };
  }
  return {};
});

vi.mock("../src/lib/supabase/server", () => ({
  getSupabaseAdmin: () => ({
    from: mockFrom,
  }),
}));

// Mock NASA APOD client
const mockFetchApod = vi.fn();
const mockDownloadImage = vi.fn();
vi.mock("../src/lib/nasa/apod", () => ({
  fetchApod: mockFetchApod,
  downloadImage: mockDownloadImage,
  ApodError: class extends Error {
    constructor(public message: string, public code: string, public status: number) {
      super(message);
    }
  },
}));

// Mock LLM Style recommendation
const mockRecommendStyle = vi.fn();
vi.mock("../src/lib/style", () => ({
  recommendStyle: mockRecommendStyle,
}));

// Mock LLM Caption recommendation
const mockRecommendCaption = vi.fn();
vi.mock("../src/lib/caption", () => ({
  recommendCaption: mockRecommendCaption,
}));

// Mock ASCII converter
const mockConvertImageToAscii = vi.fn();
vi.mock("../src/lib/ascii/convert", () => ({
  convertImageToAscii: mockConvertImageToAscii,
}));

// Mock Sharp
vi.mock("sharp", () => {
  return {
    default: vi.fn(() => ({
      ensureAlpha: vi.fn().mockReturnThis(),
      raw: vi.fn().mockReturnThis(),
      toBuffer: vi.fn().mockResolvedValue({
        data: Buffer.from([255, 255, 255, 255]),
        info: { width: 1, height: 1 },
      }),
    })),
  };
});

describe("GET /api/apod handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return cached result on initial database cache hit", async () => {
    const mockCachedRow = {
      source_date: "2026-06-28",
      title: "Cached Galaxy",
      explanation: "A cached explanation.",
      image_url: "https://example.com/cached.jpg",
      copyright: "NASA/Hubble",
      ascii: ".*Cached ASCII*.",
      char_set: "fine",
      density: 0.85,
      invert: true,
      caption: "Cached Caption",
      fun_fact: "Cached Fun Fact",
      ai_style_used: true,
      ai_caption_used: true,
      used_fallback_image: false,
    };

    mockSingle.mockResolvedValue({ data: mockCachedRow, error: null });

    const req = new NextRequest("http://localhost/api/apod?date=2026-06-28");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.source.title).toBe("Cached Galaxy");
    expect(body.ascii).toBe(".*Cached ASCII*.");
    expect(body.style.charSet).toBe("fine");
    expect(body.style.density).toBe(0.85);
    expect(body.style.invert).toBe(true);
    expect(body.caption).toBe("Cached Caption");
    expect(body.funFact).toBe("Cached Fun Fact");
    expect(body.aiStyleUsed).toBe(true);
    expect(body.aiCaptionUsed).toBe(true);

    // Verify NASA APIs and converters were NOT called
    expect(mockFetchApod).not.toHaveBeenCalled();
    expect(mockRecommendStyle).not.toHaveBeenCalled();
    expect(mockConvertImageToAscii).not.toHaveBeenCalled();
    expect(mockRecommendCaption).not.toHaveBeenCalled();
  });

  it("should execute full generation pipeline and write to cache on cache miss", async () => {
    // 1. Initial db check returns null (cache miss)
    mockSingle.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });
    // 2. Second check for the resolved date returns null as well
    mockSingle.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });

    // Mock NASA metadata
    const mockApod = {
      date: "2026-06-28",
      title: "Fresh Nebula",
      explanation: "A fresh nebula in space.",
      url: "https://example.com/nebula.jpg",
      copyright: "HST",
      media_type: "image",
      service_version: "v1",
    };
    mockFetchApod.mockResolvedValue(mockApod);
    mockDownloadImage.mockResolvedValue(Buffer.from("fresh-image"));

    // Mock style recommender
    mockRecommendStyle.mockResolvedValue({
      style: { charSet: "blocky", density: 0.7, invert: false },
      aiStyleUsed: true,
    });

    // Mock ASCII convert
    mockConvertImageToAscii.mockReturnValue("### FRESH ASCII ###");

    // Mock caption recommender
    mockRecommendCaption.mockResolvedValue({
      caption: "Fresh Caption",
      funFact: "Fresh Fun Fact",
      aiCaptionUsed: true,
    });

    mockInsert.mockResolvedValue({ error: null });

    const req = new NextRequest("http://localhost/api/apod?date=2026-06-28");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.source.title).toBe("Fresh Nebula");
    expect(body.ascii).toBe("### FRESH ASCII ###");
    expect(body.style.charSet).toBe("blocky");
    expect(body.style.density).toBe(0.7);
    expect(body.caption).toBe("Fresh Caption");
    expect(body.funFact).toBe("Fresh Fun Fact");
    expect(body.aiStyleUsed).toBe(true);
    expect(body.aiCaptionUsed).toBe(true);

    // Assert database insert was called with mapped snake_case columns
    expect(mockInsert).toHaveBeenCalledWith({
      source_date: "2026-06-28",
      title: "Fresh Nebula",
      explanation: "A fresh nebula in space.",
      image_url: "https://example.com/nebula.jpg",
      copyright: "HST",
      ascii: "### FRESH ASCII ###",
      char_set: "blocky",
      density: 0.7,
      invert: false,
      caption: "Fresh Caption",
      fun_fact: "Fresh Fun Fact",
      ai_style_used: true,
      ai_caption_used: true,
      used_fallback_image: false,
    });
  });

  it("should check cache again using walked back date to avoid redundant generation", async () => {
    // 1. Initial db check for requested date returns miss
    mockSingle.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });
    
    // 2. Second db check for walked-back date returns hit
    const mockWalkedBackRow = {
      source_date: "2026-06-27", // Walked back from 2026-06-28
      title: "Yesterday Image",
      explanation: "An explanation from yesterday.",
      image_url: "https://example.com/yesterday.jpg",
      copyright: null,
      ascii: "::ascii::",
      char_set: "standard",
      density: 0.6,
      invert: false,
      caption: "Yesterday Caption",
      fun_fact: "Yesterday Fun Fact",
      ai_style_used: false,
      ai_caption_used: false,
      used_fallback_image: false,
    };
    mockSingle.mockResolvedValueOnce({ data: mockWalkedBackRow, error: null });

    // Mock NASA fetching video today and returning yesterday's image metadata
    const mockApod = {
      date: "2026-06-27",
      title: "Yesterday Image",
      explanation: "An explanation from yesterday.",
      url: "https://example.com/yesterday.jpg",
      media_type: "image",
      service_version: "v1",
    };
    mockFetchApod.mockResolvedValue(mockApod);

    const req = new NextRequest("http://localhost/api/apod?date=2026-06-28");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.source.title).toBe("Yesterday Image");
    expect(body.source.date).toBe("2026-06-27");
    expect(body.ascii).toBe("::ascii::");

    // Caching check should have hit database second time and avoided generation
    expect(mockRecommendStyle).not.toHaveBeenCalled();
    expect(mockConvertImageToAscii).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**
  Run: `npx vitest tests/api-apod.test.ts --run`
  Expected: FAIL (either missing imports/route logic mismatches or no caching implemented yet).

---

### Task 2: Implement Database Caching and LLM Wiring in `src/app/api/apod/route.ts`

**Files:**
- Modify: `src/app/api/apod/route.ts`

**Interfaces:**
- Consumes:
  - `fetchApod`, `downloadImage` from `src/lib/nasa/apod`
  - `convertImageToAscii` from `src/lib/ascii/convert`
  - `recommendStyle` from `src/lib/style`
  - `recommendCaption` from `src/lib/caption`
  - `getSupabaseAdmin` from `src/lib/supabase/server`
- Produces: Fully functional `/api/apod` route handler with route responses complying with `ApodApiResponse` and caching.

- [ ] **Step 1: Replace file contents of `src/app/api/apod/route.ts`**

Replace the contents of `src/app/api/apod/route.ts` with the following implementation:

```typescript
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { fetchApod, downloadImage } from "@/lib/nasa/apod";
import { ApodError } from "@/lib/nasa/apod";
import { convertImageToAscii } from "@/lib/ascii/convert";
import { recommendStyle } from "@/lib/style";
import { recommendCaption } from "@/lib/caption";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { ApiErrorResponse, ApodApiResponse, ApodSource, AsciiStyle, ErrorCode } from "@/lib/types";

const ASCII_MAX_WIDTH = 120;

/**
 * Maps a single row from public.cached_apods to our standard camelCase API response shape.
 */
function mapCachedRowToResponse(row: any): ApodApiResponse {
  return {
    ok: true,
    source: {
      title: row.title,
      date: row.source_date,
      imageUrl: row.image_url,
      copyright: row.copyright || null,
      explanation: row.explanation,
    },
    ascii: row.ascii,
    style: {
      charSet: row.char_set as "standard" | "fine" | "blocky",
      density: Number(row.density),
      invert: row.invert,
    },
    caption: row.caption,
    funFact: row.fun_fact,
    aiStyleUsed: row.ai_style_used,
    aiCaptionUsed: row.ai_caption_used,
    usedFallbackImage: row.used_fallback_image,
  };
}

/**
 * GET /api/apod?date=YYYY-MM-DD
 *
 * Integrates caching check, APOD fetch with walkback, nested cache check,
 * LLM settings recommendation, conversion, LLM captions, and database caching.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const dateStr = searchParams.get("date") ?? undefined;

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (dbErr) {
    // If Supabase credentials are not set, log and proceed without database cache support
    console.error("Supabase Admin client initialization failed. Proceeding without caching:", dbErr);
  }

  // 1. Initial Cache Check (only if requested date is provided and db is initialized)
  if (dateStr && supabase) {
    try {
      const { data: cached, error: cacheErr } = await supabase
        .from("cached_apods")
        .select("*")
        .eq("source_date", dateStr)
        .single();

      if (cached && !cacheErr) {
        return NextResponse.json(mapCachedRowToResponse(cached), { status: 200 });
      }
    } catch (err) {
      console.warn("Error querying database cache. Proceeding with generation:", err);
    }
  }

  try {
    // 2. Fetch NASA APOD (performs walkback if video/issue occurs)
    const apod = await fetchApod(dateStr);
    const resolvedDate = apod.date;

    // 3. Nested Cache Check for actual resolved date
    if (supabase) {
      try {
        const { data: cachedResolved, error: resolvedCacheErr } = await supabase
          .from("cached_apods")
          .select("*")
          .eq("source_date", resolvedDate)
          .single();

        if (cachedResolved && !resolvedCacheErr) {
          return NextResponse.json(mapCachedRowToResponse(cachedResolved), { status: 200 });
        }
      } catch (err) {
        console.warn("Error querying database cache for resolved date. Proceeding:", err);
      }
    }

    const source: ApodSource = {
      title: apod.title,
      date: apod.date,
      imageUrl: apod.url,
      copyright: apod.copyright ?? null,
      explanation: apod.explanation,
    };

    // 4. Feature 1: Get Recommended Style
    const { style, aiStyleUsed } = await recommendStyle(apod.title, apod.explanation);

    // 5. Download Image Buffer
    let imageBuffer: Buffer;
    if (apod.usedFallbackImage) {
      const fs = await import("fs/promises");
      const path = await import("path");
      const fallbackPath = path.join(process.cwd(), "public", "starry.png");
      imageBuffer = await fs.readFile(fallbackPath);
    } else {
      imageBuffer = await downloadImage(apod.url);
    }

    // 6. Decode and Convert Image to ASCII
    const { data, info } = await sharp(imageBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const rgbaBuffer = Buffer.from(data);
    const ascii = convertImageToAscii(rgbaBuffer, {
      width: info.width,
      height: info.height,
      charSet: style.charSet,
      density: style.density,
      invert: style.invert,
      maxWidth: ASCII_MAX_WIDTH,
    });

    // 7. Feature 2: Get Recommended Caption and Fun Fact
    const { caption, funFact, aiCaptionUsed } = await recommendCaption(apod.title, apod.explanation);

    const body: ApodApiResponse = {
      ok: true,
      source,
      ascii,
      style,
      caption,
      funFact,
      aiStyleUsed,
      aiCaptionUsed,
      usedFallbackImage: !!apod.usedFallbackImage,
    };

    // 8. Write Generated Result to Cache
    if (supabase) {
      try {
        await supabase.from("cached_apods").insert({
          source_date: resolvedDate,
          title: source.title,
          explanation: source.explanation,
          image_url: source.imageUrl,
          copyright: source.copyright,
          ascii,
          char_set: style.charSet,
          density: style.density,
          invert: style.invert,
          caption,
          fun_fact: funFact,
          ai_style_used: aiStyleUsed,
          ai_caption_used: aiCaptionUsed,
          used_fallback_image: !!apod.usedFallbackImage,
        });
      } catch (insertErr) {
        console.error("Failed to write APOD result to cache:", insertErr);
      }
    }

    return NextResponse.json(body, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof ApodError) {
      const errBody: ApiErrorResponse = {
        ok: false,
        error: error.message,
        code: error.code as ErrorCode,
      };
      return NextResponse.json(errBody, { status: error.status });
    }

    // Unexpected server error
    const errBody: ApiErrorResponse = {
      ok: false,
      error: "An unexpected server error occurred.",
      code: "SERVER",
    };
    return NextResponse.json(errBody, { status: 500 });
  }
}
```

- [ ] **Step 2: Run tests to verify they pass**
  Run: `npx vitest tests/api-apod.test.ts --run`
  Expected: PASS

---

### Task 3: Regression Check and Live Verification

**Files:**
- Modify: None.
- Test: All unit and integration test suites.

- [ ] **Step 1: Run all tests in the workspace**
  Run: `npx vitest run`
  Expected: All test suites (smoke, nasa, ascii, style, caption, api-apod) must pass.

- [ ] **Step 2: Start the Next.js dev server**
  Run: `npm run dev` in the background (or launch and verify it compiles).

- [ ] **Step 3: Make a live request to confirm the API works and caches**
  Open the browser or use `curl` / `wget` on the localhost dev server:
  Request today's APOD: `GET http://localhost:3000/api/apod`
  Request a specific date: `GET http://localhost:3000/api/apod?date=2023-10-23`
  Verify subsequent hits are sub-100ms.
  Ensure correct JSON payload shape.
