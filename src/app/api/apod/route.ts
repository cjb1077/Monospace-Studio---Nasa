import { NextRequest, NextResponse } from "next/server";
import { fetchApod } from "@/lib/nasa/apod";
import { ApodError } from "@/lib/nasa/apod";
import { ApiErrorResponse, ApodApiResponse, ApodSource, ErrorCode } from "@/lib/types";

/**
 * GET /api/apod?date=YYYY-MM-DD
 *
 * Phase 1.4 (Issue #8): Returns `source` metadata only.
 * ASCII conversion and LLM features will be wired in Phase 2/3.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const date = searchParams.get("date") ?? undefined;

  try {
    const apod = await fetchApod(date);

    const source: ApodSource = {
      title: apod.title,
      date: apod.date,
      imageUrl: apod.url,
      copyright: apod.copyright ?? null,
      explanation: apod.explanation,
    };

    const body: ApodApiResponse = {
      ok: true,
      source,
      usedFallbackImage: apod.usedFallbackImage ?? false,
    };

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
