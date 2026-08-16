import { useEffect, useState } from "react";
import { followLoopBlog, getFollowVisitorId, loadFollowStatus, unfollowLoopBlog } from "../lib/follows";

type FollowChoice = "follow" | "email";

export default function FollowButton() {
  const [visitorId] = useState(getFollowVisitorId);
  const [followerCount, setFollowerCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [wantsNotifications, setWantsNotifications] = useState(false);
  const [choice, setChoice] = useState<FollowChoice>("follow");
  const [email, setEmail] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadFollowStatus(visitorId)
      .then((status) => {
        setFollowerCount(status.followerCount);
        setIsFollowing(status.isFollowing);
        setWantsNotifications(status.wantsNotifications);
        setChoice(status.wantsNotifications ? "email" : "follow");
      })
      .catch(() => setMessage("Following is temporarily unavailable."))
      .finally(() => setLoading(false));
  }, [visitorId]);

  async function saveFollow() {
    const cleanEmail = email.trim();
    if (choice === "email" && !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setMessage("Enter a valid email address.");
      return;
    }
    setBusy(true); setMessage(null);
    try {
      const count = await followLoopBlog(visitorId, choice === "email", choice === "email" ? cleanEmail : null);
      setFollowerCount(count);
      setIsFollowing(true);
      setWantsNotifications(choice === "email");
      setPanelOpen(false);
      setEmail("");
      setMessage(choice === "email" ? "Following with email updates ✓" : "You’re following LoopBlog ✓");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not follow LoopBlog.");
    } finally {
      setBusy(false);
    }
  }

  async function unfollow() {
    setBusy(true); setMessage(null);
    try {
      const count = await unfollowLoopBlog(visitorId);
      setFollowerCount(count);
      setIsFollowing(false);
      setWantsNotifications(false);
      setChoice("follow");
      setEmail("");
      setPanelOpen(false);
      setMessage("You’ve unfollowed LoopBlog.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not unfollow LoopBlog.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="followWidget">
      <div className="followSummary">
        <button className={`followButton ${isFollowing ? "following" : ""}`} type="button" disabled={loading || busy} onClick={() => { setMessage(null); setPanelOpen((open) => !open); }}>
          {loading ? "Loading…" : isFollowing ? "Following ✓" : "Follow LoopBlog"}
        </button>
        <span><b>{followerCount.toLocaleString()}</b> {followerCount === 1 ? "follower" : "followers"}</span>
        {wantsNotifications ? <span className="notificationStatus">Email updates on</span> : null}
      </div>

      {panelOpen ? (
        <div className="followPanel">
          <div className="followPanelTitle"><div><b>{isFollowing ? "Manage following" : "Follow LoopBlog"}</b><small>Choose how you want to stay in the loop.</small></div><button type="button" onClick={() => setPanelOpen(false)} aria-label="Close follow options">×</button></div>
          <label className={`followChoice ${choice === "follow" ? "selected" : ""}`}>
            <input type="radio" name="follow-choice" checked={choice === "follow"} onChange={() => setChoice("follow")} />
            <span><b>Follow only</b><small>Count me as a follower without notifications.</small></span>
          </label>
          <label className={`followChoice ${choice === "email" ? "selected" : ""}`}>
            <input type="radio" name="follow-choice" checked={choice === "email"} onChange={() => setChoice("email")} />
            <span><b>Follow + email updates</b><small>Save my preference for new posts, videos, and music.</small></span>
          </label>
          {choice === "email" ? <label className="followEmail"><span>Email address</span><input type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} /></label> : null}
          <div className="followPanelActions">
            <button className="followSave" type="button" disabled={busy} onClick={saveFollow}>{busy ? "Saving…" : isFollowing ? "Save preference" : "Follow"}</button>
            {isFollowing ? <button className="followUnfollow" type="button" disabled={busy} onClick={unfollow}>Unfollow</button> : null}
          </div>
          <small className="followPrivacy">Your email stays private and is only saved when you choose email updates.</small>
        </div>
      ) : null}
      {message ? <small className="followMessage" role="status">{message}</small> : null}
    </div>
  );
}
