import { useEffect, useMemo, useState } from "react";
import {
  adminDisableFollowerNotifications,
  adminLoadFollowers,
  adminRemoveFollower,
  type ManagedFollower,
} from "../lib/follows";

type FollowerFilter = "all" | "email" | "follow";

function followerLabel(follower: ManagedFollower) {
  return follower.displayName || follower.notificationEmail || `Anonymous ${follower.visitorId.slice(0, 8)}`;
}

export default function FollowersManager() {
  const [followers, setFollowers] = useState<ManagedFollower[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FollowerFilter>("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setMessage(null);
    try {
      setFollowers(await adminLoadFollowers());
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not load followers. Run the latest follower database setup.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const notificationCount = useMemo(
    () => followers.filter((follower) => follower.wantsNotifications).length,
    [followers],
  );

  const visibleFollowers = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    return followers.filter((follower) => {
      if (filter === "email" && !follower.wantsNotifications) return false;
      if (filter === "follow" && follower.wantsNotifications) return false;
      if (!cleanQuery) return true;
      return [follower.displayName, follower.notificationEmail, follower.visitorId]
        .some((value) => value?.toLowerCase().includes(cleanQuery));
    });
  }, [filter, followers, query]);

  async function disableNotifications(follower: ManagedFollower) {
    if (!window.confirm(`Turn off email updates for ${followerLabel(follower)}? Their saved email address will be removed.`)) return;
    setBusyId(follower.visitorId);
    setMessage(null);
    try {
      await adminDisableFollowerNotifications(follower.visitorId);
      setFollowers((current) => current.map((item) => item.visitorId === follower.visitorId
        ? { ...item, wantsNotifications: false, notificationEmail: null, updatedAt: new Date().toISOString() }
        : item));
      setMessage("Email updates disabled and the saved email address was removed.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update this follower.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeFollower(follower: ManagedFollower) {
    if (!window.confirm(`Remove ${followerLabel(follower)} from the follower list? This cannot be undone.`)) return;
    setBusyId(follower.visitorId);
    setMessage(null);
    try {
      await adminRemoveFollower(follower.visitorId);
      setFollowers((current) => current.filter((item) => item.visitorId !== follower.visitorId));
      setMessage("Follower removed.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not remove this follower.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card stack adminModule followersManager">
      <div className="sectionTitle">
        <h3>Followers</h3>
        <span>{followers.length} total</span>
      </div>

      <div className="followerMetrics" aria-label="Follower summary">
        <div><b>{followers.length}</b><span>Total followers</span></div>
        <div><b>{notificationCount}</b><span>Email updates</span></div>
        <div><b>{followers.length - notificationCount}</b><span>Follow only</span></div>
      </div>

      <div className="followerToolbar">
        <input
          className="sideInput"
          type="search"
          placeholder="Search name, email, or follower ID…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="followerFilters">
          {(["all", "email", "follow"] as const).map((value) => (
            <button className={filter === value ? "active" : ""} type="button" onClick={() => setFilter(value)} key={value}>
              {value === "email" ? "Email updates" : value === "follow" ? "Follow only" : "All"}
            </button>
          ))}
        </div>
        <button className="btn ghost actionWhite" type="button" onClick={refresh} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <p className="followerPrivacy">Names are optional. Followers without a name or notification email remain anonymous and are shown by their private browser ID.</p>
      {message ? <p className="followerMessage" role="status">{message}</p> : null}

      {loading ? <p className="muted">Loading followers…</p> : visibleFollowers.length === 0 ? (
        <p className="muted">No followers match this view.</p>
      ) : (
        <div className="followerList">
          {visibleFollowers.map((follower) => {
            const busy = busyId === follower.visitorId;
            return (
              <article className="followerRow" key={follower.visitorId}>
                <div className="followerIdentity">
                  <div>
                    <b>{follower.displayName || "Anonymous follower"}</b>
                    <span className={follower.wantsNotifications ? "followerBadge email" : "followerBadge"}>
                      {follower.wantsNotifications ? "Email updates" : "Follow only"}
                    </span>
                  </div>
                  {follower.notificationEmail ? <a href={`mailto:${follower.notificationEmail}`}>{follower.notificationEmail}</a> : null}
                  <small>Joined {new Date(follower.createdAt).toLocaleString()} · ID {follower.visitorId.slice(0, 8)}</small>
                </div>
                <div className="followerActions">
                  {follower.wantsNotifications ? (
                    <button className="btn ghost actionWhite" type="button" onClick={() => disableNotifications(follower)} disabled={busy}>
                      Disable emails
                    </button>
                  ) : null}
                  <button className="btn dangerAction actionWhite" type="button" onClick={() => removeFollower(follower)} disabled={busy}>
                    {busy ? "Working…" : "Remove follower"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
