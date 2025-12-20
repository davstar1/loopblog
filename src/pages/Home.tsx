import { Link } from "react-router-dom";
import { loadPosts } from "../lib/posts";

export default function Home() {
  const posts = loadPosts();

  return (
    <section className="stack">
      <div className="hero">
        <h1>LoopBlog</h1>
        <p>
          Write posts, attach photos, share playlists, and embed your videos.
        </p>
        <div className="heroBtns">
          <Link className="btn" to="/write">
            New Post
          </Link>
          <Link className="btn ghost" to="/videos">
            YouTube Gallery
          </Link>
        </div>
      </div>

      <div className="sectionTitle">
        <h2>Latest Posts</h2>
        <span className="muted">{posts.length} total</span>
      </div>

      {posts.length === 0 ? (
        <div className="card">
          <p className="muted">
            No posts yet. Click “New Post” to write your first one.
          </p>
        </div>
      ) : (
        <div className="grid">
          {posts.map((p) => (
            <Link key={p.id} to={`/post/${p.id}`} className="card cardLink">
              <h3>{p.title}</h3>
              <p className="muted clamp3">{p.body}</p>
              <div className="metaRow">
                <span className="chip">
                  {new Date(p.createdAt).toLocaleDateString()}
                </span>
                {p.imageIds.length > 0 && (
                  <span className="chip">📷 {p.imageIds.length}</span>
                )}
                {p.tags.slice(0, 2).map((t) => (
                  <span className="chip" key={t}>
                    #{t}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
