import { supabase } from "./supabase";

export const MUSIC_BUCKET = "loopblogmusic";
export type MusicTrack = { id: string; title: string; artist: string | null; audio_url: string | null; embed_url: string | null; artwork_url: string | null; sort_order: number | null; created_at: string };

export async function loadTracks() {
  const { data, error } = await supabase.from("music_tracks").select("id,title,artist,audio_url,embed_url,artwork_url,sort_order,created_at").order("sort_order", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MusicTrack[];
}

export async function uploadAudio(file: File) {
  const ext = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "mp3";
  const path = `tracks/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(MUSIC_BUCKET).upload(path, file, { contentType: file.type || "audio/mpeg", upsert: false });
  if (error) throw error;
  return supabase.storage.from(MUSIC_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function uploadArtwork(file: File) {
  const ext = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "jpg";
  const path = `artwork/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(MUSIC_BUCKET).upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from(MUSIC_BUCKET).getPublicUrl(path).data.publicUrl;
}

function storagePath(publicUrl: string | null) {
  if (!publicUrl) return null;
  try {
    const url = new URL(publicUrl);
    const marker = `/storage/v1/object/public/${MUSIC_BUCKET}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}

export async function deleteUploadedMusicFiles(urls: Array<string | null>) {
  const paths = urls.map(storagePath).filter((path): path is string => Boolean(path));
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(MUSIC_BUCKET).remove(paths);
  if (error) throw error;
}
