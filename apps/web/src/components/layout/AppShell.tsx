import { Link, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { logout } from "../../lib/api";

async function signOut() {
  await logout();
  window.location.href = "/login";
}

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const studioActive = location.pathname === "/";
  const progressActive = location.pathname.startsWith("/progress");

  return (
    <>
      <div className="announce" role="note">
        Estimated practice scores only — not an official IELTS result.
      </div>
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand">
            Atelier Speaking
            <span className="brand-dot" aria-hidden="true" />
          </Link>
          <nav className="nav" aria-label="Primary">
            <Link className={`nav-link${studioActive ? " active" : ""}`} to="/">
              Studio
            </Link>
            <Link className={`nav-link${progressActive ? " active" : ""}`} to="/progress">
              Progress
            </Link>
            <button type="button" className="btn btn--ghost btn--sm" onClick={signOut}>
              Sign out
            </button>
          </nav>
        </div>
      </header>
      <div className="shell">{children}</div>
    </>
  );
}
