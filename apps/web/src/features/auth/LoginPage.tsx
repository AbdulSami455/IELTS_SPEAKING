import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { Alert, Button, Field, TextInput } from "../../components/ui";

export function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result =
        mode === "register"
          ? await api.register(email, password, displayName)
          : await api.login(email, password);
      void result;
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-grid">
        <div className="auth-story">
          <p className="kicker">Atelier Speaking</p>
          <h1>Practice a full IELTS speaking test.</h1>
          <ul className="auth-points">
            <li>Live Part 1–3 interview with an AI examiner</li>
            <li>Band estimate across fluency, vocabulary, grammar, and pronunciation</li>
          </ul>
          <p className="caption">Practice only — not an official IELTS score.</p>
        </div>
        <div className="auth-form">
          <h2>{mode === "register" ? "Create account" : "Sign in"}</h2>
          <form onSubmit={submit}>
            {mode === "register" && (
              <Field label="Name">
                <TextInput
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  required
                  autoComplete="name"
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
              />
            </Field>
            <Field label="Password" hint={mode === "register" ? "At least 8 characters." : undefined}>
              <TextInput
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
                autoComplete={mode === "register" ? "new-password" : "current-password"}
              />
            </Field>
            {error && <Alert tone="error">{error}</Alert>}
            <Button type="submit" loading={busy}>
              {busy ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"}
            </Button>
          </form>
          <Button variant="ghost" onClick={() => setMode(mode === "login" ? "register" : "login")}>
            {mode === "login" ? "Create an account" : "Already have an account?"}
          </Button>
        </div>
      </div>
    </div>
  );
}
