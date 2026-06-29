/**
 * scripts/test-llm.ts
 *
 * CLI smoke test for the LLM layer.
 * Run with:  npm run test:llm
 *
 * Verifies:
 *  1. Config resolves without throwing
 *  2. A basic chat completion round-trip succeeds
 *
 * Reads .env.local automatically via dotenv.
 */

import { config as loadEnv } from "dotenv";
import { resolve } from "path";

// Load .env.local before importing the LLM modules
loadEnv({ path: resolve(process.cwd(), ".env.local") });

import { getLlmConfig } from "../src/lib/llm/config";
import { createChatCompletion } from "../src/lib/llm/chat";

async function main() {
  console.log("🔍  Resolving LLM config…");

  let cfg: ReturnType<typeof getLlmConfig>;
  try {
    cfg = getLlmConfig();
    console.log(`✅  Config OK`);
    console.log(`    provider : ${cfg.provider}`);
    console.log(`    baseURL  : ${cfg.baseURL}`);
    console.log(`    model    : ${cfg.model}`);
  } catch (err) {
    console.error("❌  Config error:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  console.log("\n🚀  Sending test chat completion…");
  const start = Date.now();

  try {
    const result = await createChatCompletion({
      messages: [
        {
          role: "system",
          content:
            "You are a terse assistant. Reply with exactly one word.",
        },
        { role: "user", content: "Say: pong" },
      ],
      temperature: 0,
      maxTokens: 10,
    });

    const elapsed = Date.now() - start;
    console.log(`✅  Completion received in ${elapsed}ms`);
    console.log(`    model    : ${result.meta.model}`);
    console.log(`    response : "${result.text}"`);
    if (result.meta.usage) {
      const { prompt_tokens, completion_tokens, total_tokens } =
        result.meta.usage;
      console.log(
        `    tokens   : ${prompt_tokens} prompt / ${completion_tokens} completion / ${total_tokens} total`
      );
    }
  } catch (err) {
    console.error(
      "❌  Completion error:",
      err instanceof Error ? err.message : err
    );
    process.exit(1);
  }

  console.log("\n✨  LLM layer smoke test passed.");
}

main();
