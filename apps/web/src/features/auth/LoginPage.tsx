import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setToken } from "../../lib/api";
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
      setToken(result.token);
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
          <p className="kicker">Practice studio</p>
          <h1>Speak as if the examiner is already in the room.</h1>
          <ul className="auth-points">
            <li>A full Part 1–3 interview with timed answers and follow-up questions.</li>
            <li>Your voice stays private — recorded for scoring, then deleted on schedule.</li>
            <li>A four-criterion estimated report: fluency, vocabulary, grammar, pronunciation.</li>
          </ul>
          <p className="caption">Practice estimates only. Never an official IELTS result.</p>
        </div>
        <div className="auth-form">
          <h2>{mode === "register" ? "Create your studio" : "Welcome back"}</h2>
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
            <Field label="Password" hint="At least 8 characters.">
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
              {busy ? "Please wait…" : mode === "register" ? "Create account" : "Enter studio"}
            </Button>
          </form>
          <Button variant="ghost" onClick={() => setMode(mode === "login" ? "register" : "login")}>
            {mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
          </Button>
        </div>
      </div>
    </div>
  );
}
