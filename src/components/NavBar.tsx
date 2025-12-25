import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type AuthState = {
  loading: boolean;
  authed: boolean;
  email?: string | null;
};

export default function Navbar() {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [auth, setAuth] = useState<AuthState>({ loading: true, authed: false });

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 820) setOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    let alive = true;

    async function boot() {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!alive) return;

      setAuth({
        loading: false,
        authed: !!session,
        email: session?.user?.email ?? null,
      });
    }

    boot();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuth({
        loading: false,
        authed: !!session,
        email: session?.user?.email ?? null,
      });
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function onLogout() {
    await supabase.auth.signOut();
    setOpen(false);
    nav("/admin");
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `catLink ${isActive ? "active" : ""}`;

  return (
    <header className="newsNav">
      <div className="newsNavTop">
        <NavLink to="/" className="newsBrand" onClick={() => setOpen(false)}>
          <span className="dot" aria-hidden="true" />
          <span>LoopBlog</span>
        </NavLink>

        <div className="newsNavActions">
          {!auth.loading && auth.authed ? (
            <>
              <span className="navUser muted">
                {auth.email ? auth.email : "Logged in"}
              </span>
              <button className="navBtn ghost" onClick={onLogout} type="button">
                Log out
              </button>
            </>
          ) : (
            <NavLink
              className="navBtn"
              to="/admin"
              onClick={() => setOpen(false)}
            >
              Log in
            </NavLink>
          )}

          <button
            className="burger"
            aria-label="Toggle navigation"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            type="button"
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      <nav
        className={`newsNavCats ${open ? "open" : ""}`}
        aria-label="Sections"
      >
        <NavLink
          to="/"
          className={linkClass}
          onClick={() => setOpen(false)}
          end
        >
          Home
        </NavLink>

        {/* ✅ hide when logged out */}
        {auth.authed && (
          <NavLink
            to="/write"
            className={linkClass}
            onClick={() => setOpen(false)}
          >
            Write
          </NavLink>
        )}

        <NavLink
          to="/playlist"
          className={linkClass}
          onClick={() => setOpen(false)}
        >
          Spotify
        </NavLink>

        <NavLink
          to="/gallery"
          className={linkClass}
          onClick={() => setOpen(false)}
        >
          Gallery
        </NavLink>

        <NavLink
          to="/admin"
          className={linkClass}
          onClick={() => setOpen(false)}
        >
          Admin
        </NavLink>
      </nav>
    </header>
  );
}
