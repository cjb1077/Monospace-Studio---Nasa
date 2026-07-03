"use client";

import React, { useState, useEffect, useRef } from "react";
import styles from "./page.module.css";
import { getSupabaseClient } from "@/lib/supabase/client";
import { doubleAsciiWidth } from "@/lib/ascii/convert";

interface Render {
  id: string;
  userId: string;
  title: string;
  ascii: string;
  caption: string;
  funFact: string;
  sourceDate: string;
  isPublic: boolean;
  createdAt: string;
}

/** Scales an ASCII art <pre> to fit its container width without scrollbars. */
function ScaledPreview({ ascii }: { ascii: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const [scale, setScale] = useState(1);
  const [containerHeight, setContainerHeight] = useState<string>("auto");

  useEffect(() => {
    const measure = () => {
      const container = containerRef.current;
      const pre = preRef.current;
      if (!container || !pre) return;

      // Compute usable inner width (clientWidth excludes border but includes padding)
      const cs = window.getComputedStyle(container);
      const paddingH = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const paddingV = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const usableW = container.clientWidth - paddingH;

      // Temporarily force scale(1) so scrollWidth reflects natural content width
      pre.style.transform = "scale(1)";
      pre.style.transformOrigin = "top left";
      const naturalW = pre.scrollWidth;
      const naturalH = pre.scrollHeight;

      const s = naturalW > usableW ? usableW / naturalW : 1;

      setScale(s);
      // Tell the container exactly how tall to be so the scaled content fits perfectly
      setContainerHeight(`${Math.ceil(naturalH * s) + paddingV}px`);
    };

    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [ascii]);

  return (
    <div
      ref={containerRef}
      className={styles.previewContainer}
      style={{ height: containerHeight, overflow: "hidden" }}
    >
      <pre
        ref={preRef}
        className={styles.preArt}
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          display: "block",
        }}
      >
        {ascii}
      </pre>
    </div>
  );
}

export default function Gallery() {
  const [renders, setRenders] = useState<Render[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Auth states
  const [session, setSession] = useState<any>(null);
  const [showAuthDropdown, setShowAuthDropdown] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Stateful toast notifications
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "mine" | "public">("all");

  // Modal Details states
  const [selectedRender, setSelectedRender] = useState<Render | null>(null);
  const [modalZoomLevel, setModalZoomLevel] = useState(1.0);
  const [modalFullscreen, setModalFullscreen] = useState(false);

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

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

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

  const fetchRenders = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/renders");
      const data = await response.json();
      if (response.ok && data.ok) {
        setRenders(data.renders);
      } else {
        setError(data.error || "Failed to load space gallery.");
      }
    } catch (err) {
      console.error(err);
      setError("Connection failure while querying space gallery.");
    } finally {
      setLoading(false);
    }
  };

  // Mount logic: fetch renders + set browser tab title dynamically
  useEffect(() => {
    document.title = "Monospace Studio — Gallery";
    fetchRenders();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to scrub this render from the space archive?")) return;
    try {
      const response = await fetch(`/api/renders/${id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (response.ok && data.ok) {
        setRenders(renders.filter((r) => r.id !== id));
        setToast({ message: "Render successfully scrubbed from space archive.", type: "success" });
      } else {
        setToast({ message: data.error || "Failed to delete render.", type: "error" });
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Connection failure while deleting render.", type: "error" });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) return;
    setLoginLoading(true);
    setAuthError(null);
    try {
      const supabase = getSupabaseClient();
      if (authMode === "signin") {
        const { error: authErr } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password: loginPassword,
        });
        if (authErr) {
          setAuthError(authErr.message);
        } else {
          setShowAuthDropdown(false);
          setLoginPassword("");
        }
      } else {
        const { data, error: authErr } = await supabase.auth.signUp({
          email: loginEmail,
          password: loginPassword,
          options: {
            emailRedirectTo: window.location.origin + "/api/auth/callback",
          },
        });
        if (authErr) {
          setAuthError(authErr.message);
        } else {
          if (data?.session) {
            setShowAuthDropdown(false);
            setLoginPassword("");
          } else {
            setLoginSuccess(true);
          }
        }
      }
    } catch (err) {
      console.error(err);
      setAuthError("Failed to authenticate.");
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
      // Reset filter if filtering on 'mine' and logging out
      if (filterTab === "mine") {
        setFilterTab("all");
      }
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

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
        .replace(/^_+|_+$/g, "");
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

  // Filtered renders logic
  const filteredRenders = renders.filter((render) => {
    // Search query matches title
    const matchesSearch = render.title.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Tab filtering
    let matchesTab = true;
    if (filterTab === "mine") {
      matchesTab = session ? render.userId === session.user.id : false;
    } else if (filterTab === "public") {
      matchesTab = render.isPublic;
    }

    return matchesSearch && matchesTab;
  });

  return (
    <div className={styles.container}>
      {/* Header / Navbar */}
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.terminalIcon}>🪐</span> Monospace Studio
        </div>
        <nav className={styles.nav}>
          <a href="/" className={styles.navLink}>
            🔭 Studio
          </a>
          <a href="/gallery" className={`${styles.navLink} ${styles.navLinkActive}`}>
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
                  setLoginPassword("");
                  setAuthMode("signin");
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
                    {authMode === "signin" ? "🚀 Teleport In" : "🧑‍🚀 Register Account"}
                  </h3>
                  {loginSuccess ? (
                    <div style={{ color: "#34d399", fontSize: "0.875rem", lineHeight: "1.4" }}>
                      📡 Verification link sent! Please check your email inbox to complete registration.
                    </div>
                  ) : (
                    <form onSubmit={handleLogin}>
                      <div className={styles.formGroup} style={{ marginBottom: "0.75rem" }}>
                        <input
                          type="email"
                          placeholder="astronaut@nasa.gov"
                          className={styles.searchInput}
                          style={{ padding: "0.5rem 0.75rem", fontSize: "0.9rem" }}
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          required
                        />
                      </div>
                      <div className={styles.formGroup} style={{ marginBottom: "0.75rem" }}>
                        <input
                          type="password"
                          placeholder="Password"
                          className={styles.searchInput}
                          style={{ padding: "0.5rem 0.75rem", fontSize: "0.9rem" }}
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
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
                        style={{
                          background: "linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)",
                          color: "#000",
                          border: "none",
                          borderRadius: "8px",
                          width: "100%",
                          padding: "0.5rem",
                          fontWeight: "600",
                          cursor: "pointer"
                        }}
                        disabled={loginLoading}
                      >
                        {loginLoading
                          ? (authMode === "signin" ? "Signing In..." : "Registering...")
                          : (authMode === "signin" ? "Sign In" : "Register")}
                      </button>
                      <div style={{ marginTop: "0.75rem", textAlign: "center", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                        {authMode === "signin" ? (
                          <>
                            New astronaut?
                            <button
                              type="button"
                              className={styles.toggleLink}
                              onClick={() => {
                                setAuthMode("signup");
                                setAuthError(null);
                              }}
                            >
                              Sign Up
                            </button>
                          </>
                        ) : (
                          <>
                            Have credentials?
                            <button
                              type="button"
                              className={styles.toggleLink}
                              onClick={() => {
                                setAuthMode("signin");
                                setAuthError(null);
                              }}
                            >
                              Sign In
                            </button>
                          </>
                        )}
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}
        </nav>
      </header>

      {/* Main Content */}
      <main className={styles.main}>
        <div>
          <h1 className={styles.galleryTitle}>Cosmic Render Gallery</h1>
          <p className={styles.gallerySubtitle}>Explore and manage saved monospace ASCII interpretations of space.</p>
        </div>

        {/* Filter Row */}
        <section className={styles.filterRow}>
          {/* Tabs */}
          <div className={styles.tabs}>
            <button
              onClick={() => setFilterTab("all")}
              className={`${styles.tabBtn} ${filterTab === "all" ? styles.tabBtnActive : ""}`}
            >
              All Renders
            </button>
            {session && (
              <button
                onClick={() => setFilterTab("mine")}
                className={`${styles.tabBtn} ${filterTab === "mine" ? styles.tabBtnActive : ""}`}
              >
                My Renders
              </button>
            )}
            <button
              onClick={() => setFilterTab("public")}
              className={`${styles.tabBtn} ${filterTab === "public" ? styles.tabBtnActive : ""}`}
            >
              Public Feed
            </button>
          </div>

          {/* Search bar */}
          <div className={styles.searchGroup}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder="Search renders by title..."
              className={styles.searchInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </section>

        {/* Output list/grid states */}
        {loading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.spinner}></div>
            <p>Decrypting cosmic archives...</p>
          </div>
        ) : error ? (
          <div className={styles.errorCard}>
            <h3>⚠️ Archive Read Error</h3>
            <p>{error}</p>
          </div>
        ) : filteredRenders.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>🕳️</span>
            <h3>No Records Discovered</h3>
            <p>
              {searchQuery
                ? "No items match your search parameter."
                : filterTab === "mine"
                ? "You haven't saved any cosmic renders yet."
                : "The cosmic database feed is empty."}
            </p>
          </div>
        ) : (
          <section className={styles.grid}>
            {filteredRenders.map((render) => {
              const isOwner = session && render.userId === session.user.id;

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
                  <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle} title={render.title}>
                      {render.title}
                    </h2>
                    <div className={styles.cardMeta}>
                      <span>📅 Resolved: {render.sourceDate}</span>
                    </div>
                  </div>

                  {/* ASCII viewport preview */}
                  <ScaledPreview ascii={render.ascii} />

                  {/* Caption */}
                  {render.caption && <p className={styles.captionText}>"{render.caption}"</p>}

                  {/* Scientific fact */}
                  {render.funFact && (
                    <div className={styles.factBox}>
                      <div className={styles.factHeader}>Scientific Fact</div>
                      <p className={styles.factText}>{render.funFact}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className={styles.controlRow}>
                    <span
                      className={`${styles.badge} ${
                        render.isPublic ? styles.badgePublic : styles.badgePrivate
                      }`}
                    >
                      {render.isPublic ? "Public Feed" : "Private Archive"}
                    </span>

                    {isOwner && (
                      <button
                        className={styles.deleteBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(render.id);
                        }}
                      >
                        Scrub Log
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </main>

      {/* Glassmorphic Toasts */}
      {toast && (
        <div className={styles.toastContainer}>
          <div className={`${styles.toast} ${toast.type === "success" ? styles.toastSuccess : styles.toastError}`}>
            <span className={toast.type === "success" ? styles.toastIconSuccess : styles.toastIconError}>
              {toast.type === "success" ? "🛸" : "⚠️"}
            </span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Details Popup Modal */}
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
    </div>
  );
}
