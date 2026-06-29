import { z } from "zod";
import { createJsonCompletion } from "../llm/chat";
import { getCaptionPrompt } from "../prompts/caption";

// Schema to validate LLM output structure and value bounds
const captionSchema = z.object({
  caption: z.string().min(1).max(140),
  funFact: z.string().max(200),
});

function getFirstSentence(text: string): string {
  if (!text) return "";
  const trimmed = text.trim();
  const match = trimmed.match(/^[^.!?]*[.!?]/);
  const sentence = match ? match[0].trim() : trimmed;
  // Ensure the fallback caption is safe for any 140 character limiters
  return sentence.length > 140 ? sentence.slice(0, 137) + "..." : sentence;
}

/**
 * Recommends a short themed caption and fun fact using the LLM based on APOD metadata.
 * Trims input explanation to 1500 chars to satisfy limits.
 * Employs Zod validation and retries once on JSON/validation failure,
 * before falling back to default parameters.
 * 
 * @param title NASA APOD title
 * @param explanation NASA APOD explanation
 * @returns Object indicating caption, fun fact, and whether AI was successfully used
 */
export async function recommendCaption(
  title: string,
  explanation: string
): Promise<{ caption: string; funFact: string; aiCaptionUsed: boolean }> {
  // Trim explanation text to control cost/context limit
  const trimmedExplanation = explanation.slice(0, 1500);
  const messages = getCaptionPrompt(title, trimmedExplanation);

  const attemptCaption = async (): Promise<z.infer<typeof captionSchema>> => {
    const { data } = await createJsonCompletion<unknown>({
      messages,
      temperature: 0.3,
      maxTokens: 400,
    });
    return captionSchema.parse(data);
  };

  try {
    // Attempt 1
    const data = await attemptCaption();
    return {
      caption: data.caption,
      funFact: data.funFact,
      aiCaptionUsed: true,
    };
  } catch (firstErr) {
    // Retry once on parse, validation, or network failures
    try {
      const data = await attemptCaption();
      return {
        caption: data.caption,
        funFact: data.funFact,
        aiCaptionUsed: true,
      };
    } catch (secondErr) {
      // Graceful fallback on persistent failure
      return {
        caption: getFirstSentence(trimmedExplanation),
        funFact: "",
        aiCaptionUsed: false,
      };
    }
  }
}
