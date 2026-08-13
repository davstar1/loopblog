import { useEffect, useState } from "react";
import { loadProfileImage, saveProfileImage } from "../lib/profile";

export default function ProfileManager() {
  const [image, setImage] = useState("/loopdot.png");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => { void loadProfileImage().then(setImage); }, []);

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
      {message && <p className="muted">{message}</p>}
    </div>
  );
}
