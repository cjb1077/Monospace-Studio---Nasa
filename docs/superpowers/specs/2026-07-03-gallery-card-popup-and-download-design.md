# Design Spec: Gallery Card Details Popup & Text Download

## 1. Goal Description

This design specification details the implementation of an interactive detail popup modal for the Monospace Studio Gallery page. When a user clicks on any card in the gallery grid:
1. A glassmorphic details popup modal is displayed.
2. The modal shows the full APOD title, date, the ASCII art viewport, and the AI insights (themed caption and scientific fun fact).
3. The ASCII art viewport supports zoom-in, zoom-out, and fullscreen toggle.
4. Instead of copy to clipboard, the popup includes a download button that exports the ASCII art as a `.txt` file, using horizontal character doubling (Approach 1) to correct the aspect ratio stretch when opened in standard 2:1 character cell editors.

---

## 2. Proposed Changes

### 2.1 Gallery Card Interactions
In [src/app/gallery/page.tsx](file:///d:/AI%20Bootcamp/week3-cjb1077/src/app/gallery/page.tsx):
- Introduce a state variables for tracking the active selected render to show in the popup modal:
  ```typescript
  const [selectedRender, setSelectedRender] = useState<Render | null>(null);
  const [modalZoomLevel, setModalZoomLevel] = useState<number>(1.0);
  const [modalFullscreen, setModalFullscreen] = useState<boolean>(false);
  ```
- Wrap the main contents of each gallery card in a click handler that calls `setSelectedRender(render)` and resets the zoom and fullscreen states.
- Exclude the `Scrub Log` (delete button) from triggering the modal by adding `e.stopPropagation()` in its click handler.
- Update CSS to style the cards with `cursor: pointer` and pointer-active hover glow effects.

### 2.2 Details Popup Modal UI
In [src/app/gallery/page.tsx](file:///d:/AI%20Bootcamp/week3-cjb1077/src/app/gallery/page.tsx):
- Implement the overlay markup at the end of the return statement:
  - Background overlay: closes the modal on click.
  - Listen for the `Escape` key using a `useEffect` window keydown listener to close the modal.
  - The modal panel contains:
    - **Header:** Full title, resolved date, and `✕` close button.
    - **Modal Body (Flexbox/Grid layout):**
      - **ASCII Art Viewport:** Shows the ASCII art inside a styled container.
      - **Toolbar Controls:**
        - `-` Zoom Out: decreases `modalZoomLevel` by `0.2` (minimum `0.2`).
        - `+` Zoom In: increases `modalZoomLevel` by `0.2` (maximum `3.0`).
        - `📥 Download` button: downloads the formatted `.txt` file.
        - `🔍 Fullscreen` button: toggles `modalFullscreen` to stretch the ASCII container across the modal, hiding the header and sidebar.
      - **Sidebar Panel:** Displays the AI Themed Caption and the AI Scientific Fun Fact.

### 2.3 Aspect Ratio Correcting Text Download
In [src/app/gallery/page.tsx](file:///d:/AI%20Bootcamp/week3-cjb1077/src/app/gallery/page.tsx):
- Implement a helper function `downloadAsciiTextFile(render: Render)`:
  - Take the `render.ascii` string.
  - Process line-by-line: duplicate every character horizontally (`char => char + char`).
  - Convert newlines to CRLF (`\r\n`) for cross-platform compatibility.
  - Create a `Blob` of type `text/plain;charset=utf-8`.
  - Initiate file download using a temporary `<a>` element.
  - Naming convention: `<title_slug>_ascii.txt` (with non-alphanumeric characters replaced by underscores).

### 2.4 Modal Styling in Gallery Module CSS
In [src/app/gallery/page.module.css](file:///d:/AI%20Bootcamp/week3-cjb1077/src/app/gallery/page.module.css):
- Define classes for the modal layout:
  - `.modalOverlay`: Fixed centering overlay covering the screen.
  - `.modalContainer`: Glassmorphic panel containing the layout with backdrop blur and custom border styles.
  - `.modalHeader`, `.modalTitle`, `.modalCloseBtn`.
  - `.modalBody`: Desktop two-column layout, mobile single-column layout.
  - `.modalViewport`: Styled container for `<pre>` tag.
  - `.modalPre`: Styled pre-tag with customizable font-size scaling.
  - `.modalControls`, `.modalBtn`.
  - `.modalSidebar`: Side-column for AI Insights.
  - `.fullscreenView`: Styles applied when `modalFullscreen` is active.

---

## 3. Verification Plan

### 3.1 Manual Verification
- Open the application in the browser at `http://localhost:3000/gallery`.
- Verify that hovering over any render card changes the cursor to pointer and increases border visibility.
- Click a card: verify that the modal opens and displays the correct title, ASCII art preview, caption, and fact.
- Test the zoom buttons (`+` and `-`) and confirm the ASCII art font size resizes smoothly.
- Click the Fullscreen button: verify that it expands the ASCII art layout to cover the full modal screen, and hides the metadata elements.
- Press `Escape` or click the backdrop overlay to close the modal.
- Click the **Download** button:
  - Verify that a `.txt` file downloads to your local machine.
  - Open the `.txt` file in a standard text editor (like Notepad or VS Code) and verify that the image retains correct proportions (no vertical stretch).
