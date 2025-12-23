import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getPost, type PostRow } from "../lib/posts";
import { supabase } from "../lib/supabase";

function coverUrlFromPath(path: string | null) {
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
          setPost(null);
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

  const coverUrl = coverUrlFromPath(post.cover_path);

  return (
    <section className="stack">
      <div className="card stack">
        <div className="metaRow">
          <span className="chip">
            {new Date(post.published_at ?? post.created_at).toLocaleString()}
          </span>
          <span className="chip">{post.status}</span>
        </div>

        <h1 className="postTitle">{post.title}</h1>

        {post.excerpt && <p className="muted">{post.excerpt}</p>}

        {coverUrl && (
          <a href={coverUrl} target="_blank" rel="noreferrer" className="thumb">
            <img
              src={coverUrl}
              alt={post.title}
              style={{ width: "100%", borderRadius: 16 }}
            />
          </a>
        )}

        <div className="postBody">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {post.body_md ?? ""}
          </ReactMarkdown>
        </div>

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
