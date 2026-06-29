# Monospace Studio — NASA APOD ASCII Art Studio

Monospace Studio is a Next.js web application that fetches the daily **NASA Astronomy Picture of the Day (APOD)**, converts it server-side into customized ASCII art, enriches the artwork using structured LLM analyses (Style Direction & Themed Captioning), and allows users to save and share their cosmic renders in a Supabase-backed gallery.

---

## 1. Project Overview & Architecture

Monospace Studio uses a decoupled, service-oriented architecture designed to run high-performance ASCII conversions and LLM features entirely on the server. This prevents API keys from ever leaking to the browser and keeps rendering light and fast.

```
Browser (client components)
   │   fetch /api/apod, /api/renders
   ▼
Next.js API routes (server only)  ─── NASA_API_KEY ───►  NASA APOD API
   │                              ─── LLM_API_KEY  ───►  LLM (LM Studio / Trussed)
   │   ascii conversion (pure code, server)
   ▼
Supabase (Postgres + Auth + RLS)
```

### Core Request Lifecycle (Generate Flow)
1. **Client Fetch:** Client requests `GET /api/apod?date=YYYY-MM-DD` (date is optional, defaulting to today).
2. **Cache Check:** Server queries the `cached_apods` table in Supabase. On a **Cache Hit**, the server immediately returns the cached payload.
3. **NASA Metadata Query:** On a **Cache Miss**, the server fetches NASA APOD metadata.
   - *Video walkback:* If the media type is `"video"`, the server automatically walks back day-by-day (up to 7 days) until it finds an image.
   - *API outage fallback:* If NASA is down or rate-limits the key, the server uses a bundled starry sky fallback image.
4. **LLM Feature 1 (Style Selection):** The server sends the trimmed APOD title & explanation to the LLM to choose style settings (character set, density, and invert switch).
5. **ASCII Conversion:** The server downloads the APOD image buffer (preferring standard `url` to keep downloads fast) and converts it to a monospace string based on the LLM's styling choice.
6. **LLM Feature 2 (Themed Caption & Fun Fact):** In parallel, the server asks the LLM to write a short themed caption and a scientific fun fact based on the explanation.
7. **Database Caching:** The resulting image, ASCII, style parameters, captions, and telemetry flags are cached in `cached_apods` for future hits.
8. **Client Display:** The client receives the payload, renders the preformatted ASCII art, shows the captions, and exposes interactive controls.

---

## 2. Environment Configuration

Copy the example file to initialize your local environment:
```bash
cp .env.local.example .env.local
```

### Shared Configuration
Ensure these variables are always defined:
```ini
# NASA API Credentials (register at api.nasa.gov)
NASA_API_KEY=your_nasa_api_key_here

# Supabase Project Connection Details
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Provider A: LM Studio (Local Dev Default)
Ensure LM Studio is running an **instruct** model (do not use thinking models like Qwen 3.x that output reasoning-only tags) on the default port:
```ini
LLM_PROVIDER=openai-compatible
OPENAI_API_KEY=lm-studio
OPENAI_BASE_URL=http://localhost:1234/v1
LLM_MODEL=qwen/qwen2.5-27b-instruct
```

### Provider B: FAU Trussed (Demo & Production Default)
For production deployments or demo submissions, route through the FAU course proxy:
```ini
LLM_PROVIDER=trussed
TRUSSED_API_KEY=your_fau_assigned_key
TRUSSED_BASE_URL=https://fauengtrussed.fau.edu/provider/generic
LLM_MODEL=cogito:14b
```

---

## 3. Developer Setup & Installation

### Prerequisite: Database Schema Setup
Execute the SQL definition located in `supabase/schema.sql` inside your Supabase SQL editor to create the `cached_apods` and `renders` tables and enable Row Level Security (RLS) policies.

### Local Installation
1. Install project dependencies:
   ```bash
   npm install
   ```
2. Start the local Next.js development server:
   ```bash
   npm run dev
   ```
3. Open your browser and navigate to `http://localhost:3000`.

---

## 4. AI Features & Fallback Strategy

Monospace Studio utilizes two server-side AI features that return strict, structured JSON structures. We implement strict input constraints, structured schema enforcement, validation, and automated fallbacks.

### Safety & Processing Invariants
* **Explanation Trimming:** APOD explanations are trimmed to `1,500 characters` maximum before being sent to the LLM to control token sizes and response time.
* **No Image Binaries:** Image bytes are never sent to the LLM. Both features run text-based inference from the APOD metadata to preserve latency.
* **JSON Mode & Zod Validation:** LLM responses are parsed inside Next.js and validated against strict Zod schemas. If the model returns malformed JSON or invalid values, it is retried once. On the second failure, the fallback configuration is loaded.

### Feature 1: Style Direction
* **Goal:** Choose the optimal ASCII art conversion parameters to match the cosmic subject's contrast and visual weight.
* **Schema:**
  ```json
  {
    "charSet": "standard|fine|blocky",
    "density": 0.4-0.9,
    "invert": true|false,
    "reasoning": "string"
  }
  ```
* **Fallback Strategy:** If LLM Feature 1 fails, the system logs `aiStyleUsed: false` and applies standard default configurations: `charSet: "standard"`, `density: 0.6`, `invert: false`.

### Feature 2: Caption & Fun Fact
* **Goal:** Generate a short, contextually-aware caption suitable for social media sharing, alongside an educational fun fact.
* **Schema:**
  ```json
  {
    "caption": "string (<= 140 chars)",
    "funFact": "string (<= 200 chars)"
  }
  ```
* **Fallback Strategy:** If LLM Feature 2 fails, the system logs `aiCaptionUsed: false` and falls back to:
  - `caption`: The first sentence of the original NASA APOD explanation.
  - `funFact`: Empty string (`""`).

---

## 5. API Endpoint Documentation

All error shapes return:
```json
{
  "ok": false,
  "error": "A user-friendly message explaining the error.",
  "code": "BAD_DATE|NASA_DOWN|NASA_RATE_LIMIT|LLM_DOWN|UNAUTHORIZED|NOT_FOUND|SERVER"
}
```

### 1. Fetch APOD Details
Retrieves the processed daily image, ASCII art, and LLM text assets.
* **Route:** `GET /api/apod`
* **Query Parameters:** `date` (optional, format: `YYYY-MM-DD`). Defaults to current UTC date.
* **Success Response (200 OK):**
  ```json
  {
    "ok": true,
    "source": {
      "title": "A Perfect Solar Eclipse",
      "date": "2026-06-28",
      "imageUrl": "https://apod.nasa.gov/apod/image/2606/eclipse.jpg",
      "copyright": "Jane Doe",
      "explanation": "A complete description of the solar eclipse..."
    },
    "ascii": "  ...::--++##@@\n ...::--++##@@\n",
    "style": {
      "charSet": "standard",
      "density": 0.6,
      "invert": false
    },
    "caption": "Catching shadows across the sky during the total solar eclipse.",
    "funFact": "During totality, the temperature can drop by up to 10 degrees Fahrenheit.",
    "aiStyleUsed": true,
    "aiCaptionUsed": true,
    "usedFallbackImage": false
  }
  ```

### 2. List Renders
Returns the caller's saved renders along with all items explicitly marked public.
* **Route:** `GET /api/renders`
* **Headers:** `Authorization: Bearer <Supabase_JWT>` (optional; if missing, returns only public renders)
* **Success Response (200 OK):**
  ```json
  {
    "ok": true,
    "renders": [
      {
        "id": "76495b45-1234-5678-abcd-ef1234567890",
        "userId": "d7182230-abcd-ef01-2345-6789abcdef01",
        "title": "Total Solar Eclipse",
        "ascii": " ...::--++##@@ ",
        "caption": "Catching shadows across the sky...",
        "funFact": "During totality, the temperature...",
        "sourceDate": "2026-06-28",
        "isPublic": true,
        "createdAt": "2026-06-28T21:00:00Z"
      }
    ]
  }
  ```

### 3. Save Render
Saves a newly generated render to the user's gallery profile.
* **Route:** `POST /api/renders`
* **Headers:** `Authorization: Bearer <Supabase_JWT>` (Required)
* **Request Body:**
  ```json
  {
    "title": "My Eclipse Render",
    "ascii": " ...::--++##@@ ",
    "caption": "Catching shadows across the sky...",
    "funFact": "During totality, the temperature...",
    "sourceDate": "2026-06-28",
    "isPublic": false
  }
  ```
* **Success Response (200 OK):**
  ```json
  {
    "ok": true,
    "render": {
      "id": "76495b45-1234-5678-abcd-ef1234567890",
      "userId": "d7182230-abcd-ef01-2345-6789abcdef01",
      "title": "My Eclipse Render",
      "ascii": " ...::--++##@@ ",
      "caption": "Catching shadows across the sky...",
      "funFact": "During totality, the temperature...",
      "sourceDate": "2026-06-28",
      "isPublic": false,
      "createdAt": "2026-06-28T21:01:00Z"
    }
  }
  ```

### 4. Delete Render
Deletes an owned render from the database.
* **Route:** `DELETE /api/renders/[id]`
* **Headers:** `Authorization: Bearer <Supabase_JWT>` (Required)
* **Success Response (200 OK):**
  ```json
  {
    "ok": true
  }
  ```

---

## 6. API Cost Estimates

The application leverages local models and proxy solutions to keep active hosting costs at **$0**.

### Pinned Local Dev & Production Setup ($0)
* **NASA APOD API:** Free tier (limited requests per hour, optimized via server-side Supabase caching which eliminates duplicate downstream request volumes).
* **LM Studio (Local Dev):** Free, self-hosted locally on local hardware.
* **FAU Trussed (Demo/Staging):** Free course-provided API endpoint.

### Pricing Structure for Paid OpenAI API Swaps
If you swap out the provider configuration to point to a paid endpoint (like standard `gpt-5.4`), costs map to the following mathematical model:

$$\text{Cost per Generate} = (\text{Input Tokens} \times \text{Input Price}) + (\text{Output Tokens} \times \text{Output Price})$$

* **Input Tokens (per cache-miss query):**
  - Feature 1 (Style Selection): system prompt (~250 tokens) + input text (~350 tokens) = ~600 tokens
  - Feature 2 (Captioning): system prompt (~150 tokens) + input text (~350 tokens) = ~500 tokens
  - **Combined Input Tokens:** ~1,100 tokens
* **Output Tokens (per cache-miss query):**
  - Style JSON output (Feature 1): ~60 tokens
  - Caption JSON output (Feature 2): ~120 tokens
  - **Total Output Tokens:** ~180 tokens

#### Sample Calculation (using standard `gpt-5.4` rates: $2.50 / 1M input, $15.00 / 1M output):
On a cache miss, both Feature 1 and Feature 2 completions are executed:
* **Combined Input Cost:** $1,100 \times \frac{2.50}{1,000,000} = \$0.00275$
* **Combined Output Cost:** $180 \times \frac{15.00}{1,000,000} = \$0.00270$
* **Total Cost per Cache Miss Fetch:** **$0.00545** (Approx. **183 APOD fetches per $1.00**)

*Note: Enabling the Supabase `cached_apods` table caching strategy ensures that repeated requests for any date consume exactly $0 in API costs.*

---

## 7. Testing Suite

Unit and integration tests are run via **Vitest**.

### Running the Test Suite
* Run all unit tests:
  ```bash
  npm test
  ```
* Run a console smoke test checking basic LLM connectivity:
  ```bash
  npm run test:llm
  ```
* Execute the complete APOD-to-ASCII processing pipeline CLI validation tool:
  ```bash
  npm run test:features
  ```

### API Endpoint Testing (Postman)
A Postman collection is provided in the repository to verify all HTTP endpoint operations:
* **Collection File:** [postman/collection.json](file:///d:/AI%20Bootcamp/week3-cjb1077/postman/collection.json)
* **Features Covered:**
  - `GET /api/apod` (success, specific date, invalid date, future date)
  - `GET /api/renders` (lists public renders)
  - `POST /api/renders` (authenticated save, unauthorized rejection, validation/bad payload checks)
  - `DELETE /api/renders/:id` (authenticated delete, unauthorized delete checks)
* **Setup:** Import the collection into Postman or Thunder Client, and customize the collection variables (`base_url`, `supabase_jwt`, `render_id`) to point to your target server (e.g. `http://localhost:3000` or Netlify deployment).

---

## 8. Demo Walkthrough Video

[View the Demo Walkthrough Video](https://www.youtube.com/watch?v=dQw4w9WgXcQ)
