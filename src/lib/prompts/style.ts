import { ChatMessage } from "../llm/chat";

/**
 * Generates the chat messages for Feature 1 (AI Style Direction).
 * Defines system instructions, schema rules, and builds the user prompt with the APOD title + explanation.
 * 
 * @param title NASA APOD image title
 * @param explanation NASA APOD explanation text (trimmed to <= 1500 characters)
 */
export function getStylePrompt(title: string, explanation: string): ChatMessage[] {
  const systemPrompt = `You are an assistant that returns ONLY valid JSON matching the given schema.
Do not include prose, markdown, or code fences.

Your job is to recommend ASCII art settings suited to the subject of a NASA Astronomy Picture of the Day.
You must choose the character set, density, and invert settings based on the image's subject matter.

Constraints:
- "charSet": choose exactly one of: "standard" (for normal details), "fine" (for smooth gradients, starry fields, nebulae), or "blocky" (for high-contrast, structural shapes, craters).
- "density": choose a decimal between 0.4 and 0.9. Lower density (e.g. 0.4-0.5) works best for bright, detailed images. Higher density (e.g. 0.7-0.9) works best for dark, sparse images like space backgrounds.
- "invert": set to true if the subject would render better inverted (dark characters on light background), otherwise false.
- "reasoning": a single short sentence explaining why you selected these settings.`;

  const userPrompt = `Image Title: ${title}
Image Explanation: ${explanation}

Provide your recommendations in this JSON schema:
{
  "charSet": "standard" | "fine" | "blocky",
  "density": number,
  "invert": boolean,
  "reasoning": "string"
}`;

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}
