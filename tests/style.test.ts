import { describe, it, expect, vi, beforeEach } from "vitest";
import { recommendStyle } from "../src/lib/style";
import * as chatModule from "../src/lib/llm/chat";

vi.mock("../src/lib/llm/chat", async () => {
  const actual = await vi.importActual<typeof chatModule>("../src/lib/llm/chat");
  return {
    ...actual,
    createJsonCompletion: vi.fn(),
  };
});

describe("recommendStyle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return recommended style on successful LLM response", async () => {
    vi.mocked(chatModule.createJsonCompletion).mockResolvedValue({
      data: {
        charSet: "fine",
        density: 0.75,
        invert: true,
        reasoning: "Test reasoning",
      },
      meta: { model: "test-model", provider: "test" },
    });

    const result = await recommendStyle("Galaxy", "A beautiful spiral galaxy.");
    expect(result.style).toEqual({ charSet: "fine", density: 0.75, invert: true });
    expect(result.aiStyleUsed).toBe(true);
  });

  it("should retry and fall back to default if validation fails twice", async () => {
    vi.mocked(chatModule.createJsonCompletion).mockResolvedValue({
      data: {
        charSet: "invalid-charset",
        density: 1.5,
        invert: false,
        reasoning: "Invalid density",
      },
      meta: { model: "test-model", provider: "test" },
    });

    const result = await recommendStyle("Galaxy", "A beautiful spiral galaxy.");
    expect(result.style).toEqual({ charSet: "standard", density: 0.6, invert: false });
    expect(result.aiStyleUsed).toBe(false);
    expect(chatModule.createJsonCompletion).toHaveBeenCalledTimes(2);
  });

  it("should retry once and succeed if the second attempt passes validation", async () => {
    vi.mocked(chatModule.createJsonCompletion)
      .mockRejectedValueOnce(new Error("Network issue"))
      .mockResolvedValueOnce({
        data: {
          charSet: "blocky",
          density: 0.45,
          invert: false,
          reasoning: "Valid on second try",
        },
        meta: { model: "test-model", provider: "test" },
      });

    const result = await recommendStyle("Galaxy", "A beautiful spiral galaxy.");
    expect(result.style).toEqual({ charSet: "blocky", density: 0.45, invert: false });
    expect(result.aiStyleUsed).toBe(true);
    expect(chatModule.createJsonCompletion).toHaveBeenCalledTimes(2);
  });
});
