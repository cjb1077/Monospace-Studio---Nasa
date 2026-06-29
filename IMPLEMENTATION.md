# IMPLEMENTATION.md -- ASCII Art Studio

The source of truth for architecture, contracts, and the ordered build plan. Read
`AGENTS.md` first for the rules of engagement (including the mandatory **Git, GitHub, and Notes Workflow** for tracking and updating issue/project board states).
Build the phases in order; each task is small, has a verification step, and requires running the tracking sync commands.

---

## 1. What we're building

A single-page web app plus a gallery:

1. The app fetches the **NASA Astronomy Picture of the Day (APOD)** -- a real image with
   a title and a written explanation -- on the server.
2. It converts that image into **ASCII art** in code (deterministic, no AI).
3. Two **LLM features** run server-side:
   - **Feature 1 -- AI style direction:** given the image title/explanation, the LLM
     returns ASCII conversion settings suited to the subject (structured JSON).
   - **Feature 2 -- AI caption + fun fact:** given the title/explanation, the LLM returns
     a short themed caption and one fun fact (structured JSON).
4. The browser renders the ASCII art, the caption, and the fun fact.
5. Signed-in users **save renders** to a Supabase-backed gallery (CRUD + auth).

Why this satisfies the assignment: a real external API (NASA) as the data backbone,
two genuine AI features that add value, full CRUD + auth to test, clear error/rate-limit
handling, and very low API cost (NASA is free; LLM calls are a few hundred tokens each).

## 2. Architecture

```
Browser (client components)
   |  fetch /api/apod, /api/renders
   v
Next.js API routes (server only)  --- NASA_API_KEY --->  NASA APOD API
   |                              --- LLM_API_KEY  --->  LLM (OpenAI-compatible)
   |  ascii conversion (pure code, server)
   v
Supabase (Postgres + Auth + RLS)
```

Keys live only in server code and env vars. The client never talks to NASA or the LLM
directly; it only calls our own `/api/*` routes.

### Request lifecycle (generate flow)
1. Client calls `GET /api/apod?date=YYYY-MM-DD` (date optional; defaults to today).
2. Server fetches APOD. If `media_type !== "image"`, it walks back day-by-day (up to ~7
   days) to find an image; if none, returns a bundled default image marker.
3. Server downloads the image bytes (from `url`, not `hdurl`, to keep conversion fast).
4. Server calls LLM Feature 1 with the trimmed title + explanation -> style settings.
5. Server converts the image to ASCII using those settings.
6. Server calls LLM Feature 2 -> caption + fun fact.
7. Server returns one JSON payload: ascii text, the source metadata, the caption, the
   fun fact, and `aiStyleUsed` / `aiCaptionUsed` flags.
8. Client renders it. If signed in, the user can POST it to `/api/renders`.

Feature 1 runs before conversion (it shapes the conversion); Feature 2 can run in
parallel with conversion to save time, but sequential is fine for v1.

### Diagrams -- Mermaid
All diagrams live as Mermaid fenced blocks in `DIAGRAMS.md`. Use the right type per
concern:
- `flowchart` for architecture / component layout
- `sequenceDiagram` for request/response and auth flows (e.g. the generate lifecycle
  above, and the Supabase auth flow)
- `erDiagram` for the data model (the `renders` table)
- `stateDiagram-v2` for state machines

Keep each diagram focused on one concern. Reference diagrams from this file rather than
duplicating them.

## 3. Tech + folder layout

```
src/
  app/
    page.tsx                 # studio page (pick date, see art + caption, save)
    gallery/page.tsx         # gallery: own + public renders
    api/
      apod/route.ts          # GET: fetch APOD, convert, run both LLM features
      renders/route.ts       # GET (list), POST (save)
      renders/[id]/route.ts  # DELETE (own only)
  lib/
    nasa/apod.ts             # fetch APOD, handle video/fallback, download image
    ascii/convert.ts         # pure image-buffer -> ascii string (deterministic)
    llm/config.ts            # reads LLM_PROVIDER, resolves baseURL + model + key
    llm/client.ts            # cached OpenAI-compatible client instance
    llm/chat.ts              # createChatCompletion, createJsonCompletion, retries, errors
    prompts/style.ts         # Feature 1 prompt + JSON schema text
    prompts/caption.ts       # Feature 2 prompt + JSON schema text
    style/index.ts           # Feature 1 logic: call LLM, zod validate, fallback
    caption/index.ts         # Feature 2 logic: call LLM, zod validate, fallback
    supabase/server.ts       # server client (cookies)
    supabase/client.ts       # browser client
    types.ts                 # shared TS types / zod schemas
  middleware.ts              # Supabase session refresh
  app/api/llm/test/route.ts  # LLM connectivity smoke test (config + round-trip)
supabase/
  schema.sql                 # renders table + RLS policies
scripts/
  test-llm.ts                # CLI: basic chat completion smoke test
tests/                       # vitest unit + api tests
postman/collection.json      # documented endpoints
```

Env vars (`.env.local`, and set in Netlify). Pick ONE provider block; switch by
`LLM_PROVIDER` only (see section 6 for full details):
- Always: `NASA_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` (server-only).
- Trussed (demo/deploy): `LLM_PROVIDER=trussed`, `TRUSSED_API_KEY`, `TRUSSED_BASE_URL`,
  `LLM_MODEL=cogito:14b`.
- LM Studio (local dev default): `LLM_PROVIDER=openai-compatible`,
  `OPENAI_API_KEY=lm-studio` (any non-empty string), `OPENAI_BASE_URL=http://localhost:1234/v1`,
  `LLM_MODEL=qwen/qwen2.5-27b-instruct` (an instruct model -- not a thinking model).

No LLM key ever gets a `NEXT_PUBLIC_` prefix.

## 4. External API: NASA APOD

- Endpoint: `https://api.nasa.gov/planetary/apod`
- Params: `api_key` (required; `DEMO_KEY` works for early dev), `date=YYYY-MM-DD`
  (optional, defaults to today; must be >= 1995-06-16; no future dates).
- Response fields used: `title`, `explanation`, `url`, `hdurl`, `media_type`, `date`,
  `copyright` (may be absent -> public domain).
- Gotchas to handle:
  - `media_type` may be `"video"` -> no image to convert. Walk back to a recent image
    day, or use the bundled default.
  - `hdurl` may be missing; some `url`s are `.gif`. Prefer `url`; if conversion fails on
    the format, fall back to default.
  - Rate limit: `DEMO_KEY` is very low; a registered key allows far more. On HTTP 429,
    back off and show a message.

## 5. Contracts (API shapes)

`GET /api/apod?date=YYYY-MM-DD`
```json
{
  "ok": true,
  "source": {
    "title": "string",
    "date": "YYYY-MM-DD",
    "imageUrl": "string",
    "copyright": "string|null",
    "explanation": "string (trimmed for display)"
  },
  "ascii": "string (monospace art)",
  "style": { "charSet": "standard|fine|blocky", "density": 0.6, "invert": false },
  "caption": "string",
  "funFact": "string",
  "aiStyleUsed": true,
  "aiCaptionUsed": true,
  "usedFallbackImage": false
}
```
Error shape (all routes): `{ "ok": false, "error": "user-friendly message", "code": "BAD_DATE|NASA_DOWN|NASA_RATE_LIMIT|LLM_DOWN|UNAUTHORIZED|NOT_FOUND|SERVER" }`.

`GET /api/renders` -> `{ "ok": true, "renders": Render[] }`
(returns the caller's own renders plus any `is_public = true`).

`POST /api/renders` (auth required) body:
```json
{ "title": "string", "ascii": "string", "caption": "string",
  "funFact": "string", "sourceDate": "YYYY-MM-DD", "isPublic": false }
```
-> `{ "ok": true, "render": Render }`

`DELETE /api/renders/:id` (auth required, owner only) -> `{ "ok": true }`

`Render`:
```json
{ "id": "uuid", "userId": "uuid", "title": "string", "ascii": "string",
  "caption": "string", "funFact": "string", "sourceDate": "YYYY-MM-DD",
  "isPublic": false, "createdAt": "timestamp" }
```

## 6. LLM contracts (both features return JSON only)

The client mechanics -- provider config, `createJsonCompletion`, JSON mode, retries,
typed errors -- live in `LLM_INTEGRATION.md`. This section defines only the two feature
schemas and their fallbacks. Both call `createJsonCompletion` and zod-validate the
result.

Feature 1 -- style. System prompt instructs: return ONLY JSON, no prose.
```json
{ "charSet": "standard|fine|blocky", "density": 0.4-0.9, "invert": true|false,
  "reasoning": "one short sentence" }
```
Validate with a schema. On parse failure, timeout, or out-of-range values -> fallback
`{ charSet: "standard", density: 0.6, invert: false }`, set `aiStyleUsed: false`.

Feature 2 -- caption + fun fact. System prompt: return ONLY JSON.
```json
{ "caption": "<= 140 chars", "funFact": "<= 200 chars" }
```
On failure -> caption = first sentence of the trimmed explanation, funFact = "" and set
`aiCaptionUsed: false`.

Always trim the explanation to ~1,500 chars before sending. Never send image bytes.

## 7. ASCII converter (pure, testable)

`convertImageToAscii(buffer, { charSet, density, invert, maxWidth }) -> string`

- Decode the image, downscale to a target column count (e.g. 80-120 cols; account for
  the ~2:1 character aspect ratio by halving rows).
- For each cell, compute luminance, map to a character from the chosen ramp:
  - `standard`: `" .:-=+*#%@"`
  - `fine`: a longer 16+ char ramp for smooth gradients
  - `blocky`: ` .:oO0@` style high-contrast ramp
- `invert` flips the ramp (useful for dark-on-light vs light-on-dark sources).
- `density` scales how aggressively mid-tones map toward darker glyphs.
- Pure function, no network, no randomness -> deterministic, easy to unit test with a
  small synthetic image (e.g. a known gradient).

## 8. Database (Supabase)

`supabase/schema.sql`:
```sql
-- Table: public.cached_apods
create table public.cached_apods (
  source_date date primary key,
  title text not null,
  explanation text not null,
  image_url text not null,
  copyright text,
  ascii text not null,
  char_set text not null,
  density numeric(3, 2) not null,
  invert boolean not null,
  caption text not null,
  fun_fact text not null,
  ai_style_used boolean not null,
  ai_caption_used boolean not null,
  used_fallback_image boolean not null,
  created_at timestamptz not null default now()
);
alter table public.cached_apods enable row level security;

-- Table: public.renders
create table public.renders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  ascii text not null,
  caption text default '',
  fun_fact text default '',
  source_date date not null,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.renders enable row level security;

-- RLS policies: cached_apods
create policy "read public cached_apods" on public.cached_apods
  for select using (true);
create policy "insert authenticated cached_apods" on public.cached_apods
  for insert with check (auth.role() = 'authenticated');

-- RLS policies: renders
create policy "read own or public" on public.renders
  for select using (auth.uid() = user_id or is_public = true);
create policy "insert own" on public.renders
  for insert with check (auth.uid() = user_id);
create policy "delete own" on public.renders
  for delete using (auth.uid() = user_id);
```

## 9. Build plan (ordered tasks)

Each task ends with a verification step. Commit after each. Write tests where noted.

### Phase 0 -- Project setup
- 0.1 [Issue 1] Create Next.js (App Router, TypeScript) app. Verify: `npm run dev` serves the
  default page.
- 0.2 [Issue 2] Add Vitest + a trivial passing test. Verify: `npm test` is green.
- 0.3 [Issue 3] Add `.env.local.example` listing every env var from section 3 (no real values).
  Verify: file present, README references it.
- 0.4 [Issue 4] Init git, commit. Verify: clean `git status`.

### Phase 1 -- NASA APOD integration (server)
- 1.1 [Issue 5] `lib/nasa/apod.ts`: `fetchApod(date?)` calling the endpoint with `NASA_API_KEY`.
  Verify: a quick script logs a real title for today.
- 1.2 [Issue 6] Handle `media_type === "video"`: walk back up to 7 days to find an image; if none,
  return a `usedFallbackImage` marker. Verify: unit test with mocked video response
  walks back and stops.
- 1.3 [Issue 7] `downloadImage(url)` returning a buffer, with timeout + content-type check.
  Verify: unit test with a mocked fetch returns a buffer; bad type throws typed error.
- 1.4 [Issue 8] `GET /api/apod` route returning `source` only (no ascii/LLM yet). Verify: hitting
  the route returns JSON with a real title.

### Phase 2 -- ASCII converter (pure)
- 2.1 [Issue 9] Write a FAILING unit test: a known 2x2 gradient image -> expected ascii string for
  `charSet: "standard"`. Verify: test fails (red).
- 2.2 [Issue 9] Implement `convertImageToAscii` minimally to pass. Verify: test passes (green).
- 2.3 [Issue 9] Add `fine` and `blocky` ramps + `invert` + `density`, each with a unit test.
  Verify: all converter tests green.
- 2.4 [Issue 10] Wire converter into `/api/apod` with default settings. Verify: route now returns a
  non-empty `ascii` field.

### Phase 3 -- LLM features (server)
Adopt the prebuilt LLM layer from `LLM_INTEGRATION.md` -- do NOT write a client from
scratch. Dev runs against LM Studio; the same code targets Trussed by env var.
- 3.1 [Issue 11] Add `lib/llm/config.ts`, `client.ts`, `chat.ts` per `LLM_INTEGRATION.md` (provider
  config, cached client, `createChatCompletion` / `createJsonCompletion` with JSON mode,
  3-attempt retry, typed errors). Add the `test:llm` script and `GET /api/llm/test`
  smoke route. Verify: with LM Studio running, `npm run test:llm` returns a completion
  and `/api/llm/test` reports connectivity from the browser.
- 3.2 [Issue 12] Feature 1 `lib/prompts/style.ts` + `lib/llm/style.ts`: build the prompt with the
  JSON schema, call `createJsonCompletion`, zod-validate (charSet in enum, density
  0.4-0.9, invert boolean), retry once, then fallback. Write a test feeding malformed /
  out-of-range JSON -> returns fallback `{standard,0.6,false}` with `aiStyleUsed:false`.
  Verify: test green.
- 3.3 [Issue 13] Feature 2 `lib/prompts/caption.ts` + `lib/llm/caption.ts`: same pattern; validate
  non-empty caption/funFact within length caps; fallback = first sentence of the trimmed
  explanation, `aiCaptionUsed:false`. Test the fallback path. Verify: test green.
- 3.4 [Issue 14] Wire both features and database caching into `/api/apod`:
  - Check the `cached_apods` table first. On cache hit, return the cached result.
  - On cache miss, fetch NASA APOD -> Feature 1 -> convert -> Feature 2. Trim explanation to ~1,500 chars before sending (never send image bytes). Write the generated result to `cached_apods` (map snake_case DB columns to camelCase API response fields).
  - Verify: first fetch of a new date is slow (~2-4s), subsequent fetches are sub-100ms. Stop LM Studio and confirm both fallbacks fire, the route still returns 200, and is cached correctly with `aiStyleUsed: false`/`aiCaptionUsed: false`.

### Phase 4 -- Studio UI
- 4.1 [Issue 15] `app/page.tsx`: date picker (default today), "Generate" button, loading state.
  Verify: clicking generate shows a spinner then the ascii art in a monospace block.
- 4.2 [Issue 16] Render caption + fun fact, and a notice when a fallback was used
  (`aiStyleUsed`/`aiCaptionUsed`/`usedFallbackImage`). Verify: forcing a fallback shows
  the notice.
- 4.3 [Issue 17] Style controls (charSet, density, invert) that re-request conversion. Verify:
  changing a control updates the art.
- 4.4 [Issue 18] Error states: NASA down, rate-limited, bad date -> friendly messages, no crash.
  Verify: simulate each and confirm the message.

### Phase 5 -- Auth + gallery (CRUD)
- 5.1 [Issue 19] Supabase auth (email magic link or OAuth) + `middleware.ts` session refresh +
  server/client helpers. Verify: sign in, see session; sign out clears it.
- 5.2 [Issue 20] Apply `schema.sql` (both `renders` and `cached_apods` tables + RLS policies). Verify: in the Supabase dashboard, RLS is active on both tables and policies exist.
- 5.3 [Issue 21] `POST /api/renders` (auth required) + "Save" button on the studio page. Write an
  api test: unauthorized POST is rejected; authorized POST inserts. Verify: tests green,
  row appears.
- 5.4 [Issue 22] `GET /api/renders` + `app/gallery/page.tsx` listing own + public renders. Verify:
  saved render shows in the gallery.
- 5.5 [Issue 23] `DELETE /api/renders/:id` (owner only) + delete button. Test: deleting another
  user's row is rejected. Verify: test green; own delete works.

### Phase 6 -- Polish, docs, deploy
- 6.1 [Issue 24] Loading/empty/error states reviewed across the app; fix rough edges. Verify:
  click through every flow with no console errors.
- 6.2 [Issue 25] Build the Postman/Thunder Client collection covering all four endpoints incl.
  error cases (bad date, unauthorized, not found). Commit it. Verify: collection runs.
- 6.3 [Issue 26] README: overview, setup, env vars, run steps, **AI features section**, endpoint
  docs, **API cost estimates** (NASA free; LLM ~N tokens/call x price), edge cases, and
  a **link to the demo video**. Verify: a new reader could set it up from the README.
- 6.4 [Issue 27] Deploy to Netlify with all env vars set server-side. Verify: the live URL runs end
  to end (generate + save + gallery).
- 6.5 [Issue 27] Record the 3-5 min demo video, link it in the README. Verify: link works.

## 10. Cost notes (for the README cost doc)
- NASA APOD: free. Register a key to avoid `DEMO_KEY` rate limits.
- LLM: with the pinned setup, **$0** -- LM Studio runs locally and Trussed `cogito:14b`
  is the free course proxy. The cost doc should explain this provider setup rather than
  quote per-token prices. For completeness, note the *shape* of usage: two small calls
  per generate (style ~100-200 tokens out, caption ~100-250 out; input is the trimmed
  <=1,500-char explanation), so if a paid OpenAI-compatible provider were swapped in,
  cost per generate = (input + output tokens) x that model's price. ASCII conversion is
  pure code and costs nothing.
- Caching idea (optional): cache the APOD + ascii by date so repeat views of the same
  day don't re-call the LLM.

## 11. Open questions to log in NOTES.md as you decide
- Resolved: LLM layer = LM Studio (dev) / Trussed `cogito:14b` (deploy), text-only,
  via the prebuilt layer in `LLM_INTEGRATION.md`. Feature 1 infers style from the APOD
  title + explanation (not the image pixels) -- keeps it on the text-chat layer. If you
  later want pixel-aware styling, that needs a vision model and is a separate decision.
- Pick the specific LM Studio instruct model id you load (must be instruct, not thinking).
- Auth method (magic link vs OAuth provider).
- Column width / character ramps you settle on after eyeballing real APOD images.
- Whether to cache by date.
