import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { loadPosts, type PostRow } from "../lib/posts";
import { supabase } from "../lib/supabase";
import WeatherWidget from "../components/widgets/WeatherWidget";

type HomeVideo = {
  youtube_id: string;
  title: string | null;
};

function coverUrlFromPath(path: string | null) {
  if (!path) return null;
  return supabase.storage.from("loopblogimages").getPublicUrl(path).data
    .publicUrl;
}

function bodyPreview(p: any, n = 180) {
  const raw = (p?.excerpt ?? p?.body_md ?? p?.body ?? "") as string;
  const clean = raw.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean.length > n ? clean.slice(0, n) + "…" : clean;
}

function ytThumb(id: string) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}
function ytEmbed(id: string) {
  return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;
}

/* ===========================
   "Most Read" — localStorage
=========================== */
const VIEW_KEY = "loopblog:views";

function bumpView(id: string) {
  try {
    const raw = localStorage.getItem(VIEW_KEY);
    const data = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    data[id] = (data[id] ?? 0) + 1;
    localStorage.setItem(VIEW_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

function getViews(): Record<string, number> {
  try {
    const raw = localStorage.getItem(VIEW_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

/* ===========================
   Videos — gallery + lightbox
=========================== */
function VideoGallery({ videos }: { videos: HomeVideo[] }) {
  const ids = useMemo(() => videos.map((v) => v.youtube_id), [videos]);
  const [openId, setOpenId] = useState<string | null>(null);

  const index = useMemo(() => {
    if (!openId) return -1;
    return ids.indexOf(openId);
  }, [openId, ids]);

  useEffect(() => {
    if (!openId) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
      if (e.key === "ArrowLeft" && index > 0) setOpenId(ids[index - 1]);
      if (e.key === "ArrowRight" && index >= 0 && index < ids.length - 1) {
        setOpenId(ids[index + 1]);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openId, ids, index]);

  // Lock background scroll while lightbox is open (prevents “page scroll behind modal”)
  useEffect(() => {
    if (!openId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [openId]);

  // Inline “always works” lightbox styles (fixes the tiny inline iframe issue)
  const backdropStyle: CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 99999,
    background: "rgba(0,0,0,.72)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
  };

  const panelStyle: CSSProperties = {
    width: "min(980px, 96vw)",
    maxHeight: "90vh",
    background: "#0b0f14",
    borderRadius: 16,
    boxShadow: "0 18px 60px rgba(0,0,0,.65)",
    border: "1px solid rgba(255,255,255,.10)",
    padding: 16,
    position: "relative",
  };

  const closeStyle: CSSProperties = {
    position: "absolute",
    top: 10,
    right: 10,
    width: 38,
    height: 38,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,.14)",
    background: "rgba(0,0,0,.55)",
    color: "inherit",
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
    lineHeight: 1,
    fontSize: 18,
  };

  const frameStyle: CSSProperties = {
    position: "relative",
    width: "100%",
    paddingTop: "56.25%", // 16:9
    borderRadius: 12,
    overflow: "hidden",
    background: "#000",
  };

  const iframeStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    border: 0,
  };

  const hintStyle: CSSProperties = {
    display: "flex",
    gap: 12,
    justifyContent: "center",
    marginTop: 10,
    fontSize: 12,
  };

  if (!videos.length) return null;

  return (
    <section className="homeVideoSection" aria-label="Videos">
      <div className="homeVideoTop">
        <h2 className="homeVideoH2">Videos</h2>
        <div className="muted homeVideoSub"></div>
      </div>

      <div className="videoGrid">
        {videos.map((v) => (
          <button
            key={v.youtube_id}
            type="button"
            className="videoTile"
            onClick={() => setOpenId(v.youtube_id)}
            aria-label={`Open video${v.title ? `: ${v.title}` : ""}`}
          >
            <div className="videoThumb">
              <img
                src={ytThumb(v.youtube_id)}
                alt={v.title ?? "YouTube video"}
                loading="lazy"
              />
              <div className="videoPlay" aria-hidden="true">
                ▶
              </div>
            </div>
            <div className="videoMeta">
              <div className="videoTitle">{v.title ?? "Untitled"}</div>
              <div className="muted videoSub">Watch</div>
            </div>
          </button>
        ))}
      </div>

      {openId && (
        <div
          className="lbBackdrop"
          style={backdropStyle}
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpenId(null);
          }}
        >
          <div className="lbPanel" style={panelStyle} role="document">
            <button
              type="button"
              className="lbClose"
              style={closeStyle}
              onClick={() => setOpenId(null)}
              aria-label="Close"
            >
              ✕
            </button>

            <div className="lbFrame" style={frameStyle}>
              <iframe
                style={iframeStyle}
                src={ytEmbed(openId)}
                title="YouTube video"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>

            <div className="lbHint muted" style={hintStyle}>
              <span>Esc to close</span>
              <span>← / → to switch</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default function Home() {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [videos, setVideos] = useState<HomeVideo[]>([]);
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState<string | null>(null);

  // Search + sort
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"new" | "old">("new");

  // refresh Most Read after clicks/focus
  const [viewsTick, setViewsTick] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const rows = await loadPosts();
        setPosts(Array.isArray(rows) ? rows : []);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load posts");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setVideoLoading(true);
        setVideoError(null);

        const { data, error } = await supabase
          .from("youtube_videos")
          .select("youtube_id,title")
          .order("created_at", { ascending: false });

        if (error) throw error;

        const rows: HomeVideo[] = (data ?? [])
          .filter(
            (r: any) =>
              typeof r?.youtube_id === "string" && r.youtube_id.length > 0
          )
          .map((r: any) => ({
            youtube_id: r.youtube_id,
            title: r.title ?? null,
          }));

        setVideos(rows);
      } catch (e: any) {
        setVideoError(e?.message ?? "Failed to load videos");
      } finally {
        setVideoLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const onFocus = () => setViewsTick((x) => x + 1);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const bumpAndTick = (id: string) => {
    bumpView(id);
    setViewsTick((x) => x + 1);
  };

  const filteredPosts = useMemo(() => {
    const q = query.trim().toLowerCase();

    const sorted = [...posts].sort((a, b) => {
      const ad = new Date(a.published_at ?? a.created_at).getTime();
      const bd = new Date(b.published_at ?? b.created_at).getTime();
      const aTime = Number.isFinite(ad) ? ad : 0;
      const bTime = Number.isFinite(bd) ? bd : 0;
      return sort === "new" ? bTime - aTime : aTime - bTime;
    });

    if (!q) return sorted;

    return sorted.filter((p) => {
      const title = (p.title ?? "").toLowerCase();
      const preview = bodyPreview(p, 400).toLowerCase();
      return title.includes(q) || preview.includes(q);
    });
  }, [posts, query, sort]);

  const mostRead = useMemo(() => {
    const views = getViews();
    return [...posts]
      .sort((a, b) => (views[b.id] ?? 0) - (views[a.id] ?? 0))
      .slice(0, 8);
  }, [posts, viewsTick]);

  const slices = useMemo(() => {
    const hero = filteredPosts[0] ?? null;
    const leftRail = filteredPosts.slice(1, 5);
    const main = filteredPosts.slice(5, 11);
    const headlines = filteredPosts.slice(0, 8);
    return { hero, leftRail, main, headlines };
  }, [filteredPosts]);

  const noMatches =
    posts.length > 0 && filteredPosts.length === 0 && query.trim().length > 0;

  if (loading) return <div className="muted">Loading posts…</div>;
  if (error) return <div className="error">Error: {error}</div>;

  if (!posts.length) {
    return (
      <section className="newsShell">
        <h1 className="newsH1">Latest</h1>
        <p className="muted">No posts yet.</p>
      </section>
    );
  }

  const heroCover = slices.hero
    ? coverUrlFromPath(slices.hero.cover_path)
    : null;

  return (
    <section className="newsShell">
      <div className="newsTop">
        <div className="newsTopRow">
          <h1 className="newsH1">Latest</h1>

          <div className="homeControls" role="search">
            <input
              className="homeSearch"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search posts…"
              aria-label="Search posts"
            />

            <select
              className="homeSort"
              value={sort}
              onChange={(e) => setSort(e.target.value as "new" | "old")}
              aria-label="Sort posts"
            >
              <option value="new">Newest</option>
              <option value="old">Oldest</option>
            </select>

            {query.trim() && (
              <button
                type="button"
                className="homeClear"
                onClick={() => setQuery("")}
                aria-label="Clear search"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="newsSub muted"></div>
      </div>

      <div className="newsCols">
        <aside className="newsRail">
          {slices.leftRail.map((p) => {
            const img = coverUrlFromPath(p.cover_path);
            return (
              <Link
                key={p.id}
                to={`/post/${p.id}`}
                className="railCard"
                onClick={() => bumpAndTick(p.id)}
              >
                {img && (
                  <div className="railThumb">
                    <img src={img} alt={p.title} loading="lazy" />
                  </div>
                )}
                <div className="railBody">
                  <div className="railTitle">{p.title}</div>
                  <div className="railDeck muted">{bodyPreview(p, 110)}</div>
                  <div className="railMeta muted">
                    {new Date(p.published_at ?? p.created_at).toLocaleString()}
                  </div>
                </div>
              </Link>
            );
          })}
        </aside>

        <main className="newsMain">
          {slices.hero && (
            <Link
              to={`/post/${slices.hero.id}`}
              className="heroCard"
              onClick={() => bumpAndTick(slices.hero!.id)}
            >
              {heroCover && (
                <div className="heroMedia">
                  <img src={heroCover} alt={slices.hero.title} loading="lazy" />
                </div>
              )}
              <div className="heroContent">
                <div className="heroKicker">FEATURED</div>
                <div className="heroTitle">{slices.hero.title}</div>
                <div className="heroDeck muted">
                  {bodyPreview(slices.hero, 220)}
                </div>
                <div className="heroMeta">
                  <span className="chip">
                    {new Date(
                      slices.hero.published_at ?? slices.hero.created_at
                    ).toLocaleString()}
                  </span>
                </div>
              </div>
            </Link>
          )}

          {noMatches && (
            <div className="emptyState">
              <div className="emptyTitle">No posts match your search.</div>
              <div className="muted" style={{ marginTop: 6 }}>
                Try a different keyword, or clear the search.
              </div>
            </div>
          )}

          <div className="mainList">
            {slices.main.map((p) => {
              const img = coverUrlFromPath(p.cover_path);
              return (
                <Link
                  key={p.id}
                  to={`/post/${p.id}`}
                  className="mainItem"
                  onClick={() => bumpAndTick(p.id)}
                >
                  <div className="mainText">
                    <div className="mainTitle">{p.title}</div>
                    <div className="mainDeck muted">{bodyPreview(p, 160)}</div>
                    <div className="mainMeta muted">
                      {new Date(
                        p.published_at ?? p.created_at
                      ).toLocaleString()}
                    </div>
                  </div>

                  {img && (
                    <div className="mainThumb">
                      <img src={img} alt={p.title} loading="lazy" />
                    </div>
                  )}
                </Link>
              );
            })}
          </div>

          {videoLoading ? (
            <div className="muted">Loading videos…</div>
          ) : videoError ? (
            <div className="error">Videos error: {videoError}</div>
          ) : (
            <VideoGallery videos={videos} />
          )}
        </main>

        <aside className="newsSide">
          <WeatherWidget />
          <div className="sideCard">
            <div className="sideTitle">Top Headlines</div>
            <div className="sideList">
              {slices.headlines.map((p) => (
                <Link
                  key={p.id}
                  to={`/post/${p.id}`}
                  className="sideLink"
                  onClick={() => bumpAndTick(p.id)}
                >
                  {p.title}
                </Link>
              ))}
            </div>
          </div>

          <div className="sideCard">
            <div className="sideTitle">Most Read</div>
            <div className="sideList">
              {mostRead.map((p) => (
                <Link
                  key={p.id}
                  to={`/post/${p.id}`}
                  className="sideLink"
                  onClick={() => bumpAndTick(p.id)}
                >
                  {p.title}
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
