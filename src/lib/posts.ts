import { supabase } from "../lib/supabase"; // ✅ if this file lives in src/lib, use "./supabase" instead

export type PostStatus = "draft" | "published";

export type PostRow = {
  id: string;
  title: string;
  slug: string | null;
  excerpt: string | null;

  // App uses body_md naming, but DB column is typically "body"
  body_md: string | null;

  cover_path: string | null;

  // ✅ multiple storage paths (array column in DB)
  image_paths: string[];

  status: PostStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

function normalizeRow(r: any): PostRow {
  return {
    ...r,
    body_md: (r?.body_md ?? r?.body ?? null) as string | null,
    image_paths: Array.isArray(r?.image_paths) ? r.image_paths : [],
  } as PostRow;
}

export async function loadPosts(): Promise<PostRow[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as any[];
  return rows.map(normalizeRow);
}

export async function getPost(id: string): Promise<PostRow | null> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return normalizeRow(data);
}

export async function addPost(input: {
  title: string;
  slug: string;
  excerpt?: string | null;

  // UI calls it body_md, DB column is "body"
  body_md: string;

  cover_path?: string | null;

  // ✅ accept multi-image paths
  image_paths?: string[];

  status?: PostStatus;
}): Promise<PostRow> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;

  const author_id = userData.user?.id;
  if (!author_id) throw new Error("Not logged in. Go to #/admin and log in first.");

  const status: PostStatus = input.status ?? "draft";

  const payload = {
    author_id,
    title: input.title,
    slug: input.slug,
    excerpt: input.excerpt ?? null,

    // ✅ DB column
    body: input.body_md,

    cover_path: input.cover_path ?? null,

    // ✅ array column
    image_paths: Array.isArray(input.image_paths) ? input.image_paths : [],

    status,
    published_at: status === "published" ? new Date().toISOString() : null,
  };

  const { data, error } = await supabase
    .from("posts")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;

  return normalizeRow(data);
}

