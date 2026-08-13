import { supabase } from "./supabase";

export const MUSIC_BUCKET = "loopblogmusic";
export type MusicTrack = { id: string; title: string; artist: string | null; audio_url: string | null; embed_url: string | null; artwork_url: string | null; created_at: string };

export async function loadTracks() {
  const { data, error } = await supabase.from("music_tracks").select("id,title,artist,audio_url,embed_url,artwork_url,created_at").order("created_at", { ascending: false });
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
