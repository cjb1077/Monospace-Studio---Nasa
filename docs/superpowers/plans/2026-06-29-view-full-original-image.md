# View Full Original Image Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to view the full original APOD image in the Source Telemetry preview card without cropping, and open it in a new tab upon clicking.

**Architecture:** Modifies client-side CSS styles for object framing and wraps the image element in an HTML anchor tag pointing to the original image URL.

**Tech Stack:** Next.js, React, CSS Modules

## Global Constraints

- No API key or secure credential should be exposed to the client.
- The thumbnail must display the image completely without any cropping.

---

### Task 1: Update Preview Thumbnail CSS Styles

**Files:**
- Modify: `src/app/page.module.css:319-332`

**Interfaces:**
- Consumes: None
- Produces: Updated CSS styles for `.thumbnailContainer`, `.thumbnail`, and new `.thumbnailLink` styles

- [ ] **Step 1: Check existing styles**

Read the CSS file lines 319-332 to verify existing selectors.

- [ ] **Step 2: Implement styling updates**

Modify `src/app/page.module.css` to update `.thumbnailContainer` and `.thumbnail`, and add `.thumbnailLink`:
```css
/* Source Details Card */
.thumbnailContainer {
  position: relative;
  width: 100%;
  height: 180px;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.05);
  background-color: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}

.thumbnailLink {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s ease;
}

.thumbnailLink:hover {
  opacity: 0.8;
}

.thumbnail {
  object-fit: contain;
}
```

- [ ] **Step 3: Commit CSS changes**

```bash
git add src/app/page.module.css
git commit -m "style: update APOD thumbnail styling for contain fit and hover state"
```

---

### Task 2: Wrap APOD Source Image in Interactive Link

**Files:**
- Modify: `src/app/page.tsx:561-569`

**Interfaces:**
- Consumes: `apodData.source.imageUrl` (string)
- Produces: Updated HTML structure in `src/app/page.tsx` wrapping the image in an anchor link with `contain` styles

- [ ] **Step 1: Update page component code**

Modify lines 561-569 of `src/app/page.tsx` to wrap the thumbnail in an `<a>` tag and set its style to use `objectFit: "contain"`:
```tsx
              <div className={styles.thumbnailContainer}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <a
                  href={apodData.source.imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="View full-size original image"
                  className={styles.thumbnailLink}
                >
                  <img
                    src={apodData.source.imageUrl}
                    alt={apodData.source.title}
                    className={styles.thumbnail}
                    style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", width: "auto", height: "auto" }}
                  />
                </a>
              </div>
```

- [ ] **Step 2: Commit Page component changes**

```bash
git add src/app/page.tsx
git commit -m "feat: wrap APOD source preview image in click-through tab link"
```

---

### Task 3: Verify and Test Changes

**Files:**
- Test: None (No functional logic changes, pure UI modification)

**Interfaces:**
- Consumes: UI preview components
- Produces: Verified UI look and feel

- [ ] **Step 1: Run automated tests to verify zero regressions**

Run command:
`npm test`
Expected output: All 57 tests pass successfully.

- [ ] **Step 2: Run build validation**

Run command:
`npm run build`
Expected output: Success with zero TypeScript/lint compilation errors.

- [ ] **Step 3: Commit and push changes**

```bash
git status
```
Confirm status is clean.
