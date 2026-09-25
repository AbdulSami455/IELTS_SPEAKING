import { Link, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { logout } from "../../lib/api";
import { useUser } from "../../features/auth/useUser";
import { Brand } from "./Brand";
import { Icon, type IconName } from "../ui/Icon";

async function signOut() {
  await logout();
  window.location.href = "/login";
}

const NAV: { to: string; label: string; icon: IconName; match: (path: string) => boolean }[] = [
  { to: "/", label: "Overview", icon: "home", match: (path) => path === "/" },
  { to: "/progress", label: "My progress", icon: "chart", match: (path) => path.startsWith("/progress") },
  { to: "/leaderboard", label: "Leaderboard", icon: "trophy", match: (path) => path.startsWith("/leaderboard") },
];

interface AppShellProps {
  children: ReactNode;
  // "focus" hides navigation so nothing competes with a live exam.
  variant?: "default" | "focus";
  focusAction?: ReactNode;
}

export function AppShell({ children, variant = "default", focusAction }: AppShellProps) {
  const location = useLocation();
  const { user } = useUser();
  const focus = variant === "focus";
  const name = user?.displayName?.trim() || user?.email || "";
  const initial = name.charAt(0).toUpperCase() || "?";

  const links = NAV.map((item) => {
    const active = item.match(location.pathname);
    return (
      <Link
        key={item.to}
        className={`nav-link${active ? " active" : ""}`}
        aria-current={active ? "page" : undefined}
        to={item.to}
      >
        <Icon name={item.icon} size={18} />
        <span>{item.label}</span>
      </Link>
    );
  });

  return (
    <div className={`app${focus ? " app--focus" : ""}`}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          {focus ? (
            <Brand />
          ) : (
            <Link to="/" className="brand-link" aria-label="IELTS Speaking by Hinterbuild home">
              <Brand />
            </Link>
          )}
          {!focus && (
            <nav className="nav nav--top" aria-label="Primary">
              {links}
            </nav>
          )}
          <div className="topbar-end">
            {focus ? (
              focusAction
            ) : (
              <>
                {name && (
                  <span className="account-chip" title={user?.email ?? name}>
                    <span className="avatar" aria-hidden="true">
                      {initial}
                    </span>
                    <span className="account-name">{name.split(" ")[0]}</span>
                  </span>
                )}
                <button type="button" className="btn btn--ghost btn--sm" onClick={signOut}>
                  <Icon name="logout" size={16} />
                  <span className="signout-label">Sign out</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>
      <main id="main-content" className="shell" tabIndex={-1}>
        {children}
      </main>
      {!focus && (
        <>
          <footer className="app-footer">
            <span>IELTS Speaking by Hinterbuild · Make yourself heard.</span>
            <span>Practice estimates, not official IELTS results.</span>
          </footer>
          <nav className="nav nav--tabs" aria-label="Primary">
            {links}
          </nav>
        </>
      )}
    </div>
  );
}
