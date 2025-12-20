import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";

export default function Navbar() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 820) setOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
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
          <NavLink to="/write" onClick={() => setOpen(false)}>
            Write
          </NavLink>
          <NavLink to="/videos" onClick={() => setOpen(false)}>
            YouTube
          </NavLink>
          <NavLink to="/playlist" onClick={() => setOpen(false)}>
            Spotify
          </NavLink>
          <NavLink to="/gallery" onClick={() => false}>
            Gallery
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
