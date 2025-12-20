import type { BlogPost } from "./types";

const KEY = "loopblog.posts.v1";

export function loadPosts(): BlogPost[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BlogPost[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePosts(posts: BlogPost[]) {
  localStorage.setItem(KEY, JSON.stringify(posts));
}

export function addPost(post: BlogPost) {
  const posts = loadPosts();
  posts.unshift(post);
  savePosts(posts);
}

export function getPost(id: string): BlogPost | undefined {
  return loadPosts().find((p) => p.id === id);
}
