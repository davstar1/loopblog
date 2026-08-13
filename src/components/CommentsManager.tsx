import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type ManagedComment = {
  id: string;
  source: "journal" | "video" | "music";
  itemId: string;
  authorName: string;
  body: string;
  createdAt: string;
};

export default function CommentsManager() {
  const [comments, setComments] = useState<ManagedComment[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | ManagedComment["source"]>("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    setBusy(true); setMessage(null);
    const [journal, media, posts, videos, tracks] = await Promise.all([
      supabase.from("comments").select("id,post_id,author_name,body,created_at").order("created_at", { ascending: false }),
      supabase.from("media_comments").select("id,media_kind,item_id,author_name,body,created_at").order("created_at", { ascending: false }),
      supabase.from("posts").select("id,title"),
      supabase.from("youtube_videos").select("id,title,youtube_id"),
      supabase.from("music_tracks").select("id,title"),
    ]);

    const nextLabels: Record<string, string> = {};
    for (const row of posts.data ?? []) nextLabels[`journal:${row.id}`] = row.title;
    for (const row of videos.data ?? []) nextLabels[`video:${row.id}`] = row.title || row.youtube_id;
    for (const row of tracks.data ?? []) nextLabels[`music:${row.id}`] = row.title;
    setLabels(nextLabels);

    const journalComments: ManagedComment[] = (journal.data ?? []).map((row) => ({ id: row.id, source: "journal", itemId: row.post_id, authorName: row.author_name, body: row.body, createdAt: row.created_at }));
    const mediaComments: ManagedComment[] = (media.data ?? []).map((row) => ({ id: row.id, source: row.media_kind as "video" | "music", itemId: row.item_id, authorName: row.author_name, body: row.body, createdAt: row.created_at }));
    setComments([...journalComments, ...mediaComments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    if (journal.error || media.error) setMessage("Run the latest database setup if some comments are missing.");
    setBusy(false);
  }

  useEffect(() => { void refresh(); }, []);
  const visible = useMemo(() => filter === "all" ? comments : comments.filter((comment) => comment.source === filter), [comments, filter]);

  function beginEdit(comment: ManagedComment) {
    setEditing(`${comment.source}:${comment.id}`); setDraftName(comment.authorName); setDraftBody(comment.body); setMessage(null);
  }

  async function save(comment: ManagedComment) {
    if (!draftName.trim() || !draftBody.trim()) return setMessage("A comment needs a name and message.");
    setBusy(true); setMessage(null);
    const table = comment.source === "journal" ? "comments" : "media_comments";
    const { error } = await supabase.from(table).update({ author_name: draftName.trim(), body: draftBody.trim() }).eq("id", comment.id);
    if (error) setMessage(error.message); else { setEditing(null); setMessage("Comment updated ✓"); await refresh(); }
    setBusy(false);
  }

  async function remove(comment: ManagedComment) {
    if (!window.confirm(`Delete ${comment.authorName}'s comment? This cannot be undone.`)) return;
    setBusy(true); setMessage(null);
    const table = comment.source === "journal" ? "comments" : "media_comments";
    const { error } = await supabase.from(table).delete().eq("id", comment.id);
    if (error) setMessage(error.message); else { setMessage("Comment deleted."); await refresh(); }
    setBusy(false);
  }

  return (
    <div className="card stack adminModule commentsManager">
      <div className="sectionTitle"><h3>Comments</h3><span>{comments.length} total</span></div>
      <div className="commentFilters">{(["all", "journal", "video", "music"] as const).map((value) => <button type="button" className={filter === value ? "active" : ""} onClick={() => setFilter(value)} key={value}>{value}</button>)}<button type="button" onClick={refresh} disabled={busy}>Refresh</button></div>
      {message && <p className="muted">{message}</p>}
      {visible.length === 0 ? <p className="muted">No comments in this section.</p> : <div className="managedCommentList">{visible.map((comment) => {
        const key = `${comment.source}:${comment.id}`;
        const isEditing = editing === key;
        return <article key={key} className="managedComment">
          <div className="managedCommentMeta"><span>{comment.source}</span><b>{labels[`${comment.source}:${comment.itemId}`] || "Unknown item"}</b><time>{new Date(comment.createdAt).toLocaleString()}</time></div>
          {isEditing ? <div className="commentEditor"><input value={draftName} onChange={(event) => setDraftName(event.target.value)} maxLength={80} /><textarea value={draftBody} onChange={(event) => setDraftBody(event.target.value)} maxLength={1000} /><div><button className="btn actionWhite" type="button" onClick={() => save(comment)} disabled={busy}>Save</button><button className="btn ghost actionWhite" type="button" onClick={() => setEditing(null)}>Cancel</button></div></div> : <><p><b>{comment.authorName}</b></p><div className="managedCommentBody">{comment.body}</div><div className="managedCommentActions"><button className="btn ghost actionWhite" type="button" onClick={() => beginEdit(comment)}>Edit</button><button className="btn ghost actionWhite" type="button" onClick={() => remove(comment)}>Delete</button></div></>}
        </article>;
      })}</div>}
    </div>
  );
}
