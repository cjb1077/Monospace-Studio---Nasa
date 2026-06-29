/**
 * convertImageToAscii — Pure, deterministic image-to-ASCII converter.
 *
 * Input:  raw RGBA pixel buffer (width × height × 4 bytes, row-major)
 * Output: ASCII string (newline-separated rows)
 *
 * No network calls, no randomness. Safe to unit-test with synthetic buffers.
 */

export type CharSet = "standard" | "fine" | "blocky";

export interface ConvertOptions {
  /** Raw pixel width of the input buffer */
  width: number;
  /** Raw pixel height of the input buffer */
  height: number;
  /** Which character ramp to use */
  charSet: CharSet;
  /**
   * Controls how aggressively mid-tones map toward darker glyphs.
   * Range: 0.4 (biases light) – 0.9 (biases dark).
   * Applied as: adjustedLum = lum^density
   */
  density: number;
  /** When true, flips the ramp (swap light ↔ dark). */
  invert: boolean;
  /** Maximum output column count. Input is downscaled to fit. */
  maxWidth: number;
}

// ---------------------------------------------------------------------------
// Character ramps (index 0 = lightest/space, last index = darkest)
// ---------------------------------------------------------------------------

const RAMPS: Record<CharSet, string> = {
  // 10 characters
  standard: " .:-=+*#%@",
  // 18 characters — fine gradients
  fine:     " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
  // 7 characters — high-contrast blocky
  blocky:   " .:oO0@",
};

// ---------------------------------------------------------------------------
// Luminance helper (NTSC/Rec.601 perceptual weighting)
// ---------------------------------------------------------------------------

/**
 * Returns normalised luminance in [0, 1] where 0 = black, 1 = white.
 */
function luminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// ---------------------------------------------------------------------------
// Core converter
// ---------------------------------------------------------------------------

export function convertImageToAscii(
  buffer: Buffer,
  options: ConvertOptions
): string {
  const { width, height, charSet, density, invert, maxWidth } = options;

  const ramp = RAMPS[charSet];

  // --- Determine output dimensions -----------------------------------------
  // Downscale to fit maxWidth; never upscale.
  const cols = Math.min(width, maxWidth);
  // Account for ~2:1 character aspect ratio (chars are taller than wide).
  const rows = Math.max(1, Math.round((height / width) * cols * 0.5));

  // --- Sample pixels and convert -------------------------------------------
  const lines: string[] = [];

  for (let row = 0; row < rows; row++) {
    // Map output row → source pixel row range (exclusive upper boundary)
    const srcRowStart = Math.floor((row / rows) * height);
    const srcRowEnd = Math.max(
      srcRowStart,
      Math.min(height - 1, Math.ceil(((row + 1) / rows) * height) - 1)
    );

    let line = "";
    for (let col = 0; col < cols; col++) {
      // Map output col → source pixel col range (exclusive upper boundary)
      const srcColStart = Math.floor((col / cols) * width);
      const srcColEnd = Math.max(
        srcColStart,
        Math.min(width - 1, Math.ceil(((col + 1) / cols) * width) - 1)
      );

      // Average luminance over the source cell
      let totalLum = 0;
      let count = 0;
      for (let py = srcRowStart; py <= srcRowEnd; py++) {
        for (let px = srcColStart; px <= srcColEnd; px++) {
          const offset = (py * width + px) * 4;
          const r = buffer[offset];
          const g = buffer[offset + 1];
          const b = buffer[offset + 2];
          // Alpha premultiplication: transparent pixels → white background
          const a = buffer[offset + 3] / 255;
          const lum = luminance(r, g, b) * a + (1 - a);
          totalLum += lum;
          count++;
        }
      }
      let lum = count > 0 ? totalLum / count : 1;

      // Apply density curve: adjustedLum = lum^density
      // density 0.4 → exponent 0.4 → expands toward white (lighter chars)
      // density 0.9 → exponent 0.9 → pushes mid-tones toward dark (darker chars)
      lum = Math.pow(lum, density);
      lum = Math.max(0, Math.min(1, lum));

      // Map to ramp index (lum=1 → index 0, lum=0 → last index)
      // Light pixels → low index (space); Dark pixels → high index (dense char)
      let idx: number;
      if (invert) {
        // Inverted: lum=1 (white) → last char, lum=0 (black) → first char
        idx = Math.round(lum * (ramp.length - 1));
      } else {
        // Normal: lum=1 (white) → space, lum=0 (black) → dense char
        idx = Math.round((1 - lum) * (ramp.length - 1));
      }
      idx = Math.max(0, Math.min(ramp.length - 1, idx));

      line += ramp[idx];
    }
    lines.push(line);
  }

  return lines.join("\n");
}
