/**
 * scripts/test-features.ts
 *
 * CLI end-to-end pipeline test:
 *   APOD fetch → LLM style → ASCII convert → LLM caption
 *
 * Run with:  npm run test:features
 *
 * Prints timing for each stage so you can eyeball real-world performance
 * before the full UI is wired.
 */

import { config as loadEnv } from "dotenv";
import { resolve } from "path";

// Load .env.local before any module that reads env vars
loadEnv({ path: resolve(process.cwd(), ".env.local") });

import sharp from "sharp";
import { fetchApod, downloadImage } from "../src/lib/nasa/apod";
import { convertImageToAscii } from "../src/lib/ascii/convert";
import { getLlmConfig } from "../src/lib/llm/config";

// Feature helpers will be added in Phase 3.2 / 3.3 — stub them here
// so the script runs as an integration harness even before those modules exist.
type StyleResult = {
  charSet: "standard" | "fine" | "blocky";
  density: number;
  invert: boolean;
  aiStyleUsed: boolean;
};

async function getStyle(
  title: string,
  explanation: string
): Promise<StyleResult> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const mod = await (new Function('p', 'return import(p)')("../src/lib/style/index")) as { recommendStyle: (t: string, e: string) => Promise<{ style: Omit<StyleResult, 'aiStyleUsed'>; aiStyleUsed: boolean }> };
    const result = await mod.recommendStyle(title, explanation);
    return { ...result.style, aiStyleUsed: result.aiStyleUsed };
  } catch (err) {
    console.error("Style import error:", err);
    return { charSet: "standard", density: 0.6, invert: false, aiStyleUsed: false };
  }
}

type CaptionResult = { caption: string; funFact: string; aiCaptionUsed: boolean };

async function getCaption(
  title: string,
  explanation: string
): Promise<CaptionResult> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const mod = await (new Function('p', 'return import(p)')("../src/lib/caption/index")) as { recommendCaption: (t: string, e: string) => Promise<{ caption: string; funFact: string; aiCaptionUsed: boolean }> };
    const result = await mod.recommendCaption(title, explanation);
    return result;
  } catch (err) {
    console.error("Caption import error:", err);
    const firstSentence = explanation.split(/[.!?]/)[0]?.trim() ?? "";
    return { caption: firstSentence, funFact: "", aiCaptionUsed: false };
  }
}

async function main() {
  const dateArg = process.argv[2]; // optional: node test-features.ts 2024-01-01

  console.log("🔍  Config:");
  try {
    const cfg = getLlmConfig();
    console.log(`    provider=${cfg.provider}  model=${cfg.model}`);
  } catch (err) {
    console.error("❌  Config error:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  // 1. Fetch APOD
  console.log(`\n📡  Fetching APOD${dateArg ? ` for ${dateArg}` : " (today)"}…`);
  let apod: Awaited<ReturnType<typeof fetchApod>>;
  const t0 = Date.now();
  try {
    apod = await fetchApod(dateArg);
    console.log(`✅  APOD fetch:    ${Date.now() - t0}ms  →  "${apod.title}"`);
  } catch (err) {
    console.error("❌  APOD error:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  // Trim explanation
  const trimmedExplanation = apod.explanation.slice(0, 1500);

  // 2. LLM Feature 1 — style direction
  console.log("\n🎨  LLM Feature 1: style direction…");
  const t1 = Date.now();
  const styleResult = await getStyle(apod.title, trimmedExplanation);
  console.log(`${styleResult.aiStyleUsed ? "✅" : "⚠️ "}  LLM style:       ${Date.now() - t1}ms  →`, {
    charSet: styleResult.charSet,
    density: styleResult.density,
    invert: styleResult.invert,
    aiStyleUsed: styleResult.aiStyleUsed,
  });

  // 3. Download image + ASCII convert
  console.log("\n🖼️   Downloading image + ASCII convert…");
  const t2 = Date.now();
  let ascii = "(no art)";
  try {
    let imageBuffer: Buffer;
    if (apod.usedFallbackImage) {
      const fs = await import("fs/promises");
      const path = await import("path");
      imageBuffer = await fs.readFile(
        path.join(process.cwd(), "public", "starry.png")
      );
    } else {
      imageBuffer = await downloadImage(apod.url);
    }

    const { data, info } = await sharp(imageBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    ascii = convertImageToAscii(Buffer.from(data), {
      width: info.width,
      height: info.height,
      charSet: styleResult.charSet,
      density: styleResult.density,
      invert: styleResult.invert,
      maxWidth: 120,
    });
    console.log(
      `✅  ASCII convert: ${Date.now() - t2}ms  →  ${ascii.length} chars`
    );
  } catch (err) {
    console.warn(
      "⚠️   Image/convert error (non-fatal):",
      err instanceof Error ? err.message : err
    );
  }

  // 4. LLM Feature 2 — caption + fun fact
  console.log("\n✍️   LLM Feature 2: caption + fun fact…");
  const t3 = Date.now();
  const captionResult = await getCaption(apod.title, trimmedExplanation);
  console.log(`${captionResult.aiCaptionUsed ? "✅" : "⚠️ "}  LLM caption:     ${Date.now() - t3}ms`);
  console.log(`    caption  : "${captionResult.caption}"`);
  console.log(`    funFact  : "${captionResult.funFact}"`);

  // Summary
  const totalMs = Date.now() - t0;
  console.log(`\n⏱   Total: ${totalMs}ms`);

  // Print a preview of the ASCII art (first 3 lines)
  const preview = ascii.split("\n").slice(0, 3).join("\n");
  if (preview.trim()) {
    console.log("\n🎭  ASCII preview (first 3 rows):");
    console.log(preview);
  }

  console.log("\n✨  Pipeline test complete.");
}

main();
