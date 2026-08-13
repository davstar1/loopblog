import { useEffect, useState } from "react";
import { loadTracks, uploadAudio, type MusicTrack } from "../lib/music";
import { supabase } from "../lib/supabase";

const ALLOWED_EMBED_HOSTS = ["soundcloud.com", "w.soundcloud.com", "open.spotify.com", "bandcamp.com", "audiomack.com"];

function extractEmbedUrl(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  const match = text.match(/src=["']([^"']+)["']/i);
  const candidate = match?.[1] ?? text;
  try {
    const url = new URL(candidate.replace(/&amp;/g, "&"));
    if (url.protocol !== "https:" || !ALLOWED_EMBED_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) return null;
    return url.toString();
  } catch { return null; }
}

export default function MusicManager() {
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [url, setUrl] = useState("");
  const [embedCode, setEmbedCode] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const refresh = () => loadTracks().then(setTracks).catch((error: Error) => setMsg(error.message));

  useEffect(() => { void refresh(); }, []);

  async function add() {
    const embedUrl = extractEmbedUrl(embedCode);
    if (!title.trim() || (!url.trim() && !file && !embedCode.trim())) return setMsg("Add a title and an audio file, direct URL, or embed code.");
    if (embedCode.trim() && !embedUrl) return setMsg("Use SoundCloud, Spotify, Bandcamp, or Audiomack embed code.");
    setBusy(true); setMsg(null);
    try {
      const audioUrl = file ? await uploadAudio(file) : url.trim() || null;
      const { error } = await supabase.from("music_tracks").insert({ title: title.trim(), artist: artist.trim() || null, audio_url: audioUrl, embed_url: embedUrl });
      if (error) throw error;
      setTitle(""); setArtist(""); setUrl(""); setEmbedCode(""); setFile(null); setMsg("Track added ✓"); await refresh();
    } catch (error: unknown) { setMsg(error instanceof Error ? error.message : "Could not add track."); } finally { setBusy(false); }
  }

  async function remove(id: string) {
    const { error } = await supabase.from("music_tracks").delete().eq("id", id);
    if (error) setMsg(error.message); else await refresh();
  }

  return (
    <div className="card stack adminModule">
      <div className="sectionTitle"><h3>Music</h3><span>{tracks.length} tracks</span></div>
      <div className="adminFields">
        <input className="sideInput" placeholder="Track title" value={title} onChange={(event) => setTitle(event.target.value)} />
        <input className="sideInput" placeholder="Artist (optional)" value={artist} onChange={(event) => setArtist(event.target.value)} />
        <input className="sideInput" placeholder="Direct audio URL" value={url} onChange={(event) => setUrl(event.target.value)} />
        <label className="fileField">or upload audio<input type="file" accept="audio/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
        <label className="embedField"><span>Or paste embed code</span><textarea placeholder={'<iframe src="https://w.soundcloud.com/player/…"></iframe>'} value={embedCode} onChange={(event) => setEmbedCode(event.target.value)} /><small>Supports SoundCloud, Spotify, Bandcamp, and Audiomack.</small></label>
        <button className="btn" type="button" onClick={add} disabled={busy}>{busy ? "Adding…" : "Add track"}</button>
      </div>
      {msg && <p className="muted">{msg}</p>}
      <div className="adminTrackList">{tracks.map((track) => <div key={track.id}><span><b>{track.title}</b><small>{track.artist || "LoopBlog"} · {track.embed_url ? "embed" : "audio"}</small></span><button className="btn ghost actionWhite" onClick={() => remove(track.id)}>Remove</button></div>)}</div>
    </div>
  );
}
