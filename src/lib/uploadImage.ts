import { supabase } from "./supabase";

const BUCKET = "loopblogimages";

export async function uploadBlogImage(file: File, folder = "covers") {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = ext.replace(/[^a-z0-9]/g, "") || "jpg";

  const fileName = `${crypto.randomUUID()}.${safeExt}`;
  const path = `${folder}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "image/jpeg",
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}
