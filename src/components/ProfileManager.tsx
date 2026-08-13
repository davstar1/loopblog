import { useEffect, useState } from "react";
import { loadSiteProfile, removeBannerImage, saveBannerImage, saveProfileImage } from "../lib/profile";

export default function ProfileManager() {
  const [image, setImage] = useState("/loopdot.png");
  const [file, setFile] = useState<File | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => { void loadSiteProfile().then((profile) => { setImage(profile.profileImage); setBanner(profile.bannerImage); }); }, []);

  async function upload() {
    if (!file) return setMessage("Choose a photo first.");
    setBusy(true); setMessage(null);
    try {
      const url = await saveProfileImage(file);
      setImage(url); setFile(null); setMessage("Profile photo updated ✓");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not update the profile photo.");
    } finally { setBusy(false); }
  }

  async function uploadBanner() {
    if (!bannerFile) return setMessage("Choose a banner image first.");
    setBusy(true); setMessage(null);
    try { const url = await saveBannerImage(bannerFile); setBanner(url); setBannerFile(null); setMessage("Video banner updated ✓"); }
    catch (error: unknown) { setMessage(error instanceof Error ? error.message : "Could not update the banner."); }
    finally { setBusy(false); }
  }

  async function removeBanner() {
    setBusy(true); setMessage(null);
    try { await removeBannerImage(); setBanner(null); setMessage("Video banner removed."); }
    catch (error: unknown) { setMessage(error instanceof Error ? error.message : "Could not remove the banner."); }
    finally { setBusy(false); }
  }

  return (
    <div className="card stack adminModule">
      <div className="sectionTitle"><h3>Profile photo</h3><span>Videos page</span></div>
      <div className="profileAdminRow">
        <div className="profileRing profileRingSmall"><img src={image} alt="Current LoopBlog profile" /></div>
        <div className="profileUploadControls">
          <input type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          <button className="btn" type="button" onClick={upload} disabled={busy}>{busy ? "Uploading…" : "Upload photo"}</button>
          <small>Square photos work best. The gradient ring is added automatically.</small>
        </div>
      </div>
      <div className="bannerAdmin">
        <div className="bannerPreview">{banner ? <img src={banner} alt="Current Videos page banner" /> : <span>No banner yet</span>}</div>
        <div className="profileUploadControls">
          <input type="file" accept="image/*" onChange={(event) => setBannerFile(event.target.files?.[0] ?? null)} />
          <div className="row"><button className="btn" type="button" onClick={uploadBanner} disabled={busy}>{banner ? "Replace banner" : "Upload banner"}</button>{banner && <button className="btn ghost actionWhite" type="button" onClick={removeBanner} disabled={busy}>Remove banner</button>}</div>
          <small>A wide image works best. You can replace or remove it anytime.</small>
        </div>
      </div>
      {message && <p className="muted">{message}</p>}
    </div>
  );
}
