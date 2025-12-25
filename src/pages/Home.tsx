import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadPosts, type PostRow } from "../lib/posts";
import { supabase } from "../lib/supabase";

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

            {/* ✅ show Admin-entered title */}
            {v.title && <div className="videoCaption">{v.title}</div>}
          </button>
        ))}
      </div>

      {openId && (
        <div
          className="lbBackdrop"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpenId(null);
          }}
        >
          <div className="lbPanel" role="document">
            <button
              className="lbClose"
              onClick={() => setOpenId(null)}
              aria-label="Close"
            >
              ✕
            </button>

            <div className="lbFrame">
              <iframe
                src={ytEmbed(openId)}
                title="YouTube video"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>

            <div className="lbHint muted">
              <span>Esc to close</span>
              <span style={{ marginLeft: 12 }}>← / → to switch</span>
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

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const rows = await loadPosts();
        setPosts(Array.isArray(rows) ? rows : []);
      } catch (e: any) {
        console.error(e);
        setError(e?.message ?? "Failed to load posts");
        setPosts([]);
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
              typeof r.youtube_id === "string" &&
              (r.youtube_id as string).length > 0
          )
          .map((r: any) => ({
            youtube_id: r.youtube_id as string,
            title: (r.title ?? null) as string | null,
          }));

        // de-dupe while keeping order
        const seen = new Set<string>();
        const deduped: HomeVideo[] = [];
        for (const r of rows) {
          if (seen.has(r.youtube_id)) continue;
          seen.add(r.youtube_id);
          deduped.push(r);
        }

        setVideos(deduped);
      } catch (e: any) {
        console.error(e);
        setVideoError(e?.message ?? "Failed to load videos");
        setVideos([]);
      } finally {
        setVideoLoading(false);
      }
    })();
  }, []);

  const slices = useMemo(() => {
    const hero = posts[0] ?? null;
    const leftRail = posts.slice(1, 5);
    const main = posts.slice(5, 11);
    const headlines = posts.slice(0, 8);
    return { hero, leftRail, main, headlines };
  }, [posts]);

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
        <h1 className="newsH1">Latest</h1>
        <div className="newsSub muted"></div>
      </div>

      <div className="newsCols">
        <aside className="newsRail">
          {slices.leftRail.map((p) => {
            const img = coverUrlFromPath(p.cover_path);
            return (
              <Link key={p.id} to={`/post/${p.id}`} className="railCard">
                {img && (
                  <div className="railThumb">
                    <img src={img} alt={p.title} loading="lazy" />
                  </div>
                )}
                <div className="railBody">
                  <div className="railTitle">{p.title}</div>
                  <div className="railMeta muted">
                    {new Date(
                      p.published_at ?? p.created_at
                    ).toLocaleDateString()}
                  </div>
                </div>
              </Link>
            );
          })}
        </aside>

        <main className="newsMain">
          {slices.hero && (
            <Link to={`/post/${slices.hero.id}`} className="heroCard">
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

          <div className="mainList">
            {slices.main.map((p) => {
              const img = coverUrlFromPath(p.cover_path);
              return (
                <Link key={p.id} to={`/post/${p.id}`} className="mainItem">
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
          <div className="sideCard">
            <div className="sideTitle">Top Headlines</div>
            <div className="sideList">
              {slices.headlines.map((p) => (
                <Link key={p.id} to={`/post/${p.id}`} className="sideLink">
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
