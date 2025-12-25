import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { User } from "@supabase/supabase-js";

type YoutubeRow = {
  id: string;
  user_id: string;
  youtube_id: string;
  title: string | null;
  created_at: string;
};

function extractYouTubeId(input: string): string | null {
  const s = input.trim();

  // raw ID (11 chars)
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;

  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\./, "");

    // youtu.be/<id>
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (host.endsWith("youtube.com")) {
      // /watch?v=<id>
      const v = u.searchParams.get("v");
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

      // /shorts/<id> or /embed/<id>
      const parts = u.pathname.split("/").filter(Boolean);
      const idx = parts.findIndex((p) => p === "shorts" || p === "embed");
      if (idx !== -1) {
        const id = parts[idx + 1];
        return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
      }
    }
  } catch {
    // ignore invalid URLs
  }

  return null;
}

function ytThumb(id: string) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

export default function Admin() {
  const nav = useNavigate();
  const location = useLocation();

  const from =
    (location.state as any)?.from &&
    typeof (location.state as any).from === "string"
      ? (location.state as any).from
      : "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [msg, setMsg] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);

  // --- Video manager state (Admin-only UI) ---
  const [videos, setVideos] = useState<YoutubeRow[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [ytInput, setYtInput] = useState("");
  const [ytTitle, setYtTitle] = useState("");

  useEffect(() => {
    let alive = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      setUser(data.user ?? null);
      setChecking(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      setUser(session?.user ?? null);
      setChecking(false);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function login(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    setBusy(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg("Logged in!");
    nav(from, { replace: true });
  }

  async function logout() {
    setBusy(true);
    await supabase.auth.signOut();
    setBusy(false);
    setMsg("Logged out.");
    setUser(null);
  }

  async function refreshVideos() {
    setVideosLoading(true);
    try {
      const { data, error } = await supabase
        .from("youtube_videos")
        .select("id,user_id,youtube_id,title,created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setVideos((data ?? []) as YoutubeRow[]);
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to load videos.");
      setVideos([]);
    } finally {
      setVideosLoading(false);
    }
  }

  useEffect(() => {
    if (user) refreshVideos();
    else setVideos([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const videoCount = useMemo(() => videos.length, [videos]);

  async function addVideo() {
    setMsg(null);

    if (!user) {
      setMsg("You must be logged in to add videos.");
      return;
    }

    const youtubeId = extractYouTubeId(ytInput);
    if (!youtubeId) {
      setMsg("Paste a valid YouTube URL (or 11-char video ID).");
      return;
    }

    try {
      const { error } = await supabase.from("youtube_videos").insert({
        user_id: user.id, // ✅ ensures RLS check passes even if DB default isn’t set
        youtube_id: youtubeId,
        title: ytTitle.trim() ? ytTitle.trim() : null,
      });

      if (error) throw error;

      setYtInput("");
      setYtTitle("");
      setMsg("Video added ✅");
      await refreshVideos();
    } catch (e: any) {
      const text = String(e?.message ?? "");
      const friendly =
        text.toLowerCase().includes("duplicate") ||
        text.toLowerCase().includes("unique")
          ? "That video is already in the gallery."
          : text || "Failed to add video.";
      setMsg(friendly);
    }
  }

  async function removeVideo(row: YoutubeRow) {
    setMsg(null);

    try {
      const { error } = await supabase
        .from("youtube_videos")
        .delete()
        .eq("id", row.id);
      if (error) throw error;

      setMsg("Video removed ✅");
      await refreshVideos();
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to remove video.");
    }
  }

  if (checking) {
    return (
      <section className="stack">
        <h1>Admin</h1>
        <div className="card">Checking session…</div>
      </section>
    );
  }

  return (
    <section className="stack">
      <h1>admin</h1>

      {user ? (
        <>
          <div
            className="card stack"
            style={{ maxWidth: 900, margin: "0 auto", width: "100%" }}
          >
            <div className="muted" style={{ textAlign: "center" }}>
              You’re logged in as:
            </div>
            <div style={{ fontWeight: 800, textAlign: "center" }}>
              {user.email}
            </div>

            <div className="row" style={{ justifyContent: "center" }}>
              <button
                className="btn"
                type="button"
                onClick={() => nav("/write")}
              >
                Go to Write
              </button>
              <button
                className="btn ghost"
                type="button"
                onClick={logout}
                disabled={busy}
              >
                {busy ? "Signing out…" : "Log out"}
              </button>
            </div>

            {msg && (
              <div
                className={msg.toLowerCase().includes("✅") ? "muted" : "error"}
                style={{ textAlign: "center", width: "100%" }}
              >
                {msg}
              </div>
            )}
          </div>

          {/* ✅ YouTube Manager (Admin-only) */}
          <div
            className="card stack"
            style={{ maxWidth: 900, margin: "0 auto", width: "100%" }}
          >
            <div className="sectionTitle">
              <h3 style={{ margin: 0 }}>YouTube Gallery Manager</h3>
              <span className="muted">{videoCount} videos</span>
            </div>

            <div className="row">
              <input
                className="sideInput"
                placeholder="Paste YouTube URL or 11-char ID…"
                value={ytInput}
                onChange={(e) => setYtInput(e.target.value)}
              />
              <button
                className="btn"
                type="button"
                onClick={addVideo}
                disabled={videosLoading}
              >
                Add
              </button>
              <button
                className="btn ghost"
                type="button"
                onClick={refreshVideos}
                disabled={videosLoading}
              >
                Refresh
              </button>
            </div>

            <div className="row">
              <input
                className="sideInput"
                placeholder="Optional title (shows in list)…"
                value={ytTitle}
                onChange={(e) => setYtTitle(e.target.value)}
              />
            </div>

            {videosLoading ? (
              <div className="muted">Loading videos…</div>
            ) : videos.length === 0 ? (
              <div className="muted">No videos yet. Add one above.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {videos.map((v) => (
                  <div
                    key={v.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "140px 1fr auto",
                      gap: 12,
                      alignItems: "center",
                      border: "1px solid var(--line)",
                      borderRadius: 14,
                      overflow: "hidden",
                      background: "rgba(255,255,255,.03)",
                    }}
                  >
                    <img
                      src={ytThumb(v.youtube_id)}
                      alt={v.title ?? v.youtube_id}
                      style={{
                        width: "140px",
                        height: "80px",
                        objectFit: "cover",
                        display: "block",
                      }}
                      loading="lazy"
                    />

                    <div style={{ padding: "10px 0" }}>
                      <div style={{ fontWeight: 800 }}>
                        {v.title ? v.title : v.youtube_id}
                      </div>
                      <div
                        className="muted"
                        style={{ fontSize: 12, marginTop: 4 }}
                      >
                        Added: {new Date(v.created_at).toLocaleString()}
                      </div>
                    </div>

                    <div style={{ paddingRight: 12 }}>
                      <button
                        className="btn ghost"
                        type="button"
                        onClick={() => removeVideo(v)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <form
          className="card stack"
          style={{ maxWidth: 520, margin: "0 auto" }}
          onSubmit={login}
        >
          <label className="field">
            <span>Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@email.com"
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </label>

          <div className="row">
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Logging in…" : "Log in"}
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={() => nav("/")}
            >
              Cancel
            </button>
          </div>

          {msg && <div className="error">{msg}</div>}
        </form>
      )}
    </section>
  );
}
