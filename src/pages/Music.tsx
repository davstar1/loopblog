import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { loadTracks, type MusicTrack } from "../lib/music";
import MediaCommunity from "../components/MediaCommunity";

const VU_BARS = 20;
const WAVEFORM_BARS = 96;
const EMPTY_LEVELS = Array.from({ length: VU_BARS }, () => 0.06);

function createWaveform(seed: string) {
  let value = Array.from(seed).reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 2166136261);
  return Array.from({ length: WAVEFORM_BARS }, (_, index) => {
    value = ((value * 1664525) + 1013904223) >>> 0;
    const noise = value / 4294967295;
    const movement = Math.abs(Math.sin(index * 0.43) * 0.34 + Math.sin(index * 0.117) * 0.2);
    const edgeFade = Math.min(1, index / 8, (WAVEFORM_BARS - 1 - index) / 8);
    return Math.round(18 + (noise * 42 + movement * 42) * (0.65 + edgeFade * 0.35));
  });
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function canAnalyzeSource(source: string | null) {
  if (!source) return false;
  try {
    const audioUrl = new URL(source, window.location.href);
    return audioUrl.origin === window.location.origin || audioUrl.hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
}

type DirectTrackPlayerProps = {
  track: MusicTrack;
  active: boolean;
  registerPlayer: (id: string, player: HTMLAudioElement | null) => void;
  activate: (id: string) => void;
  deactivate: (id: string) => void;
};

function DirectTrackPlayer({ track, active, registerPlayer, activate, deactivate }: DirectTrackPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const frequencyDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const frameRef = useRef<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [levels, setLevels] = useState(EMPTY_LEVELS);
  const waveform = useMemo(() => createWaveform(`${track.id}:${track.title}`), [track.id, track.title]);

  const setAudioRef = useCallback((node: HTMLAudioElement | null) => {
    audioRef.current = node;
    registerPlayer(track.id, node);
  }, [registerPlayer, track.id]);

  const prepareMeter = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || analyserRef.current || audioContextRef.current) return;

    try {
      if (!canAnalyzeSource(audio.currentSrc || track.audio_url)) return;

      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      const source = context.createMediaElementSource(audio);
      const analyser = context.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.72;
      source.connect(analyser);
      analyser.connect(context.destination);
      audioContextRef.current = context;
      analyserRef.current = analyser;
      frequencyDataRef.current = new Uint8Array(analyser.frequencyBinCount);
      await context.resume();
    } catch {
      analyserRef.current = null;
      frequencyDataRef.current = null;
    }
  }, [track.audio_url]);

  useEffect(() => {
    if (!active) {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      return;
    }

    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const audio = audioRef.current;
      if (audio) setCurrentTime(audio.currentTime || 0);

      const analyser = analyserRef.current;
      const frequencyData = frequencyDataRef.current;
      if (analyser && frequencyData) {
        analyser.getByteFrequencyData(frequencyData);
        const stride = Math.max(1, Math.floor(frequencyData.length / VU_BARS));
        setLevels(Array.from({ length: VU_BARS }, (_, index) => {
          let total = 0;
          let count = 0;
          for (let position = index * stride; position < Math.min(frequencyData.length, (index + 1) * stride); position += 1) {
            total += frequencyData[position];
            count += 1;
          }
          return Math.max(0.06, Math.min(1, total / Math.max(1, count) / 210));
        }));
      } else {
        const time = audio?.currentTime ?? 0;
        setLevels(Array.from({ length: VU_BARS }, (_, index) => 0.16 + Math.abs(Math.sin(time * 5.4 + index * 1.71)) * (0.32 + (index % 4) * 0.08)));
      }
      frameRef.current = requestAnimationFrame(tick);
    };

    void prepareMeter().finally(() => {
      if (!cancelled) tick();
    });
    return () => {
      cancelled = true;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [active, prepareMeter]);

  useEffect(() => () => {
    registerPlayer(track.id, null);
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    void audioContextRef.current?.close();
  }, [registerPlayer, track.id]);

  async function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    activate(track.id);
    try {
      await audio.play();
    } catch {
      setLevels(EMPTY_LEVELS);
      deactivate(track.id);
    }
  }

  function seekBy(seconds: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(Number.isFinite(audio.duration) ? audio.duration : Infinity, audio.currentTime + seconds));
    setCurrentTime(audio.currentTime);
  }

  function seekTo(value: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setCurrentTime(value);
  }

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const progressStyle = { "--music-progress": `${progress}%` } as CSSProperties;

  return (
    <div className="audioConsole">
      <div className="transportRow">
        <div className="transportControls">
          <button type="button" className="transportButton" onClick={() => seekBy(-10)} aria-label={`Go back 10 seconds in ${track.title}`}>−10</button>
          <button type="button" className="transportButton transportPlay" onClick={toggle} aria-label={`${active ? "Pause" : "Play"} ${track.title}`}>{active ? "Ⅱ" : "▶"}</button>
          <button type="button" className="transportButton" onClick={() => seekBy(10)} aria-label={`Go forward 10 seconds in ${track.title}`}>+10</button>
        </div>
        <div className="vuMeter" aria-label={active ? "Live audio level" : "Audio level idle"}>
          {levels.map((level, index) => <i key={index} style={{ transform: `scaleY(${Math.min(1, level)})` }} />)}
        </div>
        <span className={`playerStatus ${active ? "isPlaying" : ""}`}>{active ? "PLAY" : "READY"}</span>
      </div>
      <div className="progressRow">
        <time>{formatTime(currentTime)}</time>
        <div className="musicWaveform" style={progressStyle}>
          <div className="musicWaveformBars" aria-hidden="true">
            {waveform.map((height, index) => (
              <i className={(index / waveform.length) * 100 <= progress ? "played" : ""} key={index} style={{ "--wave-height": `${height}%` } as CSSProperties} />
            ))}
          </div>
          <input className="musicProgress" type="range" min="0" max={duration || 1} step="0.01" value={Math.min(currentTime, duration || 0)} onChange={(event) => seekTo(Number(event.target.value))} disabled={!duration} aria-label={`Playback position for ${track.title}`} />
        </div>
        <time>{formatTime(duration)}</time>
      </div>
      <audio ref={setAudioRef} src={track.audio_url ?? undefined} crossOrigin={canAnalyzeSource(track.audio_url) ? "anonymous" : undefined} preload="metadata" onLoadedMetadata={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)} onDurationChange={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onPlay={() => activate(track.id)} onPause={() => { setLevels(EMPTY_LEVELS); deactivate(track.id); }} onEnded={() => { setCurrentTime(0); setLevels(EMPTY_LEVELS); deactivate(track.id); }} />
    </div>
  );
}

export default function Music() {
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const players = useRef<Record<string, HTMLAudioElement | null>>({});

  useEffect(() => { loadTracks().then(setTracks).catch(() => setError("Music collection is ready for its first track.")); }, []);

  const registerPlayer = useCallback((id: string, player: HTMLAudioElement | null) => {
    players.current[id] = player;
  }, []);

  const activate = useCallback((id: string) => {
    Object.entries(players.current).forEach(([playerId, player]) => {
      if (playerId !== id) player?.pause();
    });
    setActive(id);
  }, []);

  const deactivate = useCallback((id: string) => {
    setActive((current) => current === id ? null : current);
  }, []);

  return (
    <section className="musicPage">
      <header className="musicHero"><p className="profileEyebrow">LoopBlog audio</p><h1>Music</h1><p>Original tracks, works in progress, and sounds found along the way.</p></header>
      <div className="trackHeader"><span>Recent tracks</span><span>{tracks.length} releases</span></div>
      {tracks.length === 0 ? <div className="minimalState">{error ?? "Loading tracks…"}</div> : (
        <div className="trackList">{tracks.map((track, index) => (
          <article className={`trackRow ${track.embed_url ? "embedTrack" : ""}`} key={track.id}>
            <div className="trackArt">{track.artwork_url ? <img src={track.artwork_url} alt={`${track.title} album artwork`} /> : <span>{String(index + 1).padStart(2, "0")}</span>}</div>
            <div className="trackBody">
              <div className="trackMeta"><div><span>{track.artist || "LoopBlog"}</span><h2>{track.title}</h2></div><time>{new Date(track.created_at).toLocaleDateString()}</time></div>
              {track.embed_url ? <iframe className="musicEmbed" src={track.embed_url} title={`${track.title} player`} allow="autoplay; encrypted-media" loading="lazy" sandbox="allow-scripts allow-same-origin allow-popups allow-forms" /> : <DirectTrackPlayer track={track} active={active === track.id} registerPlayer={registerPlayer} activate={activate} deactivate={deactivate} />}
              <MediaCommunity kind="music" itemId={track.id} />
            </div>
          </article>
        ))}</div>
      )}
    </section>
  );
}
