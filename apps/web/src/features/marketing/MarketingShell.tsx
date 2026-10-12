import { Link, NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Brand } from "../../components/layout/Brand";
import { Button } from "../../components/studio";
import { OPERATOR, PRODUCT_FULL, SUPPORT_EMAIL } from "./site";
import { cn } from "@/lib/utils";

const navLink = ({ isActive }: { isActive: boolean }) =>
  cn("text-sm text-subtle no-underline underline-offset-[7px] hover:text-foreground", isActive && "text-foreground underline");

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-subtle">
      <a className="fixed top-3 left-4 z-[200] -translate-y-[200%] rounded-lg bg-card px-3.5 py-2.5 text-sm font-medium focus:translate-y-0" href="#main-content">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-border bg-card">
        <div className="mx-auto flex min-h-[72px] w-full max-w-[1160px] flex-wrap items-center gap-x-8 gap-y-3 px-5 py-3 md:px-10">
          <Link to="/" className="shrink-0 rounded-lg no-underline" aria-label={`${PRODUCT_FULL} home`}>
            <Brand />
          </Link>
          <nav className="order-3 flex w-full items-center justify-center gap-7 border-t border-border pt-3 md:order-none md:ml-auto md:w-auto md:border-0 md:pt-0" aria-label="Site">
            <NavLink to="/" end className={navLink}>
              Home
            </NavLink>
            <NavLink to="/learn" className={navLink}>
              The speaking test
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-4 md:ml-2">
            <Link className="text-sm text-subtle no-underline hover:text-foreground" to="/login">
              Sign in
            </Link>
            <Button variant="coral" to="/start" className="max-sm:h-9 max-sm:px-3 max-sm:text-[13px]">
              Start practice <ArrowRight className="max-sm:hidden" />
            </Button>
          </div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <footer className="border-t border-border bg-card pt-10 pb-7">
        <div className="mx-auto grid w-full max-w-[1160px] gap-8 px-5 md:px-10">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <Link to="/" className="inline-block rounded-lg no-underline">
                <Brand />
              </Link>
              <p className="mt-3.5 font-serif text-[15px] italic">A little practice. A little more confidence.</p>
            </div>
            <nav className="flex flex-wrap gap-6 text-[13px]" aria-label="Resources">
              <Link to="/learn" className="no-underline hover:underline">
                Speaking guide
              </Link>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex items-center gap-1.5 no-underline hover:underline">
                Get in touch <ArrowRight className="size-3.5" aria-hidden="true" />
              </a>
            </nav>
          </div>
          <div className="flex flex-col justify-between gap-4 border-t border-border pt-6 text-xs sm:flex-row">
            <p>
              © {new Date().getFullYear()} {OPERATOR}. Made for your next chapter.
            </p>
            <nav className="flex flex-wrap gap-5" aria-label="Policies">
              <Link to="/terms" className="text-subtle no-underline hover:underline">
                Terms
              </Link>
              <Link to="/privacy" className="text-subtle no-underline hover:underline">
                Privacy
              </Link>
              <Link to="/refunds" className="text-subtle no-underline hover:underline">
                Refunds
              </Link>
              <Link to="/acceptable-use" className="text-subtle no-underline hover:underline">
                Acceptable use
              </Link>
            </nav>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Independent IELTS practice. AI band estimates are for practice, not official results. Not affiliated with or endorsed by the IELTS partners.
          </p>
        </div>
      </footer>
    </div>
  );
}
