# AGENTS.md

Shared guidance for any AI agent working in this repo (Cursor, Claude, or other
agentic tools). This project is an **ASCII art studio**: it pulls a real image from an
external data API (NASA APOD), converts it to ASCII art, and uses an LLM for two
features (style direction + caption/fun-fact). Users sign in and save renders to a
gallery.

Read `IMPLEMENTATION.md` for the full architecture, contracts, and the ordered build
plan. This file is the rules-of-engagement; `IMPLEMENTATION.md` is the what-to-build.

---

## Project summary
Next.js app. Fetch the NASA Astronomy Picture of the Day (image + title + explanation)
server-side -> convert the image to ASCII art in code -> run two LLM features over it
(1: pick ASCII style settings, 2: write a themed caption + fun fact) -> render in the
browser -> let authenticated users save renders to a Supabase-backed gallery.

The two required AI features are:
1. **AI style direction** -- LLM chooses ASCII conversion settings to suit the image.
2. **AI caption + fun fact** -- LLM writes a short themed caption and one fun fact.

Both return structured JSON, never free-form chat. Both have non-AI fallbacks.

## Stack
- Next.js App Router (TypeScript)
- Supabase (auth + Postgres + RLS)
- NASA APOD API -- server-side only (key never reaches the browser)
- LLM via an OpenAI-compatible client (`openai` npm package), one client / many backends:
  - Default for local dev: **LM Studio** (instruct model, e.g. `qwen/qwen2.5-27b-instruct`).
  - Default for demo + deploy: **FAU Trussed**, model `cogito:14b` (course proxy, $0).
  - Switch providers by env var only -- no code changes. Full setup in `LLM_INTEGRATION.md`.
  - Keys are server-side only and never `NEXT_PUBLIC_`.
- Deployed on Netlify
- Tested with Vitest (unit) + a documented Postman/Thunder Client collection

## How to work
- Build in the order given by `IMPLEMENTATION.md` (Phase 0 -> Phase 6). One task at a
  time. Each task is small (a few minutes) and has a verification step -- run it.
- Drive behavior changes with a test where the task says so. Don't claim a test passes
  without running it.
- Keep changes scoped to the current task. Don't expand scope or refactor unrelated code.
- Commit per completed task with a message referencing the task number.
- If reality contradicts `IMPLEMENTATION.md`, stop and surface the conflict in
  `NOTES.md` rather than silently diverging. The plan stays the source of truth; update
  it deliberately.

## Use Superpowers
This project runs on the Superpowers methodology. Let the skills drive the flow -- do not
improvise around them:
- **brainstorming** -- refine the spec through clarifying questions before producing any
  plan. Present design in digestible sections for approval.
- **writing-plans** -- break work into bite-sized tasks (2-5 min each), each with exact
  file paths, complete code, and verification steps. This output goes into
  `IMPLEMENTATION.md` (the ordered build plan).
- **using-git-worktrees** -- set up an isolated workspace after design approval if needed.

Trust the skill triggers; they activate automatically. Do not skip brainstorming
"because the task is simple."

## Security & invariants (never relax these)
- `NASA_API_KEY` and the LLM API key live only in server-side code (`src/app/api/**`,
  `src/lib/**`) and environment variables. They must never appear in client components,
  client bundles, `NEXT_PUBLIC_*` vars, or network responses to the browser.
- All external calls (NASA, LLM) happen in server route handlers or server-only lib
  modules -- never from the client.
- Auth is required on any route that writes user data (`/api/renders` POST/DELETE).
- Use Supabase Row Level Security. Users can only read/update/delete their own rows
  (plus read rows explicitly marked public). Never use the service-role key in
  client-reachable code.
- LLM output must be parsed as structured JSON. If parsing fails, use the fallback --
  never render raw model text as if it were the structured result.
- Trim text sent to the LLM: cap the APOD explanation at ~1,500 characters before
  sending. Never send image binary to the text LLM.

## Error handling & UX (required by the rubric)
- Every external call (NASA, LLM) is wrapped with try/catch, a timeout, and a typed
  result. Surface user-friendly messages, never raw stack traces.
- Show loading states for every async AI/data operation.
- Handle rate limits (HTTP 429) gracefully: detect, back off, and show a clear message.
- Defined fallbacks:
  - APOD `media_type === "video"` or fetch fails -> fall back to a recent image-type day
    or a bundled default image; tell the user.
  - LLM style call fails -> use default conversion settings (`charSet: "standard"`,
    `density: 0.6`, `invert: false`) and set `aiStyleUsed: false`.
  - LLM caption call fails -> show the raw (trimmed) APOD explanation and set
    `aiCaptionUsed: false`.

## Testing (required by the rubric)
- Unit tests for the ASCII converter (pure function -- easy to test deterministically),
  the LLM response parsers, and the fallback logic.
- API/auth tests: at minimum, the renders CRUD (create/list/delete) and that
  unauthorized writes are rejected.
- Document every endpoint (method, route, request body, response shape, error cases) in
  the README and in a Postman/Thunder Client collection committed to the repo.
- Verify edge cases: invalid date, video-type APOD, NASA 429, LLM timeout, unauthorized
  delete, malformed LLM JSON.

## Deliverables to keep current
- `README.md` -- overview, setup, env vars, how to run, **AI features section**, API cost
  estimates, endpoint docs, and a link to the demo video.
- `IMPLEMENTATION.md` -- architecture + ordered build plan (source of truth).
- `DIAGRAMS.md` -- Mermaid diagrams (architecture, generate lifecycle, auth, ERD).
- `NOTES.md` -- running log: decisions, assumptions, conflicts found, fallbacks chosen.
  Append as you go.
- Postman/Thunder Client collection -- committed, matches the documented endpoints.

## Do not
- Put any API key in client code, `NEXT_PUBLIC_*`, or a response body.
- Call NASA or the LLM directly from a client component.
- Render unparsed LLM text as the structured result.
- Send the APOD image binary to the text LLM, or send untrimmed explanation text.
- Build a generic chatbot UI as the main feature -- the app is a converter + gallery.
- Skip auth on write routes, or bypass RLS with the service-role key client-side.
- Use a "thinking" LLM model (e.g. qwen3.x). They return empty `content` and only
  `reasoning_content`, surfacing as `REASONING_ONLY`. Use instruct models only.
- Use `gpt-4o` on Trussed -- it is not on the FAU allowlist. Use `cogito:14b`.
- Claim a build or test passes without running it.
- Expand a task beyond what `IMPLEMENTATION.md` specifies for it.

## Reference
- `IMPLEMENTATION.md` -- architecture, contracts, ordered build steps
- `LLM_INTEGRATION.md` -- LLM layer: providers, env, client helpers, feature pattern
- `DIAGRAMS.md` -- Mermaid diagrams
- `NOTES.md` -- decision log (append findings here)
- `README.md` -- setup + endpoint + cost + demo docs
