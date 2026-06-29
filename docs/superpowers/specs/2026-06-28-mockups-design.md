# Design Spec: UI Mockups & Screenshots

**Date:** 2026-06-28  
**Status:** Under Review  
**Author:** AI Pair Programmer (Antigravity)

---

## 1. Goal
Create a design document `MOCKUPS.md` in the root of the workspace that documents the visual appearance and responsive layout of the ASCII Art Studio app. It will embed two high-fidelity UI mockups representing the application's key screens: the main Studio Dashboard and the User Gallery.

---

## 2. Visual Direction
* **Theme:** Sleek cosmic glassmorphism.
* **Colors:** Deep purple nebulas in the background, a dark cyber-grid, translucent card containers with borders, and neon teal (`#00e5ff`) accents for focus states and main controls.
* **Layout:** A grid-based desktop view that collapses gracefully on smaller screens.

---

## 3. UI Screens to Mock Up

### 3.1 Studio Dashboard (`studio_dashboard.png`)
* **Layout:** Two-column desktop grid.
* **Left Column:**
  * Control panel for picking an APOD date.
  * Image thumbnail of the current APOD.
  * ASCII conversion controls (Character set dropdown, Density slider, Invert checkbox).
  * A prominent "Generate Art" button.
* **Right Column:**
  * Monospace Terminal container showing computed ASCII art (e.g. a stylized planet shape or galaxy).
  * AI Insights card containing a generated short themed caption and a scientific fun fact.
  * Status badges showing AI feature active/fallback status.
  * Actions: "Save to Gallery" and a "Make Public" toggle.

### 3.2 User Gallery (`user_gallery.png`)
* **Layout:** Grid of cards.
* **Controls:** Search bar and filters ("All", "My Renders", "Public Feed").
* **Cards:** Translucent cards featuring a small monospace preview of the ASCII art, the original title/date, the AI-generated caption, and actions like "Delete" (for own renders) and a "Public/Private" toggle status badge.

---

## 4. Screenshot Assets Generation Plan
We will use the `generate_image` tool to render these UI screenshots as high-quality mockups and save them to the artifacts directory.

### 4.1 Studio Dashboard Prompt
`"High-fidelity UI mockup screenshot of a web application called 'ASCII Art Studio' in dark mode. The UI features a sleek cosmic glassmorphism design with a background of deep purple nebulas and a subtle dark cyber-grid. Left column has a translucent card containing date input, a thumbnail of a NASA space image, dropdown select for 'Character Set', slider for 'Density', and a glowing neon teal 'Generate Art' button. Right column has a large dark terminal window showing detailed ASCII art of Saturn. Below the terminal are translucent cards with neon accents containing an AI-generated caption and a fun fact. High resolution, professional UX/UI, crisp details, no device frame."`

### 4.2 User Gallery Prompt
`"High-fidelity UI mockup screenshot of a web application's gallery page in dark mode. The page is titled 'Cosmic Render Gallery'. Sleek glassmorphism theme, deep purple space nebula background, cyber-grid overlay. Contains a search bar and filter tabs. Below the controls is a grid of translucent cards, each displaying a mini monospace ASCII art preview of a space object, its title, date, a short description, a neon teal 'Delete' trash-can icon, and a glowing toggle switch for 'Public/Private'. High resolution, professional UX/UI, crisp details, no device frame."`

---

## 5. Proposed Deliverables
1. **Mockup Images:**
   - `studio_dashboard.png` saved in the artifacts folder.
   - `user_gallery.png` saved in the artifacts folder.
2. **`MOCKUPS.md`**: Created in the workspace root, containing:
   - Visual aesthetics overview (color palette, design principles).
   - Embedded screenshots of the Studio Dashboard and User Gallery.
   - Component-by-component layout breakdowns for implementation.
   - Styling specifications (CSS variables, backdrop filter effects).
