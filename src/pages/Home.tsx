import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loadPosts, type PostRow } from "../lib/posts";

export default function Home() {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) return <div>Loading posts…</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <section>
      <h1>Latest</h1>

      {posts.length === 0 ? (
        <p className="muted">No posts yet.</p>
      ) : (
        <div className="grid">
          {posts.map((p) => (
            <Link key={p.id} to={`/post/${p.id}`} className="card cardLink">
              <h3>{p.title}</h3>
              <p className="muted clamp3">
                {p.excerpt ?? (p.body_md ? p.body_md.slice(0, 180) + "…" : "")}
              </p>
              <div className="metaRow">
                <span className="chip">
                  {new Date(
                    p.published_at ?? p.created_at
                  ).toLocaleDateString()}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
