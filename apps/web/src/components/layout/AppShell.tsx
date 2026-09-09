import { Link, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { logout } from "../../lib/api";
import { Icon } from "../ui/Icon";

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
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand">
            <img className="brand-mark" src="/hinterbuild-logo.svg" alt="" width="40" height="40" />
            <span>
              IELTS Speaking<span className="brand-subtitle">by Hinterbuild</span>
            </span>
          </Link>
          <nav className="nav" aria-label="Primary">
            <Link
              className={`nav-link${studioActive ? " active" : ""}`}
              aria-current={studioActive ? "page" : undefined}
              to="/"
            >
              <Icon name="home" size={17} /> Overview
            </Link>
            <Link
              className={`nav-link${progressActive ? " active" : ""}`}
              aria-current={progressActive ? "page" : undefined}
              to="/progress"
            >
              <Icon name="chart" size={17} /> My progress
            </Link>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={signOut}
            >
              Sign out
            </button>
          </nav>
        </div>
      </header>
      <main id="main-content" className="shell">
        {children}
      </main>
      <footer className="app-footer">
        <span>IELTS Speaking by Hinterbuild · Make yourself heard.</span>
        <span>Practice estimates, not official IELTS results.</span>
      </footer>
    </>
  );
}
