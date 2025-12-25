import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getPost, type PostRow } from "../lib/posts";
import { supabase } from "../lib/supabase";

function publicUrlFromPath(path: string | null): string | null {
  if (!path) return null;
  return supabase.storage.from("loopblogimages").getPublicUrl(path).data
    .publicUrl;
}

export default function Post() {
  const { id } = useParams<{ id: string }>();

  const [post, setPost] = useState<PostRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

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

  return (
    // ✅ added wrapper class so we can scope typography safely in CSS
    <section className="stack postShell">
      <div className="card stack postCard">
        <div className="metaRow">
          <span className="chip">
            {new Date(
              (post as any).published_at ?? (post as any).created_at
            ).toLocaleString()}
          </span>
          <span className="chip">{(post as any).status}</span>
        </div>

        {/* ✅ title uses a stable class for styling */}
        <h1 className="postTitle">{(post as any).title}</h1>

        {(post as any).excerpt && (
          <p className="muted postExcerpt">{(post as any).excerpt}</p>
        )}

        {/* Text left, cover image right */}
        <div
          className="postWrap"
          style={{
            display: "grid",
            gridTemplateColumns: coverUrl ? "1fr 320px" : "1fr",
            gap: 16,
            alignItems: "start",
          }}
        >
          <div className="postMain">
            <div className="postBody">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {bodyText}
              </ReactMarkdown>
            </div>
          </div>

          {coverUrl && (
            <aside className="postSide">
              <a
                href={coverUrl}
                target="_blank"
                rel="noreferrer"
                className="thumb"
              >
                <img
                  src={coverUrl}
                  alt={(post as any).title ?? "Cover"}
                  style={{
                    width: "100%",
                    borderRadius: 16,
                    display: "block",
                    transform: "scale(0.75)",
                    transformOrigin: "top right",
                  }}
                />
              </a>
            </aside>
          )}
        </div>

        {/* Show ALL uploaded images */}
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
