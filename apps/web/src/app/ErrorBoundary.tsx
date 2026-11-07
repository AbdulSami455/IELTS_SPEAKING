import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "../components/studio";

interface State {
  error: Error | null;
}

/** Last line of defence: a render-time exception shows a recovery screen instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center">
          <p className="kicker">Something went wrong</p>
          <h1 className="mt-2 text-2xl">This page hit an unexpected error.</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Your answers and reports are safe on the server. Reload to continue, or go back to the overview.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button onClick={() => window.location.reload()}>Reload</Button>
            <Button variant="secondary" onClick={() => window.location.assign("/")}>
              Back to overview
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
