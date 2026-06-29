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
 * Helper to download and convert an image to ASCII using sharp and convertImageToAscii.
 */
async function performConversion(
  imageUrl: string,
  usedFallbackImage: boolean,
  style: { charSet: "standard" | "fine" | "blocky"; density: number; invert: boolean }
): Promise<string> {
  let imageBuffer: Buffer;
  if (usedFallbackImage) {
    const fs = await import("fs/promises");
    const path = await import("path");
    const fallbackPath = path.join(process.cwd(), "public", "starry.png");
    imageBuffer = await fs.readFile(fallbackPath);
  } else {
    imageBuffer = await downloadImage(imageUrl);
  }

  const { data, info } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const rgbaBuffer = Buffer.from(data);
  return convertImageToAscii(rgbaBuffer, {
    width: info.width,
    height: info.height,
    charSet: style.charSet,
    density: style.density,
    invert: style.invert,
    maxWidth: ASCII_MAX_WIDTH,
  });
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

  const charSetParam = searchParams.get("charSet");
  const densityParam = searchParams.get("density");
  const invertParam = searchParams.get("invert");

  // Validate overrides if present
  let overrideStyle: { charSet?: "standard" | "fine" | "blocky"; density?: number; invert?: boolean } | undefined;
  if (charSetParam || densityParam || invertParam) {
    overrideStyle = {};
    if (charSetParam) {
      if (charSetParam === "standard" || charSetParam === "fine" || charSetParam === "blocky") {
        overrideStyle.charSet = charSetParam;
      } else {
        const errBody: ApiErrorResponse = {
          ok: false,
          error: "Invalid charSet parameter. Must be standard, fine, or blocky.",
          code: "BAD_DATE",
        };
        return NextResponse.json(errBody, { status: 400 });
      }
    }
    if (densityParam) {
      const d = parseFloat(densityParam);
      if (!isNaN(d) && d >= 0.4 && d <= 0.9) {
        overrideStyle.density = d;
      } else {
        const errBody: ApiErrorResponse = {
          ok: false,
          error: "Invalid density parameter. Must be a number between 0.4 and 0.9.",
          code: "BAD_DATE",
        };
        return NextResponse.json(errBody, { status: 400 });
      }
    }
    if (invertParam) {
      overrideStyle.invert = invertParam === "true";
    }
  }

  let supabase: any;
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
        const responseData = mapCachedRowToResponse(cached);
        if (overrideStyle) {
          const mergedStyle = {
            charSet: overrideStyle.charSet ?? responseData.style!.charSet,
            density: overrideStyle.density ?? responseData.style!.density,
            invert: overrideStyle.invert ?? responseData.style!.invert,
          };
          const overriddenAscii = await performConversion(
            responseData.source!.imageUrl,
            !!responseData.usedFallbackImage,
            mergedStyle
          );
          responseData.ascii = overriddenAscii;
          responseData.style = mergedStyle;
          responseData.aiStyleUsed = false;
        }
        return NextResponse.json(responseData, { status: 200 });
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
          const responseData = mapCachedRowToResponse(cachedResolved);
          if (overrideStyle) {
            const mergedStyle = {
              charSet: overrideStyle.charSet ?? responseData.style!.charSet,
              density: overrideStyle.density ?? responseData.style!.density,
              invert: overrideStyle.invert ?? responseData.style!.invert,
            };
            const overriddenAscii = await performConversion(
              responseData.source!.imageUrl,
              !!responseData.usedFallbackImage,
              mergedStyle
            );
            responseData.ascii = overriddenAscii;
            responseData.style = mergedStyle;
            responseData.aiStyleUsed = false;
          }
          return NextResponse.json(responseData, { status: 200 });
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

    // 6. Decode Image
    const { data, info } = await sharp(imageBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const rgbaBuffer = Buffer.from(data);

    // Convert with recommended settings for DB caching
    const recommendedAscii = convertImageToAscii(rgbaBuffer, {
      width: info.width,
      height: info.height,
      charSet: style.charSet,
      density: style.density,
      invert: style.invert,
      maxWidth: ASCII_MAX_WIDTH,
    });

    // Determine final style and ASCII for the response
    let finalAscii = recommendedAscii;
    let finalStyle = style;
    let finalAiStyleUsed = aiStyleUsed;

    if (overrideStyle) {
      finalStyle = {
        charSet: overrideStyle.charSet ?? style.charSet,
        density: overrideStyle.density ?? style.density,
        invert: overrideStyle.invert ?? style.invert,
      };
      finalAscii = convertImageToAscii(rgbaBuffer, {
        width: info.width,
        height: info.height,
        charSet: finalStyle.charSet,
        density: finalStyle.density,
        invert: finalStyle.invert,
        maxWidth: ASCII_MAX_WIDTH,
      });
      finalAiStyleUsed = false;
    }

    // 7. Feature 2: Get Recommended Caption and Fun Fact
    const { caption, funFact, aiCaptionUsed } = await recommendCaption(apod.title, apod.explanation);

    const body: ApodApiResponse = {
      ok: true,
      source,
      ascii: finalAscii,
      style: finalStyle,
      caption,
      funFact,
      aiStyleUsed: finalAiStyleUsed,
      aiCaptionUsed,
      usedFallbackImage: !!apod.usedFallbackImage,
    };

    // 8. Write Recommended Result to Cache
    if (supabase) {
      try {
        await supabase.from("cached_apods").insert({
          source_date: resolvedDate,
          title: source.title,
          explanation: source.explanation,
          image_url: source.imageUrl,
          copyright: source.copyright,
          ascii: recommendedAscii,
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
