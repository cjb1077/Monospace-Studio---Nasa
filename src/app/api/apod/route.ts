import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { fetchApod, downloadImage } from "@/lib/nasa/apod";
import { ApodError } from "@/lib/nasa/apod";
import { convertImageToAscii } from "@/lib/ascii/convert";
import { recommendStyle } from "@/lib/style";
import { recommendCaption } from "@/lib/caption";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { ApiErrorResponse, ApodApiResponse, ApodSource, ErrorCode } from "@/lib/types";

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
