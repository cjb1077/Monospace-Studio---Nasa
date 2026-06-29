import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { fetchApod, downloadImage } from "@/lib/nasa/apod";
import { ApodError } from "@/lib/nasa/apod";
import { convertImageToAscii } from "@/lib/ascii/convert";
import { ApiErrorResponse, ApodApiResponse, ApodSource, AsciiStyle, ErrorCode } from "@/lib/types";

/**
 * Default ASCII conversion settings (used when AI style direction is unavailable).
 * These will be replaced by the LLM-chosen settings in Phase 3.
 */
const DEFAULT_STYLE: AsciiStyle = {
  charSet: "standard",
  density: 0.6,
  invert: false,
};

const ASCII_MAX_WIDTH = 120;

/**
 * GET /api/apod?date=YYYY-MM-DD
 *
 * Phase 2.4 (Issue #10): Adds ASCII conversion with default settings.
 * LLM features (style direction + caption) will be wired in Phase 3.
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

    // Download image and convert to ASCII
    let ascii = "";
    const style: AsciiStyle = { ...DEFAULT_STYLE };

    try {
      let imageBuffer: Buffer;

      if (apod.usedFallbackImage) {
        // Fallback image is a local file in /public — read it from the filesystem
        const fs = await import("fs/promises");
        const path = await import("path");
        const fallbackPath = path.join(process.cwd(), "public", "starry.png");
        imageBuffer = await fs.readFile(fallbackPath);
      } else {
        imageBuffer = await downloadImage(apod.url);
      }

      // Decode image to raw RGBA using sharp
      const { data, info } = await sharp(imageBuffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const rgbaBuffer = Buffer.from(data);
      ascii = convertImageToAscii(rgbaBuffer, {
        width: info.width,
        height: info.height,
        charSet: style.charSet,
        density: style.density,
        invert: style.invert,
        maxWidth: ASCII_MAX_WIDTH,
      });
    } catch {
      // If image download or conversion fails, return empty ascii
      // rather than crashing the whole response
      ascii = "";
    }

    const body: ApodApiResponse = {
      ok: true,
      source,
      ascii,
      style,
      aiStyleUsed: false,
      aiCaptionUsed: false,
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
