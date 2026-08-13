import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { loadSiteProfile } from "../lib/profile";
import MediaCommunity from "../components/MediaCommunity";

type Video = { id: string; youtube_id: string; title: string | null };

const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;

export default function Videos() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [active, setActive] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileImage, setProfileImage] = useState("/loopdot.png");
  const [bannerImage, setBannerImage] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("youtube_videos").select("id,youtube_id,title").order("created_at", { ascending: false })
      .then(({ data }) => { setVideos((data ?? []) as Video[]); setLoading(false); });
  }, []);

  useEffect(() => { void loadSiteProfile().then((profile) => { setProfileImage(profile.profileImage); setBannerImage(profile.bannerImage); }); }, []);

  useEffect(() => {
    if (!active) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setActive(null);
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", close); };
  }, [active]);

  return (
    <section className="mediaPage">
      {bannerImage && <div className="videoBanner"><img src={bannerImage} alt="LoopBlog banner" /></div>}
      <div className="profileIntro">
        <div className="profileRing"><img src={profileImage} alt="LoopBlog" className="profileMark" /></div>
        <div>
          <p className="profileEyebrow">Video journal</p>
          <h1>LoopBlog</h1>
          <p>A collection of videos, music, and ideas worth keeping in the loop.</p>
          <div className="profileStats"><span><b>{videos.length}</b> videos</span><span>Independent archive</span></div>
        </div>
      </div>

      <div className="gridTabs"><span className="active">▦ &nbsp; Videos</span></div>
      {loading ? <div className="minimalState">Loading videos…</div> : videos.length === 0 ? (
        <div className="minimalState">No videos have been added yet.</div>
      ) : (
        <div className="videoPostGrid">
          {videos.map((video) => (
            <button key={video.id} className="videoPost" onClick={() => setActive(video)} aria-label={`Play ${video.title ?? "video"}`}>
              <img src={thumb(video.youtube_id)} alt={video.title ?? "LoopBlog video"} loading="lazy" onError={(e) => { e.currentTarget.src = `https://i.ytimg.com/vi/${video.youtube_id}/hqdefault.jpg`; }} />
              <span className="postPlay">▶</span>
              {video.title && <span className="postCaption">{video.title}</span>}
            </button>
          ))}
        </div>
      )}

      {active && (
        <div className="mediaModal" role="dialog" aria-modal="true" onMouseDown={(e) => e.target === e.currentTarget && setActive(null)}>
          <div className="mediaModalPanel">
            <button className="mediaClose" onClick={() => setActive(null)} aria-label="Close video">×</button>
            <div className="videoRatio"><iframe src={`https://www.youtube.com/embed/${active.youtube_id}?autoplay=1&rel=0`} title={active.title ?? "LoopBlog video"} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /></div>
            {active.title && <h2>{active.title}</h2>}
            <MediaCommunity kind="video" itemId={active.id} />
          </div>
        </div>
      )}
    </section>
  );
}
