import { supabase } from "./supabase";

const VISITOR_KEY = "loopblog:follow-visitor";

export type FollowStatus = {
  followerCount: number;
  isFollowing: boolean;
  wantsNotifications: boolean;
};

export type ManagedFollower = {
  visitorId: string;
  displayName: string | null;
  wantsNotifications: boolean;
  notificationEmail: string | null;
  createdAt: string;
  updatedAt: string;
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

export async function followLoopBlog(visitorId: string, wantsNotifications: boolean, email: string | null, displayName: string | null) {
  const { data, error } = await supabase.rpc("follow_loopblog", {
    p_visitor_id: visitorId,
    p_wants_notifications: wantsNotifications,
    p_email: email,
    p_display_name: displayName,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function unfollowLoopBlog(visitorId: string) {
  const { data, error } = await supabase.rpc("unfollow_loopblog", { p_visitor_id: visitorId });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function adminLoadFollowers(): Promise<ManagedFollower[]> {
  const { data, error } = await supabase.rpc("admin_list_followers");
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => ({
    visitorId: String(row.visitor_id),
    displayName: typeof row.display_name === "string" ? row.display_name : null,
    wantsNotifications: Boolean(row.wants_notifications),
    notificationEmail: typeof row.notification_email === "string" ? row.notification_email : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));
}

export async function adminDisableFollowerNotifications(visitorId: string) {
  const { data, error } = await supabase.rpc("admin_disable_follower_notifications", { p_visitor_id: visitorId });
  if (error) throw error;
  return Boolean(data);
}

export async function adminRemoveFollower(visitorId: string) {
  const { data, error } = await supabase.rpc("admin_remove_follower", { p_visitor_id: visitorId });
  if (error) throw error;
  return Boolean(data);
}
