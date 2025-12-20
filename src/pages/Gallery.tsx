import { useEffect, useState } from "react";

const GH = {
  owner: "davstar1",
  repo: "blogimages", // <-- if your repo name is different, change this
  // We'll try these folders in order:
  pathCandidates: ["images", ""], // "images" folder first, then root
};

const IMAGE_RE = /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i;

type RepoInfo = { default_branch: string };
type ContentItem = {
  type: "file" | "dir";
  name: string;
  download_url: string | null;
};

function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);
}

async function fetchDefaultBranch(
  owner: string,
  repo: string
): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: { Accept: "application/vnd.github+json" },
  });

  if (!res.ok) {
    throw new Error(
      `Repo lookup failed (${res.status}). If the repo is private or the name is wrong, GitHub won’t allow loading images.`
    );
  }

  const data = (await res.json()) as RepoInfo;
  return data.default_branch || "main";
}

async function fetchImagesFromPath(
  owner: string,
  repo: string,
  branch: string,
  path: string
): Promise<string[]> {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
  const res = await fetch(apiUrl, {
    headers: { Accept: "application/vnd.github+json" },
  });

  if (!res.ok) return []; // try next path candidate

  const items = (await res.json()) as ContentItem[];
  if (!Array.isArray(items)) return [];

  return items
    .filter((it) => it.type === "file" && IMAGE_RE.test(it.name))
    .map((it) => it.download_url)
    .filter((u): u is string => !!u);
}

export default function Gallery() {
  const [images, setImages] = useState<string[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [errorMsg, setErrorMsg] = useState<string>("");

  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const isOpen = openIndex !== null;
  useBodyScrollLock(isOpen);

  const close = () => setOpenIndex(null);
  const prev = () =>
    openIndex !== null &&
    setOpenIndex(openIndex === 0 ? images.length - 1 : openIndex - 1);
  const next = () =>
    openIndex !== null &&
    setOpenIndex(openIndex === images.length - 1 ? 0 : openIndex + 1);

  // keyboard nav
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, openIndex, images.length]);

  // swipe nav
  useEffect(() => {
    if (!isOpen) return;
    let startX = 0;
    let startY = 0;
    let active = false;

    const onTouchStart = (e: TouchEvent) => {
      active = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!active) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (Math.abs(dy) > Math.abs(dx)) return;
      e.preventDefault();
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (!active) return;
      active = false;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) dx > 0 ? prev() : next();
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, openIndex, images.length]);

  // load images from GitHub
  useEffect(() => {
    let alive = true;

    async function load() {
      setStatus("loading");
      setErrorMsg("");

      const cacheKey = `loopblog.gallery.gh.v2:${GH.owner}/${GH.repo}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as { ts: number; urls: string[] };
          if (Date.now() - parsed.ts < 10 * 60 * 1000 && parsed.urls?.length) {
            if (alive) {
              setImages(parsed.urls);
              setStatus("ready");
            }
            return;
          }
        } catch {}
      }

      try {
        const branch = await fetchDefaultBranch(GH.owner, GH.repo);

        let urls: string[] = [];
        for (const path of GH.pathCandidates) {
          urls = await fetchImagesFromPath(GH.owner, GH.repo, branch, path);
          if (urls.length) break;
        }

        if (!urls.length) {
          throw new Error(
            `No images found. Put images in "${GH.repo}/images" (recommended) or in the repo root, and make sure the repo is public.`
          );
        }

        localStorage.setItem(
          cacheKey,
          JSON.stringify({ ts: Date.now(), urls })
        );

        if (alive) {
          setImages(urls);
          setStatus("ready");
        }
      } catch (e: any) {
        if (!alive) return;
        setStatus("error");
        setErrorMsg(e?.message ?? "Failed to load images from GitHub.");
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="stack">
      <div className="sectionTitle">
        <h2>Photo Gallery</h2>
        <span className="muted">
          {status === "loading" ? "Loading…" : `${images.length} photos`}
        </span>
      </div>

      {status === "error" && (
        <div className="card">
          <div className="error">{errorMsg}</div>
          <p className="muted" style={{ marginTop: 10 }}>
            If your repo name isn’t <code>blogimages</code>, update{" "}
            <code>GH.repo</code>.
          </p>
        </div>
      )}

      {status === "ready" && (
        <div className="photoGrid">
          {images.map((src, i) => (
            <button
              key={src}
              className="photoTile"
              onClick={() => setOpenIndex(i)}
              aria-label="Open image"
            >
              <img src={src} alt={`Gallery ${i + 1}`} loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {isOpen && openIndex !== null && (
        <div className="lightbox" role="dialog" aria-modal="true">
          <button className="lbBackdrop" onClick={close} aria-label="Close" />
          <div className="lbPanel">
            <div className="lbTop">
              <span className="muted">
                {openIndex + 1} / {images.length}
              </span>
              <button className="lbBtn" onClick={close} aria-label="Close">
                ✕
              </button>
            </div>
            <div className="lbBody">
              <button className="lbNav" onClick={prev} aria-label="Previous">
                ‹
              </button>
              <img className="lbImg" src={images[openIndex]} alt="Full size" />
              <button className="lbNav" onClick={next} aria-label="Next">
                ›
              </button>
            </div>
            <div className="lbHint muted">
              Tip: ← → keys / swipe • Esc closes
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
