import { Link, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { ChartNoAxesCombined, Home, LogOut, Trophy, type LucideIcon } from "lucide-react";
import { logout } from "../../lib/api";
import { useUser } from "../../features/auth/useUser";
import { Brand } from "./Brand";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

async function signOut() {
  await logout();
  window.location.href = "/login";
}

const NAV: { to: string; label: string; icon: LucideIcon; match: (path: string) => boolean }[] = [
  { to: "/", label: "Overview", icon: Home, match: (path) => path === "/" },
  { to: "/progress", label: "My progress", icon: ChartNoAxesCombined, match: (path) => path.startsWith("/progress") },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy, match: (path) => path.startsWith("/leaderboard") },
];

interface AppShellProps {
  children: ReactNode;
  /** "focus" hides navigation so nothing competes with a live exam. */
  variant?: "default" | "focus";
  focusAction?: ReactNode;
}

export function AppShell({ children, variant = "default", focusAction }: AppShellProps) {
  const location = useLocation();
  const { user } = useUser();
  const focus = variant === "focus";
  const name = user?.displayName?.trim() || user?.email || "";
  const initial = name.charAt(0).toUpperCase() || "?";

  const links = (orientation: "top" | "tabs") =>
    NAV.map((item) => {
      const active = item.match(location.pathname);
      const Icon = item.icon;
      return (
        <Link
          key={item.to}
          to={item.to}
          aria-current={active ? "page" : undefined}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg font-medium no-underline transition-colors",
            orientation === "top" &&
              cn("h-10 px-3.5 text-sm text-subtle hover:bg-muted hover:text-foreground", active && "bg-accent text-accent-foreground"),
            orientation === "tabs" &&
              cn(
                "h-13 flex-col justify-center gap-0.5 px-2 text-[11px] text-muted-foreground",
                active && "text-primary [&_svg]:stroke-[2.2]",
              ),
          )}
        >
          <Icon className="size-[18px]" aria-hidden="true" />
          <span>{item.label}</span>
        </Link>
      );
    });

  return (
    <div className="flex min-h-screen flex-col">
      <a
        className="fixed top-3 left-4 z-[200] -translate-y-[200%] rounded-lg bg-card px-3.5 py-2.5 text-sm font-medium focus:translate-y-0"
        href="#main-content"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex h-(--topbar-h) w-full max-w-[1200px] items-center gap-6 px-4 md:px-6">
          {focus ? (
            <Brand compact />
          ) : (
            <Link to="/" className="shrink-0 rounded-lg no-underline" aria-label="IELTS Speaking by Hinterbuild home">
              <Brand />
            </Link>
          )}
          {!focus && (
            <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Primary">
              {links("top")}
            </nav>
          )}
          <div className={cn("flex items-center gap-2", focus ? "ml-auto" : "md:ml-2 max-md:ml-auto md:border-l md:border-border md:pl-4")}>
            {focus ? (
              focusAction
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="inline-flex h-10 items-center gap-2 rounded-lg px-2 text-sm font-medium text-foreground hover:bg-muted"
                  aria-label="Account menu"
                >
                  <span
                    className="inline-grid size-8 place-items-center rounded-full bg-indigo-soft text-[13px] font-semibold text-primary"
                    aria-hidden="true"
                  >
                    {initial}
                  </span>
                  <span className="hidden lg:inline">{name.split(" ")[0]}</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-56">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="grid gap-0.5">
                      <span className="font-medium text-foreground">{name || "Your account"}</span>
                      {user?.email && name !== user.email && (
                        <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
                      )}
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem render={<Link to="/progress#goal" />}>Set a goal</DropdownMenuItem>
                  <DropdownMenuItem render={<Link to="/learn" />}>Speaking guide</DropdownMenuItem>
                  <DropdownMenuItem render={<Link to="/privacy" />}>Privacy &amp; data</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="size-4" aria-hidden="true" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className={cn(
          "mx-auto w-full max-w-[1200px] flex-1 px-4 pt-6 md:px-6 md:pt-8",
          focus ? "pb-10" : "pb-[calc(40px+var(--tabbar-h))] md:pb-16",
        )}
      >
        {children}
      </main>

      {!focus && (
        <>
          <footer className="mx-auto flex w-full max-w-[1200px] flex-wrap justify-between gap-x-5 gap-y-2 border-t border-border px-4 pt-5 pb-[calc(24px+var(--tabbar-h))] text-xs text-muted-foreground md:px-6 md:pb-7">
            <span>IELTS Speaking by Hinterbuild · Make yourself heard.</span>
            <span>Practice estimates, not official IELTS results.</span>
          </footer>
          <nav
            className="fixed inset-x-0 bottom-0 z-30 grid h-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] grid-cols-3 border-t border-border bg-card/95 px-2 pt-1.5 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
            aria-label="Primary"
          >
            {links("tabs")}
          </nav>
        </>
      )}
    </div>
  );
}
