import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Brand } from "../../components/layout/Brand";
import { api } from "../../lib/api";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { Alert, Button, Field, TextInput } from "../../components/ui";
import { Icon, type IconName } from "../../components/ui/Icon";

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  { icon: "mic", title: "A real interview, out loud", body: "Parts 1–3 with an AI examiner who follows up on what you say." },
  { icon: "chart", title: "Four-criterion band estimate", body: "Fluency, vocabulary, grammar, and pronunciation — with evidence." },
  { icon: "target", title: "A plan for next time", body: "Corrections from your own answers and a short daily practice plan." },
];

function safeRedirect(value: unknown): string {
  // Only follow in-app paths so a crafted link can't bounce users off-site.
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const registering = mode === "register";
  useDocumentTitle(registering ? "Create account" : "Sign in");

  function switchMode(next: "login" | "register") {
    setMode(next);
    setError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (registering) await api.register(email, password, displayName);
      else await api.login(email, password);
      navigate(safeRedirect((location.state as { from?: unknown } | null)?.from), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <main className="auth-grid">
        <section className="auth-story" aria-label="About IELTS Speaking">
          <Brand />
          <h1>Rehearse the whole IELTS speaking test.</h1>
          <ul className="auth-features">
            {FEATURES.map((item) => (
              <li key={item.title}>
                <span className="icon-tile icon-tile--sm">
                  <Icon name={item.icon} size={18} />
                </span>
                <span>
                  <strong>{item.title}</strong>
                  <span className="caption">{item.body}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="auth-disclaimer">Practice estimates only — not an official IELTS score.</p>
        </section>
        <section className="auth-form" aria-labelledby="auth-heading">
          <div className="segmented segmented--full" role="group" aria-label="Account">
            <button type="button" aria-pressed={!registering} onClick={() => switchMode("login")}>
              Sign in
            </button>
            <button type="button" aria-pressed={registering} onClick={() => switchMode("register")}>
              Create account
            </button>
          </div>
          <div className="stack-sm">
            <h2 id="auth-heading">{registering ? "Create your account" : "Welcome back"}</h2>
            <p className="caption">
              {registering
                ? "Your tests, reports, and progress stay private to your account."
                : "Sign in to continue your practice and see your reports."}
            </p>
          </div>
          <form onSubmit={submit} className="stack">
            {registering && (
              <Field label="Name">
                <TextInput
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  required
                  autoComplete="name"
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
                autoFocus={!registering}
              />
            </Field>
            <Field label="Password" hint={registering ? "At least 8 characters." : undefined}>
              <span className="input-affix">
                <TextInput
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  required
                  autoComplete={registering ? "new-password" : "current-password"}
                />
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  <Icon name={showPassword ? "eyeOff" : "eye"} size={18} />
                </button>
              </span>
            </Field>
            {error && <Alert tone="error">{error}</Alert>}
            <Button type="submit" size="lg" loading={busy} className="btn--block">
              {busy ? "Please wait…" : registering ? "Create account" : "Sign in"}
            </Button>
          </form>
          <p className="caption auth-switch">
            {registering ? "Already have an account?" : "New to IELTS Speaking?"}{" "}
            <button type="button" className="link-button" onClick={() => switchMode(registering ? "login" : "register")}>
              {registering ? "Sign in" : "Create an account"}
            </button>
          </p>
        </section>
      </main>
    </div>
  );
}
