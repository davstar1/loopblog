import { supabase } from "./supabase";

export type PostStatus = "draft" | "published";

export type PostRow = {
  id: string;
  title: string;
  slug: string | null;
  excerpt: string | null;
  body_md: string | null;
  cover_path: string | null;
  status: PostStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function loadPosts() {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as PostRow[];
}

export async function getPost(id: string) {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as PostRow | null;
}

export async function addPost(input: {
  title: string;
  slug: string;
  excerpt?: string | null;
  body_md: string;
  cover_path?: string | null;
  status?: PostStatus;
}) {
  // Make sure we are logged in
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;

  const author_id = userData.user?.id;
  if (!author_id) {
    throw new Error("Not logged in. Go to #/admin and log in first.");
  }

  const status: PostStatus = input.status ?? "draft";

  const payload = {
  author_id,
  title: input.title,
  slug: input.slug,
  excerpt: input.excerpt ?? null,
  body: input.body_md,                 // ✅ matches DB column "body"
  cover_path: input.cover_path ?? null,
  status,
  published_at: status === "published" ? new Date().toISOString() : null,
};

  const { data, error } = await supabase
    .from("posts")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data as PostRow;
}
