import { useEffect, useRef, useState } from "react";
import { loadTracks, type MusicTrack } from "../lib/music";
import MediaCommunity from "../components/MediaCommunity";

function Waveform() { return <div className="waveform" aria-hidden="true">{Array.from({ length: 72 }, (_, i) => <i key={i} style={{ height: `${18 + ((i * 17) % 58)}%` }} />)}</div>; }

export default function Music() {
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const players = useRef<Record<string, HTMLAudioElement | null>>({});

  useEffect(() => { loadTracks().then(setTracks).catch(() => setError("Music collection is ready for its first track.")); }, []);

  function toggle(track: MusicTrack) {
    Object.entries(players.current).forEach(([id, player]) => { if (id !== track.id) player?.pause(); });
    const player = players.current[track.id];
    if (!player) return;
    if (player.paused) { player.play(); setActive(track.id); } else { player.pause(); setActive(null); }
  }

  return (
    <section className="musicPage">
      <header className="musicHero"><p className="profileEyebrow">LoopBlog audio</p><h1>Music</h1><p>Original tracks, works in progress, and sounds found along the way.</p></header>
      <div className="trackHeader"><span>Recent tracks</span><span>{tracks.length} releases</span></div>
      {tracks.length === 0 ? <div className="minimalState">{error ?? "Loading tracks…"}</div> : (
        <div className="trackList">{tracks.map((track, index) => (
          <article className={`trackRow ${track.embed_url ? "embedTrack" : ""}`} key={track.id}>
            <div className="trackArt">{track.artwork_url ? <img src={track.artwork_url} alt="" /> : <span>{String(index + 1).padStart(2, "0")}</span>}</div>
            {track.embed_url ? <span className="embedBadge">↗</span> : <button className="trackPlay" onClick={() => toggle(track)} aria-label={`${active === track.id ? "Pause" : "Play"} ${track.title}`}>{active === track.id ? "Ⅱ" : "▶"}</button>}
            <div className="trackBody"><div className="trackMeta"><div><span>{track.artist || "LoopBlog"}</span><h2>{track.title}</h2></div><time>{new Date(track.created_at).toLocaleDateString()}</time></div>{track.embed_url ? <iframe className="musicEmbed" src={track.embed_url} title={`${track.title} player`} allow="autoplay; encrypted-media" loading="lazy" sandbox="allow-scripts allow-same-origin allow-popups allow-forms" /> : <><Waveform /><audio ref={(node) => { players.current[track.id] = node; }} src={track.audio_url ?? undefined} preload="metadata" onEnded={() => setActive(null)} /></>}<MediaCommunity kind="music" itemId={track.id} /></div>
          </article>
        ))}</div>
      )}
    </section>
  );
}
