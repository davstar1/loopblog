import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type MediaKind = "video" | "music";
type MediaComment = { id: string; author_name: string; body: string; created_at: string };

function visitorId() {
  const key = "loopblog:visitor-id";
  let value = localStorage.getItem(key);
  if (!value) { value = crypto.randomUUID(); localStorage.setItem(key, value); }
  return value;
}

export default function MediaCommunity({ kind, itemId }: { kind: MediaKind; itemId: string }) {
  const [comments, setComments] = useState<MediaComment[]>([]);
  const [likes, setLikes] = useState(0);
  const [liked, setLiked] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const visitor = useMemo(visitorId, []);

  async function refresh() {
    const [commentsResult, likesResult, mineResult] = await Promise.all([
      supabase.from("media_comments").select("id,author_name,body,created_at").eq("media_kind", kind).eq("item_id", itemId).order("created_at", { ascending: false }),
      supabase.from("media_likes").select("id", { count: "exact", head: true }).eq("media_kind", kind).eq("item_id", itemId),
      supabase.from("media_likes").select("id").eq("media_kind", kind).eq("item_id", itemId).eq("visitor_id", visitor).maybeSingle(),
    ]);
    if (!commentsResult.error) setComments((commentsResult.data ?? []) as MediaComment[]);
    if (!likesResult.error) setLikes(likesResult.count ?? 0);
    if (!mineResult.error) setLiked(!!mineResult.data);
  }

  useEffect(() => { void refresh(); }, [kind, itemId]);

  async function toggleLike() {
    setMessage(null);
    if (liked) {
      const { error } = await supabase.from("media_likes").delete().eq("media_kind", kind).eq("item_id", itemId).eq("visitor_id", visitor);
      if (!error) { setLiked(false); setLikes((count) => Math.max(0, count - 1)); } else setMessage("Likes need the community database update.");
    } else {
      const { error } = await supabase.from("media_likes").insert({ media_kind: kind, item_id: itemId, visitor_id: visitor });
      if (!error) { setLiked(true); setLikes((count) => count + 1); } else setMessage("Likes need the community database update.");
    }
  }

  async function submitComment() {
    if (!name.trim() || !body.trim()) return setMessage("Add your name and a comment.");
    setBusy(true); setMessage(null);
    const { error } = await supabase.from("media_comments").insert({ media_kind: kind, item_id: itemId, author_name: name.trim(), body: body.trim() });
    if (error) setMessage("Comments need the community database update.");
    else { setBody(""); setMessage("Comment posted ✓"); await refresh(); }
    setBusy(false);
  }

  return (
    <div className="mediaCommunity">
      <div className="communityActions">
        <button className={liked ? "liked" : ""} type="button" onClick={toggleLike} aria-label={liked ? "Remove shaka" : "Send a shaka"}><span aria-hidden="true">🤙🏽</span>{likes}</button>
        <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}><span>○</span>{comments.length} comments</button>
      </div>
      {open && <div className="communityPanel">
        <div className="communityForm"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" maxLength={80} /><textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Leave a comment" maxLength={1000} /><button type="button" onClick={submitComment} disabled={busy}>{busy ? "Posting…" : "Post"}</button></div>
        {message && <small className="communityMessage">{message}</small>}
        <div className="communityComments">{comments.map((comment) => <div key={comment.id}><p><b>{comment.author_name}</b><time>{new Date(comment.created_at).toLocaleDateString()}</time></p><span>{comment.body}</span></div>)}</div>
      </div>}
    </div>
  );
}
