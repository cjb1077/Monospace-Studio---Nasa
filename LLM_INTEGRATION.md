# LLM_INTEGRATION.md -- ASCII Art Studio

The LLM layer for this project. Adapted from a tested integration plan. `AGENTS.md` is
the rules; `IMPLEMENTATION.md` is the build plan; this file is the LLM subsystem the two
AI features sit on. Build `src/lib/llm/` from this, then build the two features on top.

Pinned for this project: **LM Studio** for local dev, **FAU Trussed `cogito:14b`** for
demo + deploy. Switching between them is an env-var change, no code change.

---

## 1. Design principle

One client, many backends. The official `openai` npm package talks to any
OpenAI-compatible endpoint, so we switch providers by changing env vars only.

```
Browser -> Next.js API route -> src/lib/llm/ -> LM Studio | Trussed | OpenAI
                                  (server only)
                              API keys never reach the client
```

| Rule | Why |
|------|-----|
| LLM calls only in `src/lib/llm/`, `src/lib/<feature>/`, and `src/app/api/` | Keys stay server-side |
| Structured JSON output, not free chat | The rubric wants meaningful AI features, not a chatbot wrapper |
| Validate + retry + fallback | Local/cloud models drift; the app must still work |

## 2. File layout

| Path | Role |
|------|------|
| `src/lib/llm/config.ts` | Reads `LLM_PROVIDER`, resolves base URL + model + API key |
| `src/lib/llm/client.ts` | Cached `openai` client instance |
| `src/lib/llm/chat.ts` | `createChatCompletion`, `createJsonCompletion`, retries, typed errors |
| `src/lib/prompts/style.ts` | Feature 1: system prompt, user prompt builder, JSON schema text |
| `src/lib/prompts/caption.ts` | Feature 2: system prompt, user prompt builder, JSON schema text |
| `src/lib/style/index.ts` | Feature 1 logic: call LLM, zod validate, fallback |
| `src/lib/caption/index.ts` | Feature 2 logic: call LLM, zod validate, fallback |
| `src/app/api/llm/test/route.ts` | Smoke-test endpoint (config + connectivity) |
| `src/app/api/apod/route.ts` | Production endpoint that runs both features (see IMPLEMENTATION.md) |
| `scripts/test-llm.ts` | CLI smoke test |
| `scripts/test-features.ts` | CLI: APOD -> style -> convert -> caption, with timing |

## 3. Environment configuration

Copy `.env.example` -> `.env.local`. Pick one provider block.

### Option A -- LM Studio (local dev default)
1. Load an **instruct** model in LM Studio (e.g. `qwen/qwen2.5-27b-instruct`).
2. Developer tab -> Start Server (default `http://localhost:1234`).
3. Confirm the model id: `curl http://localhost:1234/v1/models`

```
LLM_PROVIDER=openai-compatible
OPENAI_API_KEY=lm-studio
OPENAI_BASE_URL=http://localhost:1234/v1
LLM_MODEL=qwen/qwen2.5-27b-instruct
```
- `OPENAI_API_KEY` can be any non-empty string; LM Studio usually ignores it.
- Avoid **thinking** models (e.g. `qwen/qwen3.x`): they return empty `content` and only
  populate `reasoning_content`, surfacing as `REASONING_ONLY`. Use instruct models.

### Option B -- FAU Trussed.ai (demo / deploy default)
```
LLM_PROVIDER=trussed
TRUSSED_API_KEY=your_key_from_instructor
TRUSSED_BASE_URL=https://fauengtrussed.fau.edu/provider/generic
LLM_MODEL=cogito:14b
```
- Endpoint: `POST {TRUSSED_BASE_URL}/chat/completions`
- Auth: `Authorization: Bearer {TRUSSED_API_KEY}`
- `gpt-4o` is NOT on the FAU allowlist. Use `cogito:14b` (maps to `openai/cogito:14b`).

### Option C -- Ollama (local alternative)
```
LLM_PROVIDER=openai-compatible
OPENAI_API_KEY=ollama
OPENAI_BASE_URL=http://localhost:11434/v1
LLM_MODEL=qwen2.5:7b-instruct
```

### Option D -- Direct OpenAI
```
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

## 4. Core client code

### Config (`src/lib/llm/config.ts`)
`getLlmConfig()` branches on `LLM_PROVIDER`:
- `trussed` -> `TRUSSED_API_KEY` + `TRUSSED_BASE_URL`
- `openai` / `openai-compatible` -> `OPENAI_API_KEY` + `OPENAI_BASE_URL`
Returns `{ apiKey, baseURL, model }`. Throw a clear error if a required var is missing.

### Client (`src/lib/llm/client.ts`)
```ts
import OpenAI from "openai";
const { apiKey, baseURL } = getLlmConfig();
const client = new OpenAI({ apiKey, baseURL });
```
One cached client per process, reused across API requests.

### Chat helpers (`src/lib/llm/chat.ts`)
`createChatCompletion` -- general text:
```ts
const result = await createChatCompletion({
  messages: [
    { role: "system", content: "..." },
    { role: "user", content: "..." },
  ],
  temperature: 0.3,
  maxTokens: 800,
});
```
`createJsonCompletion` -- structured features (style, caption):
```ts
const { data, meta } = await createJsonCompletion<MySchema>({
  messages: [...],
  maxTokens: 600,
});
// data = parsed JSON; meta includes model, usage, provider
```

Built-in behavior:

| Behavior | Detail |
|----------|--------|
| JSON mode | Sets `response_format: { type: "json_object" }` when `jsonMode: true` |
| 429 / 502 / 503 retry | Up to 3 attempts, exponential backoff |
| Empty response | `EMPTY_RESPONSE` error |
| Thinking models | `REASONING_ONLY` if `content` empty but `reasoning_content` present |
| Bad JSON | `INVALID_JSON` after parse failure |

## 5. Feature integration pattern

Both AI features follow the same shape. (Full schemas + fallbacks are in
`IMPLEMENTATION.md` section 6; don't duplicate them -- reference them.)

1. **Gather input** -- the APOD `title` + `explanation`, trimmed to ~1,500 chars.
2. **Build prompts** -- `src/lib/prompts/<feature>.ts`: system role + constraints +
   "return ONLY valid JSON matching this schema", user message with the input.
3. **Call LLM** -- `createJsonCompletion` with the schema described in the prompt.
4. **Validate** -- zod against a strict schema:
   - Feature 1 (style): `charSet` in `{standard,fine,blocky}`, `density` 0.4-0.9,
     `invert` boolean. Out-of-range -> treat as invalid.
   - Feature 2 (caption): non-empty `caption` (<=140 chars) and `funFact` (<=200 chars).
5. **Retry once** on `INVALID_JSON` or validation failure.
6. **Fallback** (graceful degradation, app still works for the demo):
   - Feature 1 -> `{ charSet: "standard", density: 0.6, invert: false }`,
     `aiStyleUsed: false`.
   - Feature 2 -> caption = first sentence of the trimmed explanation, funFact = "",
     `aiCaptionUsed: false`.
7. **Return** the validated (or fallback) object plus its `aiUsed` flag, so the API
   response and UI can advertise when the app degraded.

### Prompt structure (both features)
System -- role + hard constraint:
```
You are an assistant that returns ONLY valid JSON matching the given schema.
Do not include prose, markdown, or code fences.
```
User -- the trimmed APOD title + explanation, then the schema example to fill in.

### Anti-drift note
The original of this pattern (a places recommender) enforced "every id in the output
must exist in the input." Our analog is **range/enum clamping** for Feature 1 and
**length/non-empty checks** for Feature 2 -- same idea: never trust raw model output;
validate, retry once, then fall back.

## 6. Testing

| Command | What it checks |
|---------|----------------|
| `npm run test:llm` | Basic chat completion against the configured provider |
| `GET /api/llm/test` | Config + connectivity from the browser |
| `npm run test:features` | APOD -> style -> convert -> caption, full pipeline + timing |
| `/ -> Generate` | Full UI flow |

Example timing output (CLI):
```
APOD fetch:   373ms
LLM style:    1.20s
ASCII convert: 40ms
LLM caption:  1.80s
Total:        3.41s
Tokens (style):   prompt 410 / completion 60
Tokens (caption): prompt 430 / completion 120
```

## 7. Provider comparison (expected)

| Provider | Model | JSON quality | Latency | Cost |
|----------|-------|--------------|---------|------|
| LM Studio | `qwen/qwen2.5-27b-instruct` | Good | slower local | $0 local |
| LM Studio | smaller instruct (e.g. 7b) | OK | faster | $0 local |
| Trussed | `cogito:14b` | Good | ~5-7s | $0 (course) |
| any | a "thinking" model (qwen3.x) | Broken -- `REASONING_ONLY` | -- | -- |

## 8. Security checklist
- [ ] `TRUSSED_API_KEY` / `OPENAI_API_KEY` only in `.env.local` (gitignored)
- [ ] No `NEXT_PUBLIC_` prefix on any LLM key
- [ ] All LLM calls from API routes or server libs -- never the client
- [ ] Trim the APOD explanation (~1,500 chars) before sending (token/cost control)
- [ ] Never send image bytes to the text LLM

## 9. Switching providers (quick reference)

| Goal | Change |
|------|--------|
| Local dev | `LLM_PROVIDER=openai-compatible`, `OPENAI_BASE_URL=http://localhost:1234/v1` |
| Demo / deploy | `LLM_PROVIDER=trussed`, `LLM_MODEL=cogito:14b` |
| After any env change | Restart `npm run dev` (Next.js reads `.env.local` at boot) |

## 10. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `TRUSSED_API_KEY is not set` | Key missing/empty in `.env.local`; restart dev server |
| `404 model not on allowlist` | Use `cogito:14b` on Trussed |
| LLM endpoint unreachable | LM Studio server not running, or wrong port |
| `REASONING_ONLY` | Load an instruct model, not a thinking model |
| `INVALID_JSON` | Lower temperature, strengthen the schema in the prompt (retry is built in) |
| Fallback fires every time | Confirm the model supports `json_object`; inspect the prompt with `test:features` |
