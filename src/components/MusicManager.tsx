import { useEffect, useState } from "react";
import { deleteUploadedMusicFiles, loadTracks, uploadArtwork, uploadAudio, type MusicTrack } from "../lib/music";
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
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [trackArtworkFiles, setTrackArtworkFiles] = useState<Record<string, File | undefined>>({});
  const [busyTrackId, setBusyTrackId] = useState<string | null>(null);
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
      const artworkUrl = artworkFile ? await uploadArtwork(artworkFile) : null;
      const { error } = await supabase.from("music_tracks").insert({ title: title.trim(), artist: artist.trim() || null, audio_url: audioUrl, embed_url: embedUrl, artwork_url: artworkUrl });
      if (error) throw error;
      setTitle(""); setArtist(""); setUrl(""); setEmbedCode(""); setFile(null); setArtworkFile(null); setMsg("Track added ✓"); await refresh();
    } catch (error: unknown) { setMsg(error instanceof Error ? error.message : "Could not add track."); } finally { setBusy(false); }
  }

  async function saveArtwork(track: MusicTrack) {
    const artwork = trackArtworkFiles[track.id];
    if (!artwork) return;
    setBusyTrackId(track.id); setMsg(null);
    let artworkUrl: string | null = null;
    try {
      artworkUrl = await uploadArtwork(artwork);
      const { error } = await supabase.from("music_tracks").update({ artwork_url: artworkUrl }).eq("id", track.id).select("id").single();
      if (error) throw error;
      let cleanupFailed = false;
      if (track.artwork_url) {
        try { await deleteUploadedMusicFiles([track.artwork_url]); }
        catch { cleanupFailed = true; }
      }
      setTrackArtworkFiles((current) => {
        const next = { ...current };
        delete next[track.id];
        return next;
      });
      setMsg(cleanupFailed ? `Artwork updated for ${track.title}, but the old image could not be cleaned up from storage.` : `Artwork updated for ${track.title} ✓`);
      await refresh();
    } catch (error: unknown) {
      if (artworkUrl && artworkUrl !== track.artwork_url) await deleteUploadedMusicFiles([artworkUrl]).catch(() => undefined);
      setMsg(error instanceof Error ? error.message : "Could not update artwork.");
    } finally {
      setBusyTrackId(null);
    }
  }

  async function remove(track: MusicTrack) {
    if (!window.confirm(`Delete “${track.title}” from LoopBlog? This permanently removes its uploaded audio and album artwork.`)) return;
    setBusyTrackId(track.id); setMsg(null);
    try {
      const { error } = await supabase.from("music_tracks").delete().eq("id", track.id);
      if (error) throw error;
      try {
        await deleteUploadedMusicFiles([track.audio_url, track.artwork_url]);
        setMsg(`${track.title} was permanently deleted ✓`);
      } catch {
        setMsg(`${track.title} was removed from the site, but its uploaded files could not be cleaned up from storage.`);
      }
      await refresh();
    } catch (error: unknown) {
      setMsg(error instanceof Error ? error.message : "Could not delete track.");
    } finally {
      setBusyTrackId(null);
    }
  }

  return (
    <div className="card stack adminModule">
      <div className="sectionTitle"><h3>Music</h3><span>{tracks.length} tracks</span></div>
      <div className="adminFields">
        <input className="sideInput" placeholder="Track title" value={title} onChange={(event) => setTitle(event.target.value)} />
        <input className="sideInput" placeholder="Artist (optional)" value={artist} onChange={(event) => setArtist(event.target.value)} />
        <input className="sideInput" placeholder="Direct audio URL" value={url} onChange={(event) => setUrl(event.target.value)} />
        <label className="fileField">or upload audio<input type="file" accept="audio/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
        <label className="fileField artworkField">album artwork (square image recommended)<input type="file" accept="image/*" onChange={(event) => setArtworkFile(event.target.files?.[0] ?? null)} />{artworkFile ? <small>{artworkFile.name}</small> : null}</label>
        <label className="embedField"><span>Or paste embed code</span><textarea placeholder={'<iframe src="https://w.soundcloud.com/player/…"></iframe>'} value={embedCode} onChange={(event) => setEmbedCode(event.target.value)} /><small>Supports SoundCloud, Spotify, Bandcamp, and Audiomack.</small></label>
        <button className="btn actionWhite" type="button" onClick={add} disabled={busy}>{busy ? "Adding…" : "Add track"}</button>
      </div>
      {msg && <p className="muted">{msg}</p>}
      <div className="adminTrackList">
        {tracks.map((track) => (
          <div className="adminTrackItem" key={track.id}>
            <div className="adminTrackArtwork">{track.artwork_url ? <img src={track.artwork_url} alt={`${track.title} album artwork`} /> : <span>♪</span>}</div>
            <span className="adminTrackInfo">
              <b>{track.title}</b>
              <small>{track.artist || "LoopBlog"} · {track.embed_url ? "embed" : "audio"}</small>
              {trackArtworkFiles[track.id] ? <small className="selectedArtworkName">Selected: {trackArtworkFiles[track.id]?.name}</small> : null}
            </span>
            <div className="adminTrackActions">
              <label className={`btn ghost actionWhite artworkPicker ${busyTrackId === track.id ? "disabled" : ""}`}>
                {track.artwork_url ? "Replace artwork" : "Add artwork"}
                <input type="file" accept="image/*" disabled={busyTrackId === track.id} onChange={(event) => setTrackArtworkFiles((current) => ({ ...current, [track.id]: event.target.files?.[0] }))} />
              </label>
              {trackArtworkFiles[track.id] ? <button className="btn actionWhite" type="button" disabled={busyTrackId === track.id} onClick={() => saveArtwork(track)}>{busyTrackId === track.id ? "Saving…" : "Save artwork"}</button> : null}
              <button className="btn dangerAction actionWhite" type="button" disabled={busyTrackId === track.id} onClick={() => remove(track)}>Delete track</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
