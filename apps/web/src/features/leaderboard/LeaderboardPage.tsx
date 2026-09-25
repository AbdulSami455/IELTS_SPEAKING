import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { Alert, Badge, Button, LoadingState } from "../../components/ui";
import { Icon } from "../../components/ui/Icon";
import { api } from "../../lib/api";
import type { Leaderboard, LeaderboardPeriod } from "../../lib/api/types";
import { useDocumentTitle } from "../../lib/useDocumentTitle";

const PERIODS: { id: LeaderboardPeriod; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "overall", label: "Overall" },
];

export function LeaderboardPage() {
  const [period, setPeriod] = useState<LeaderboardPeriod>("today");
  const [data, setData] = useState<Leaderboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useDocumentTitle("Leaderboard");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    const load = async () => {
      try {
        const result = await api.leaderboard(period);
        if (active) setData(result);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Could not load leaderboard");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [period, revision]);

  const current = !loading && !error && data?.period === period ? data : null;
  const label = PERIODS.find((item) => item.id === period)!.label;

  return (
    <AppShell>
      <div className="stack-lg">
        <section className="page-heading row between">
          <div className="stack-sm">
            <p className="kicker">Speaking community</p>
            <h1>Leaderboard</h1>
            <p className="muted">Celebrate progress. See how your best speaking score compares.</p>
          </div>
          <Link to="/" className="btn btn--primary">Practise now <Icon name="arrow" size={17} /></Link>
        </section>
        <section className="card stack" aria-label="Speaking leaderboard">
          <div className="row between">
            <div className="row"><span className="leaderboard-icon"><Icon name="trophy" size={24} /></span><h2>Top performers</h2></div>
            <div className="segmented" role="group" aria-label="Leaderboard period">
              {PERIODS.map((item) => (
                <button type="button" key={item.id} aria-pressed={period === item.id} onClick={() => { if (item.id !== period) { setPeriod(item.id); setLoading(true); } }}>{item.label}</button>
              ))}
            </div>
          </div>
          <p className="caption">Best estimated band per person. Equal scores share a rank. Days reset at 00:00 UTC; weeks start Monday.</p>
          <div aria-live="polite" aria-busy={loading}>
            {loading && <LoadingState label={`Loading ${label.toLowerCase()} rankings…`} compact />}
            {error && <Alert tone="error" action={<Button variant="secondary" size="sm" onClick={() => setRevision((value) => value + 1)}>Retry</Button>}>{error}</Alert>}
            {current && (
              <div className="stack">
                <div className="leaderboard-summary row between">
                  <div className="stack-sm"><span className="kicker">Your position · {label}</span>
                    <strong>{current.yourEntry ? `#${current.yourEntry.rank} · Band ${current.yourEntry.bestBand.toFixed(1)}` : "Not ranked yet"}</strong>
                    {!current.yourEntry && <span className="caption">Complete a test with a scored report in this period to join.</span>}
                  </div>
                  <Badge>{current.totalParticipants} {current.totalParticipants === 1 ? "participant" : "participants"}</Badge>
                </div>
                {current.entries.length === 0 ? (
                  <div className="empty stack-sm"><strong>No scores for this period yet</strong><p>Be the first to complete a scored speaking test.</p><Link className="text-link" to="/">Start your practice <Icon name="arrow" size={16} /></Link></div>
                ) : (
                  <div className="leaderboard-table-wrap">
                    <table className="leaderboard-table">
                      <caption className="visually-hidden">{label} top 50 speaking performers</caption>
                      <thead><tr><th scope="col">Rank</th><th scope="col">Learner</th><th scope="col">Best band</th><th scope="col">Scored tests</th></tr></thead>
                      <tbody>{current.entries.map((entry, index) => (
                        <tr key={index} className={entry.isYou ? "leaderboard-you" : ""}>
                          <td><span className={`leaderboard-rank${entry.rank <= 3 ? " leading" : ""}`}>{entry.rank}</span></td>
                          <th scope="row"><span className="leaderboard-name">{entry.displayName}</span>{entry.isYou && <Badge tone="accent">You</Badge>}</th>
                          <td className="leaderboard-band">{entry.bestBand.toFixed(1)}</td><td>{entry.testsCompleted}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
                <div className="row between">
                  <p className="caption">Showing up to 50 learners · Updated {new Date(current.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                  <Button variant="ghost" size="sm" onClick={() => setRevision((value) => value + 1)}>Refresh rankings</Button>
                </div>
              </div>
            )}
          </div>
        </section>
        <p className="caption">Rankings include completed, conclusive reports from the current scoring version. These are practice estimates, not official IELTS results.</p>
      </div>
    </AppShell>
  );
}
