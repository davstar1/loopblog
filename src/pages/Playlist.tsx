const SPOTIFY_PLAYLIST_ID = "37i9dQZF1DXcBWIGoYBM5M";

export default function Playlist() {
  return (
    <section className="stack">
      <div className="sectionTitle">
        <h2>Spotify Playlist</h2>
        <span className="muted">Embedded player</span>
      </div>

      <div className="card">
        <div className="ratio spotify">
          <iframe
            title="Spotify Playlist"
            style={{ borderRadius: 16, width: "100%", height: "100%" }}
            src={`https://open.spotify.com/embed/playlist/${SPOTIFY_PLAYLIST_ID}?utm_source=generator`}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          />
        </div>
      </div>
    </section>
  );
}
