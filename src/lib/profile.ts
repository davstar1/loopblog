import { supabase } from "./supabase";
import { uploadBlogImage } from "./uploadImage";

export const FALLBACK_PROFILE_IMAGE = "/loopdot.png";

export type SiteProfile = { profileImage: string; bannerImage: string | null };

export async function loadSiteProfile(): Promise<SiteProfile> {
  const { data } = await supabase.from("site_profile").select("profile_image_url,banner_image_url").eq("id", 1).maybeSingle();
  return { profileImage: (data?.profile_image_url as string | null) || FALLBACK_PROFILE_IMAGE, bannerImage: (data?.banner_image_url as string | null) || null };
}

export async function loadProfileImage(): Promise<string> {
  return (await loadSiteProfile()).profileImage;
}

export async function saveBannerImage(file: File): Promise<string> {
  const { publicUrl } = await uploadBlogImage(file, "banners");
  const { error } = await supabase.from("site_profile").upsert({ id: 1, banner_image_url: publicUrl, updated_at: new Date().toISOString() });
  if (error) throw error;
  return publicUrl;
}

export async function removeBannerImage() {
  const { error } = await supabase.from("site_profile").update({ banner_image_url: null, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) throw error;
}

export async function saveProfileImage(file: File): Promise<string> {
  const { publicUrl } = await uploadBlogImage(file, "profile");
  const { error } = await supabase
    .from("site_profile")
    .upsert({ id: 1, profile_image_url: publicUrl, updated_at: new Date().toISOString() });
  if (error) throw error;
  return publicUrl;
}
