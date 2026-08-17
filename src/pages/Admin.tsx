import { useEffect, useMemo, useState, type DragEvent, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { loadPosts, type PostRow } from "../lib/posts";
import type { User } from "@supabase/supabase-js";
import MusicManager from "../components/MusicManager";
import ProfileManager from "../components/ProfileManager";
import CommentsManager from "../components/CommentsManager";
import FollowersManager from "../components/FollowersManager";

type YoutubeRow = {
  id: string;
  user_id: string;
  youtube_id: string;
  title: string | null;
  sort_order: number | null;
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
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [editYtInput, setEditYtInput] = useState("");
  const [editYtTitle, setEditYtTitle] = useState("");
  const [draggedVideoId, setDraggedVideoId] = useState<string | null>(null);
  const [videoDropTargetId, setVideoDropTargetId] = useState<string | null>(null);
  const [videoOrderBusy, setVideoOrderBusy] = useState(false);

  // --- Post manager state (Admin-only UI) ---
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postQuery, setPostQuery] = useState("");

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
        .select("id,user_id,youtube_id,title,sort_order,created_at")
        .order("sort_order", { ascending: true, nullsFirst: false })
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

  async function refreshPosts() {
    setPostsLoading(true);
    try {
      const rows = await loadPosts();
      setPosts(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to load posts.");
      setPosts([]);
    } finally {
      setPostsLoading(false);
    }
  }

  useEffect(() => {
    if (user) {
      refreshVideos();
      refreshPosts();
    } else {
      setVideos([]);
      setPosts([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const videoCount = useMemo(() => videos.length, [videos]);
  const postCount = useMemo(() => posts.length, [posts]);

  const filteredPosts = useMemo(() => {
    const q = postQuery.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((p: any) => {
      const t = String(p?.title ?? "").toLowerCase();
      const ex = String(p?.excerpt ?? "").toLowerCase();
      return t.includes(q) || ex.includes(q);
    });
  }, [posts, postQuery]);

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
        sort_order: Math.max(-1, ...videos.map((video) => video.sort_order ?? -1)) + 1,
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

  function beginVideoEdit(row: YoutubeRow) {
    setEditingVideoId(row.id);
    setEditYtInput(`https://www.youtube.com/watch?v=${row.youtube_id}`);
    setEditYtTitle(row.title ?? "");
    setMsg(null);
  }

  function cancelVideoEdit() {
    setEditingVideoId(null);
    setEditYtInput("");
    setEditYtTitle("");
  }

  async function saveVideoEdit(row: YoutubeRow) {
    if (!user) return setMsg("You must be logged in to edit videos.");
    const youtubeId = extractYouTubeId(editYtInput);
    if (!youtubeId) return setMsg("Paste a valid YouTube URL (or 11-character video ID).");

    setVideosLoading(true);
    setMsg(null);
    try {
      const { error } = await supabase
        .from("youtube_videos")
        .update({ youtube_id: youtubeId, title: editYtTitle.trim() || null })
        .eq("id", row.id)
        .eq("user_id", user.id);
      if (error) throw error;

      cancelVideoEdit();
      setMsg("Video updated ✅");
      await refreshVideos();
    } catch (error: unknown) {
      const text = error instanceof Error ? error.message : "Failed to update video.";
      setMsg(text.toLowerCase().includes("duplicate") || text.toLowerCase().includes("unique")
        ? "That video is already in the gallery."
        : text);
      setVideosLoading(false);
    }
  }

  async function persistVideoOrder(nextVideos: YoutubeRow[]) {
    if (!user) return setMsg("You must be logged in to reorder videos.");
    setVideos(nextVideos);
    setVideoOrderBusy(true);
    setMsg(null);
    try {
      const results = await Promise.all(nextVideos.map((video, index) => supabase
        .from("youtube_videos")
        .update({ sort_order: index })
        .eq("id", video.id)
        .eq("user_id", user.id)
        .select("id")
        .single()));
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
      setMsg("Video order saved ✅");
    } catch (error: unknown) {
      setMsg(error instanceof Error ? error.message : "Failed to save video order.");
      await refreshVideos();
    } finally {
      setVideoOrderBusy(false);
    }
  }

  function moveVideo(videoId: string, direction: -1 | 1) {
    if (videoOrderBusy) return;
    const fromIndex = videos.findIndex((video) => video.id === videoId);
    const toIndex = fromIndex + direction;
    if (fromIndex < 0 || toIndex < 0 || toIndex >= videos.length) return;
    const nextVideos = [...videos];
    const [movedVideo] = nextVideos.splice(fromIndex, 1);
    nextVideos.splice(toIndex, 0, movedVideo);
    void persistVideoOrder(nextVideos);
  }

  function startVideoDrag(event: DragEvent<HTMLDivElement>, videoId: string) {
    if (videoOrderBusy || editingVideoId === videoId) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", videoId);
    setDraggedVideoId(videoId);
  }

  function dropVideo(event: DragEvent<HTMLDivElement>, targetId: string) {
    event.preventDefault();
    const sourceId = draggedVideoId || event.dataTransfer.getData("text/plain");
    setDraggedVideoId(null);
    setVideoDropTargetId(null);
    if (!sourceId || sourceId === targetId || videoOrderBusy) return;
    const fromIndex = videos.findIndex((video) => video.id === sourceId);
    const targetIndex = videos.findIndex((video) => video.id === targetId);
    if (fromIndex < 0 || targetIndex < 0) return;
    const nextVideos = [...videos];
    const [movedVideo] = nextVideos.splice(fromIndex, 1);
    nextVideos.splice(targetIndex, 0, movedVideo);
    void persistVideoOrder(nextVideos);
  }

  if (checking) {
    return (
      <section className="stack adminPage" style={{ maxWidth: 1100, margin: "0 auto", padding: "0 14px" }}>
        <h1>Admin</h1>
        <div className="card">Checking session…</div>
      </section>
    );
  }

  return (
    <section className="stack adminPage" style={{ maxWidth: 1100, margin: "0 auto", padding: "0 14px" }}>
      <h1>admin</h1>

      {user ? (
        <>
          <div className="card stack" style={{ maxWidth: 900, margin: "0 auto", width: "100%" }}>
            <div style={{ textAlign: "center", opacity: 0.9 }}>You’re logged in as:</div>
            <div style={{ fontWeight: 800, textAlign: "center" }}>{user.email}</div>

            <div className="row" style={{ justifyContent: "center" }}>
              <button className="btn actionWhite" type="button" onClick={() => nav("/write")}>
                New Post
              </button>
              <button className="btn ghost actionWhite" type="button" onClick={logout} disabled={busy}>
                {busy ? "Signing out…" : "Log out"}
              </button>
            </div>

            {msg && (
              <div style={{ textAlign: "center", width: "100%", color: msg.toLowerCase().includes("✅") ? "inherit" : "tomato" }}>
                {msg}
              </div>
            )}
          </div>
          <ProfileManager />

          {/* Posts manager */}
          <div className="card stack postsManager" style={{ maxWidth: 900, margin: "0 auto", width: "100%" }}>
            <div className="sectionTitle">
              <h3 style={{ margin: 0 }}>Posts</h3>
              <span style={{ opacity: 0.85 }}>{postCount} total</span>
            </div>

            <div className="row" style={{ flexWrap: "wrap" }}>
              <input
                className="sideInput"
                placeholder="Search posts…"
                value={postQuery}
                onChange={(e) => setPostQuery(e.target.value)}
                style={{ flex: 1, minWidth: 220 }}
              />
              <button className="btn ghost actionWhite" type="button" onClick={refreshPosts} disabled={postsLoading}>
                {postsLoading ? "Refreshing…" : "Refresh"}
              </button>
            </div>

            {postsLoading ? (
              <div style={{ opacity: 0.85 }}>Loading posts…</div>
            ) : filteredPosts.length === 0 ? (
              <div style={{ opacity: 0.85 }}>No posts match.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {filteredPosts.map((p: any) => {
                  const when = new Date(p.published_at ?? p.created_at).toLocaleString();
                  return (
                    <div
                      key={p.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1fr) auto",
                        gap: 12,
                        alignItems: "center",
                        border: "1px solid var(--line)",
                        borderRadius: 14,
                        padding: 12,
                        background: "rgba(255,255,255,.03)",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.title}
                        </div>
                        <div style={{ opacity: 0.85, fontSize: 12, marginTop: 4 }}>{when}</div>
                        {p.status && (
                          <div style={{ opacity: 0.85, fontSize: 12, marginTop: 4 }}>status: {p.status}</div>
                        )}
                      </div>

                      <div className="row" style={{ justifyContent: "flex-end" }}>
                        <Link className="btn ghost actionWhite" to={`/post/${p.id}`}>
                          View
                        </Link>
                        <Link className="btn actionWhite" to={`/edit/${p.id}`}>
                          Edit
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* YouTube manager */}
          <div className="card stack youtubeManager" style={{ maxWidth: 900, margin: "0 auto", width: "100%" }}>
            <div className="sectionTitle">
              <h3 style={{ margin: 0 }}>YouTube Gallery Manager</h3>
              <span style={{ opacity: 0.85 }}>{videoCount} videos</span>
            </div>

            <div className="row" style={{ flexWrap: "wrap" }}>
              <input
                className="sideInput"
                placeholder="Paste YouTube URL or 11-char ID…"
                value={ytInput}
                onChange={(e) => setYtInput(e.target.value)}
                style={{ minWidth: 220, flex: 1 }}
              />
              <button className="btn actionWhite" type="button" onClick={addVideo} disabled={videosLoading}>
                Add
              </button>
              <button className="btn ghost actionWhite" type="button" onClick={refreshVideos} disabled={videosLoading}>
                Refresh
              </button>
            </div>

            <div className="row" style={{ flexWrap: "wrap" }}>
              <input
                className="sideInput"
                placeholder="Optional title (shows in list)…"
                value={ytTitle}
                onChange={(e) => setYtTitle(e.target.value)}
                style={{ minWidth: 220, flex: 1 }}
              />
            </div>

            {videosLoading ? (
              <div style={{ opacity: 0.85 }}>Loading videos…</div>
            ) : videos.length === 0 ? (
              <div style={{ opacity: 0.85 }}>No videos yet. Add one above.</div>
            ) : (
              <div className="youtubeAdminList" style={{ display: "grid", gap: 10 }}>
                <p className="adminOrderHint">Drag video tiles into a new order, or use the arrow buttons on touch screens. Changes save automatically.</p>
                {videos.map((v, index) => {
                  const isEditing = editingVideoId === v.id;
                  return (
                  <div
                    key={v.id}
                    className={`youtubeAdminCard ${draggedVideoId === v.id ? "dragging" : ""} ${videoDropTargetId === v.id ? "dropTarget" : ""}`}
                    draggable={!videoOrderBusy && !isEditing}
                    onDragStart={(event) => startVideoDrag(event, v.id)}
                    onDragEnd={() => { setDraggedVideoId(null); setVideoDropTargetId(null); }}
                    onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setVideoDropTargetId(v.id); }}
                    onDrop={(event) => dropVideo(event, v.id)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "140px minmax(0, 1fr) auto",
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

                    <div className="youtubeAdminDetails" style={{ padding: "10px 0", minWidth: 0 }}>
                      <div className="youtubeOrderControls">
                        <span className="youtubeDragCue" aria-hidden="true">⠿ Drag to reorder</span>
                        <span>
                          <button type="button" disabled={videoOrderBusy || index === 0} onClick={() => moveVideo(v.id, -1)} aria-label={`Move ${v.title || "video"} up`}>↑</button>
                          <button type="button" disabled={videoOrderBusy || index === videos.length - 1} onClick={() => moveVideo(v.id, 1)} aria-label={`Move ${v.title || "video"} down`}>↓</button>
                        </span>
                      </div>
                      {isEditing ? (
                        <div className="youtubeEditFields">
                          <input className="sideInput" value={editYtInput} onChange={(event) => setEditYtInput(event.target.value)} placeholder="YouTube URL or video ID" />
                          <input className="sideInput" value={editYtTitle} onChange={(event) => setEditYtTitle(event.target.value)} placeholder="Video title (optional)" />
                        </div>
                      ) : (
                        <>
                          <div style={{ fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {v.title ? v.title : v.youtube_id}
                          </div>
                          <div style={{ opacity: 0.85, fontSize: 12, marginTop: 4 }}>
                            Added: {new Date(v.created_at).toLocaleString()}
                          </div>
                        </>
                      )}
                    </div>

                    <div className="youtubeCardActions">
                      {isEditing ? (
                        <>
                          <button className="btn actionWhite youtubeCardAction" type="button" onClick={() => saveVideoEdit(v)}>Save</button>
                          <button className="btn ghost actionWhite youtubeCardAction" type="button" onClick={cancelVideoEdit}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button className="btn ghost actionWhite youtubeCardAction" type="button" onClick={() => beginVideoEdit(v)}>Edit</button>
                          <button className="btn ghost actionWhite youtubeCardAction" type="button" onClick={() => removeVideo(v)}>Remove</button>
                        </>
                      )}
                      </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
          <FollowersManager />
          <MusicManager />
          <CommentsManager />
        </>
      ) : (
        <form className="card stack" style={{ maxWidth: 520, margin: "0 auto", width: "100%" }} onSubmit={login}>
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

          <div className="row" style={{ flexWrap: "wrap" }}>
            <button className="btn actionWhite" type="submit" disabled={busy}>
              {busy ? "Logging in…" : "Log in"}
            </button>
            <button className="btn ghost actionWhite" type="button" onClick={() => nav("/")}>
              Cancel
            </button>
          </div>

          {msg && <div style={{ color: "tomato" }}>{msg}</div>}
        </form>
      )}
    </section>
  );
}
