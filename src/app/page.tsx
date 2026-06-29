"use client";

import React, { useState, useEffect, useRef } from "react";
import styles from "./page.module.css";
import { getSupabaseClient } from "@/lib/supabase/client";

interface ApodSource {
  title: string;
  date: string;
  imageUrl: string;
  copyright: string | null;
  explanation: string;
}

interface AsciiStyle {
  charSet: "standard" | "fine" | "blocky";
  density: number;
  invert: boolean;
}

interface ApodApiResponse {
  ok: boolean;
  source?: ApodSource;
  ascii?: string;
  style?: AsciiStyle;
  caption?: string;
  funFact?: string;
  aiStyleUsed?: boolean;
  aiCaptionUsed?: boolean;
  usedFallbackImage?: boolean;
  error?: string;
}

const getTodayEst = () => {
  const todayStr = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  const todayDateObj = new Date(todayStr);
  const todayYear = todayDateObj.getFullYear();
  const todayMonth = String(todayDateObj.getMonth() + 1).padStart(2, "0");
  const todayDay = String(todayDateObj.getDate()).padStart(2, "0");
  return `${todayYear}-${todayMonth}-${todayDay}`;
};

export default function Home() {
  const [inputDate, setInputDate] = useState("");
  const [activeDate, setActiveDate] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const todayEst = isMounted ? getTodayEst() : "";
  const [loading, setLoading] = useState(true);
  const [isCooldown, setIsCooldown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apodData, setApodData] = useState<ApodApiResponse | null>(null);
  
  // Style overrides state
  const [styleOverride, setStyleOverride] = useState<AsciiStyle | null>(null);
  
  // Auth states
  const [session, setSession] = useState<any>(null);
  const [showAuthDropdown, setShowAuthDropdown] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Save states
  const [saveIsPublic, setSaveIsPublic] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [viewportHover, setViewportHover] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

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


  // Dynamic loader step ticking
  const [loaderStep, setLoaderStep] = useState(0);

  useEffect(() => {
    let intervalId: any;
    if (loading) {
      setLoaderStep(0);
      intervalId = setInterval(() => {
        setLoaderStep((prev) => (prev < 3 ? prev + 1 : prev));
      }, 950);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [loading]);

  // Mount logic to calculate timezone date client-side and avoid hydration warnings
  useEffect(() => {
    const today = getTodayEst();
    setInputDate(today);
    setActiveDate(today);
    setIsMounted(true);
  }, []);

  // Listen to auth changes
  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchApodData = async (targetDate: string, overrides: AsciiStyle | null) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setIsCooldown(true);
    setError(null);

    setTimeout(() => {
      setIsCooldown(false);
    }, 1500);

    try {
      let url = `/api/apod?date=${targetDate}`;
      if (overrides) {
        url += `&charSet=${overrides.charSet}&density=${overrides.density}&invert=${overrides.invert}`;
      }
      const response = await fetch(url, { signal: abortController.signal });
      const data = (await response.json()) as ApodApiResponse;

      if (response.ok && data.ok) {
        setApodData(data);
        if (!overrides && data.style) {
          setStyleOverride(data.style);
        }
      } else {
        setError(data.error || "An error occurred while fetching cosmic data.");
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error(err);
        setError("A connection error occurred while reaching Monospace Studio API.");
      }
    } finally {
      if (abortControllerRef.current === abortController) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (activeDate) {
      fetchApodData(activeDate, null);
    }
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [activeDate]);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputDate) return;
    setActiveDate(inputDate);
    // Reset overrides for a fresh date request
    setStyleOverride(null);
  };

  const handleStyleChange = (updates: Partial<AsciiStyle>) => {
    if (!styleOverride) return;
    const newOverrides = {
      ...styleOverride,
      ...updates,
    };
    setStyleOverride(newOverrides);
    fetchApodData(activeDate, newOverrides);
  };

  const handleCopy = async () => {
    if (!apodData?.ascii) return;
    try {
      await navigator.clipboard.writeText(apodData.ascii);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy art:", err);
    }
  };

  const handleZoom = () => {
    setZoomed(!zoomed);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail) return;
    setLoginLoading(true);
    setAuthError(null);
    try {
      const supabase = getSupabaseClient();
      const { error: authErr } = await supabase.auth.signInWithOtp({
        email: loginEmail,
        options: {
          emailRedirectTo: window.location.origin + "/api/auth/callback",
        },
      });
      if (authErr) {
        setAuthError(authErr.message);
      } else {
        setLoginSuccess(true);
      }
    } catch (err) {
      console.error(err);
      setAuthError("Failed to trigger login request.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
      setSession(null);
      setShowAuthDropdown(false);
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  const handleSaveRender = async () => {
    if (!apodData || !session) return;
    setSaveLoading(true);
    setSaveError(null);
    try {
      const response = await fetch("/api/renders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: apodData.source?.title,
          ascii: apodData.ascii,
          caption: apodData.caption || "",
          funFact: apodData.funFact || "",
          sourceDate: apodData.source?.date,
          isPublic: saveIsPublic,
        }),
      });
      const data = await response.json();
      if (data.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setSaveError(data.error || "Failed to save cosmic render.");
      }
    } catch (err) {
      console.error(err);
      setSaveError("Connection error while saving render.");
    } finally {
      setSaveLoading(false);
    }
  };

  if (!isMounted) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <span className={styles.terminalIcon}>&gt;_</span> Monospace Studio
          </div>
          <nav className={styles.nav}>
            <a href="#" className={`${styles.navLink} ${styles.navLinkActive}`}>🔭 Studio</a>
            <a href="/gallery" className={styles.navLink}>🌌 Gallery</a>
          </nav>
        </header>
        <main className={styles.main}>
          <section className={styles.leftCol}>
            <div className={`${styles.glassCard} ${styles.skeletonPulse}`} style={{ height: "180px" }} />
          </section>
          <section className={styles.rightCol}>
            <div className={styles.loadingContainer}>
              <div className={styles.spinner}></div>
              <p>📡 Initializing quantum data link...</p>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header / Navbar */}
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.terminalIcon}>&gt;_</span> Monospace Studio
        </div>
        <nav className={styles.nav}>
          <a href="#" className={`${styles.navLink} ${styles.navLinkActive}`}>
            🔭 Studio
          </a>
          <a href="/gallery" className={styles.navLink}>
            🌌 Gallery
          </a>

          {session ? (
            <div className={styles.userStatus}>
              <span>🧑‍🚀 {session.user.email}</span>
              <button onClick={handleSignOut} className={styles.authBtn}>
                Sign Out
              </button>
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              <button
                onClick={() => {
                  setShowAuthDropdown(!showAuthDropdown);
                  setLoginSuccess(false);
                  setAuthError(null);
                }}
                className={styles.authBtn}
              >
                Sign In
              </button>

              {showAuthDropdown && (
                <div className={styles.glassCard} style={{
                  position: "absolute",
                  right: 0,
                  top: "120%",
                  width: "280px",
                  zIndex: 200,
                  padding: "1.25rem",
                  boxShadow: "0 10px 40px rgba(0,0,0,0.7)"
                }}>
                  <h3 className={styles.cardTitle} style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>
                    🚀 Teleport Link
                  </h3>
                  {loginSuccess ? (
                    <div style={{ color: "#34d399", fontSize: "0.875rem", lineHeight: "1.4" }}>
                      📡 Magic link sent! Please check your email inbox to complete sign-in.
                    </div>
                  ) : (
                    <form onSubmit={handleLogin}>
                      <div className={styles.formGroup} style={{ marginBottom: "0.75rem" }}>
                        <input
                          type="email"
                          placeholder="astronaut@nasa.gov"
                          className={styles.dateInput}
                          style={{ padding: "0.5rem", fontSize: "0.9rem" }}
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          required
                        />
                      </div>
                      {authError && (
                        <div className={styles.inlineError} style={{ marginBottom: "0.75rem", marginTop: 0 }}>
                          <span>⚠️</span> {authError}
                        </div>
                      )}
                      <button
                        type="submit"
                        className={styles.btn}
                        style={{ padding: "0.5rem", fontSize: "0.9rem" }}
                        disabled={loginLoading}
                      >
                        {loginLoading ? "Sending..." : "Send Magic Link"}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}
        </nav>
      </header>

      {/* Main Grid */}
      <main className={styles.main}>
        {/* Left Column: Input + Controls */}
        <section className={styles.leftCol}>
          {/* Date Picker Form */}
          <div className={styles.glassCard}>
            <h2 className={styles.cardTitle}>
              <span className={styles.cardTitleIcon}>📅</span> Target Coordinates
            </h2>
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
                    disabled={loading || isCooldown || isMinDate}
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
                    disabled={loading || isCooldown}
                  />
                  <button
                    type="button"
                    className={styles.stepperBtn}
                    onClick={handleNextDay}
                    disabled={loading || isCooldown || isToday}
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
                    disabled={loading || isCooldown || isToday}
                    title="Load Today's APOD"
                  >
                    📅 Today
                  </button>
                  <button
                    type="button"
                    className={styles.shortcutBtn}
                    onClick={handleYesterday}
                    disabled={loading || isCooldown || isMinDate}
                    title="Load Yesterday's APOD"
                  >
                    ⬅️ Yesterday
                  </button>
                  <button
                    type="button"
                    className={styles.shortcutBtn}
                    onClick={handleRandom}
                    disabled={loading || isCooldown}
                    title="Load a Random APOD"
                  >
                    🎲 Random
                  </button>
                </div>
              </div>
              <button type="submit" className={styles.btn} disabled={loading || isCooldown}>
                {loading ? "Transmitting..." : "Generate Cosmic Art"}
              </button>
            </form>
          </div>

          {/* Skeletons when initial loading and no data exists yet */}
          {loading && !apodData && (
            <>
              {/* Skeleton Source Telemetry */}
              <div className={`${styles.glassCard} ${styles.skeletonPulse}`}>
                <h2 className={styles.cardTitle}>
                  <span className={styles.cardTitleIcon}>☄️</span> Source Telemetry
                </h2>
                <div className={`${styles.skeletonThumbnail} ${styles.skeletonPulse}`} />
                <div className={`${styles.skeletonTitle} ${styles.skeletonPulse}`} />
                <div className={`${styles.skeletonTextShort} ${styles.skeletonPulse}`} style={{ marginBottom: "1rem" }} />
                <div className={`${styles.skeletonText} ${styles.skeletonPulse}`} />
                <div className={`${styles.skeletonText} ${styles.skeletonPulse}`} />
                <div className={`${styles.skeletonText} ${styles.skeletonPulse}`} />
              </div>
              {/* Skeleton Stylization controls */}
              <div className={`${styles.glassCard} ${styles.skeletonPulse}`}>
                <h2 className={styles.cardTitle}>
                  <span className={styles.cardTitleIcon}>⚙️</span> Stylization Matrix
                </h2>
                <div className={`${styles.skeletonControl} ${styles.skeletonPulse}`} />
                <div className={`${styles.skeletonControl} ${styles.skeletonPulse}`} />
                <div className={`${styles.skeletonControl} ${styles.skeletonPulse}`} />
              </div>
            </>
          )}

          {/* APOD Metadata Display */}
          {apodData?.source && !error && (!loading || apodData) && (
            <div className={styles.glassCard} style={{ opacity: loading ? 0.6 : 1, transition: "opacity 0.2s" }}>
              <h2 className={styles.cardTitle}>
                <span className={styles.cardTitleIcon}>☄️</span> Source Telemetry
              </h2>
              <div className={styles.thumbnailContainer}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={apodData.source.imageUrl}
                  alt={apodData.source.title}
                  className={styles.thumbnail}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
              <h3 className={styles.apodTitle}>{apodData.source.title}</h3>
              <div className={styles.apodMeta}>
                <span>📅 {apodData.source.date}</span>
                {apodData.source.copyright && <span>©️ {apodData.source.copyright}</span>}
              </div>
              <div className={styles.explanationContainer}>
                <p>{apodData.source.explanation}</p>
              </div>
            </div>
          )}

          {/* ASCII Conversion Parameters */}
          {styleOverride && !error && (!loading || apodData) && (
            <div className={styles.glassCard} style={{ opacity: loading ? 0.6 : 1, transition: "opacity 0.2s" }}>
              <h2 className={styles.cardTitle}>
                <span className={styles.cardTitleIcon}>⚙️</span> Stylization Matrix
              </h2>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="charset-select">
                  Glyph Set
                </label>
                <select
                  id="charset-select"
                  className={styles.selectInput}
                  value={styleOverride.charSet}
                  onChange={(e) =>
                    handleStyleChange({ charSet: e.target.value as AsciiStyle["charSet"] })
                  }
                  disabled={loading}
                >
                  <option value="standard">Standard (.-=+*#%@)</option>
                  <option value="fine">Fine (Smooth Gradients)</option>
                  <option value="blocky">Blocky (High Contrast)</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="density-slider">
                  Luminance Density
                </label>
                <div className={styles.sliderContainer}>
                  <input
                    id="density-slider"
                    type="range"
                    min="0.4"
                    max="0.9"
                    step="0.05"
                    className={styles.slider}
                    value={styleOverride.density}
                    onChange={(e) => handleStyleChange({ density: parseFloat(e.target.value) })}
                    disabled={loading}
                  />
                  <span className={styles.sliderValue}>{styleOverride.density.toFixed(2)}</span>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.checkboxContainer}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={styleOverride.invert}
                    onChange={(e) => handleStyleChange({ invert: e.target.checked })}
                    disabled={loading}
                  />
                  <span className={styles.label}>Invert Luminance Ramp</span>
                </label>
              </div>
            </div>
          )}
        </section>

        {/* Right Column: ASCII Art Viewport + AI Insights */}
        <section className={styles.rightCol}>
          {/* Main Output State Render: Loading, Skeletons & Cosmic Telemetry */}
          {loading && !apodData && (
            <div className={styles.loadingContainer}>
              <div className={styles.spinner}></div>
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

          {error && !loading && (
            <div className={styles.errorCard}>
              <div className={styles.errorHeader}>
                <span>⚠️</span> Transmission Failure
              </div>
              <p className={styles.errorDesc}>{error}</p>
              <button
                onClick={() => fetchApodData(activeDate, styleOverride)}
                className={styles.retryBtn}
              >
                🔄 Retry Connection
              </button>
            </div>
          )}

          {/* ASCII Art Viewport (renders when we have data, showing an overlay spinner if loading additional styling overrides) */}
          {apodData?.ascii && !error && (
            <>
              {/* ASCII Output Card */}
              <div
                className={`${styles.viewportContainer} ${
                  viewportHover ? styles.viewportContainerHover : ""
                }`}
                onMouseEnter={() => setViewportHover(true)}
                onMouseLeave={() => setViewportHover(false)}
                style={{ position: "relative" }}
              >
                {loading && (
                  <div style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    background: "rgba(5, 6, 8, 0.7)",
                    backdropFilter: "blur(4px)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "1rem",
                    zIndex: 20
                  }}>
                    <div className={styles.spinner} style={{ width: "35px", height: "35px" }}></div>
                    <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Recalculating ASCII projection...</p>
                  </div>
                )}
                {/* Floating control buttons */}
                <div className={styles.floatingControls}>
                  <button
                    className={styles.floatingBtn}
                    onClick={handleCopy}
                    title="Copy Raw ASCII to Clipboard"
                    disabled={loading}
                  >
                    {copied ? "✅" : "📋"}
                  </button>
                  <button
                    className={styles.floatingBtn}
                    onClick={handleZoom}
                    title="Fullscreen Zoom"
                    disabled={loading}
                  >
                    🔍
                  </button>
                </div>
                <pre className={styles.preArt} style={{ opacity: loading ? 0.3 : 1 }}>{apodData.ascii}</pre>
              </div>

              {/* System Telemetry Section */}
              <div className={styles.telemetryGrid} style={{ opacity: loading ? 0.5 : 1 }}>
                {/* AI Style badge */}
                <div
                  className={`${styles.badge} ${
                    apodData.aiStyleUsed ? styles.badgeActive : styles.badgeFallback
                  }`}
                >
                  AI Style: {apodData.aiStyleUsed ? "Active" : "Bypassed / Default"}
                </div>

                {/* AI Caption badge */}
                <div
                  className={`${styles.badge} ${
                    apodData.aiCaptionUsed ? styles.badgeActive : styles.badgeFallback
                  }`}
                >
                  AI Insights: {apodData.aiCaptionUsed ? "Active" : "Fallback Default"}
                </div>

                {/* NASA Source badge */}
                <div
                  className={`${styles.badge} ${
                    apodData.usedFallbackImage
                      ? styles.badgeFallback
                      : activeDate !== apodData.source?.date
                      ? styles.badgeWalkback
                      : styles.badgeStable
                  }`}
                >
                  NASA Source:{" "}
                  {apodData.usedFallbackImage
                    ? "Offline Fallback"
                    : activeDate !== apodData.source?.date
                    ? `Walkback (${apodData.source?.date})`
                    : "Original"}
                </div>
              </div>

              {/* Warning notifications */}
              {apodData.usedFallbackImage && (
                <div className={styles.warningBanner}>
                  <span>⚠️</span> The NASA APOD service is currently offline or returned invalid
                  media. Rendered using default local starry assets.
                </div>
              )}

              {/* Save Render Card (Only when logged in) */}
              {session && (
                <div className={styles.glassCard} style={{ display: "flex", flexDirection: "column", gap: "1rem", opacity: loading ? 0.5 : 1 }}>
                  <h3 className={styles.cardTitle} style={{ fontSize: "1.05rem", paddingBottom: "0.5rem", marginBottom: 0 }}>
                    💾 Save to Space Archive
                  </h3>
                  {saveError && (
                    <div className={styles.inlineError} style={{ margin: 0 }}>
                      <span>⚠️</span> {saveError}
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", width: "100%" }}>
                    <label className={styles.checkboxContainer} style={{ margin: 0 }}>
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={saveIsPublic}
                        onChange={(e) => setSaveIsPublic(e.target.checked)}
                        disabled={loading}
                      />
                      <span className={styles.label}>Publish to public feed</span>
                    </label>
                    <button
                      className={styles.btn}
                      style={{ width: "auto", minWidth: "160px", padding: "0.6rem 1.2rem", fontSize: "0.9rem" }}
                      onClick={handleSaveRender}
                      disabled={saveLoading || loading}
                    >
                      {saveLoading ? "Saving..." : saveSuccess ? "Saved! 🚀" : "Save Render"}
                    </button>
                  </div>
                </div>
              )}

              {/* AI Insights Card */}
              <div className={styles.glassCard} style={{ opacity: loading ? 0.5 : 1 }}>
                <h2 className={styles.cardTitle}>
                  <span className={styles.cardTitleIcon}>💡</span> AI Insights
                </h2>
                {apodData.caption && <p className={styles.insightText}>"{apodData.caption}"</p>}
                {apodData.funFact && (
                  <div className={styles.factBox}>
                    <div className={styles.factHeader}>Scientific Fun Fact</div>
                    <p className={styles.factText}>{apodData.funFact}</p>
                  </div>
                )}
              </div>
            </>
          )}

          {!loading && !error && !apodData && (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>🔭</span>
              <p>Transmitter ready. Press button to start scan.</p>
            </div>
          )}
        </section>
      </main>

      {/* Fullscreen Zoom Overlay Modal */}
      {zoomed && apodData?.ascii && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalHeader}>
            <div className={styles.modalTitle}>
              🔍 Monospace Viewport — {apodData.source?.title || "Cosmic Art"}
            </div>
            <button className={styles.modalCloseBtn} onClick={handleZoom}>
              ✕
            </button>
          </div>
          <div className={styles.modalContent}>
            <pre className={styles.modalPre}>{apodData.ascii}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
