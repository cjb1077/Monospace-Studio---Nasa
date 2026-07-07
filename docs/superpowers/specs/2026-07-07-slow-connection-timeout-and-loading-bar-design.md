# Design Spec: Slow Connection Timeout & Loading Progress Bar

## 1. Goal Description

This design specification details the implementation of client-side timeout mitigation and a smooth visual progress bar on the Studio page of the **Monospace Studio** application:
1. **Client-Side Timeout:** Introduce a 25-second client-side request timeout for API calls to `/api/apod`. If a slow connection causes the request to exceed 25 seconds, the request is aborted and a user-friendly error is shown: *"Connection timed out due to slow internet. Please check your network and try again."*
2. **Glowing Progress Bar:** Replace the infinite loading spinner with a custom, premium progress bar showing progress (0% to 100%) as the API payload fetches.
3. **Simulated Progress Interpolation:** Implement a non-linear client-side progress timer matching the telemetry steps to make the wait feel natural and responsive, reaching 100% immediately on successful resolution.

---

## 2. Proposed Changes

### 2.1 Component State & Timeout Setup
In [src/app/page.tsx](file:///d:/AI%20Bootcamp/week3-cjb1077/src/app/page.tsx):
- Add a new state variable:
  ```typescript
  const [progress, setProgress] = useState(0);
  ```
- Modify `fetchApodData()` to implement a 25-second timeout using a flag variable and `AbortController.abort()`:
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

### 2.2 Progress Timer Hook
In [src/app/page.tsx](file:///d:/AI%20Bootcamp/week3-cjb1077/src/app/page.tsx):
- Update the loading useEffect hook to run an interval updating progress dynamically:
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

### 2.3 Progress Bar Rendering
In [src/app/page.tsx](file:///d:/AI%20Bootcamp/week3-cjb1077/src/app/page.tsx):
- Replace the loading container layout `loading && !apodData` with:
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

### 2.4 Styling in Studio Page Stylesheet
In [src/app/page.module.css](file:///d:/AI%20Bootcamp/week3-cjb1077/src/app/page.module.css):
- Remove `.spinner` styling elements.
- Add style definitions:
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

---

## 3. Verification Plan

### 3.1 Automated Verification
- Run `npm run build` to verify standard package bundling completes with zero errors.
- Run `npm test` to verify all Vitest tests pass without regressions.

### 3.2 Manual Verification (with Chrome DevTools / Browser Subagent)
- Open DevTools Network tab. Enable network throttling (e.g. "Slow 3G").
- Request a date (e.g. today's date) and verify that the progress bar mounts and increments smoothly.
- Simulate a client timeout:
  - Temporarily modify the client-side timeout value to `1000` (1 second) or throttle network extremely.
  - Trigger a generate action.
  - Verify that the connection aborts after 1 second, the loading screen closes, and the error card displays: *"Connection timed out due to slow internet. Please check your network and try again."*
  - Revert the timeout value to `25000`.
