# DIAGRAMS.md -- ASCII Art Studio Diagram Spec

This document details the system design, flow control lifecycles, and database relationships of the ASCII Art Studio application.

---

## 1. High-Level System Architecture

This flow diagram illustrates the core components and communication routes between the client browser, Next.js server route handlers, Supabase services, and downstream APIs.

```mermaid
graph TD
    Client[Browser UI / Studio Client] <-->|GET /api/apod<br>POST/GET/DELETE /api/renders| API[Next.js Server API Routes]
    API <-->|Check/Write Cache & CRUD Renders| DB[(Supabase Postgres Database)]
    API <-->|Verify Session JWT| Auth[Supabase Auth Service]
    API --->|GET APOD & Download Image| NASA[NASA planetary API]
    API --->|JSON Style / JSON Caption| LLM[LLM Endpoint - LM Studio/Trussed]

    style Client fill:#1b1d24,stroke:#00d2ff,stroke-width:2px,color:#fff
    style API fill:#1b1d24,stroke:#ff007f,stroke-width:2px,color:#fff
    style DB fill:#1b1d24,stroke:#39ff14,stroke-width:2px,color:#fff
    style Auth fill:#1b1d24,stroke:#ffb703,stroke-width:2px,color:#fff
    style NASA fill:#12131a,stroke:#7000ff,stroke-width:1px,color:#d2d2d2
    style LLM fill:#12131a,stroke:#7000ff,stroke-width:1px,color:#d2d2d2
```

---

## 2. Generate APOD Lifecycle (Sequence Diagram)

Shows the orchestration of the `GET /api/apod` route. This includes the database caching check, NASA video-walkback logic, image downloading, and parallelized ASCII conversion and LLM captioning.

```mermaid
sequenceDiagram
    autonumber
    actor User as Client Browser
    participant API as /api/apod Endpoint
    participant DB as Supabase DB (cached_apods)
    participant NASA as NASA planetary APOD
    participant LLM as LLM Endpoint (Trussed/LM Studio)
    
    User->>API: GET /api/apod?date=YYYY-MM-DD
    API->>DB: Query cached_apods for target date
    alt Cache Hit
        DB-->>API: Return cached JSON
        API-->>User: Return ASCII + captions (cached)
    else Cache Miss
        API->>NASA: Query date metadata
        alt media_type == "video"
            loop Up to 7 times (until media_type == "image")
                API->>NASA: Fetch previous day metadata
            end
        end
        NASA-->>API: Return valid metadata & image URL
        API->>API: Download image buffer (from url, not hdurl)
        
        API->>LLM: POST style config request (trimmed explanation)
        LLM-->>API: Return style JSON (charSet, density, invert)
        
        par Pure ASCII Conversion
            API->>API: Convert image buffer to ASCII string
        and LLM Feature 2: Captioning
            API->>LLM: POST themed caption request (trimmed explanation)
            LLM-->>API: Return caption JSON (caption, funFact)
        end
        
        API->>DB: Insert newly generated result into cached_apods
        API-->>User: Return ASCII art, style settings, caption, fun fact, & status flags
    end
```

---

## 3. Authentication & Gallery CRUD Operations (Sequence Diagram)

Illustrates how security is maintained during read/write routes via Supabase Auth and PostgreSQL Row Level Security (RLS).

```mermaid
sequenceDiagram
    autonumber
    actor User as Client Browser (Authenticated)
    participant API as /api/renders Endpoint
    participant Client as Supabase Auth Client
    participant DB as Supabase DB (renders table)

    User->>Client: Sign In with Email & Password
    Client-->>User: Return JWT Session Token
    
    User->>API: POST /api/renders (JWT Token inside authorization header)
    API->>API: Validate session JWT using Supabase Server Client
    
    alt Authorized (Valid Session)
        API->>DB: Perform SQL Insert (with user_id = auth.uid())
        Note over DB: Evaluates Row Level Security (RLS) "insert own" policy
        alt RLS Validations Pass
            DB-->>API: Render inserted successfully
            API-->>User: Return 200 OK (Render object)
        else RLS Validations Fail (Forged user_id)
            DB-->>API: Error (RLS Violation)
            API-->>User: Return 403 Forbidden
        end
    else Unauthorized / Expired Session
        API-->>User: Return 401 Unauthorized
    end
```

---

## 4. Entity Relationship Diagram (ERD)

Defines the database tables structure, column details, data types, and primary/foreign key relationships.

```mermaid
erDiagram
    auth_users {
        uuid id PK "auth.users(id) - private Supabase schema"
        string email
    }
    
    cached_apods {
        date source_date PK "YYYY-MM-DD format"
        string title "APOD Title"
        string explanation "APOD description (trimmed)"
        string image_url "Source image URL"
        string copyright "Author copyright status"
        string ascii "Computed monospace art"
        string char_set "Ramp selection (standard|fine|blocky)"
        numeric density "Tone density value"
        boolean invert "Invert setting"
        string caption "AI themed caption"
        string fun_fact "AI fun fact text"
        boolean ai_style_used "Feature 1 fallback indicator"
        boolean ai_caption_used "Feature 2 fallback indicator"
        boolean used_fallback_image "Outage fallback indicator"
        timestamptz created_at "Timestamp of cache generation"
    }

    renders {
        uuid id PK "Generated unique ID"
        uuid user_id FK "References auth.users(id)"
        string title "Render name"
        string ascii "Saved ASCII output"
        string caption "Saved AI caption"
        string fun_fact "Saved AI fun fact"
        date source_date "Original APOD date"
        boolean is_public "Visible in public feed"
        timestamptz created_at "Timestamp of render"
    }

    auth_users ||--o{ renders : "creates and saves"
```
