import { supabase } from "./supabase";
import { uploadBlogImage } from "./uploadImage";

export const FALLBACK_PROFILE_IMAGE = "/loopdot.png";

export async function loadProfileImage(): Promise<string> {
  const { data, error } = await supabase
    .from("site_profile")
    .select("profile_image_url")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data?.profile_image_url) return FALLBACK_PROFILE_IMAGE;
  return data.profile_image_url as string;
}

export async function saveProfileImage(file: File): Promise<string> {
  const { publicUrl } = await uploadBlogImage(file, "profile");
  const { error } = await supabase
    .from("site_profile")
    .upsert({ id: 1, profile_image_url: publicUrl, updated_at: new Date().toISOString() });
  if (error) throw error;
  return publicUrl;
}
