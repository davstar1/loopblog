import { supabase } from "./supabase";

export async function uploadBlogImage(file: File, folder = "covers") {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = ext.replace(/[^a-z0-9]/g, "");
  const fileName = `${crypto.randomUUID()}.${safeExt}`;
  const path = `${folder}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("loopblogimages")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "image/jpeg",
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("blog-images").getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}
