# Design Specification: View Full Original Image Preview

We will update the APOD source image thumbnail in the Monospace Studio "Source Telemetry" card to display the complete image without cropping, and provide click-through navigation to open the original image in full resolution.

## User Review Required

No breaking changes or major database updates are involved. This is purely a user interface optimization for image preview.

## Proposed Changes

### Front-end Component

#### [MODIFY] [page.tsx](file:///d:/AI%20Bootcamp/week3-cjb1077/src/app/page.tsx)
- Wrap the preview image in an `<a>` tag with `href={apodData.source.imageUrl}`, `target="_blank"`, and `rel="noopener noreferrer"` so users can click the image to open it in a new tab.
- Set a clear `title="View full-size original image"` tooltip on the link.
- Update the image inline styles to use `objectFit: "contain"`, `maxWidth: "100%"`, `maxHeight: "100%"`, `width: "auto"`, and `height: "auto"`.

### Stylesheet

#### [MODIFY] [page.module.css](file:///d:/AI%20Bootcamp/week3-cjb1077/src/app/page.module.css)
- Add styling to `.thumbnailContainer` to center the image and set a clean dark background framing:
  - Add `background-color: rgba(0, 0, 0, 0.4);`
  - Add `display: flex;`
  - Add `align-items: center;`
  - Add `justify-content: center;`
- Update `.thumbnail` class:
  - Set `object-fit: contain;`
- Add a `.thumbnailLink` helper style:
  - Ensure the anchor occupies `width: 100%; height: 100%;` with flex center alignment to support hover states and clean scaling of interactive elements.

## Verification Plan

### Automated Tests
- Run existing test suites to ensure zero code regressions:
  - `npm test`

### Manual Verification
- Start local development server.
- Load different dates (e.g. standard horizontal images vs vertical panorama images) to check that:
  - Images are framed in full within the preview box without any border/edge cropping.
  - Mismatched aspect ratios are presented beautifully inside a centered dark letterboxed block.
  - Hovering over the image displays the tool-tip "View full-size original image".
  - Clicking the image successfully opens the original URL in a new browser tab.
