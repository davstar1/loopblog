import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { User } from "@supabase/supabase-js";

export default function Admin() {
  const nav = useNavigate();
  const location = useLocation();

  const from =
    (location.state as any)?.from &&
    typeof (location.state as any).from === "string"
      ? (location.state as any).from
      : "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      setUser(data.user ?? null);
      setChecking(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      setUser(session?.user ?? null);
      setChecking(false);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    setBusy(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg("Logged in!");
    nav(from, { replace: true }); // ✅ go back to where you came from (e.g. /write)
  }

  async function logout() {
    setBusy(true);
    await supabase.auth.signOut();
    setBusy(false);
    setMsg("Logged out.");
    setUser(null);
  }

  if (checking) {
    return (
      <section className="stack">
        <h1>Admin</h1>
        <div className="card">Checking session…</div>
      </section>
    );
  }

  return (
    <section className="stack">
      <h1>Admin</h1>

      {user ? (
        <div className="card stack" style={{ maxWidth: 520 }}>
          <div className="muted">You’re logged in as:</div>
          <div style={{ fontWeight: 700 }}>{user.email}</div>

          <div className="row">
            <button className="btn" type="button" onClick={() => nav("/write")}>
              Go to Write
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={logout}
              disabled={busy}
            >
              {busy ? "Signing out…" : "Log out"}
            </button>
          </div>

          {msg && <div className="muted">{msg}</div>}
        </div>
      ) : (
        <form className="card stack" style={{ maxWidth: 520 }} onSubmit={login}>
          <label className="field">
            <span>Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@email.com"
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </label>

          <div className="row">
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Logging in…" : "Log in"}
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={() => nav("/")}
            >
              Cancel
            </button>
          </div>

          {msg && <div className="error">{msg}</div>}
        </form>
      )}
    </section>
  );
}
