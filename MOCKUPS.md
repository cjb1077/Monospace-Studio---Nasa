# ASCII Art Studio - UI Mockups & Visual Guide

This document serves as the visual reference and design specification for the ASCII Art Studio application. The user interface implements a premium **Sleek Cosmic Glassmorphism** design, tailored for a cosmic/space aesthetic.

---

## 1. Core Design System

### 1.1 Color Palette & Theme
All interface surfaces follow a modern dark-mode aesthetic with rich gradients and luminous accents:
* **Background:** Deep cosmic void space (`#0a0b10`) with a subtle dark cyber-grid pattern and soft background blur nebulae (`backdrop-filter: blur(40px)`).
* **Card Surface (Glassmorphism):** Semi-translucent panels (`rgba(22, 24, 33, 0.75)`) with a fine border (`1px solid rgba(255, 255, 255, 0.08)`) and high blur filter (`backdrop-filter: blur(12px)`).
* **Accent Primary (Neon Teal):** `#00e5ff` / `rgb(0, 229, 255)` (used for primary controls, borders, active focus glows).
* **Accent Secondary (Cosmic Indigo):** `#8b5cf6` (used for secondary badges, background radial gradients, and secondary hover states).
* **Text Primary:** `#ffffff` (headers, primary actions).
* **Text Secondary:** `#9ca3af` (muted gray for descriptions, APOD explanations, meta-info).
* **Monospace Font:** `JetBrains Mono` / `Fira Code` / `SF Mono` for ASCII art output and system telemetry.

### 1.2 Layout & Grid Rules
* **Grid:** 12-column layout (on desktop) collapsing to single-column on mobile viewports.
* **Transitions:** `transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1)` for interactive elements with glowing text/box shadows.

---

## 2. Main Studio Dashboard

The **Studio Dashboard** (`/`) is the central workspace where users fetch the Astronomy Picture of the Day, review settings, run ASCII conversion, and review AI-generated captions and fun facts.

### 2.1 Screenshot Mockup
![Main Studio Dashboard Mockup](file:///d:/AI%20Bootcamp/week3-cjb1077/docs/superpowers/specs/images/studio_dashboard.png)

### 2.2 Component Breakdown

#### Header / Navigation Bar
* Displays the app branding **"Monospace Studio"** with a tiny glowing terminal icon on the left.
* Right side features navigation links (`Studio`, `Gallery`) and user authentication status (e.g., `"Signed in as astronaut@nasa.gov"` or a glowing `"Sign In"` CTA button).

#### Left Column (Inputs & Controls) - Width: `col-span-5` on desktop
1. **Date Picker Card:**
   - A date input box with a customized dark calendar dropdown interface.
   - A prominent **"Generate Cosmic Art"** button featuring a gradient glow effect (`linear-gradient(135deg, #00e5ff, #8b5cf6)`).
2. **APOD Source Metadata Card:**
   - Displays the fetched APOD title, date, and copyright info.
   - Shows a clean, cropped thumbnail of the original NASA image.
   - Text explanation block (scrollable container if exceeding 400px height).
3. **ASCII Conversion Controls Card:**
   - **Character Set (Dropdown):** Choose between *Standard* (`" .:-=+*#%@"`), *Fine* (gradient ramp of 16+ chars), or *Blocky* (`" .:oO0@"`).
   - **Density (Slider):** Range from `0.4` to `0.9` to scale glyph mapping.
   - **Invert (Toggle Switch):** Flips light/dark glyph ramps.

#### Right Column (Output Terminal & AI Insights) - Width: `col-span-7` on desktop
1. **ASCII Art Monospace Viewport:**
   - A large, styled terminal container with a fine neon-teal border (`#00e5ff`) and subtle inner glow.
   - Text rendered in raw `<pre>` tag with high horizontal scroll support.
   - Floating action buttons: **"Copy Art"** (copies raw string to clipboard) and **"Zoom"** (opens fullscreen overlay modal).
2. **AI Insights Card:**
   - **AI Themed Caption:** Displayed in a card with a stylized cosmic border.
   - **AI Scientific Fun Fact:** Displayed in an accordion or card below the caption.
3. **System Telemetry Badges:**
   - Inline indicators showing the source data status and LLM processing state:
     - `[AI Style: ACTIVE]` or `[AI Style: FALLBACK]` (yellow/red indicator if LLM failed)
     - `[AI Caption: ACTIVE]` or `[AI Caption: FALLBACK]`
     - `[NASA Source: ORIGINAL]` or `[NASA Source: RECENT_IMAGE_FALLBACK]` (if walkback occurred)

---

## 3. User Gallery Feed

The **User Gallery** (`/gallery`) page presents saved renders in a card-based grid layout, enabling discovery, sharing, and management of saved ASCII pieces.

### 3.1 Screenshot Mockup
![User Gallery Page Mockup](file:///d:/AI%20Bootcamp/week3-cjb1077/docs/superpowers/specs/images/user_gallery.png)

### 3.2 Component Breakdown

#### Gallery Header
* Title: **"Cosmic Render Gallery"** styled with a gradient from white to muted indigo.
* Subtitle describing the workspace gallery.
* Navigation button returning back to the main Studio.

#### Filter & Search Panel
* A full-width search input with a neon-accented magnifying glass icon.
* Filter Tabs:
  * **"All Renders"**: Show all public renders plus user's private renders.
  * **"My Renders"**: Show only the signed-in user's saved renders.
  * **"Public Feed"**: Show public renders from all users.

#### Gallery Card Grid
* Responsive grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`).
* **Individual Render Card:**
  * Displays the APOD Title and saved Source Date.
  * Displays a **Mini ASCII Monospace Preview box** (scale-down representation, fixed height, scroll hidden).
  * Displays the saved AI description/caption.
  * **Interactive Row (Owner Only):**
    - A toggle switch or checkbox for **"Public"** setting (interacts directly with Supabase Postgres RLS).
    - A trash icon button (**"Delete"**) with confirmation prompt.

---

## 4. Implementation CSS Snippets

Use these CSS rules (or adapt to Tailwind config) to build the glassmorphism aesthetic during Phase 4:

```css
/* Glassmorphism Card Style */
.glass-card {
  background: rgba(22, 24, 33, 0.75);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Neon Teal Accent Glow */
.glass-card-accent:hover {
  border-color: rgba(0, 229, 255, 0.4);
  box-shadow: 0 0 20px rgba(0, 229, 255, 0.15), 
              0 8px 32px 0 rgba(0, 0, 0, 0.37);
}

/* Cosmic Cyber Grid Background */
.cyber-grid {
  background-color: #0a0b10;
  background-image: 
    linear-gradient(rgba(0, 229, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 229, 255, 0.03) 1px, transparent 1px);
  background-size: 40px 40px;
}
```
