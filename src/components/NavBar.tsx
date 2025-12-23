import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 820) setOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setAuthed(!!data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      setAuthed(!!session);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <header className="navWrap">
      <div className="navInner">
        <NavLink to="/" className="brand" onClick={() => setOpen(false)}>
          LoopBlog
        </NavLink>

        <button
          className="burger"
          aria-label="Toggle navigation"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav className={`navLinks ${open ? "open" : ""}`}>
          <NavLink to="/" onClick={() => setOpen(false)} end>
            Home
          </NavLink>

          {authed && (
            <NavLink to="/write" onClick={() => setOpen(false)}>
              Write
            </NavLink>
          )}

          <NavLink to="/videos" onClick={() => setOpen(false)}>
            Video
          </NavLink>

          <NavLink to="/playlist" onClick={() => setOpen(false)}>
            Spotify
          </NavLink>

          <NavLink to="/gallery" onClick={() => setOpen(false)}>
            Gallery
          </NavLink>

          <NavLink to="/admin" onClick={() => setOpen(false)}>
            Admin
          </NavLink>

          {authed && (
            <button
              className="btn ghost"
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                setOpen(false);
              }}
              style={{ marginLeft: 8 }}
            >
              Logout
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
