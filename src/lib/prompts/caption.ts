import { ChatMessage } from "../llm/chat";

/**
 * Generates the chat messages for Feature 2 (AI Caption & Fun-Fact).
 * Defines system instructions, schema rules, and builds the user prompt with the APOD title + explanation.
 * 
 * @param title NASA APOD image title
 * @param explanation NASA APOD explanation text (trimmed to <= 1500 characters)
 */
export function getCaptionPrompt(title: string, explanation: string): ChatMessage[] {
  const systemPrompt = `You are an assistant that returns ONLY valid JSON matching the given schema.
Do not include prose, markdown, or code fences.

Your job is to generate a short, themed caption and a fun fact based on the provided NASA Astronomy Picture of the Day.

Constraints:
- "caption": A short, creative caption or title themed around the image subject (must be 140 characters or fewer).
- "funFact": An interesting scientific fun fact about the subject (must be 200 characters or fewer).`;

  const userPrompt = `Image Title: ${title}
Image Explanation: ${explanation}

Provide your recommendations in this JSON schema:
{
  "caption": "string",
  "funFact": "string"
}`;

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}
