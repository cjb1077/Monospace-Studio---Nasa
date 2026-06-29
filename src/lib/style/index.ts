import { z } from "zod";
import { createJsonCompletion } from "../llm/chat";
import { getStylePrompt } from "../prompts/style";
import { AsciiStyle } from "../types";

// Schema to validate LLM output structure and value bounds
const styleSchema = z.object({
  charSet: z.enum(["standard", "fine", "blocky"]),
  density: z.number().min(0.4).max(0.9),
  invert: z.boolean(),
  reasoning: z.string(),
});

const DEFAULT_STYLE: AsciiStyle = {
  charSet: "standard",
  density: 0.6,
  invert: false,
};

/**
 * Recommends ASCII conversion parameters using the LLM based on APOD metadata.
 * Trims input explanation to 1500 chars to satisfy limits.
 * Employs Zod validation and retries once on JSON/validation failure,
 * before falling back to default styling parameters.
 * 
 * @param title NASA APOD title
 * @param explanation NASA APOD explanation
 * @returns Object indicating style settings and whether AI was successfully used
 */
export async function recommendStyle(
  title: string,
  explanation: string
): Promise<{ style: AsciiStyle; aiStyleUsed: boolean }> {
  // Trim explanation text to control cost/context limit
  const trimmedExplanation = explanation.slice(0, 1500);
  const messages = getStylePrompt(title, trimmedExplanation);

  const attemptStyle = async (): Promise<z.infer<typeof styleSchema>> => {
    const { data } = await createJsonCompletion<unknown>({
      messages,
      temperature: 0.2,
      maxTokens: 300,
    });
    return styleSchema.parse(data);
  };

  try {
    // Attempt 1
    const data = await attemptStyle();
    return {
      style: {
        charSet: data.charSet,
        density: data.density,
        invert: data.invert,
      },
      aiStyleUsed: true,
    };
  } catch (firstErr) {
    // Retry once on parse, validation, or network failures
    try {
      const data = await attemptStyle();
      return {
        style: {
          charSet: data.charSet,
          density: data.density,
          invert: data.invert,
        },
        aiStyleUsed: true,
      };
    } catch (secondErr) {
      // Graceful fallback on persistent failure
      return {
        style: DEFAULT_STYLE,
        aiStyleUsed: false,
      };
    }
  }
}
