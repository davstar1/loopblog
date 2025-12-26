import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getPost, loadPosts, type PostRow } from "../lib/posts";
import { supabase } from "../lib/supabase";

/* ===========================
   Storage helpers (views)
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

function publicUrlFromPath(path: string | null): string | null {
  if (!path) return null;
  return supabase.storage.from("loopblogimages").getPublicUrl(path).data
    .publicUrl;
}

/* ===========================
   Reading time + TOC helpers
=========================== */
function stripMarkdown(md: string) {
  // remove fenced code blocks
  let s = md.replace(/```[\s\S]*?```/g, " ");
  // remove inline code
  s = s.replace(/`[^`]*`/g, " ");
  // remove images ![alt](url)
  s = s.replace(/!\[[^\]]*\]\([^)]+\)/g, " ");
  // turn links [text](url) -> text
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // remove heading markers/bullets
  s = s.replace(/^#{1,6}\s+/gm, "");
  s = s.replace(/^[-*+]\s+/gm, "");
  // collapse whitespace
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function countWords(text: string) {
  if (!text) return 0;
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function createSlugger() {
  const counts: Record<string, number> = {};
  return (text: string) => {
    const base = slugify(text) || "section";
    const n = (counts[base] ?? 0) + 1;
    counts[base] = n;
    return n === 1 ? base : `${base}-${n}`;
  };
}

type TocItem = {
  level: 2 | 3;
  text: string;
  id: string;
};

function extractToc(md: string): TocItem[] {
  const slug = createSlugger();
  const items: TocItem[] = [];
  const lines = (md || "").split("\n");

  for (const line of lines) {
    const m = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (!m) continue;

    const level = m[1].length as 2 | 3;
    const text = m[2]
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[*_`]/g, "")
      .trim();

    if (!text) continue;
    items.push({ level, text, id: slug(text) });
  }

  return items;
}

function getNodeText(node: any): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getNodeText).join("");
  if (typeof node === "object" && node.props?.children)
    return getNodeText(node.props.children);
  return "";
}

/* ===========================
   Clipboard helper
=========================== */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export default function Post() {
  const { id } = useParams<{ id: string }>();

  const [post, setPost] = useState<PostRow | null>(null);
  const [allPosts, setAllPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);

  const [isNarrow, setIsNarrow] = useState(false);

  // Responsive behavior for the post layout (1 column on narrow screens)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 980px)");
    const apply = () => setIsNarrow(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  // Load post
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        if (!id) {
          if (alive) setPost(null);
          return;
        }

        const row = await getPost(id);
        if (alive) setPost(row);
      } catch (e: any) {
        console.error(e);
        if (alive) {
          setErr(e?.message ?? "Failed to load post.");
          setPost(null);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  // Load all posts for next/prev/related
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = await loadPosts();
        if (alive) setAllPosts(Array.isArray(rows) ? rows : []);
      } catch (e) {
        console.error(e);
        if (alive) setAllPosts([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Count a view on mount / when id changes (counts direct links too)
  useEffect(() => {
    if (!id) return;
    bumpView(id);
  }, [id]);

  // ✅ Hooks MUST be called every render (even while loading / post=null)
  const bodyText: string = useMemo(() => {
    const p: any = post;
    return (p?.body_md ?? p?.body ?? "") as string;
  }, [post]);

  const coverUrl: string | null = useMemo(() => {
    const p: any = post;
    return publicUrlFromPath((p?.cover_path ?? null) as string | null);
  }, [post]);

  const imageUrls: string[] = useMemo(() => {
    const p: any = post;
    const raw: unknown = p?.image_paths;

    const safePaths: string[] = Array.isArray(raw)
      ? (raw.filter((x): x is string => typeof x === "string") as string[])
      : [];

    const urls: string[] = safePaths
      .map((path) => publicUrlFromPath(path))
      .filter((u): u is string => typeof u === "string" && u.length > 0);

    return Array.from(new Set(urls));
  }, [post]);

  const readingTimeLabel = useMemo(() => {
    const text = stripMarkdown(bodyText);
    const words = countWords(text);
    const minutes = Math.max(1, Math.round(words / 200));
    return `${minutes} min read`;
  }, [bodyText]);

  const toc: TocItem[] = useMemo(() => extractToc(bodyText), [bodyText]);

  const nav = useMemo(() => {
    if (!post || !allPosts.length)
      return { prev: null as PostRow | null, next: null as PostRow | null };

    const sorted = [...allPosts].sort((a, b) => {
      const ad = new Date(
        (a as any).published_at ?? (a as any).created_at
      ).getTime();
      const bd = new Date(
        (b as any).published_at ?? (b as any).created_at
      ).getTime();
      return bd - ad; // newest first
    });

    const idx = sorted.findIndex((p) => p.id === (post as any).id);
    const prev = idx > 0 ? sorted[idx - 1] : null; // newer
    const next = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null; // older
    return { prev, next };
  }, [post, allPosts]);

  const related: PostRow[] = useMemo(() => {
    if (!post || !allPosts.length) return [];
    const currentId = (post as any).id;

    const category = ((post as any).category ?? (post as any).topic ?? null) as
      | string
      | null;

    const others = allPosts.filter((p) => p.id !== currentId);

    const sameCat = category
      ? others.filter((p: any) => (p.category ?? p.topic ?? null) === category)
      : [];

    const pool = sameCat.length ? sameCat : others;

    // newest first
    pool.sort((a: any, b: any) => {
      const ad = new Date(a.published_at ?? a.created_at).getTime();
      const bd = new Date(b.published_at ?? b.created_at).getTime();
      return bd - ad;
    });

    return pool.slice(0, 4);
  }, [post, allPosts]);

  const markdownComponents = useMemo(() => {
    // Slugger must match TOC order; ReactMarkdown renders headings in order, so this aligns well.
    const slug = createSlugger();

    return {
      h2: ({ children }: any) => {
        const text = getNodeText(children);
        const id = slug(text);
        return <h2 id={id}>{children}</h2>;
      },
      h3: ({ children }: any) => {
        const text = getNodeText(children);
        const id = slug(text);
        return <h3 id={id}>{children}</h3>;
      },
    };
  }, [bodyText]);

  // ----- NOW it’s safe to early-return -----
  if (loading) {
    return (
      <section className="stack">
        <div className="card">
          <p className="muted">Loading…</p>
        </div>
      </section>
    );
  }

  if (err) {
    return (
      <section className="stack">
        <div className="card stack">
          <h2>Error</h2>
          <p className="error">{err}</p>
          <Link className="btn" to="/">
            Go Home
          </Link>
        </div>
      </section>
    );
  }

  if (!post) {
    return (
      <section className="stack">
        <div className="card stack">
          <h2>Post not found</h2>
          <p className="muted">That post doesn’t exist.</p>
          <Link className="btn" to="/">
            Go Home
          </Link>
        </div>
      </section>
    );
  }

  const dateLabel = new Date(
    (post as any).published_at ?? (post as any).created_at
  ).toLocaleString();

  const showRightCol = !isNarrow && (coverUrl || toc.length > 0);
  const rightColWidth = 320;

  return (
    <section className="stack postShell">
      <div className="card stack postCard">
        <div
          className="metaRow"
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <span className="chip">{dateLabel}</span>
          <span className="chip">{readingTimeLabel}</span>
          {(post as any).status && (
            <span className="chip">{(post as any).status}</span>
          )}

          <span style={{ flex: 1 }} />

          <button
            type="button"
            className="btn ghost"
            onClick={async () => {
              const url = window.location.href;
              const ok = await copyText(url);
              setCopied(ok);
              if (copyTimer.current) window.clearTimeout(copyTimer.current);
              copyTimer.current = window.setTimeout(
                () => setCopied(false),
                1200
              );
            }}
            aria-label="Copy link"
            style={{ padding: "8px 12px" }}
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>

        <h1 className="postTitle">{(post as any).title}</h1>

        {(post as any).excerpt && (
          <p className="muted postExcerpt">{(post as any).excerpt}</p>
        )}

        {/* Text left, TOC/cover right */}
        <div
          className="postWrap"
          style={{
            display: "grid",
            gridTemplateColumns: showRightCol
              ? `minmax(0, 1fr) ${rightColWidth}px`
              : "minmax(0, 1fr)",
            gap: 16,
            alignItems: "start",
          }}
        >
          <div className="postMain">
            {/* TOC for mobile (top) */}
            {isNarrow && toc.length > 0 && (
              <div
                className="tocCard"
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: 16,
                  padding: 12,
                  marginBottom: 12,
                  background: "rgba(255,255,255,.02)",
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 8 }}>
                  On this page
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  {toc.map((t) => (
                    <a
                      key={t.id}
                      href={`#${t.id}`}
                      style={{
                        textDecoration: "none",
                        color: "inherit",
                        paddingLeft: t.level === 3 ? 12 : 0,
                        opacity: t.level === 3 ? 0.9 : 1,
                      }}
                    >
                      {t.text}
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="postBody">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents as any}
              >
                {bodyText}
              </ReactMarkdown>
            </div>

            {/* Next / Prev */}
            {(nav.prev || nav.next) && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr",
                  gap: 12,
                  marginTop: 18,
                }}
              >
                {nav.prev ? (
                  <Link
                    className="card"
                    to={`/post/${(nav.prev as any).id}`}
                    style={{ padding: 12, textDecoration: "none" }}
                  >
                    <div className="muted" style={{ fontSize: 12 }}>
                      ← Newer
                    </div>
                    <div style={{ fontWeight: 800, marginTop: 6 }}>
                      {(nav.prev as any).title}
                    </div>
                  </Link>
                ) : (
                  <div />
                )}

                {nav.next ? (
                  <Link
                    className="card"
                    to={`/post/${(nav.next as any).id}`}
                    style={{ padding: 12, textDecoration: "none" }}
                  >
                    <div
                      className="muted"
                      style={{ fontSize: 12, textAlign: "right" }}
                    >
                      Older →
                    </div>
                    <div
                      style={{
                        fontWeight: 800,
                        marginTop: 6,
                        textAlign: "right",
                      }}
                    >
                      {(nav.next as any).title}
                    </div>
                  </Link>
                ) : (
                  <div />
                )}
              </div>
            )}

            {/* Related */}
            {related.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div className="sectionTitle" style={{ marginBottom: 10 }}>
                  <h3 style={{ margin: 0 }}>Related posts</h3>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isNarrow
                      ? "1fr"
                      : "repeat(2, minmax(0, 1fr))",
                    gap: 12,
                  }}
                >
                  {related.map((p: any) => (
                    <Link
                      key={p.id}
                      to={`/post/${p.id}`}
                      className="card"
                      style={{ padding: 12, textDecoration: "none" }}
                    >
                      <div style={{ fontWeight: 800 }}>{p.title}</div>
                      <div className="muted" style={{ marginTop: 6 }}>
                        {new Date(
                          p.published_at ?? p.created_at
                        ).toLocaleString()}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right column (desktop): cover + TOC */}
          {showRightCol && (
            <aside
              className="postSide"
              style={{ display: "grid", gap: 12, position: "sticky", top: 14 }}
            >
              {coverUrl && (
                <a
                  href={coverUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="thumb"
                  style={{ textDecoration: "none" }}
                >
                  <img
                    src={coverUrl}
                    alt={(post as any).title ?? "Cover"}
                    style={{
                      width: "100%",
                      borderRadius: 16,
                      display: "block",
                      border: "1px solid var(--line)",
                    }}
                  />
                </a>
              )}

              {toc.length > 0 && (
                <div
                  className="tocCard"
                  style={{
                    border: "1px solid var(--line)",
                    borderRadius: 16,
                    padding: 12,
                    background: "rgba(255,255,255,.02)",
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>
                    On this page
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    {toc.map((t) => (
                      <a
                        key={t.id}
                        href={`#${t.id}`}
                        style={{
                          textDecoration: "none",
                          color: "inherit",
                          paddingLeft: t.level === 3 ? 12 : 0,
                          opacity: t.level === 3 ? 0.9 : 1,
                        }}
                      >
                        {t.text}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          )}
        </div>

        {/* Photos */}
        {imageUrls.length > 0 && (
          <>
            <div className="sectionTitle" style={{ marginTop: 12 }}>
              <h3>Photos</h3>
              <span className="muted">{imageUrls.length} uploaded</span>
            </div>

            <div
              className="postImageGrid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                gap: 12,
              }}
            >
              {imageUrls.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="thumb"
                >
                  <img
                    src={url}
                    alt="post"
                    style={{
                      width: "100%",
                      height: 160,
                      objectFit: "cover",
                      borderRadius: 14,
                      border: "1px solid var(--line)",
                      display: "block",
                    }}
                  />
                </a>
              ))}
            </div>
          </>
        )}

        <div className="row">
          <Link className="btn ghost" to="/">
            ← Back
          </Link>
          <Link className="btn" to="/write">
            New Post
          </Link>
        </div>
      </div>
    </section>
  );
}
