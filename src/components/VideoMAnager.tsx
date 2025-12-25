import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type YoutubeRow = {
  id: string;
  youtube_id: string;
  title: string | null;
  created_at: string;
};

function extractYouTubeId(input: string): string | null {
  const s = input.trim();

  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;

  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (host.endsWith("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

      const parts = u.pathname.split("/").filter(Boolean);
      const idx = parts.findIndex((p) => p === "shorts" || p === "embed");
      if (idx !== -1) {
        const id = parts[idx + 1];
        return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
      }
    }
  } catch {
    // ignore
  }

  return null;
}

function ytThumb(id: string) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

export default function VideoManager() {
  const [authed, setAuthed] = useState(false);

  const [videos, setVideos] = useState<YoutubeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [input, setInput] = useState("");
  const [title, setTitle] = useState("");

  // watch auth
  useEffect(() => {
    let alive = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      setAuthed(!!data.session);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setAuthed(!!session);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function refresh() {
    setMsg(null);
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("youtube_videos")
        .select("id,youtube_id,title,created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setVideos((data ?? []) as YoutubeRow[]);
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to load videos.");
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const count = useMemo(() => videos.length, [videos]);

  async function addVideo() {
    setMsg(null);

    const youtubeId = extractYouTubeId(input);
    if (!youtubeId) {
      setMsg("Paste a valid YouTube URL (or 11-char ID).");
      return;
    }

    try {
      const { error } = await supabase.from("youtube_videos").insert({
        youtube_id: youtubeId,
        title: title.trim() ? title.trim() : null,
      });

      if (error) throw error;

      setInput("");
      setTitle("");
      setMsg("Added ✅");
      await refresh();
    } catch (e: any) {
      const m = String(e?.message ?? "")
        .toLowerCase()
        .includes("duplicate")
        ? "That video is already in the gallery."
        : e?.message ?? "Failed to add video.";
      setMsg(m);
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
      setMsg("Removed ✅");
      await refresh();
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to remove video.");
    }
  }

  return (
    <div className="card stack" style={{ marginTop: 14 }}>
      <div className="sectionTitle">
        <h3 style={{ margin: 0 }}>YouTube Gallery Manager</h3>
        <span className="muted">{count} videos</span>
      </div>

      {!authed ? (
        <div className="muted">You must be logged in to add/remove videos.</div>
      ) : (
        <>
          <div className="row" style={{ marginTop: 10 }}>
            <input
              className="sideInput"
              placeholder="Paste YouTube URL or 11-char ID…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button className="btn" type="button" onClick={addVideo}>
              Add
            </button>
          </div>

          <div className="row">
            <input
              className="sideInput"
              placeholder="Optional title/label (shows only in admin list)…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
        </>
      )}

      {msg && <div className="muted">{msg}</div>}

      {loading ? (
        <div className="muted">Loading…</div>
      ) : (
        <div className="thumbGrid">
          {videos.map((v) => (
            <div key={v.id} className="thumb" style={{ position: "relative" }}>
              <img src={ytThumb(v.youtube_id)} alt={v.title ?? v.youtube_id} />
              <div style={{ padding: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>
                  {v.title ?? v.youtube_id}
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  {new Date(v.created_at).toLocaleString()}
                </div>
              </div>

              {authed && (
                <button
                  className="xBtn"
                  type="button"
                  onClick={() => removeVideo(v)}
                  aria-label="Remove video"
                  title="Remove"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="row">
        <button className="btn ghost" type="button" onClick={refresh}>
          Refresh
        </button>
      </div>
    </div>
  );
}
