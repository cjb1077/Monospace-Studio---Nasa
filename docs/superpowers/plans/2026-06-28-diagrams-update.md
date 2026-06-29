# Update DIAGRAMS.md Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update `DIAGRAMS.md` with four additional Mermaid diagrams covering planned workflows and architectures.

**Architecture:** Append structured markdown sections containing Mermaid definitions to `DIAGRAMS.md`. No logic code is modified.

**Tech Stack:** Markdown, Mermaid.

## Global Constraints
- Write valid Mermaid syntax.
- Do not use placeholders or TBD sections.

---

### Task 1: Append New Diagrams to DIAGRAMS.md

**Files:**
- Modify: `DIAGRAMS.md`

**Interfaces:**
- Consumes: None
- Produces: Visual representations of APOD walkback, LLM fallback, UI state, and Supabase auth/middleware flows in `DIAGRAMS.md`

- [ ] **Step 1: Modify `DIAGRAMS.md`**

Modify [DIAGRAMS.md](file:///d:/AI%20Bootcamp/week3-cjb1077/DIAGRAMS.md) to append the four new sections at the end of the file.

```markdown
---

## 5. APOD Date Walkback & Fallback State Machine

This state diagram captures the date check, media type verification, the 7-day walkback loop, and the final fallback to a static starry image.

```mermaid
stateDiagram-v2
    [*] --> CheckCache : GET /api/apod?date=YYYY-MM-DD
    CheckCache --> CacheHit : Date exists in cached_apods
    CacheHit --> [*] : Return cached APOD + ASCII + Caption

    CheckCache --> CacheMiss : Date not cached
    CacheMiss --> FetchMetadata : Call NASA APOD API with Date
    
    state FetchMetadata_Decision <<choice>>
    FetchMetadata --> FetchMetadata_Decision
    
    FetchMetadata_Decision --> DownloadImage : media_type == "image"
    FetchMetadata_Decision --> WalkbackLoop : media_type == "video" or API failure

    state WalkbackLoop {
        [*] --> CheckLimit
        CheckLimit --> DecrementDate : Attempt < 7 days
        DecrementDate --> QueryPreviousDate : Fetch from NASA APOD
        QueryPreviousDate --> CheckLimit : media_type == "video"
        QueryPreviousDate --> ImageFound : media_type == "image"
        CheckLimit --> Exceeded : Attempt >= 7 days
    }

    ImageFound --> DownloadImage : Download original image URL
    Exceeded --> LoadFallbackImage : Use bundled starry.png & set usedFallbackImage = true
    
    DownloadImage --> ExecutePipeline : Generate ASCII & Call LLMs
    LoadFallbackImage --> ExecutePipeline : Generate ASCII & Call LLMs

    ExecutePipeline --> SaveCache : Write to cached_apods DB
    SaveCache --> [*] : Return complete JSON payload
```

---

## 6. LLM Feature Execution & Fallback Flow

This flowchart illustrates the execution of the style and captioning features, retry triggers, and fallbacks.

```mermaid
flowchart TD
    Start([Start Route Handler]) --> TrimText[Trim APOD Explanation to <= 1500 chars]
    TrimText --> CallStyle[Call Style LLM Feature 1]
    
    CallStyle --> StyleSuccess{Success & Valid JSON?}
    StyleSuccess -- Yes --> ApplyStyle[Use AI settings: charSet, density, invert]
    StyleSuccess -- No --> StyleRetry[Retry Style LLM once]
    
    StyleRetry --> StyleRetrySuccess{Success & Valid JSON?}
    StyleRetrySuccess -- Yes --> ApplyStyle
    StyleRetrySuccess -- No --> StyleFallback[Use default settings: standard, 0.6, false<br>Set aiStyleUsed = false]
    
    ApplyStyle --> ParallelStart
    StyleFallback --> ParallelStart
    
    subgraph Parallel Execution
        ParallelStart --> ConvertASCII[Deterministic ASCII Conversion]
        ParallelStart --> CallCaption[Call Caption LLM Feature 2]
    end
    
    CallCaption --> CaptionSuccess{Success & Valid JSON?}
    CaptionSuccess -- Yes --> SaveCaption[Use AI caption & fun fact]
    CaptionSuccess -- No --> CaptionRetry[Retry Caption LLM once]
    
    CaptionRetry --> CaptionRetrySuccess{Success & Valid JSON?}
    CaptionRetrySuccess -- Yes --> SaveCaption
    CaptionRetrySuccess -- No --> CaptionFallback[Use fallback caption: 1st sentence of APOD explanation<br>funFact = ''<br>Set aiCaptionUsed = false]
    
    ConvertASCII --> MergeResult
    SaveCaption --> MergeResult
    CaptionFallback --> MergeResult
    
    MergeResult --> End([Return Response])
```

---

## 7. Studio Dashboard UI State Flow

This state diagram captures login status, interactive controls, api fetches, and toast notification states.

```mermaid
stateDiagram-v2
    [*] --> Idle : Load Application
    
    state Idle {
        [*] --> Unauthenticated : Default State
        Unauthenticated --> Authenticated : User Logs In (JWT obtained)
        Authenticated --> Unauthenticated : User Logs Out (Clear session)
    }
    
    Idle --> FetchingAPOD : Input Date + Click "Generate Cosmic Art"
    
    state FetchingAPOD {
        [*] --> SendRequest : GET /api/apod?date=YYYY-MM-DD
        SendRequest --> ShowSpinner : Display skeleton loaders & disabling UI
    }
    
    state API_Response_Decision <<choice>>
    FetchingAPOD --> API_Response_Decision : API response received
    
    API_Response_Decision --> DisplayArt : Success (200)
    API_Response_Decision --> ShowError : Error (4xx/5xx)
    
    state DisplayArt {
        [*] --> RenderASCII : Render preformatted text block
        RenderASCII --> ShowAIInsights : Populate Caption & Fun Fact
        ShowAIInsights --> CheckTelemetry : Show status/fallback badges (AI state)
    }
    
    DisplayArt --> UpdateArtSettings : User alters character set, density, or invert
    UpdateArtSettings --> RenderASCII : Recalculate ASCII output client-side
    
    DisplayArt --> SavingRender : Click "Save to Gallery" (Authenticated only)
    
    state SavingRender {
        [*] --> SendSaveRequest : POST /api/renders (auth header JWT)
        SendSaveRequest --> ShowSavingLoader : Block UI inputs / show saving status
    }
    
    state Save_Response_Decision <<choice>>
    SavingRender --> Save_Response_Decision
    
    Save_Response_Decision --> SaveSuccess : Success (200)
    Save_Response_Decision --> SaveError : Error (4xx/5xx)
    
    SaveSuccess --> DisplayArt : Show success toast & flag as saved
    SaveError --> DisplayArt : Show error toast & enable retry
    
    ShowError --> Idle : User dismisses error banner / retries
```

---

## 8. Supabase Authentication & Middleware Session Lifecycle

This sequence diagram displays edge middleware cookie management, route-handler session token checks, and RLS checking.

```mermaid
sequenceDiagram
    autonumber
    actor User as Client Browser
    participant Middleware as Next.js Edge Middleware
    participant Route as Next.js Route Handler / Server Component
    participant Supabase as Supabase Auth Server
    participant DB as Supabase DB (Postgres)

    User->>Middleware: Request protected page or API (with cookies)
    Note over Middleware: Checks for access & refresh token cookies
    Middleware->>Supabase: Get/Refresh session using refresh token cookie
    
    alt Session Valid / Successfully Refreshed
        Supabase-->>Middleware: Return new Session (Access JWT + new Refresh Token)
        Middleware->>Middleware: Update request cookies & write set-cookie header
        Middleware->>Route: Forward request with updated cookies / headers
        
        Route->>Route: Initialize Server-Side Supabase Client (using cookies)
        Route->>Supabase: getUser() (Verifies JWT signature and expiry)
        Supabase-->>Route: Return authenticated User object
        
        opt Protected DB Write (e.g. POST /api/renders)
            Route->>DB: SQL Query with authenticated user_id
            Note over DB: Postgres matches user_id against auth.uid() in RLS
            DB-->>Route: Return DB results
        end
        
        Route-->>User: Return response (200 OK + updated Cookie header)
    else Session Expired / Invalid
        Supabase-->>Middleware: Session invalid/expired error
        alt Request is for API Route
            Middleware-->>User: Return 401 Unauthorized Response
        else Request is for Protected Page
            Middleware-->>User: Redirect to /login
        end
    end
```
```

- [ ] **Step 2: Verify syntax correctness of modified file**

Check that there are no syntax/formatting errors in the markdown and that the file builds or is clean.
Verify visually or confirm structure.

- [ ] **Step 3: Commit the changes**

Run:
```bash
git add DIAGRAMS.md docs/superpowers/specs/2026-06-28-diagrams-update-design.md docs/superpowers/plans/2026-06-28-diagrams-update.md
git commit -m "docs: add walkback, LLM fallback, UI state, and auth lifecycle diagrams to DIAGRAMS.md"
```
