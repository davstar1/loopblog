import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addPost } from "../lib/posts";
import type { BlogPost } from "../lib/types";
import { saveImage } from "../lib/imagesDb";

type PendingImage = { file: File; previewUrl: string };

export default function Write() {
  const nav = useNavigate();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tagsRaw, setTagsRaw] = useState("looping, guitar");
  const [pending, setPending] = useState<PendingImage[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const tags = useMemo(() => {
    return tagsRaw
      .split(",")
      .map((t) => t.trim().replace(/^#/, ""))
      .filter(Boolean)
      .slice(0, 12);
  }, [tagsRaw]);

  function onPickFiles(files: FileList | null) {
    if (!files) return;
    const next: PendingImage[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) continue;
      next.push({ file: f, previewUrl: URL.createObjectURL(f) });
    }
    setPending((p) => [...p, ...next].slice(0, 12));
  }

  function removePending(i: number) {
    setPending((p) => {
      const copy = [...p];
      const removed = copy.splice(i, 1)[0];
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return copy;
    });
  }

  async function onSave() {
    setErr(null);
    if (!title.trim()) return setErr("Title is required.");
    if (!body.trim()) return setErr("Body is required.");

    setSaving(true);
    try {
      const imageIds: string[] = [];
      for (const item of pending) {
        const id = await saveImage(item.file);
        imageIds.push(id);
      }

      const post: BlogPost = {
        id: crypto.randomUUID(),
        title: title.trim(),
        body: body.trim(),
        createdAt: new Date().toISOString(),
        imageIds,
        tags,
      };

      addPost(post);
      pending.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      nav(`/post/${post.id}`);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save post.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="stack">
      <div className="sectionTitle">
        <h2>Write a Post</h2>
        <span className="muted">Images persist (IndexedDB)</span>
      </div>

      <div className="card stack">
        <label className="field">
          <span>Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Post title..."
          />
        </label>

        <label className="field">
          <span>Tags (comma-separated)</span>
          <input
            value={tagsRaw}
            onChange={(e) => setTagsRaw(e.target.value)}
            placeholder="looping, busking, pedals"
          />
        </label>

        <label className="field">
          <span>Body</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your post..."
            rows={10}
          />
        </label>

        <div className="field">
          <span>Images</span>
          <div className="dropzone">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => onPickFiles(e.target.files)}
            />
            <p className="muted">Pick up to 12 images (JPG/PNG/WebP).</p>
          </div>

          {pending.length > 0 && (
            <div className="thumbGrid">
              {pending.map((p, i) => (
                <div key={p.previewUrl} className="thumb">
                  <img src={p.previewUrl} alt={`upload-${i}`} />
                  <button
                    className="xBtn"
                    onClick={() => removePending(i)}
                    aria-label="Remove image"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {err && <div className="error">{err}</div>}

        <div className="row">
          <button className="btn" onClick={onSave} disabled={saving}>
            {saving ? "Saving..." : "Publish"}
          </button>
          <button className="btn ghost" onClick={() => nav("/")}>
            Cancel
          </button>
        </div>
      </div>
    </section>
  );
}
