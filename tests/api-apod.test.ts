import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Hoist all mock functions so they are initialized before hoisting vi.mock
const {
  mockSingle,
  mockEq,
  mockSelect,
  mockInsert,
  mockFrom,
  mockFetchApod,
  mockDownloadImage,
  mockRecommendStyle,
  mockRecommendCaption,
  mockConvertImageToAscii,
} = vi.hoisted(() => {
  const single = vi.fn();
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  const insert = vi.fn();
  const from = vi.fn((table: string) => {
    if (table === "cached_apods") {
      return { select, insert };
    }
    return {};
  });

  return {
    mockSingle: single,
    mockEq: eq,
    mockSelect: select,
    mockInsert: insert,
    mockFrom: from,
    mockFetchApod: vi.fn(),
    mockDownloadImage: vi.fn(),
    mockRecommendStyle: vi.fn(),
    mockRecommendCaption: vi.fn(),
    mockConvertImageToAscii: vi.fn(),
  };
});

// Setup mocks using hoisted functions
vi.mock("../src/lib/supabase/server", () => ({
  getSupabaseAdmin: () => ({
    from: mockFrom,
  }),
}));

vi.mock("../src/lib/nasa/apod", () => ({
  fetchApod: mockFetchApod,
  downloadImage: mockDownloadImage,
  ApodError: class extends Error {
    constructor(public message: string, public code: string, public status: number) {
      super(message);
    }
  },
}));

vi.mock("../src/lib/style", () => ({
  recommendStyle: mockRecommendStyle,
}));

vi.mock("../src/lib/caption", () => ({
  recommendCaption: mockRecommendCaption,
}));

vi.mock("../src/lib/ascii/convert", () => ({
  convertImageToAscii: mockConvertImageToAscii,
}));

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

// Now import GET handler safely after module mocks are set up
import { GET } from "../src/app/api/apod/route";

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

  it("should return 400 when invalid style parameters are provided", async () => {
    const req = new NextRequest("http://localhost/api/apod?date=2026-06-28&charSet=invalid");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain("Invalid charSet parameter");

    const req2 = new NextRequest("http://localhost/api/apod?date=2026-06-28&density=1.5");
    const res2 = await GET(req2);
    expect(res2.status).toBe(400);
    const body2 = await res2.json();
    expect(body2.ok).toBe(false);
    expect(body2.error).toContain("Invalid density parameter");
  });

  it("should return overridden ASCII on cache hit when overrides are specified", async () => {
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
    mockDownloadImage.mockResolvedValue(Buffer.from("image-bytes"));
    mockConvertImageToAscii.mockReturnValue("### OVERRIDDEN ASCII ###");

    const req = new NextRequest("http://localhost/api/apod?date=2026-06-28&charSet=blocky&density=0.5&invert=false");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.ascii).toBe("### OVERRIDDEN ASCII ###");
    expect(body.style.charSet).toBe("blocky");
    expect(body.style.density).toBe(0.5);
    expect(body.style.invert).toBe(false);
    expect(body.aiStyleUsed).toBe(false);

    expect(mockDownloadImage).toHaveBeenCalledWith("https://example.com/cached.jpg");
    expect(mockConvertImageToAscii).toHaveBeenCalledWith(expect.any(Buffer), expect.objectContaining({
      charSet: "blocky",
      density: 0.5,
      invert: false,
    }));
  });

  it("should generate overrides for response but save recommended styles to database cache on cache miss", async () => {
    // Cache miss for requested and resolved dates
    mockSingle.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });
    mockSingle.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });

    // NASA metadata
    const mockApod = {
      date: "2026-06-28",
      title: "Galaxy Star",
      explanation: "A bright galaxy in space.",
      url: "https://example.com/star.jpg",
      copyright: "NASA",
      media_type: "image",
      service_version: "v1",
    };
    mockFetchApod.mockResolvedValue(mockApod);
    mockDownloadImage.mockResolvedValue(Buffer.from("galaxy-bytes"));

    // Mock style recommender (Feature 1)
    mockRecommendStyle.mockResolvedValue({
      style: { charSet: "fine", density: 0.8, invert: true },
      aiStyleUsed: true,
    });

    // Mock ASCII convert
    mockConvertImageToAscii.mockImplementation((_, opts) => {
      if (opts.charSet === "fine") {
        return "=== RECOMMENDED ASCII ===";
      }
      return "=== OVERRIDDEN ASCII ===";
    });

    // Mock caption recommender (Feature 2)
    mockRecommendCaption.mockResolvedValue({
      caption: "Caption Text",
      funFact: "Fun Fact Text",
      aiCaptionUsed: true,
    });

    mockInsert.mockResolvedValue({ error: null });

    const req = new NextRequest("http://localhost/api/apod?date=2026-06-28&charSet=standard&density=0.6&invert=false");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.ascii).toBe("=== OVERRIDDEN ASCII ===");
    expect(body.style.charSet).toBe("standard");
    expect(body.style.density).toBe(0.6);
    expect(body.style.invert).toBe(false);
    expect(body.aiStyleUsed).toBe(false);

    // Assert database insert was called with RECOMMENDED values
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      source_date: "2026-06-28",
      ascii: "=== RECOMMENDED ASCII ===",
      char_set: "fine",
      density: 0.8,
      invert: true,
      ai_style_used: true,
    }));
  });
});

