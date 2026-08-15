import { useEffect, useState, type DragEvent } from "react";
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
  const [draggedTrackId, setDraggedTrackId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [orderBusy, setOrderBusy] = useState(false);
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
      const { error } = await supabase.from("music_tracks").insert({ title: title.trim(), artist: artist.trim() || null, audio_url: audioUrl, embed_url: embedUrl, artwork_url: artworkUrl, sort_order: tracks.length });
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

  async function persistOrder(nextTracks: MusicTrack[]) {
    setTracks(nextTracks);
    setOrderBusy(true); setMsg(null);
    try {
      const results = await Promise.all(nextTracks.map((track, index) => supabase.from("music_tracks").update({ sort_order: index }).eq("id", track.id).select("id").single()));
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
      setMsg("Track order saved ✓");
    } catch (error: unknown) {
      setMsg(error instanceof Error ? error.message : "Could not save track order.");
      await refresh();
    } finally {
      setOrderBusy(false);
    }
  }

  function moveTrack(trackId: string, direction: -1 | 1) {
    if (orderBusy) return;
    const fromIndex = tracks.findIndex((track) => track.id === trackId);
    const toIndex = fromIndex + direction;
    if (fromIndex < 0 || toIndex < 0 || toIndex >= tracks.length) return;
    const nextTracks = [...tracks];
    const [movedTrack] = nextTracks.splice(fromIndex, 1);
    nextTracks.splice(toIndex, 0, movedTrack);
    void persistOrder(nextTracks);
  }

  function startDragging(event: DragEvent<HTMLButtonElement>, trackId: string) {
    if (orderBusy) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", trackId);
    setDraggedTrackId(trackId);
  }

  function dropTrack(event: DragEvent<HTMLDivElement>, targetId: string) {
    event.preventDefault();
    const sourceId = draggedTrackId || event.dataTransfer.getData("text/plain");
    setDraggedTrackId(null); setDropTargetId(null);
    if (!sourceId || sourceId === targetId || orderBusy) return;
    const fromIndex = tracks.findIndex((track) => track.id === sourceId);
    const targetIndex = tracks.findIndex((track) => track.id === targetId);
    if (fromIndex < 0 || targetIndex < 0) return;
    const nextTracks = [...tracks];
    const [movedTrack] = nextTracks.splice(fromIndex, 1);
    nextTracks.splice(targetIndex, 0, movedTrack);
    void persistOrder(nextTracks);
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
      <p className="adminOrderHint">Drag tracks into a new order, or use the arrow buttons on touch screens. Changes save automatically.</p>
      <div className="adminTrackList">
        {tracks.map((track, index) => (
          <div className={`adminTrackItem ${draggedTrackId === track.id ? "dragging" : ""} ${dropTargetId === track.id ? "dropTarget" : ""}`} key={track.id} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropTargetId(track.id); }} onDrop={(event) => dropTrack(event, track.id)}>
            <div className="trackOrderControls">
              <button className="dragHandle" type="button" draggable={!orderBusy} disabled={orderBusy} aria-label={`Drag ${track.title} to reorder`} aria-grabbed={draggedTrackId === track.id} onDragStart={(event) => startDragging(event, track.id)} onDragEnd={() => { setDraggedTrackId(null); setDropTargetId(null); }}>⠿</button>
              <span>
                <button type="button" disabled={orderBusy || index === 0} onClick={() => moveTrack(track.id, -1)} aria-label={`Move ${track.title} up`}>↑</button>
                <button type="button" disabled={orderBusy || index === tracks.length - 1} onClick={() => moveTrack(track.id, 1)} aria-label={`Move ${track.title} down`}>↓</button>
              </span>
            </div>
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
