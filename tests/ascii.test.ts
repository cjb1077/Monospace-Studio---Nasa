/**
 * ASCII Converter Unit Tests
 *
 * All tests use synthetic pixel buffers so they are fully deterministic —
 * no network, no randomness, no file I/O.
 *
 * Pixel encoding: raw RGBA, 4 bytes per pixel, row-major.
 *
 * TDD phase: RED — these tests are written BEFORE the implementation exists.
 */

import { describe, it, expect } from "vitest";
import { convertImageToAscii } from "../src/lib/ascii/convert";

// ---------------------------------------------------------------------------
// Helpers to build synthetic raw RGBA buffers
// ---------------------------------------------------------------------------

/**
 * Build a 1×1 RGBA buffer from a single pixel value (0-255 per channel).
 */
function pixel(r: number, g: number, b: number, a = 255): Buffer {
  return Buffer.from([r, g, b, a]);
}

/**
 * Build a 2×2 RGBA buffer from four pixel values (top-left, top-right,
 * bottom-left, bottom-right).
 */
function pixels2x2(
  tl: [number, number, number],
  tr: [number, number, number],
  bl: [number, number, number],
  br: [number, number, number]
): Buffer {
  return Buffer.from([
    ...tl, 255,
    ...tr, 255,
    ...bl, 255,
    ...br, 255,
  ]);
}

/**
 * Build a width×height RGBA buffer filled with a single grey value.
 */
function solidGrey(value: number, width: number, height: number): Buffer {
  const buf = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    buf[i * 4 + 0] = value;
    buf[i * 4 + 1] = value;
    buf[i * 4 + 2] = value;
    buf[i * 4 + 3] = 255;
  }
  return buf;
}

// ---------------------------------------------------------------------------
// 2.1 — standard charSet, 2×2 gradient image
// ---------------------------------------------------------------------------

describe("convertImageToAscii – basic API", () => {
  it("returns a non-empty string for a 1×1 white pixel", () => {
    const result = convertImageToAscii(pixel(255, 255, 255), {
      width: 1,
      height: 1,
      charSet: "standard",
      density: 0.6,
      invert: false,
      maxWidth: 80,
    });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("maps a pure-black 1×1 pixel to the darkest standard character", () => {
    // standard ramp (darkest-last): " .:-=+*#%@"
    // black → max luminance index → "@"
    const result = convertImageToAscii(pixel(0, 0, 0), {
      width: 1,
      height: 1,
      charSet: "standard",
      density: 0.6,
      invert: false,
      maxWidth: 80,
    });
    expect(result.trim()).toBe("@");
  });

  it("maps a pure-white 1×1 pixel to the lightest standard character (space)", () => {
    const result = convertImageToAscii(pixel(255, 255, 255), {
      width: 1,
      height: 1,
      charSet: "standard",
      density: 0.6,
      invert: false,
      maxWidth: 80,
    });
    // Lightest = space (index 0)
    expect(result.trim()).toBe("");
  });

  it("produces correct output for a 2×1 black/white gradient with standard charSet", () => {
    // 2×1 buffer: left=white, right=black
    const buf = Buffer.from([
      255, 255, 255, 255, // left: white
      0, 0, 0, 255,       // right: black
    ]);
    const result = convertImageToAscii(buf, {
      width: 2,
      height: 1,
      charSet: "standard",
      density: 0.6,
      invert: false,
      maxWidth: 80,
    });
    // Single row (height=1), 2 cols
    expect(result[0]).toBe(" "); // white → lightest (space)
    expect(result[1]).toBe("@"); // black → darkest
  });
});

// ---------------------------------------------------------------------------
// 2.3a — fine charSet (longer ramp, more shades)
// ---------------------------------------------------------------------------

describe("convertImageToAscii – fine charSet", () => {
  it("maps a pure-black 1×1 pixel to the darkest fine character", () => {
    const result = convertImageToAscii(pixel(0, 0, 0), {
      width: 1,
      height: 1,
      charSet: "fine",
      density: 0.6,
      invert: false,
      maxWidth: 80,
    });
    // fine ramp has 16+ chars; darkest is the last character
    expect(result.trim().length).toBe(1);
    expect(result.trim()).not.toBe(""); // not a space
  });

  it("maps a pure-white 1×1 pixel to the lightest fine character (space)", () => {
    const result = convertImageToAscii(pixel(255, 255, 255), {
      width: 1,
      height: 1,
      charSet: "fine",
      density: 0.6,
      invert: false,
      maxWidth: 80,
    });
    expect(result.trim()).toBe(""); // space → trimmed to empty
  });

  it("produces more distinct shades than standard for a gradient", () => {
    // Build a 4×1 gradient: 0%, 33%, 66%, 100% luminance
    const buf = Buffer.from([
      255, 255, 255, 255, // white
      170, 170, 170, 255, // light grey
      85, 85, 85, 255,    // dark grey
      0, 0, 0, 255,       // black
    ]);
    const resultFine = convertImageToAscii(buf, {
      width: 4,
      height: 1,
      charSet: "fine",
      density: 0.6,
      invert: false,
      maxWidth: 80,
    });
    const resultStd = convertImageToAscii(buf, {
      width: 4,
      height: 1,
      charSet: "standard",
      density: 0.6,
      invert: false,
      maxWidth: 80,
    });
    // fine ramp has more characters — the 4 chars in fine should use a wider
    // spread of the ramp than standard (not a strict uniqueness guarantee, but
    // the fine ramp must have at least as many unique chars as standard for 4 pixels)
    const fineChars = new Set(resultFine.replace(/\n/g, "").split("")).size;
    const stdChars = new Set(resultStd.replace(/\n/g, "").split("")).size;
    expect(fineChars).toBeGreaterThanOrEqual(stdChars);
  });
});

// ---------------------------------------------------------------------------
// 2.3b — blocky charSet (high-contrast, fewer shades)
// ---------------------------------------------------------------------------

describe("convertImageToAscii – blocky charSet", () => {
  it("maps a pure-black 1×1 pixel to the darkest blocky character", () => {
    const result = convertImageToAscii(pixel(0, 0, 0), {
      width: 1,
      height: 1,
      charSet: "blocky",
      density: 0.6,
      invert: false,
      maxWidth: 80,
    });
    expect(result.trim().length).toBe(1);
    expect(result.trim()).toBe("@");
  });

  it("maps a pure-white 1×1 pixel to the lightest blocky character (space)", () => {
    const result = convertImageToAscii(pixel(255, 255, 255), {
      width: 1,
      height: 1,
      charSet: "blocky",
      density: 0.6,
      invert: false,
      maxWidth: 80,
    });
    expect(result.trim()).toBe("");
  });
});

// ---------------------------------------------------------------------------
// 2.3c — invert flag
// ---------------------------------------------------------------------------

describe("convertImageToAscii – invert", () => {
  it("inverts output: black pixel with invert=true yields lightest char", () => {
    const black = convertImageToAscii(pixel(0, 0, 0), {
      width: 1,
      height: 1,
      charSet: "standard",
      density: 0.6,
      invert: true,
      maxWidth: 80,
    });
    // inverted black → white → space
    expect(black.trim()).toBe("");
  });

  it("inverts output: white pixel with invert=true yields darkest char", () => {
    const white = convertImageToAscii(pixel(255, 255, 255), {
      width: 1,
      height: 1,
      charSet: "standard",
      density: 0.6,
      invert: true,
      maxWidth: 80,
    });
    // inverted white → black → "@"
    expect(white.trim()).toBe("@");
  });

  it("normal and inverted results are different for a mid-grey pixel", () => {
    const opts = {
      width: 1,
      height: 1,
      charSet: "standard" as const,
      density: 0.6,
      maxWidth: 80,
    };
    const normal = convertImageToAscii(pixel(128, 128, 128), { ...opts, invert: false });
    const inverted = convertImageToAscii(pixel(128, 128, 128), { ...opts, invert: true });
    expect(normal).not.toBe(inverted);
  });
});

// ---------------------------------------------------------------------------
// 2.3d — density parameter
// ---------------------------------------------------------------------------

describe("convertImageToAscii – density", () => {
  it("low density biases a mid-grey pixel toward lighter characters", () => {
    const opts = {
      width: 1,
      height: 1,
      charSet: "standard" as const,
      invert: false,
      maxWidth: 80,
    };
    const ramp = " .:-=+*#%@"; // 10 chars, index 0=lightest, 9=darkest
    const lowDensity = convertImageToAscii(pixel(128, 128, 128), { ...opts, density: 0.4 });
    const highDensity = convertImageToAscii(pixel(128, 128, 128), { ...opts, density: 0.9 });
    const lowIdx = ramp.indexOf(lowDensity.trim()[0] ?? " ");
    const highIdx = ramp.indexOf(highDensity.trim()[0] ?? " ");
    // High density (0.9) should map to a darker (higher-index) character
    // density curve: lum^density; density=0.9 → closer to linear → darker mid-tones
    // density=0.4 → lum^0.4 boosts luminance → lighter char
    expect(highIdx).toBeGreaterThanOrEqual(lowIdx);
  });
});

// ---------------------------------------------------------------------------
// 2.3e — maxWidth / output shape
// ---------------------------------------------------------------------------

describe("convertImageToAscii – output shape", () => {
  it("respects maxWidth: output line length does not exceed maxWidth", () => {
    const buf = solidGrey(128, 200, 100); // wide image
    const result = convertImageToAscii(buf, {
      width: 200,
      height: 100,
      charSet: "standard",
      density: 0.6,
      invert: false,
      maxWidth: 80,
    });
    for (const line of result.split("\n")) {
      expect(line.length).toBeLessThanOrEqual(80);
    }
  });

  it("smaller images are not upscaled beyond their natural width", () => {
    const buf = solidGrey(128, 10, 5);
    const result = convertImageToAscii(buf, {
      width: 10,
      height: 5,
      charSet: "standard",
      density: 0.6,
      invert: false,
      maxWidth: 80,
    });
    for (const line of result.split("\n")) {
      expect(line.length).toBeLessThanOrEqual(10);
    }
  });

  it("multi-line output has correct number of rows (aspect-ratio corrected)", () => {
    // 10×10 image → 10 cols, but with 2:1 aspect ratio correction → 5 rows
    const buf = solidGrey(128, 10, 10);
    const result = convertImageToAscii(buf, {
      width: 10,
      height: 10,
      charSet: "standard",
      density: 0.6,
      invert: false,
      maxWidth: 80,
    });
    const lines = result.split("\n").filter((l) => l.length > 0);
    // rows = Math.round(10 / 2) = 5
    expect(lines.length).toBe(5);
  });
});
