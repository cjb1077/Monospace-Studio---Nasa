"use client";

import React, { useState, useEffect, useRef } from "react";
import styles from "./page.module.css";

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
  const todayEst = getTodayEst();
  const [inputDate, setInputDate] = useState(todayEst);
  const [activeDate, setActiveDate] = useState(todayEst);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apodData, setApodData] = useState<ApodApiResponse | null>(null);
  
  // Style overrides state
  const [styleOverride, setStyleOverride] = useState<AsciiStyle | null>(null);
  
  const [copied, setCopied] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [viewportHover, setViewportHover] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchApodData = async (targetDate: string, overrides: AsciiStyle | null) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setError(null);

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
    fetchApodData(activeDate, null);
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
          <a href="#" className={styles.navLink}>
            🌌 Gallery
          </a>
          <button className={styles.authBtn}>Sign In</button>
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
                <input
                  id="date-picker"
                  type="date"
                  className={styles.dateInput}
                  min="1995-06-16"
                  max={todayEst}
                  value={inputDate}
                  onChange={(e) => setInputDate(e.target.value)}
                />
              </div>
              <button type="submit" className={styles.btn} disabled={loading}>
                {loading ? "Transmitting..." : "Generate Cosmic Art"}
              </button>
            </form>
          </div>

          {/* APOD Metadata Display */}
          {apodData?.source && !error && (
            <div className={styles.glassCard}>
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
          {styleOverride && !error && (
            <div className={styles.glassCard}>
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
                  />
                  <span className={styles.label}>Invert Luminance Ramp</span>
                </label>
              </div>
            </div>
          )}
        </section>

        {/* Right Column: ASCII Art Viewport + AI Insights */}
        <section className={styles.rightCol}>
          {/* Main Output State Render */}
          {loading && (
            <div className={styles.loadingContainer}>
              <div className={styles.spinner}></div>
              <p>Acquiring NASA APOD and generating matrix configurations...</p>
            </div>
          )}

          {error && !loading && (
            <div className={styles.errorCard}>
              <div className={styles.errorHeader}>
                <span>⚠️</span> Transmission Failure
              </div>
              <p className={styles.errorDesc}>{error}</p>
            </div>
          )}

          {!loading && !error && apodData?.ascii && (
            <>
              {/* ASCII Output Card */}
              <div
                className={`${styles.viewportContainer} ${
                  viewportHover ? styles.viewportContainerHover : ""
                }`}
                onMouseEnter={() => setViewportHover(true)}
                onMouseLeave={() => setViewportHover(false)}
              >
                {/* Floating control buttons */}
                <div className={styles.floatingControls}>
                  <button
                    className={styles.floatingBtn}
                    onClick={handleCopy}
                    title="Copy Raw ASCII to Clipboard"
                  >
                    {copied ? "✅" : "📋"}
                  </button>
                  <button
                    className={styles.floatingBtn}
                    onClick={handleZoom}
                    title="Fullscreen Zoom"
                  >
                    🔍
                  </button>
                </div>
                <pre className={styles.preArt}>{apodData.ascii}</pre>
              </div>

              {/* System Telemetry Section */}
              <div className={styles.telemetryGrid}>
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

              {/* AI Insights Card */}
              <div className={styles.glassCard}>
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
