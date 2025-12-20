import { useEffect, useState } from "react";

const YOUTUBE_IDS = [
  "YZ8UZ5SILUw",
  "3obCK0xYZro",
  // add more IDs
];

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

export default function Videos() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const isOpen = openIndex !== null;

  useBodyScrollLock(isOpen);

  const close = () => setOpenIndex(null);

  const prev = () => {
    if (openIndex === null) return;
    setOpenIndex((i) => (i === 0 ? YOUTUBE_IDS.length - 1 : (i as number) - 1));
  };

  const next = () => {
    if (openIndex === null) return;
    setOpenIndex((i) => (i === YOUTUBE_IDS.length - 1 ? 0 : (i as number) + 1));
  };

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
  }, [isOpen, openIndex]);

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
      const endX = e.changedTouches[0].clientX;
      const dx = endX - startX;
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
  }, [isOpen, openIndex]);

  const currentId = openIndex !== null ? YOUTUBE_IDS[openIndex] : null;

  return (
    <section className="stack">
      <div className="sectionTitle">
        <h2>YouTube Gallery</h2>
        <span className="muted">{YOUTUBE_IDS.length} videos</span>
      </div>

      <div className="videoThumbGrid">
        {YOUTUBE_IDS.map((id, i) => (
          <button
            key={id}
            className="videoTile"
            onClick={() => setOpenIndex(i)}
            aria-label={`Play video ${i + 1}`}
          >
            <img
              src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
              alt="YouTube thumbnail"
              loading="lazy"
            />
            <span className="playBadge" aria-hidden="true">
              ▶
            </span>
          </button>
        ))}
      </div>

      {isOpen && currentId && (
        <div className="lightbox" role="dialog" aria-modal="true">
          <button className="lbBackdrop" onClick={close} aria-label="Close" />

          <div className="lbPanel">
            <div className="lbTop">
              <span className="muted">
                {(openIndex as number) + 1} / {YOUTUBE_IDS.length}
              </span>
              <button className="lbBtn" onClick={close} aria-label="Close">
                ✕
              </button>
            </div>

            <div className="lbBody">
              <button className="lbNav" onClick={prev} aria-label="Previous">
                ‹
              </button>

              <div className="lbVideo">
                <div className="ratio">
                  <iframe
                    src={`https://www.youtube.com/embed/${currentId}?autoplay=1&rel=0`}
                    title="YouTube player"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>

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
