import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { Brand } from "../../components/layout/Brand";
import { api } from "../../lib/api";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { Alert, Button, Field, TextInput } from "../../components/studio";
import { StudioIllustration } from "../../components/studio/StudioIllustration";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

function safeRedirect(value: unknown): string {
  // Only follow in-app paths so a crafted link can't bounce users off-site.
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<"login" | "register">(() =>
    new URLSearchParams(location.search).get("mode") === "register" ? "register" : "login",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const registering = mode === "register";
  useDocumentTitle(registering ? "Create account" : "Sign in");

  function switchMode(next: "login" | "register") {
    setMode(next);
    setError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (registering && !acceptedTerms) {
      setError("Accept the terms, privacy policy, and recording consent to create an account.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (registering) await api.register(email, password, displayName, acceptedTerms);
      else await api.login(email, password);
      navigate(safeRedirect((location.state as { from?: unknown } | null)?.from), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-8">
      <main className="grid w-full max-w-[1000px] overflow-hidden rounded-lg border border-border bg-card md:grid-cols-[1.05fr_0.95fr]">
        <section className="grid content-start gap-6 bg-blush p-7 md:p-11" aria-label="About IELTS Speaking">
          <Link to="/" className="justify-self-start rounded-lg no-underline" aria-label="IELTS Speaking home">
            <Brand />
          </Link>
          <div className="grid gap-3">
            <h1 className="text-[clamp(28px,3vw,36px)]">
              Find your voice.
              <br />
              <em>Build your confidence.</em>
            </h1>
            <p className="max-w-[40ch] text-subtle">A space to practise, make progress, and feel ready for your next chapter.</p>
          </div>
          <div className="max-md:hidden">
            <StudioIllustration compact />
          </div>
          <p className="text-[13px] text-muted-foreground">Practice estimates only — not an official IELTS score.</p>
        </section>

        <section className="grid content-center gap-5 p-7 md:p-10" aria-labelledby="auth-heading">
          <div className="grid gap-1.5">
            <p className="kicker">Your speaking studio</p>
            <h2 id="auth-heading" className="text-2xl">
              {registering ? "Create your account" : "Welcome back"}
            </h2>
            <p className="text-[13px] text-muted-foreground">
              {registering
                ? "Your tests, reports, and progress stay private to your account."
                : "Sign in to continue your practice and see your reports."}
            </p>
          </div>
          <form onSubmit={submit} className="grid gap-4">
            {registering && (
              <Field label="Name">
                <TextInput
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  required
                  maxLength={80}
                  autoComplete="name"
                  placeholder="Your name"
                  autoFocus
                />
              </Field>
            )}
            <Field label="Email">
              <TextInput
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
                autoFocus={!registering}
              />
            </Field>
            <Field label="Password" hint={registering ? "At least 8 characters." : undefined}>
              <span className="relative block">
                <TextInput
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  maxLength={128}
                  required
                  autoComplete={registering ? "new-password" : "current-password"}
                  placeholder={registering ? "Create a password" : "Enter your password"}
                  className="pr-12"
                />
                <button
                  type="button"
                  className="absolute top-1/2 right-1.5 inline-grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
                </button>
              </span>
            </Field>
            {registering && (
              <Label className="group/field grid cursor-pointer grid-cols-[auto_1fr] items-start gap-3 text-[13px] leading-relaxed font-normal text-subtle">
                <Checkbox
                  className="mt-0.5 size-5"
                  checked={acceptedTerms}
                  onCheckedChange={(value) => setAcceptedTerms(value === true)}
                />
                <span>
                  I agree to the{" "}
                  <Link to="/terms" className="underline">
                    terms of service
                  </Link>
                  ,{" "}
                  <Link to="/privacy" className="underline">
                    privacy policy
                  </Link>
                  , and{" "}
                  <Link to="/acceptable-use" className="underline">
                    acceptable use policy
                  </Link>
                  , and I consent to my voice being recorded and analysed by AI to score my practice tests.
                </span>
              </Label>
            )}
            {error && <Alert tone="error">{error}</Alert>}
            <Button type="submit" size="lg" loading={busy} className="w-full">
              {busy ? "Please wait…" : registering ? "Create account" : "Sign in"}
            </Button>
          </form>
          <p className="text-center text-[13px] text-muted-foreground">
            {registering ? "Already have an account?" : "New to IELTS Speaking?"}{" "}
            <button
              type="button"
              className="font-medium text-foreground underline underline-offset-[0.18em]"
              disabled={busy}
              onClick={() => switchMode(registering ? "login" : "register")}
            >
              {registering ? "Sign in" : "Create an account"}
            </button>
          </p>
        </section>
      </main>
    </div>
  );
}
