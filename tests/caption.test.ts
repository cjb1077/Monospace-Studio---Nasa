import { describe, it, expect, vi, beforeEach } from "vitest";
import { recommendCaption } from "../src/lib/caption";
import * as chatModule from "../src/lib/llm/chat";

vi.mock("../src/lib/llm/chat", async () => {
  const actual = await vi.importActual<typeof chatModule>("../src/lib/llm/chat");
  return {
    ...actual,
    createJsonCompletion: vi.fn(),
  };
});

describe("recommendCaption", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return recommended caption and fun fact on successful LLM response", async () => {
    vi.mocked(chatModule.createJsonCompletion).mockResolvedValue({
      data: {
        caption: "A stellar nursery of dust and gas.",
        funFact: "Nebulae are often called star nurseries because stars are born within them.",
      },
      meta: { model: "test-model", provider: "test" },
    });

    const result = await recommendCaption("Orion Nebula", "A beautiful stellar nebula.");
    expect(result.caption).toBe("A stellar nursery of dust and gas.");
    expect(result.funFact).toBe("Nebulae are often called star nurseries because stars are born within them.");
    expect(result.aiCaptionUsed).toBe(true);
  });

  it("should retry and fall back to first sentence of explanation if validation fails twice", async () => {
    // Return invalid data (caption too long)
    vi.mocked(chatModule.createJsonCompletion).mockResolvedValue({
      data: {
        caption: "A".repeat(150), // exceeds 140 characters limit
        funFact: "Invalid caption length",
      },
      meta: { model: "test-model", provider: "test" },
    });

    const explanation = "The Orion Nebula is a diffuse nebula situated in the Milky Way. It is one of the brightest nebulae.";
    const result = await recommendCaption("Orion Nebula", explanation);
    expect(result.caption).toBe("The Orion Nebula is a diffuse nebula situated in the Milky Way.");
    expect(result.funFact).toBe("");
    expect(result.aiCaptionUsed).toBe(false);
    expect(chatModule.createJsonCompletion).toHaveBeenCalledTimes(2);
  });

  it("should retry once and succeed if the second attempt passes validation", async () => {
    vi.mocked(chatModule.createJsonCompletion)
      .mockRejectedValueOnce(new Error("Timeout error"))
      .mockResolvedValueOnce({
        data: {
          caption: "A starry night in deep space.",
          funFact: "Light from this galaxy took 2 million years to reach us.",
        },
        meta: { model: "test-model", provider: "test" },
      });

    const result = await recommendCaption("Deep Space", "Deep space image explanation.");
    expect(result.caption).toBe("A starry night in deep space.");
    expect(result.funFact).toBe("Light from this galaxy took 2 million years to reach us.");
    expect(result.aiCaptionUsed).toBe(true);
    expect(chatModule.createJsonCompletion).toHaveBeenCalledTimes(2);
  });

  it("should handle empty or weird explanation gracefully in fallback", async () => {
    vi.mocked(chatModule.createJsonCompletion).mockRejectedValue(new Error("LLM Down"));

    const result = await recommendCaption("No Explanation Title", "");
    expect(result.caption).toBe("");
    expect(result.funFact).toBe("");
    expect(result.aiCaptionUsed).toBe(false);
  });
});
