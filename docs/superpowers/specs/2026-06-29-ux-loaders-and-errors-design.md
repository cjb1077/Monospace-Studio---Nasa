# Design Document: UX Loaders, Empty States, and Error Handling

**Date:** 2026-06-29  
**Status:** Under Review  
**Author:** AI Pair Programmer (Antigravity)

---

## 1. Overview

This document outlines the plans for Phase 6.1 (Issue #24): **Optimize UX loaders, empty states, and errors**. 
The goal is to polish the user experience across Monospace Studio's main dashboard and gallery workspace to ensure premium visual aesthetics, robust error handling, isolated transient errors, and zero console/hydration warnings.

---

## 2. Detailed Technical Design

### 2.1 React Hydration Warnings Fix
- **Problem:** `getTodayEst()` reads the current timezone-dependent clock. Because Next.js pre-renders client components on the server first, computing `todayEst` in the initialization of states (`useState(todayEst)`) causes server-client text mismatch warnings in the browser console if the server timezone differs from the user's browser timezone.
- **Solution:** 
  - Initialize the `inputDate` and `activeDate` fields to `""` (empty string) or a placeholder.
  - In `useEffect(() => { ... }, [])` on mount:
    1. Calculate `todayEst` on the client.
    2. Set `inputDate` and `activeDate` to `todayEst`.
    3. Set a new state variable `isMounted` to `true`.
  - Conditionalize rendering of date-picker values and form inputs on `isMounted`.

### 2.2 Cosmic Telemetry Loading logs & Skeleton UI
- **Simulated Progression Logs:** Instead of a single static spinner, we will display a dynamic log panel that ticks through simulated states based on elapsed load time:
  - *Phase A (0ms - 800ms):* `📡 Uplinking with NASA planetary directory...`
  - *Phase B (800ms - 1800ms):* `💿 Downloading image telemetry data...`
  - *Phase C (1800ms - 2800ms):* `🤖 Synchronizing AI stylization matrix...`
  - *Phase D (2800ms+):* `🎨 Formatting monospace ASCII rendering...`
- **Skeleton Screen Layout:**
  - Define glassmorphic pulse skeletons (`.skeletonPulse` with a pulsing opacity keyframe animation).
  - During `loading`, show skeletons in place of:
    - The **Source Telemetry Thumbnail / Card** (left column).
    - The **Stylization Matrix Inputs** (left column).
    - The **ASCII Viewport** (right column).
    - The **AI Insights Card** (right column).
  - Prevents Cumulative Layout Shift (CLS) when loading transitions to success.

### 2.3 Transient Error Separation
- **Main Error state (`error`):** Reserved solely for critical APOD API transmission failure. When this triggers, the main output viewport is replaced by a "Transmission Failure" block.
- **Auth Error state (`authError`):** Displayed exclusively inside the Auth Dropdown box (under the login button) so that signing-in failures do not overwrite the successfully rendered ASCII art.
- **Save Error state (`saveError`):** Displayed exclusively inside the Save Render Card context (e.g. next to or above the "Save Render" button).

### 2.4 Browser Alert Replacement (Gallery Page)
- **Problem:** Window `alert()` is disruptive and does not align with premium glassmorphic aesthetics.
- **Solution:**
  - Build a custom notification banner component in `src/app/gallery/page.tsx`.
  - Maintain a state variable `toast: { message: string; type: "success" | "error" } | null`.
  - In `handleDelete()`, if deleting fails, set `toast` instead of triggering `alert()`.
  - Include an auto-dismiss timer (`setTimeout` for 4 seconds) to clear the toast.

### 2.5 SEO Optimization
- Update metadata title and description in `src/app/layout.tsx`.
- Add window title updating inside Gallery's `useEffect` to ensure correct titles on navigation.

---

## 3. UI/CSS Additions

Add these core tokens and CSS classes in `src/app/page.module.css` and `src/app/gallery/page.module.css` to build the skeletons:
```css
@keyframes pulse {
  0% {
    background-color: rgba(255, 255, 255, 0.03);
  }
  50% {
    background-color: rgba(255, 255, 255, 0.08);
  }
  100% {
    background-color: rgba(255, 255, 255, 0.03);
  }
}

.skeletonPulse {
  animation: pulse 1.5s infinite ease-in-out;
  border-radius: 8px;
}
```

---

## 4. Verification Plan

### 4.1 Automated Tests
Verify that page components render without crashing.
- `npm run build` to verify there are zero compile errors, ESLint errors, or TS type-check warnings.

### 4.2 Manual Verification
Use the browser subagent to:
1. Open the page and verify there are **zero** React hydration console logs.
2. Trigger a load (e.g., choose a date) and verify that skeleton frames pulse and simulated telemetry logs update correctly.
3. Trigger an authentication error and confirm it is isolated inside the dropdown box.
4. Go to Gallery, delete an item, and verify that the inline toast replaces the standard browser `alert`.
