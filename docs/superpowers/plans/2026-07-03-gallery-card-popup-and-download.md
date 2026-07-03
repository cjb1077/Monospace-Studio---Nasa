# Gallery Card Details Popup & Text Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a detail popup modal in the cosmic render gallery that displays the full metadata, zoom/fullscreen options, and a text download button with horizontal character doubling aspect ratio correction.

**Architecture:** 
1. Export a new pure utility `doubleAsciiWidth` from `src/lib/ascii/convert.ts` and test it in `tests/ascii.test.ts`.
2. Update the card click handler in `src/app/gallery/page.tsx` to set `selectedRender` and open the popup modal.
3. Build the modal UI in `src/app/gallery/page.tsx` and style it in `src/app/gallery/page.module.css`.
4. Add Zoom controls, Fullscreen toggle, and the text download action to the modal.

**Tech Stack:** Next.js App Router (TypeScript), CSS Modules, Vitest.

## Global Constraints

- Keep changes scoped to the current task. Don't expand scope or refactor unrelated code.
- Commit per completed task with a message referencing the task.

---

### Task 1: Add and Test doubleAsciiWidth Utility

**Files:**
- Modify: [src/lib/ascii/convert.ts](file:///d:/AI%20Bootcamp/week3-cjb1077/src/lib/ascii/convert.ts)
- Modify: [tests/ascii.test.ts](file:///d:/AI%20Bootcamp/week3-cjb1077/tests/ascii.test.ts)

**Interfaces:**
- Produces: `doubleAsciiWidth(ascii: string): string`

- [ ] **Step 1: Write a failing test for doubleAsciiWidth**
  Add a new test suite to the end of [tests/ascii.test.ts](file:///d:/AI%20Bootcamp/week3-cjb1077/tests/ascii.test.ts):
  ```typescript
  describe("doubleAsciiWidth", () => {
    it("doubles each character horizontally on every line", () => {
      const input = "abc\n123";
      const expected = "aabbcc\n112233";
      // We will import doubleAsciiWidth from convert.ts
      expect(doubleAsciiWidth(input)).toBe(expected);
    });
  });
  ```
  Also update the imports in [tests/ascii.test.ts](file:///d:/AI%20Bootcamp/week3-cjb1077/tests/ascii.test.ts) to:
  ```typescript
  import { convertImageToAscii, doubleAsciiWidth } from "../src/lib/ascii/convert";
  ```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npx vitest run tests/ascii.test.ts`
  Expected: FAIL with compilation error (doubleAsciiWidth is not exported/defined)

- [ ] **Step 3: Implement doubleAsciiWidth in convert.ts**
  Append the function to [src/lib/ascii/convert.ts](file:///d:/AI%20Bootcamp/week3-cjb1077/src/lib/ascii/convert.ts):
  ```typescript
  export function doubleAsciiWidth(ascii: string): string {
    return ascii
      .split("\n")
      .map((line) => Array.from(line).map((char) => char + char).join(""))
      .join("\n");
  }
  ```

- [ ] **Step 4: Run test to verify it passes**
  Run: `npx vitest run tests/ascii.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add src/lib/ascii/convert.ts tests/ascii.test.ts
  git commit -m "feat: implement doubleAsciiWidth helper and write unit tests (resolves #)"
  ```

---

### Task 2: Create Details Popup Modal UI and Interaction in Gallery Page

**Files:**
- Modify: [src/app/gallery/page.tsx](file:///d:/AI%20Bootcamp/week3-cjb1077/src/app/gallery/page.tsx)
- Modify: [src/app/gallery/page.module.css](file:///d:/AI%20Bootcamp/week3-cjb1077/src/app/gallery/page.module.css)

**Interfaces:**
- Consumes: `doubleAsciiWidth` from `src/lib/ascii/convert.ts`

- [ ] **Step 1: Update page.module.css with modal styles**
  Append these class definitions to [src/app/gallery/page.module.css](file:///d:/AI%20Bootcamp/week3-cjb1077/src/app/gallery/page.module.css):
  ```css
  /* Interactive Card Hover Indicator */
  .gridCardClickable {
    cursor: pointer;
  }
  .gridCardClickable:hover {
    border-color: var(--accent-primary, #00e5ff);
    box-shadow: 0 0 25px rgba(0, 229, 255, 0.15), 0 8px 32px 0 rgba(0, 0, 0, 0.5);
  }

  /* Modal Styles */
  .modalOverlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(5, 6, 8, 0.85);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }

  .modalContainer {
    background: var(--glass-bg, rgba(22, 24, 33, 0.8));
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
    border-radius: 16px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7);
    width: 100%;
    max-width: 1200px;
    height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: modalAppear 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  @keyframes modalAppear {
    from {
      transform: scale(0.95);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  .modalHeader {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    flex-shrink: 0;
  }

  .modalTitle {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary, #fff);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 80%;
  }

  .modalCloseBtn {
    background: transparent;
    border: none;
    color: var(--text-secondary, #9ca3af);
    cursor: pointer;
    font-size: 1.5rem;
    line-height: 1;
    transition: color 0.2s ease;
    padding: 4px 8px;
  }

  .modalCloseBtn:hover {
    color: #fff;
  }

  .modalBody {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 320px;
    overflow: hidden;
  }

  .modalViewport {
    background: rgba(5, 6, 8, 0.95);
    border-right: 1px solid rgba(255, 255, 255, 0.05);
    position: relative;
    overflow: auto;
    display: flex;
    padding: 1.5rem;
  }

  .modalPre {
    font-family: var(--font-mono);
    line-height: 0.65;
    letter-spacing: 0.1em;
    color: var(--accent-primary, #00e5ff);
    margin: auto;
    white-space: pre;
    text-shadow: 0 0 3px rgba(0, 229, 255, 0.4);
    transition: font-size 0.15s ease;
  }

  .modalControls {
    position: absolute;
    top: 1rem;
    right: 1rem;
    display: flex;
    gap: 8px;
    z-index: 10;
  }

  .modalBtn {
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-primary, #fff);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .modalBtn:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: var(--accent-primary, #00e5ff);
  }

  .modalSidebar {
    padding: 1.5rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    background: rgba(10, 11, 16, 0.3);
  }

  /* Fullscreen View state */
  .fullscreenView .modalBody {
    grid-template-columns: 1fr;
  }
  .fullscreenView .modalSidebar {
    display: none;
  }
  .fullscreenView .modalHeader {
    display: none;
  }
  .fullscreenView .modalContainer {
    max-width: 100vw;
    height: 100vh;
    border-radius: 0;
    border: none;
  }

  @media (max-width: 768px) {
    .modalBody {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr auto;
    }
    .modalViewport {
      border-right: none;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .modalSidebar {
      max-height: 250px;
    }
  }
  ```

- [ ] **Step 2: Add modal state variables in Gallery component**
  In [src/app/gallery/page.tsx](file:///d:/AI%20Bootcamp/week3-cjb1077/src/app/gallery/page.tsx), add imports:
  ```typescript
  import { doubleAsciiWidth } from "@/lib/ascii/convert";
  ```
  Add the following state variables inside the `Gallery` component (around line 99):
  ```typescript
  const [selectedRender, setSelectedRender] = useState<Render | null>(null);
  const [modalZoomLevel, setModalZoomLevel] = useState(1.0);
  const [modalFullscreen, setModalFullscreen] = useState(false);
  ```

- [ ] **Step 3: Listen for Escape key to dismiss modal**
  Add a new `useEffect` hook in the `Gallery` component:
  ```typescript
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedRender(null);
        setModalFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  ```

- [ ] **Step 4: Update card elements to trigger the modal**
  In [src/app/gallery/page.tsx](file:///d:/AI%20Bootcamp/week3-cjb1077/src/app/gallery/page.tsx) inside the card mapping code:
  Modify the card wrapping `div` to:
  ```typescript
  return (
    <div
      key={render.id}
      className={`${styles.glassCard} ${styles.gridCardClickable}`}
      onClick={() => {
        setSelectedRender(render);
        setModalZoomLevel(1.0);
        setModalFullscreen(false);
      }}
    >
  ```
  Also update the Delete button (`Scrub Log`) to prevent click propagation:
  ```typescript
  <button
    className={styles.deleteBtn}
    onClick={(e) => {
      e.stopPropagation();
      handleDelete(render.id);
    }}
  >
    Scrub Log
  </button>
  ```

- [ ] **Step 5: Verify building code**
  Run: `npm run build`
  Expected: Success

- [ ] **Step 6: Commit**
  ```bash
  git add src/app/gallery/page.tsx src/app/gallery/page.module.css
  git commit -m "feat: add click-to-open logic and key listeners for details popup modal (resolves #)"
  ```

---

### Task 3: Build Modal Popup Markup, Controls, and Fullscreen Mode

**Files:**
- Modify: [src/app/gallery/page.tsx](file:///d:/AI%20Bootcamp/week3-cjb1077/src/app/gallery/page.tsx)

- [ ] **Step 1: Append Modal JSX to Gallery render output**
  In [src/app/gallery/page.tsx](file:///d:/AI%20Bootcamp/week3-cjb1077/src/app/gallery/page.tsx), right before the closing outer container `</div>` (near line 521), insert the details modal markup:
  ```typescript
  {selectedRender && (
    <div
      className={`${styles.modalOverlay} ${modalFullscreen ? styles.fullscreenView : ""}`}
      onClick={() => {
        setSelectedRender(null);
        setModalFullscreen(false);
      }}
    >
      <div
        className={styles.modalContainer}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle} title={selectedRender.title}>
            🪐 Details: {selectedRender.title}
          </h2>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              Resolved: {selectedRender.sourceDate}
            </span>
            <button
              className={styles.modalCloseBtn}
              onClick={() => {
                setSelectedRender(null);
                setModalFullscreen(false);
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className={styles.modalBody}>
          {/* Viewport */}
          <div className={styles.modalViewport}>
            {/* Viewport Controls */}
            <div className={styles.modalControls}>
              <button
                className={styles.modalBtn}
                onClick={() => setModalZoomLevel((z) => Math.max(0.2, z - 0.2))}
                title="Zoom Out"
              >
                -
              </button>
              <span
                style={{
                  color: "var(--text-secondary)",
                  alignSelf: "center",
                  fontSize: "0.8rem",
                  fontFamily: "monospace",
                  minWidth: "35px",
                  textAlign: "center",
                }}
              >
                {Math.round(modalZoomLevel * 100)}%
              </span>
              <button
                className={styles.modalBtn}
                onClick={() => setModalZoomLevel((z) => Math.min(3.0, z + 0.2))}
                title="Zoom In"
              >
                +
              </button>
              <button
                className={styles.modalBtn}
                onClick={() => handleDownloadTxt(selectedRender)}
                title="Download ASCII Art as .txt file"
              >
                📥 Download
              </button>
              <button
                className={styles.modalBtn}
                onClick={() => setModalFullscreen(!modalFullscreen)}
                title={modalFullscreen ? "Exit Fullscreen" : "Fullscreen Zoom"}
              >
                {modalFullscreen ? "✕ Exit" : "🔍 Fullscreen"}
              </button>
            </div>

            <pre
              className={styles.modalPre}
              style={{ fontSize: `${5 * modalZoomLevel}px` }}
            >
              {selectedRender.ascii}
            </pre>
          </div>

          {/* Sidebar */}
          <div className={styles.modalSidebar}>
            {selectedRender.caption && (
              <div>
                <h3 className={styles.factHeader}>AI Themed Caption</h3>
                <p className={styles.captionText}>"{selectedRender.caption}"</p>
              </div>
            )}
            {selectedRender.funFact && (
              <div className={styles.factBox} style={{ marginTop: 0 }}>
                <div className={styles.factHeader}>Scientific Fun Fact</div>
                <p className={styles.factText}>{selectedRender.funFact}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )}
  ```

- [ ] **Step 2: Add placeholder download function**
  Add a temporary `handleDownloadTxt` stub inside `Gallery` component:
  ```typescript
  const handleDownloadTxt = (render: Render) => {
    console.log("Downloading txt for:", render.title);
  };
  ```

- [ ] **Step 3: Verify build**
  Run: `npm run build`
  Expected: Success

- [ ] **Step 4: Commit**
  ```bash
  git add src/app/gallery/page.tsx
  git commit -m "feat: complete gallery card popup JSX layout and toolbar toggle actions (resolves #)"
  ```

---

### Task 4: Implement Aspect Ratio Correcting Text Download

**Files:**
- Modify: [src/app/gallery/page.tsx](file:///d:/AI%20Bootcamp/week3-cjb1077/src/app/gallery/page.tsx)

- [ ] **Step 1: Implement full download logic**
  Replace the stub `handleDownloadTxt` in [src/app/gallery/page.tsx](file:///d:/AI%20Bootcamp/week3-cjb1077/src/app/gallery/page.tsx) with:
  ```typescript
  const handleDownloadTxt = (render: Render) => {
    try {
      // 1. Process character doubling to fix the aspect ratio stretch in text editors
      const formattedAscii = doubleAsciiWidth(render.ascii)
        .split("\n")
        .join("\r\n"); // Windows CRLF newlines

      // 2. Generate text file Blob
      const blob = new Blob([formattedAscii], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      // 3. Create downloader element
      const link = document.createElement("a");
      link.href = url;
      
      // Clean title for safe filename
      const safeTitle = render.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/(^_+|+$)/g, "");
      link.download = `${safeTitle}_ascii.txt`;
      
      // 4. Trigger download and cleanup
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download text file:", err);
      alert("Error occurred generating download file.");
    }
  };
  ```

- [ ] **Step 2: Run final validation**
  Run: `npm run build`
  Expected: Success

- [ ] **Step 3: Commit**
  ```bash
  git add src/app/gallery/page.tsx
  git commit -m "feat: implement double-width text file download for gallery renders (resolves #)"
  ```
