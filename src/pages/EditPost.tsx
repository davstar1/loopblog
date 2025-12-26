import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "../lib/supabase";
import { getPost, type PostRow } from "../lib/posts";

/**
 * Dedicated Edit Page for a blog post.
 *
 * IMPORTANT:
 * - If your posts table is NOT named "posts", change POSTS_TABLE below.
 * - Storage bucket name is taken from your existing Post/Home code: "loopblogimages".
 */
const POSTS_TABLE = "posts";
const BUCKET = "loopblogimages";

function safeName(name: string) {
  return name
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "");
}

function toDatetimeLocal(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // datetime-local wants "YYYY-MM-DDTHH:mm"
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function fromDatetimeLocal(v: string) {
  // v like "2025-12-26T08:30" (local time)
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function publicUrlFromPath(path: string | null): string | null {
  if (!path) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function uploadToBucket(file: File, path: string) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    cacheControl: "3600",
  });
  if (error) throw error;
  return path;
}

async function removeFromBucket(path: string) {
  // Best-effort. If you don't want deletes, you can remove this.
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

export default function EditPost() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();

  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [post, setPost] = useState<PostRow | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Form fields
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [bodyMd, setBodyMd] = useState("");
  const [status, setStatus] = useState<string>("draft");
  const [publishedAtLocal, setPublishedAtLocal] = useState<string>("");

  // Media fields
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [imagePaths, setImagePaths] = useState<string[]>([]);

  const coverUrl = useMemo(() => publicUrlFromPath(coverPath), [coverPath]);

  // Auth gate
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!alive) return;
        setAuthed(!!data.user);
      } finally {
        if (!alive) return;
        setChecking(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setAuthed(!!session?.user);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Load post
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr(null);
        setOk(null);

        if (!id) {
          setPost(null);
          setErr("Missing post id.");
          return;
        }

        const row = await getPost(id);
        if (!alive) return;

        setPost(row);

        // Seed form
        const r: any = row;
        setTitle((r?.title ?? "") as string);
        setExcerpt((r?.excerpt ?? "") as string);
        setBodyMd(((r?.body_md ?? r?.body ?? "") as string) ?? "");
        setStatus(((r?.status ?? "draft") as string) ?? "draft");
        setPublishedAtLocal(toDatetimeLocal(r?.published_at ?? null));

        setCoverPath((r?.cover_path ?? null) as string | null);

        const rawPaths: unknown = r?.image_paths;
        const paths = Array.isArray(rawPaths)
          ? (rawPaths.filter((x): x is string => typeof x === "string") as string[])
          : [];
        setImagePaths(paths);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "Failed to load post.");
        setPost(null);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  async function onReplaceCover(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !id) return;

    setErr(null);
    setOk(null);

    try {
      setSaving(true);

      const ext = safeName(file.name).split(".").pop() || "jpg";
      const path = `posts/${id}/cover_${Date.now()}.${ext}`;

      // Optional: remove old cover file if it lived in the bucket
      const prev = coverPath;

      const newPath = await uploadToBucket(file, path);
      setCoverPath(newPath);

      await supabase.from(POSTS_TABLE).update({ cover_path: newPath }).eq("id", id);

      // Best-effort cleanup
      if (prev && prev.startsWith(`posts/${id}/`)) {
        try {
          await removeFromBucket(prev);
        } catch {
          // ignore
        }
      }

      setOk("Cover updated ✅");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to upload cover.");
    } finally {
      setSaving(false);
    }
  }

  async function onAddImages(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length || !id) return;

    setErr(null);
    setOk(null);

    try {
      setSaving(true);

      const uploaded: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i]!;
        const ext = safeName(f.name).split(".").pop() || "jpg";
        const path = `posts/${id}/images/${Date.now()}_${i}.${ext}`;
        const p = await uploadToBucket(f, path);
        uploaded.push(p);
      }

      const next = Array.from(new Set([...imagePaths, ...uploaded]));
      setImagePaths(next);

      await supabase.from(POSTS_TABLE).update({ image_paths: next }).eq("id", id);

      setOk(`Added ${uploaded.length} image(s) ✅`);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to upload images.");
    } finally {
      setSaving(false);
    }
  }

  async function removeImage(path: string) {
    if (!id) return;
    setErr(null);
    setOk(null);

    try {
      setSaving(true);

      const next = imagePaths.filter((p) => p !== path);
      setImagePaths(next);

      await supabase.from(POSTS_TABLE).update({ image_paths: next }).eq("id", id);

      // Best-effort bucket cleanup
      if (path.startsWith(`posts/${id}/`)) {
        try {
          await removeFromBucket(path);
        } catch {
          // ignore
        }
      }

      setOk("Image removed ✅");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to remove image.");
    } finally {
      setSaving(false);
    }
  }

  async function save(e?: FormEvent) {
    e?.preventDefault();
    if (!id) return;

    setErr(null);
    setOk(null);

    try {
      setSaving(true);

      // Decide published_at behavior:
      // - If user typed a datetime, use it
      // - Else if switching to "published" and there's no published_at, set to now
      const desiredPublishedAt = fromDatetimeLocal(publishedAtLocal);
      const row: any = post;
      const existingPublishedAt = row?.published_at ?? null;

      let published_at: string | null | undefined = desiredPublishedAt;

      if (!desiredPublishedAt) {
        if (status === "published" && !existingPublishedAt) {
          published_at = new Date().toISOString();
        } else {
          // leave unchanged if empty
          published_at = undefined;
        }
      }

      const update: any = {
        title: title.trim(),
        excerpt: excerpt.trim() || null,
        body_md: bodyMd,
        status: status || null,
      };
      if (published_at !== undefined) update.published_at = published_at;
      if (coverPath !== undefined) update.cover_path = coverPath;
      if (imagePaths !== undefined) update.image_paths = imagePaths;

      const { data, error } = await supabase
        .from(POSTS_TABLE)
        .update(update)
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw error;

      setPost(data as any);
      setOk("Saved ✅");
    } catch (e: any) {
      setErr(
        e?.message ??
          `Failed to save. If your posts table isn't "${POSTS_TABLE}", change POSTS_TABLE in EditPost.tsx.`
      );
    } finally {
      setSaving(false);
    }
  }

  async function deletePost() {
    if (!id) return;
    const yes = window.confirm("Delete this post? This cannot be undone.");
    if (!yes) return;

    setErr(null);
    setOk(null);

    try {
      setSaving(true);

      const { error } = await supabase.from(POSTS_TABLE).delete().eq("id", id);
      if (error) throw error;

      setOk("Post deleted ✅");
      nav("/", { replace: true });
    } catch (e: any) {
      setErr(e?.message ?? "Failed to delete post.");
    } finally {
      setSaving(false);
    }
  }

  if (checking) {
    return (
      <section className="stack" style={{ maxWidth: 1100, margin: "0 auto", padding: "0 14px" }}>
        <div className="card">Checking session…</div>
      </section>
    );
  }

  if (!authed) {
    return (
      <section className="stack" style={{ maxWidth: 1100, margin: "0 auto", padding: "0 14px" }}>
        <div className="card stack">
          <h1>Edit Post</h1>
          <p>You must be logged in to edit posts.</p>
          <div className="row">
            <Link className="btn" to="/admin">
              Go to Admin
            </Link>
            <Link className="btn ghost" to="/">
              Back Home
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="stack" style={{ maxWidth: 1100, margin: "0 auto", padding: "0 14px" }}>
        <div className="card">Loading post…</div>
      </section>
    );
  }

  if (err && !post) {
    return (
      <section className="stack" style={{ maxWidth: 1100, margin: "0 auto", padding: "0 14px" }}>
        <div className="card stack">
          <h1>Edit Post</h1>
          <div style={{ color: "tomato" }}>{err}</div>
          <div className="row">
            <Link className="btn ghost" to="/admin">
              Back to Admin
            </Link>
            <Link className="btn" to="/">
              Home
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="stack" style={{ maxWidth: 1100, margin: "0 auto", padding: "0 14px" }}>
      <div className="card stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h1 style={{ margin: 0 }}>Edit Post</h1>
          {id && (
            <div className="row">
              <Link className="btn ghost" to={`/post/${id}`}>
                View
              </Link>
              <Link className="btn ghost" to="/admin">
                Admin
              </Link>
            </div>
          )}
        </div>

        {(err || ok) && (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.12)",
              background: "rgba(255,255,255,.03)",
              color: err ? "tomato" : "inherit",
            }}
          >
            {err ?? ok}
          </div>
        )}

        <form className="stack" onSubmit={save}>
          <label className="field">
            <span>Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Post title" />
          </label>

          <label className="field">
            <span>Excerpt</span>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Short preview text (optional)"
              rows={3}
            />
          </label>

          <div
            className="row"
            style={{
              alignItems: "flex-end",
              gap: 12,
              justifyContent: "space-between",
            }}
          >
            <label className="field" style={{ minWidth: 220, flex: 1 }}>
              <span>Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={{
                  width: "100%",
                  borderRadius: 12,
                  border: "1px solid var(--line)",
                  background: "rgba(255,255,255,.04)",
                  color: "var(--text)",
                  padding: "10px 12px",
                }}
              >
                <option value="draft">draft</option>
                <option value="published">published</option>
              </select>
            </label>

            <label className="field" style={{ minWidth: 260, flex: 1 }}>
              <span>Published at (optional)</span>
              <input
                type="datetime-local"
                value={publishedAtLocal}
                onChange={(e) => setPublishedAtLocal(e.target.value)}
              />
            </label>
          </div>

          <label className="field">
            <span>Body (Markdown)</span>
            <textarea
              value={bodyMd}
              onChange={(e) => setBodyMd(e.target.value)}
              rows={16}
              placeholder="Write your post in Markdown…"
              style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
            />
          </label>

          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            <div className="card stack" style={{ border: "1px solid var(--line)" }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>Cover</strong>
                <label className="btn ghost" style={{ cursor: saving ? "not-allowed" : "pointer" }}>
                  Replace
                  <input
                    type="file"
                    accept="image/*"
                    onChange={onReplaceCover}
                    disabled={saving}
                    style={{ display: "none" }}
                  />
                </label>
              </div>

              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt="cover"
                  style={{
                    width: "100%",
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,.10)",
                    display: "block",
                    objectFit: "cover",
                    maxHeight: 240,
                  }}
                />
              ) : (
                <div className="muted">No cover image</div>
              )}
            </div>

            <div className="card stack" style={{ border: "1px solid var(--line)" }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>Images</strong>
                <label className="btn ghost" style={{ cursor: saving ? "not-allowed" : "pointer" }}>
                  Add
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={onAddImages}
                    disabled={saving}
                    style={{ display: "none" }}
                  />
                </label>
              </div>

              {imagePaths.length === 0 ? (
                <div className="muted">No images</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 }}>
                  {imagePaths.map((p) => {
                    const url = publicUrlFromPath(p);
                    return (
                      <div key={p} style={{ display: "grid", gap: 6 }}>
                        {url ? (
                          <img
                            src={url}
                            alt="img"
                            style={{
                              width: "100%",
                              height: 90,
                              objectFit: "cover",
                              borderRadius: 12,
                              border: "1px solid rgba(255,255,255,.10)",
                              display: "block",
                            }}
                          />
                        ) : (
                          <div className="muted" style={{ fontSize: 12 }}>
                            {p}
                          </div>
                        )}

                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => removeImage(p)}
                          disabled={saving}
                          style={{ padding: "8px 10px" }}
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="row">
              <button className="btn" type="submit" disabled={saving || !title.trim()}>
                {saving ? "Saving…" : "Save changes"}
              </button>
              <button
                className="btn ghost"
                type="button"
                onClick={() => nav(-1)}
                disabled={saving}
              >
                Back
              </button>
            </div>

            <button
              className="btn ghost"
              type="button"
              onClick={deletePost}
              disabled={saving}
              style={{ borderColor: "rgba(255,99,71,.45)" }}
            >
              Delete post
            </button>
          </div>
        </form>
      </div>

      {/* Preview */}
      <div className="card stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Preview</h2>
          <span className="muted" style={{ fontSize: 12 }}>
            Markdown preview
          </span>
        </div>

        <div style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{bodyMd || "_(nothing to preview yet)_"}</ReactMarkdown>
        </div>
      </div>
    </section>
  );
}