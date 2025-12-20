import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getPost } from "../lib/posts";
import { getImageBlob } from "../lib/imagesDb";

export default function Post() {
  const { id } = useParams();
  const post = useMemo(() => (id ? getPost(id) : undefined), [id]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    const urlsToRevoke: string[] = [];

    async function load() {
      if (!post) return;
      const urls: string[] = [];
      for (const imageId of post.imageIds) {
        const blob = await getImageBlob(imageId);
        if (!blob) continue;
        const url = URL.createObjectURL(blob);
        urlsToRevoke.push(url);
        urls.push(url);
      }
      if (alive) setImageUrls(urls);
    }

    load();

    return () => {
      alive = false;
      urlsToRevoke.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [post]);

  if (!post) {
    return (
      <section className="stack">
        <div className="card">
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
    <section className="stack">
      <div className="card stack">
        <div className="metaRow">
          <span className="chip">
            {new Date(post.createdAt).toLocaleString()}
          </span>
          {post.tags.map((t) => (
            <span className="chip" key={t}>
              #{t}
            </span>
          ))}
        </div>

        <h1 className="postTitle">{post.title}</h1>
        <p className="postBody">{post.body}</p>

        {imageUrls.length > 0 && (
          <>
            <div className="sectionTitle">
              <h3>Images</h3>
              <span className="muted">{imageUrls.length} attached</span>
            </div>

            <div className="thumbGrid big">
              {imageUrls.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="thumb"
                >
                  <img src={url} alt="post" />
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
