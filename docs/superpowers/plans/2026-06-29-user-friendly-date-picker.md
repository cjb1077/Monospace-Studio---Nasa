# User-Friendly Date Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement inline date-stepping navigation and quick-action shortcuts to make browsing the NASA APOD gallery easy and fast.

**Architecture:** Add React event handlers to calculate shifted, today, yesterday, and random dates safely in local time. Flank the date picker input with stepper buttons, place quick-action buttons below it, and automatically trigger database fetching/art generation when any shortcut or arrow is clicked.

**Tech Stack:** Next.js App Router, React, CSS Modules.

## Global Constraints

- Keep changes scoped to the target coordinates date picker styling and events.
- Never hardcode the today date client-side to prevent hydration mismatches. Use the `todayEst` value (derived client-side after mounting).
- The earliest APOD date is `1995-06-16`. Never allow navigation or random dates to go earlier than this date.
- The latest APOD date is `todayEst`. Never allow navigation or random dates to exceed today.
- Use deterministic, timezone-safe date calculations to prevent off-by-one errors.

---

### Task 1: CSS Styling Setup for Stepper and Shortcuts

**Files:**
- Modify: [page.module.css](file:///d:/AI%20Bootcamp/week3-cjb1077/src/app/page.module.css)

- [ ] **Step 1: Write styling rules**
  Add the following classes to `src/app/page.module.css`:
  ```css
  /* Date Stepper Container & Buttons */
  .dateStepperContainer {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
  }

  .stepperBtn {
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--glass-border);
    border-radius: 8px;
    color: var(--text-primary);
    width: 2.75rem;
    height: 2.75rem;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .stepperBtn:hover:not(:disabled) {
    background: rgba(0, 229, 255, 0.1);
    border-color: var(--accent-primary);
    box-shadow: 0 0 10px rgba(0, 229, 255, 0.2);
  }

  .stepperBtn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  /* Shortcuts Container & Buttons */
  .shortcutsContainer {
    display: flex;
    gap: 0.5rem;
    justify-content: space-between;
    margin-top: 0.75rem;
    flex-wrap: wrap;
  }

  .shortcutBtn {
    flex: 1;
    min-width: 70px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--glass-border);
    border-radius: 6px;
    color: var(--text-secondary);
    padding: 0.375rem 0.5rem;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .shortcutBtn:hover:not(:disabled) {
    background: rgba(0, 229, 255, 0.05);
    border-color: var(--accent-primary);
    color: var(--text-primary);
  }

  .shortcutBtn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  ```

- [ ] **Step 2: Verify CSS builds successfully**
  Run: `npm run build`
  Expected: Web application builds cleanly without styling compilation errors.

- [ ] **Step 3: Commit styling setup**
  ```bash
  git add src/app/page.module.css
  git commit -m "style: add date stepper and shortcuts CSS rules"
  ```

---

### Task 2: Implement Date Shifting and Action Functions

**Files:**
- Modify: [page.tsx](file:///d:/AI%20Bootcamp/week3-cjb1077/src/app/page.tsx)

- [ ] **Step 1: Implement helper calculation functions**
  Insert date shifting functions in the component body of `src/app/page.tsx`.
  Specifically, after state definitions:
  ```typescript
  const isMinDate = inputDate === "1995-06-16";
  const isToday = inputDate === todayEst;

  const changeAndSubmitDate = (targetDate: string) => {
    setInputDate(targetDate);
    setActiveDate(targetDate);
    setStyleOverride(null);
  };

  const adjustDateByDays = (dateStr: string, days: number) => {
    const [year, month, day] = dateStr.split("-").map(Number);
    const dateObj = new Date(year, month - 1, day);
    dateObj.setDate(dateObj.getDate() + days);
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const handlePrevDay = () => {
    if (isMinDate || !inputDate) return;
    const prevDate = adjustDateByDays(inputDate, -1);
    changeAndSubmitDate(prevDate);
  };

  const handleNextDay = () => {
    if (isToday || !inputDate) return;
    const nextDate = adjustDateByDays(inputDate, 1);
    changeAndSubmitDate(nextDate);
  };

  const handleToday = () => {
    if (isToday || !todayEst) return;
    changeAndSubmitDate(todayEst);
  };

  const handleYesterday = () => {
    if (!todayEst) return;
    const yesterday = adjustDateByDays(todayEst, -1);
    changeAndSubmitDate(yesterday);
  };

  const handleRandom = () => {
    if (!todayEst) return;
    const [minY, minM, minD] = "1995-06-16".split("-").map(Number);
    const [maxY, maxM, maxD] = todayEst.split("-").map(Number);
    const minDate = new Date(minY, minM - 1, minD);
    const maxDate = new Date(maxY, maxM - 1, maxD);
    
    const diffTime = maxDate.getTime() - minDate.getTime();
    const randomTime = minDate.getTime() + Math.random() * diffTime;
    const randomDateObj = new Date(randomTime);
    
    const y = randomDateObj.getFullYear();
    const m = String(randomDateObj.getMonth() + 1).padStart(2, "0");
    const d = String(randomDateObj.getDate()).padStart(2, "0");
    const randomDateStr = `${y}-${m}-${d}`;
    changeAndSubmitDate(randomDateStr);
  };
  ```

- [ ] **Step 2: Compile verification**
  Run: `npx tsc --noEmit`
  Expected: No TypeScript compilation errors.

---

### Task 3: Replace Date Picker Form Markup

**Files:**
- Modify: [page.tsx](file:///d:/AI%20Bootcamp/week3-cjb1077/src/app/page.tsx)

- [ ] **Step 1: Replace form group markup**
  Replace lines 390-408 in `src/app/page.tsx` with the stepper and shortcut button controls:
  ```tsx
            <form onSubmit={handleGenerate}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="date-picker">
                  Select Date
                </label>
                <div className={styles.dateStepperContainer}>
                  <button
                    type="button"
                    className={styles.stepperBtn}
                    onClick={handlePrevDay}
                    disabled={loading || isMinDate}
                    title="Previous Day"
                  >
                    ◀
                  </button>
                  <input
                    id="date-picker"
                    type="date"
                    className={styles.dateInput}
                    min="1995-06-16"
                    max={todayEst}
                    value={inputDate}
                    onChange={(e) => setInputDate(e.target.value)}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className={styles.stepperBtn}
                    onClick={handleNextDay}
                    disabled={loading || isToday}
                    title="Next Day"
                  >
                    ▶
                  </button>
                </div>
                <div className={styles.shortcutsContainer}>
                  <button
                    type="button"
                    className={styles.shortcutBtn}
                    onClick={handleToday}
                    disabled={loading || isToday}
                    title="Load Today's APOD"
                  >
                    📅 Today
                  </button>
                  <button
                    type="button"
                    className={styles.shortcutBtn}
                    onClick={handleYesterday}
                    disabled={loading || isMinDate}
                    title="Load Yesterday's APOD"
                  >
                    ⬅️ Yesterday
                  </button>
                  <button
                    type="button"
                    className={styles.shortcutBtn}
                    onClick={handleRandom}
                    disabled={loading}
                    title="Load a Random APOD"
                  >
                    🎲 Random
                  </button>
                </div>
              </div>
              <button type="submit" className={styles.btn} disabled={loading}>
                {loading ? "Transmitting..." : "Generate Cosmic Art"}
              </button>
            </form>
  ```

- [ ] **Step 2: Run all unit tests**
  Run: `npm test`
  Expected: All 54 tests pass.

- [ ] **Step 3: Build check**
  Run: `npm run build`
  Expected: Successful bundle compilation.

- [ ] **Step 4: Commit UI modifications**
  ```bash
  git add src/app/page.tsx
  git commit -m "feat: implement date picker stepper and quick action shortcuts"
  ```
