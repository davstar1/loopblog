import { supabase } from "./supabase";

const VISITOR_KEY = "loopblog:follow-visitor";

export type FollowStatus = {
  followerCount: number;
  isFollowing: boolean;
  wantsNotifications: boolean;
};

export function getFollowVisitorId() {
  const visitorId = crypto.randomUUID();
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    localStorage.setItem(VISITOR_KEY, visitorId);
  } catch {
    // The follow still works for this visit when storage is unavailable.
  }
  return visitorId;
}

export async function loadFollowStatus(visitorId: string): Promise<FollowStatus> {
  const { data, error } = await supabase.rpc("get_follow_status", { p_visitor_id: visitorId });
  if (error) throw error;
  const status = Array.isArray(data) ? data[0] : data;
  return {
    followerCount: Number(status?.follower_count ?? 0),
    isFollowing: Boolean(status?.is_following),
    wantsNotifications: Boolean(status?.wants_notifications),
  };
}

export async function followLoopBlog(visitorId: string, wantsNotifications: boolean, email: string | null) {
  const { data, error } = await supabase.rpc("follow_loopblog", {
    p_visitor_id: visitorId,
    p_wants_notifications: wantsNotifications,
    p_email: email,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function unfollowLoopBlog(visitorId: string) {
  const { data, error } = await supabase.rpc("unfollow_loopblog", { p_visitor_id: visitorId });
  if (error) throw error;
  return Number(data ?? 0);
}
