import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadPosts, type PostRow } from "../lib/posts";
import { supabase } from "../lib/supabase";

function cover(path: string | null) {
  return path ? supabase.storage.from("loopblogimages").getPublicUrl(path).data.publicUrl : null;
}

export default function Journal() {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadPosts().then(setPosts).finally(() => setLoading(false)); }, []);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? posts.filter((post) => `${post.title} ${post.excerpt ?? ""}`.toLowerCase().includes(term)) : posts;
  }, [posts, query]);

  return (
    <section className="journalPage">
      <header className="journalHero">
        <p className="profileEyebrow">Writing & reflection</p>
        <h1>Journal</h1>
        <p>Notes, observations, and longer thoughts from LoopBlog.</p>
      </header>
      <div className="journalTools"><span>{posts.length} entries</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the journal" aria-label="Search journal" /></div>
      {loading ? <div className="minimalState">Loading entries…</div> : filtered.length === 0 ? <div className="minimalState">No journal entries found.</div> : (
        <div className="journalList">{filtered.map((post, index) => {
          const image = cover(post.cover_path);
          return <Link to={`/post/${post.id}`} className="journalEntry" key={post.id}>
            <span className="journalNumber">{String(index + 1).padStart(2, "0")}</span>
            <div className="journalEntryCopy"><time>{new Date(post.published_at ?? post.created_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</time><h2>{post.title}</h2>{post.excerpt && <p>{post.excerpt}</p>}</div>
            {image ? <img src={image} alt="" /> : <span className="journalArrow">↗</span>}
          </Link>;
        })}</div>
      )}
    </section>
  );
}
