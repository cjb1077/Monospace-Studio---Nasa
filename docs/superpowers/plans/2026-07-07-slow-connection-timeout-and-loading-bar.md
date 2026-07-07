# Slow Connection Timeout & Loading Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a client-side fetch timeout and a glowing, premium visual loading progress bar on the Studio page.

**Architecture:** Update the React state machine, useEffect timers, and rendering logic on the client-side (`src/app/page.tsx`) to track request timeouts and update visual loader bars. Update the layout styling classes (`src/app/page.module.css`).

**Tech Stack:** React, Next.js (App Router), Vanilla CSS Modules.

## Global Constraints

1. Introduce a 25-second client-side request timeout for API calls to `/api/apod`. If a slow connection causes the request to exceed 25 seconds, the request is aborted and a user-friendly error is shown.
2. Replace the infinite loading spinner with a custom, premium progress bar showing progress (0% to 100%).
3. Implement a non-linear progress timer (0% to 45% in 3s, 45% to 80% in next 3s, then creeping slowly, completing at 100% on success).

---

### Task 1: Add Progress State, Client-Side Timeout, and Dynamic Loader Hook

**Files:**
- Modify: `src/app/page.tsx:47-240`

**Interfaces:**
- Consumes: None
- Produces: Progress state, 25s fetch abort timeout, and simulated ticking timer hook.

- [ ] **Step 1: Declare progress state variable**

In `src/app/page.tsx`, declare `progress` state:
```typescript
  const [progress, setProgress] = useState(0);
```

- [ ] **Step 2: Implement 25-second abort timeout in fetchApodData()**

In `src/app/page.tsx`, update `fetchApodData()` to start a timeout that aborts the controller and flags `isTimeout = true`:
```typescript
  const fetchApodData = async (targetDate: string, overrides: AsciiStyle | null) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setIsCooldown(true);
    setError(null);
    setProgress(0); // Reset progress

    setTimeout(() => {
      setIsCooldown(false);
    }, 1500);

    let isTimeout = false;
    const timeoutId = setTimeout(() => {
      isTimeout = true;
      abortController.abort();
    }, 25000); // 25-second client-side timeout

    try {
      let url = `/api/apod?date=${targetDate}`;
      if (overrides) {
        url += `&charSet=${overrides.charSet}&density=${overrides.density}&invert=${overrides.invert}&brightness=${overrides.brightness ?? 0}`;
        if (overrides.charSet === "custom" && overrides.customRamp) {
          url += `&customRamp=${encodeURIComponent(overrides.customRamp)}`;
        }
      }
      const response = await fetch(url, { signal: abortController.signal });
      clearTimeout(timeoutId);
      const data = (await response.json()) as ApodApiResponse;

      if (response.ok && data.ok) {
        setProgress(100); // Jump to complete
        setApodData(data);
        if (!overrides && data.style) {
          setStyleOverride({ ...data.style, brightness: data.style.brightness ?? 0 });
        }
      } else {
        setError(data.error || "An error occurred while fetching cosmic data.");
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        if (isTimeout) {
          setError("Connection timed out due to slow internet. Please check your network and try again.");
        }
      } else {
        console.error(err);
        setError("A connection error occurred while reaching Monospace Studio API.");
      }
    } finally {
      if (abortControllerRef.current === abortController) {
        setLoading(false);
      }
    }
  };
```

- [ ] **Step 3: Implement dynamic progress ticking timer hook**

In `src/app/page.tsx`, add a `useEffect` hook to increment the progress state smoothly:
```typescript
  // Dynamic progress loader ticking
  useEffect(() => {
    let intervalId: any;
    if (loading) {
      intervalId = setInterval(() => {
        setProgress((prev) => {
          if (prev < 45) {
            return Math.min(prev + 1.5, 45); // First 3s goes to 45%
          } else if (prev < 80) {
            return Math.min(prev + 1.15, 80); // Next 3s goes to 80%
          } else if (prev < 98) {
            return Math.min(prev + 0.1, 98); // Slow creep to 98%
          }
          return prev;
        });
      }, 100);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [loading]);
```

- [ ] **Step 4: Verify Next.js compilation**

Run command: `npm run build`
Expected: Passes with no TS compile errors.

---

### Task 2: Render Progress Bar UI and Update CSS Stylesheet

**Files:**
- Modify: `src/app/page.tsx:885-903`
- Modify: `src/app/page.module.css:661-750` (or locate the `.spinner` class block)

**Interfaces:**
- Consumes: Progress state inside page component
- Produces: Visual progress bar elements with custom glassmorphic and neon styles.

- [ ] **Step 1: Replace loading container layout with progress bar markup**

In `src/app/page.tsx`, replace the previous `loading && !apodData` spinner box with:
```tsx
          {loading && !apodData && (
            <div className={styles.loadingContainer}>
              <div className={styles.progressBarContainer}>
                <div 
                  className={styles.progressBarFill} 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className={styles.progressPercent}>{Math.round(progress)}%</div>
              <div className={styles.telemetryLogContainer}>
                <div className={styles.telemetryLogText}>
                  {loaderStep >= 0 && "📡 Uplinking with NASA planetary directory..."}
                </div>
                <div className={styles.telemetryLogText} style={{ animationDelay: "0.1s" }}>
                  {loaderStep >= 1 && "💿 Downloading image telemetry data..."}
                </div>
                <div className={styles.telemetryLogText} style={{ animationDelay: "0.2s" }}>
                  {loaderStep >= 2 && "🤖 Synchronizing AI stylization matrix..."}
                </div>
                <div className={styles.telemetryLogText} style={{ animationDelay: "0.3s" }}>
                  {loaderStep >= 3 && "🎨 Formatting monospace ASCII rendering..."}
                </div>
              </div>
            </div>
          )}
```

- [ ] **Step 2: Add styles in page.module.css and remove spinner styles**

In `src/app/page.module.css`, search for the `.spinner` styles and replace them with:
```css
.progressBarContainer {
  width: 100%;
  max-width: 320px;
  height: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progressBarFill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
  box-shadow: 0 0 12px rgba(0, 229, 255, 0.6);
  border-radius: 4px;
  transition: width 0.1s linear;
}

.progressPercent {
  font-family: var(--font-mono);
  color: var(--accent-primary);
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
  text-shadow: 0 0 8px rgba(0, 229, 255, 0.4);
}
```

- [ ] **Step 3: Run Next.js production build and tests**

Run: `npm run build; npm test`
Expected: Next.js builds cleanly, and all 58 unit tests pass successfully.

- [ ] **Step 4: Manual Timeout Verification in Browser**

1. Set the client-side timeout value inside `fetchApodData` to `1000` (1 second).
2. Load `http://localhost:3000/`.
3. Try fetching a date.
4. Verify that the request aborts after 1 second, and the error card displays: *"Connection timed out due to slow internet. Please check your network and try again."*
5. Restore the client-side timeout value to `25000` (25 seconds).

- [ ] **Step 5: Commit changes**

Run command:
```bash
git add src/app/page.tsx src/app/page.module.css
git commit -m "feat: add client timeout and loading progress bar (resolves #client-timeout)"
```
