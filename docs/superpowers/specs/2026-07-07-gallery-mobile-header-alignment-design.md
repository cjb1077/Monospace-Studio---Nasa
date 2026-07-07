# Design Spec: Gallery Mobile Header Alignment

## 1. Goal Description

This design specification details the changes needed to align the mobile header navigation on the Gallery page with the correct layout of the Studio page:
1. Align the navigation items (Studio, Gallery, Sign In/Out) to the right under mobile viewports (< 640px and < 480px).
2. Truncate long email addresses inside the logged-in user status element on mobile viewports to prevent layout overflow.
3. Prevent button text wrapping for the authentication action buttons on mobile.

All changes will be applied directly to `src/app/gallery/page.module.css`.

---

## 2. Proposed Changes

### 2.1 CSS Layout Synchronization
In [src/app/gallery/page.module.css](file:///d:/AI%20Bootcamp/week3-cjb1077/src/app/gallery/page.module.css):

Under `@media (max-width: 640px)`:
- Set `.nav` to:
  ```css
  .nav {
    gap: 0.6rem;
    width: 100%;
    justify-content: flex-end;
  }
  ```
- Add `.userStatus span` truncation rules:
  ```css
  .userStatus span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 130px;
  }
  ```
- Set `white-space: nowrap` on `.authBtn`.

Under `@media (max-width: 480px)`:
- Set `.nav` to:
  ```css
  .nav {
    gap: 0.4rem;
    width: 100%;
    justify-content: flex-end;
  }
  ```
- Add `.userStatus span` width tightening:
  ```css
  .userStatus span {
    max-width: 100px;
  }
  ```

---

## 3. Verification Plan

### 3.1 Automated Verification
- Run `npm run build` to verify the Next.js application builds cleanly.
- Run `npm test` to verify no regressions in the unit and integration tests.

### 3.2 Manual Verification (with Chrome DevTools / Browser Subagent)
- Load the Gallery page at `http://localhost:3000/gallery` under a mobile viewport (e.g. 375px width).
- Verify that the navigation menu wraps and right-aligns correctly below the brand logo.
- Mock/test a logged-in user status with a long email address and verify that the email address truncates with an ellipsis (...) instead of overflowing the screen.
- Verify the same mobile layout behaves correctly on the Studio page at `http://localhost:3000/`.
