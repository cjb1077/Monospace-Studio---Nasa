# Gallery Mobile Header Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the mobile header layout of the Gallery page with the correct layout of the Studio page.

**Architecture:** Sync the CSS media query responsive properties of the Gallery page module stylesheet to match those of the Studio page module stylesheet.

**Tech Stack:** Next.js (App Router), Vanilla CSS Modules.

## Global Constraints

1. Align the navigation items (Studio, Gallery, Sign In/Out) to the right under mobile viewports (< 640px and < 480px).
2. Truncate long email addresses inside the logged-in user status element on mobile viewports to prevent layout overflow.
3. Prevent button text wrapping for the authentication action buttons on mobile.

---

### Task 1: Replicate Mobile Header Styles to Gallery Page Module CSS

**Files:**
- Modify: `src/app/gallery/page.module.css:203-255`

**Interfaces:**
- Consumes: None
- Produces: Correctly aligned mobile header styling for `/gallery`

- [ ] **Step 1: Modify CSS styles for max-width: 640px and max-width: 480px in gallery page module**

Modify `src/app/gallery/page.module.css` to update the media queries.

Target content in `src/app/gallery/page.module.css` (around lines 203-241):
```css
@media (max-width: 640px) {
  .header {
    padding: 0.75rem 1rem;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .brand {
    font-size: 1.15rem;
  }
  .nav {
    gap: 0.6rem;
  }
  .navLink {
    font-size: 0.875rem;
  }
  .userStatus {
    gap: 0.5rem;
    font-size: 0.8rem;
  }
  .authBtn {
    padding: 0.4rem 0.75rem;
    font-size: 0.85rem;
  }
  .main {
    padding: 1rem;
    gap: 1.25rem;
  }
  .filterRow {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }
  .searchGroup {
    max-width: 100%;
  }
  .grid {
    gap: 1.25rem;
  }
}
```

And lines 243-255:
```css
@media (max-width: 480px) {
  .grid {
    grid-template-columns: 1fr;
  }
  .nav {
    gap: 0.4rem;
  }
  .navLink {
    font-size: 0.8rem;
  }
  .authBtn {
    padding: 0.35rem 0.6rem;
    font-size: 0.8rem;
  }
}
```

Replacement content:
```css
@media (max-width: 640px) {
  .header {
    padding: 0.75rem 1rem;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .brand {
    font-size: 1.15rem;
  }
  .nav {
    gap: 0.6rem;
    width: 100%;
    justify-content: flex-end;
  }
  .navLink {
    font-size: 0.875rem;
  }
  .userStatus {
    gap: 0.5rem;
    font-size: 0.8rem;
    max-width: 100%;
    overflow: hidden;
  }
  .userStatus span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 130px;
  }
  .authBtn {
    padding: 0.4rem 0.75rem;
    font-size: 0.85rem;
    white-space: nowrap;
  }
  .main {
    padding: 1rem;
    gap: 1.25rem;
  }
  .filterRow {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }
  .searchGroup {
    max-width: 100%;
  }
  .grid {
    gap: 1.25rem;
  }
}

@media (max-width: 480px) {
  .grid {
    grid-template-columns: 1fr;
  }
  .nav {
    gap: 0.4rem;
    width: 100%;
    justify-content: flex-end;
  }
  .navLink {
    font-size: 0.8rem;
  }
  .authBtn {
    padding: 0.35rem 0.6rem;
    font-size: 0.8rem;
    white-space: nowrap;
  }
  .userStatus span {
    max-width: 100px;
  }
}
```

- [ ] **Step 2: Run build to verify stylesheet compatibility and typescript status**

Run command: `npm run build`
Expected: Zero compilation errors, bundle successfully builds.

- [ ] **Step 3: Verify visually on mobile screen widths using browser**

Use browser subagent to verify page layout:
- Open `http://localhost:3000/gallery` with a 375px width viewport.
- Take a screenshot of the top header.
- Confirm the navigation links (Studio, Gallery, Sign In/Out) wrap and right-align correctly below the brand title.

- [ ] **Step 4: Commit changes**

Run command:
```bash
git add src/app/gallery/page.module.css
git commit -m "style: align gallery mobile header and navbar (resolves #gallery-mobile-header)"
```
