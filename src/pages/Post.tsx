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
  let s = md.replace(/```[\s\S]*?```/g, " ");
  s = s.replace(/`[^`]*`/g, " ");
  s = s.replace(/!\[[^\]]*\]\([^)]+\)/g, " ");
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  s = s.replace(/^#{1,6}\s+/gm, "");
  s = s.replace(/^[-*+]\s+/gm, "");
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

/* ===========================
   Comments section
=========================== */
type Comment = {
  id: string;
  post_id: string;
  author_name: string;
  body: string;
  created_at: string;
  likes: number;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function CommentsSection({ postId }: { postId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [name, setName] = useState("");
  const [body, setBody] = useState("");

  // Liked comment IDs stored in localStorage
  const LIKED_KEY = `loopblog:liked:${postId}`;
  const getLiked = (): Set<string> => {
    try {
      const raw = localStorage.getItem(LIKED_KEY);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  };
  const [liked, setLiked] = useState<Set<string>>(getLiked);

  async function loadComments() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("comments")
        .select("id,post_id,author_name,body,created_at,likes")
        .eq("post_id", postId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setComments((data ?? []) as Comment[]);
    } catch {
      // silently fail — comments are optional
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  async function handleSubmit() {
    setErr(null);
    const cleanName = name.trim();
    const cleanBody = body.trim();

    if (!cleanName) return setErr("Please enter your name.");
    if (!cleanBody) return setErr("Comment can't be empty.");
    if (cleanBody.length > 1000) return setErr("Comment is too long (max 1000 chars).");

    setSubmitting(true);
    try {
      const { error } = await supabase.from("comments").insert({
        post_id: postId,
        author_name: cleanName,
        body: cleanBody,
        likes: 0,
      });

      if (error) throw error;

      setName("");
      setBody("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      await loadComments();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to post comment.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLike(comment: Comment) {
    if (liked.has(comment.id)) return;

    const newLikes = (comment.likes ?? 0) + 1;
    const newLiked = new Set(liked);
    newLiked.add(comment.id);
    setLiked(newLiked);

    // optimistic update
    setComments((prev) =>
      prev.map((c) => (c.id === comment.id ? { ...c, likes: newLikes } : c))
    );

    try {
      localStorage.setItem(LIKED_KEY, JSON.stringify([...newLiked]));
      await supabase
        .from("comments")
        .update({ likes: newLikes })
        .eq("id", comment.id);
    } catch {
      // revert
      newLiked.delete(comment.id);
      setLiked(new Set(liked));
      setComments((prev) =>
        prev.map((c) =>
          c.id === comment.id ? { ...c, likes: comment.likes } : c
        )
      );
    }
  }

  return (
    <div className="commentsSection">
      <div className="commentsSectionHeader">
        <h3 className="commentsSectionTitle">
          Comments
          {comments.length > 0 && (
            <span className="commentsCount">{comments.length}</span>
          )}
        </h3>
      </div>

      {/* Comment form */}
      <div className="commentForm">
        <input
          className="commentInput"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
        />
        <textarea
          className="commentTextarea"
          placeholder="Share your thoughts…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={1000}
        />
        <div className="commentFormFooter">
          <span className="commentCharCount muted">{body.length}/1000</span>
          <button
            className="commentSubmitBtn btn"
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "Posting…" : "Post comment"}
          </button>
        </div>
        {err && <div className="commentErr">{err}</div>}
        {success && <div className="commentSuccess">Comment posted! ✓</div>}
      </div>

      {/* Comment list */}
      {loading ? (
        <div className="muted" style={{ padding: "12px 0" }}>Loading comments…</div>
      ) : comments.length === 0 ? (
        <div className="commentsEmpty">
          No comments yet — be the first to leave one!
        </div>
      ) : (
        <div className="commentsList">
          {comments.map((c) => (
            <div key={c.id} className="commentCard">
              <div className="commentMeta">
                <span className="commentAuthor">{c.author_name}</span>
                <span className="commentTime muted">{timeAgo(c.created_at)}</span>
              </div>
              <div className="commentBody">{c.body}</div>
              <div className="commentActions">
                <button
                  type="button"
                  className={`commentLikeBtn ${liked.has(c.id) ? "liked" : ""}`}
                  onClick={() => handleLike(c)}
                  disabled={liked.has(c.id)}
                  aria-label="Like this comment"
                >
                  <span className="commentLikeIcon">♥</span>
                  {(c.likes ?? 0) > 0 && (
                    <span className="commentLikeCount">{c.likes}</span>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
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

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 980px)");
    const apply = () => setIsNarrow(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

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

  useEffect(() => {
    if (!id) return;
    bumpView(id);
  }, [id]);

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
      return bd - ad;
    });

    const idx = sorted.findIndex((p) => p.id === (post as any).id);
    const prev = idx > 0 ? sorted[idx - 1] : null;
    const next = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;
    return { prev, next };
  }, [post, allPosts]);

  const related: PostRow[] = useMemo(() => {
    if (!post || !allPosts.length) return [];
    return allPosts
      .filter((p) => p.id !== (post as any).id)
      .slice(0, 4);
  }, [post, allPosts]);

  const showRightCol = !isNarrow && (!!coverUrl || toc.length > 0);
  const rightColWidth = 260;

  const markdownComponents = useMemo(() => {
    const slugger = createSlugger();

    return {
      h2: ({ children, ...props }: any) => {
        const text = getNodeText(children);
        const id = slugger(text);
        return (
          <h2 id={id} {...props}>
            {children}
          </h2>
        );
      },
      h3: ({ children, ...props }: any) => {
        const text = getNodeText(children);
        const id = slugger(text);
        return (
          <h3 id={id} {...props}>
            {children}
          </h3>
        );
      },
      pre: ({ children, ...props }: any) => {
        const [codeCopied, setCodeCopied] = useState(false);

        async function onCopy() {
          const text = getNodeText(children);
          const ok = await copyText(text);
          if (ok) {
            setCodeCopied(true);
            setTimeout(() => setCodeCopied(false), 2000);
          }
        }

        return (
          <div style={{ position: "relative" }}>
            <pre {...props}>{children}</pre>
            <button
              type="button"
              onClick={onCopy}
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                fontSize: 11,
                padding: "4px 8px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,.14)",
                background: "rgba(0,0,0,.45)",
                color: "rgba(255,255,255,.82)",
                cursor: "pointer",
              }}
            >
              {codeCopied ? "Copied!" : "Copy"}
            </button>
          </div>
        );
      },
    };
  }, []);

  if (loading) return <div className="muted" style={{ padding: 24 }}>Loading…</div>;
  if (err) return <div className="error" style={{ padding: 24 }}>Error: {err}</div>;
  if (!post) return <div className="muted" style={{ padding: 24 }}>Post not found.</div>;

  return (
    <section className="postShell stack">
      <div className="postMeta">
        <span className="chip">{readingTimeLabel}</span>
        <span className="chip">
          {new Date(
            (post as any).published_at ?? (post as any).created_at
          ).toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </span>
        <button
          type="button"
          className="chip"
          style={{ cursor: "pointer", background: "none", border: "1px solid var(--line)" }}
          onClick={async () => {
            const ok = await copyText(window.location.href);
            if (ok) {
              setCopied(true);
              if (copyTimer.current) clearTimeout(copyTimer.current);
              copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
            }
          }}
        >
          {copied ? "Copied!" : "Share ↗"}
        </button>
      </div>

      <h1 className="postTitle">{(post as any).title}</h1>

      {(post as any).excerpt && (
        <p className="muted postExcerpt">{(post as any).excerpt}</p>
      )}

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

          {/* Comments */}
          <CommentsSection postId={id!} />
        </div>

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
    </section>
  );
}
