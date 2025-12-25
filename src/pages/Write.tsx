import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addPost } from "../lib/posts";
import { uploadBlogImage } from "../lib/uploadImage";

type PendingImage = { file: File; previewUrl: string };

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80);
}

export default function Write() {
  const nav = useNavigate();

  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [body, setBody] = useState("");
  const [tagsRaw, setTagsRaw] = useState("looping, guitar");
  const [pending, setPending] = useState<PendingImage[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);

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

  function prettyError(e: any) {
    const msg = e?.message || String(e);

    if (msg.toLowerCase().includes("row-level security")) {
      return "Upload blocked by Supabase security (RLS). Make sure you’re logged in and your Storage INSERT policy exists for bucket 'loopblogimages'.";
    }
    if (msg.toLowerCase().includes("bucket not found")) {
      return "Storage bucket not found. Confirm your bucket name is exactly 'loopblogimages' in code and in Supabase Storage.";
    }
    if (msg.toLowerCase().includes("not-null constraint")) {
      return "A required database field is missing. This usually means your insert payload doesn’t match your table columns.";
    }
    if (e?.status === 413 || msg.toLowerCase().includes("payload too large")) {
      return "Image is too large. Try a smaller image or compress it before uploading.";
    }
    return msg;
  }

  async function onSave() {
    setErr(null);
    setStage(null);
    setStep(0);
    setTotalSteps(0);

    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    const cleanExcerpt = excerpt.trim();

    if (!cleanTitle) return setErr("Title is required.");
    if (!cleanBody) return setErr("Body is required.");

    setSaving(true);
    try {
      const slug = slugify(cleanTitle) || `post-${Date.now()}`;

      // We upload ALL images to "posts/".
      // The first image also becomes cover_path in "covers/" (optional).
      const hasImages = pending.length > 0;

      const steps = (hasImages ? pending.length : 0) + (hasImages ? 1 : 0) + 1;
      // upload N images to posts/  + upload cover (1) + insert post (1)
      setTotalSteps(steps);

      // 1) Upload cover (optional)
      let cover_path: string | null = null;
      let currentStep = 0;

      if (hasImages) {
        setStage("Uploading cover image…");
        setStep(++currentStep);
        const coverUploaded = await uploadBlogImage(pending[0].file, "covers");
        cover_path = coverUploaded.path;
      }

      // 2) Upload all images
      const image_paths: string[] = [];
      if (hasImages) {
        for (let i = 0; i < pending.length; i++) {
          setStage(`Uploading image ${i + 1} of ${pending.length}…`);
          setStep(++currentStep);
          const uploaded = await uploadBlogImage(pending[i].file, "posts");
          image_paths.push(uploaded.path);
        }
      }

      // 3) Insert post
      setStage("Saving post to Supabase…");
      setStep(++currentStep);

      const created = await addPost({
        title: cleanTitle,
        slug,
        excerpt: cleanExcerpt || null,
        body_md: cleanBody,
        cover_path,
        image_paths,
        status: "published",
      });

      pending.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      setPending([]);

      setStage(null);
      nav(`/post/${created.id}`);
    } catch (e: any) {
      console.error(e);
      const rawMsg = e?.message ?? "";
      if (rawMsg.includes("posts_slug_key")) {
        setErr(
          "A post with this slug already exists. Change the title and try again."
        );
      } else {
        setErr(prettyError(e));
      }
      setStage(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="stack">
      <div className="sectionTitle">
        <h2>Write a Post</h2>
        <span className="muted">
          Saving to Supabase • Tags (UI only):{" "}
          {tags.length ? tags.join(", ") : "none"}
        </span>
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
          <span>Excerpt (optional)</span>
          <input
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="Short summary that shows on Home..."
          />
        </label>

        <label className="field">
          <span>Tags (comma-separated) — UI only</span>
          <input
            value={tagsRaw}
            onChange={(e) => setTagsRaw(e.target.value)}
            placeholder="looping, busking, pedals"
          />
        </label>

        <label className="field">
          <span>Body (Markdown)</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your post..."
            rows={10}
          />
        </label>

        <div className="field">
          <span>Images (optional)</span>
          <div className="dropzone">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => onPickFiles(e.target.files)}
            />
            <p className="muted">
              Pick up to 12 images. First becomes the cover.
            </p>
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
                    type="button"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {stage && (
          <div className="card">
            <div className="muted">{stage}</div>
            {totalSteps > 0 && (
              <div className="muted">
                Step {step} of {totalSteps}
              </div>
            )}
          </div>
        )}

        {err && <div className="error">{err}</div>}

        <div className="row">
          <button
            className="btn"
            onClick={onSave}
            disabled={saving}
            type="button"
          >
            {saving ? "Publishing..." : "Publish"}
          </button>
          <button className="btn ghost" onClick={() => nav("/")} type="button">
            Cancel
          </button>
        </div>
      </div>
    </section>
  );
}
