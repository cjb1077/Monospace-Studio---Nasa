"use client";

import React, { useState, useEffect } from "react";
import styles from "./page.module.css";
import { getSupabaseClient } from "@/lib/supabase/client";

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

export default function Gallery() {
  const [renders, setRenders] = useState<Render[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Auth states
  const [session, setSession] = useState<any>(null);
  const [showAuthDropdown, setShowAuthDropdown] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Stateful toast notifications
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "mine" | "public">("all");

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
      // Reset filter if filtering on 'mine' and logging out
      if (filterTab === "mine") {
        setFilterTab("all");
      }
    } catch (err) {
      console.error("Sign out error:", err);
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
          <span className={styles.terminalIcon}>&gt;_</span> Monospace Studio
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
                          className={styles.searchInput}
                          style={{ padding: "0.5rem 0.75rem", fontSize: "0.9rem" }}
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
                <div key={render.id} className={styles.glassCard}>
                  <div className={styles.cardHeader}>
                    <h2 className={styles.cardTitle} title={render.title}>
                      {render.title}
                    </h2>
                    <div className={styles.cardMeta}>
                      <span>📅 Resolved: {render.sourceDate}</span>
                    </div>
                  </div>

                  {/* ASCII viewport preview */}
                  <div className={styles.previewContainer}>
                    <pre className={styles.preArt}>{render.ascii}</pre>
                  </div>

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
                        onClick={() => handleDelete(render.id)}
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
    </div>
  );
}
