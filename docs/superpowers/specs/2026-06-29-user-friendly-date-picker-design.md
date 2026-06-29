# Design Specification: User-Friendly Date Picker Shortcuts & Steppers

We will implement inline date-stepping navigation and quick-action shortcut buttons to make the target coordinates selection in Monospace Studio significantly more user-friendly.

## User Review Required

No major breaking changes are expected. The existing manual entry input date field will be retained.

## Proposed Changes

### Front-end Client Components & Styling

#### [MODIFY] [page.tsx](file:///d:/AI%20Bootcamp/week3-cjb1077/src/app/page.tsx)
- Create helper state indicators for boundaries:
  - `isToday`: check if `inputDate` matches `todayEst`
  - `isMinDate`: check if `inputDate` matches `"1995-06-16"`
- Implement safe date shifting functions (preventing timezone off-by-one errors by parsing/formatting dates carefully as UTC or local ISO date substrings):
  - `changeAndSubmitDate(targetDate: string)`: Updates `inputDate`, updates `activeDate`, and resets `styleOverride`.
  - `handlePrevDay()`: Shifts current date backward by 1 day.
  - `handleNextDay()`: Shifts current date forward by 1 day.
  - `handleToday()`: Shifts date to `todayEst`.
  - `handleYesterday()`: Shifts date to yesterday's Eastern date.
  - `handleRandom()`: Selects a valid random date between `1995-06-16` and today.
- Wrap the `<input type="date">` in a `.dateStepperContainer` class along with `◀` and `▶` stepper buttons.
- Render a `.shortcutsContainer` row beneath the stepper container with "📅 Today", "⬅️ Yesterday", and "🎲 Random" buttons.

#### [MODIFY] [page.module.css](file:///d:/AI%20Bootcamp/week3-cjb1077/src/app/page.module.css)
- Add CSS styling for:
  - `.dateStepperContainer`: flexbox alignment centering picker and buttons.
  - `.stepperBtn`: glassmorphic custom action button with hover transition and disabled opacity.
  - `.shortcutsContainer`: flexbox row spacing shortcuts beneath picker.
  - `.shortcutBtn`: small glassmorphic pill button.

## Verification Plan

### Automated Tests
- We will run the Vitest unit tests to ensure no regressions are introduced:
  - `npm test`

### Manual Verification
- We will launch the browser dev server and verify:
  - Stepping backward with `◀` decreases the date and triggers a request.
  - Stepping forward with `▶` increases the date and triggers a request.
  - Clicking "Today" switches date to today and triggers a request.
  - Clicking "Yesterday" switches date to yesterday and triggers a request.
  - Clicking "Random" switches date to a random valid date and triggers a request.
  - Steppers are correctly disabled on boundaries (`1995-06-16` and `todayEst`).
