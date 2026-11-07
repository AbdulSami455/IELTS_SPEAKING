import { useEffect, useState } from "react";
import { ArrowRight, Trophy } from "lucide-react";
import { AppShell } from "../../components/layout/AppShell";
import { Alert, Badge, Button, Card, EmptyState, LoadingState, PageHeading, Segmented, TextLink } from "../../components/studio";
import { api } from "../../lib/api";
import type { Leaderboard, LeaderboardPeriod } from "../../lib/api/types";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const PERIODS: { value: LeaderboardPeriod; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "overall", label: "Overall" },
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
    api
      .leaderboard(period)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Could not load leaderboard");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [period, revision]);

  const current = !loading && !error && data?.period === period ? data : null;
  const label = PERIODS.find((item) => item.value === period)!.label;

  return (
    <AppShell>
      <div className="grid gap-6">
        <PageHeading
          kicker="Speaking community"
          title="Leaderboard"
          lead="Celebrate progress. See how your best speaking score compares."
          action={
            <Button to="/">
              Practise now <ArrowRight />
            </Button>
          }
        />
        <Card className="grid gap-5" aria-label="Speaking leaderboard">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="inline-grid size-11 place-items-center rounded-lg bg-gold-soft text-gold">
                <Trophy className="size-6" aria-hidden="true" />
              </span>
              <h2>Top performers</h2>
            </div>
            <Segmented label="Leaderboard period" value={period} onChange={setPeriod} options={PERIODS} />
          </div>
          <p className="text-[13px] text-muted-foreground">
            Best estimated band per person. Equal scores share a rank. Days reset at 00:00 UTC; weeks start Monday.
          </p>
          <div aria-live="polite" aria-busy={loading}>
            {loading && <LoadingState label={`Loading ${label.toLowerCase()} rankings…`} compact />}
            {error && (
              <Alert
                tone="error"
                action={
                  <Button variant="secondary" size="sm" onClick={() => setRevision((value) => value + 1)}>
                    Retry
                  </Button>
                }
              >
                {error}
              </Alert>
            )}
            {current && (
              <div className="grid gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-blush p-5">
                  <div className="grid gap-1">
                    <span className="kicker">Your position · {label}</span>
                    <strong className="text-xl tabular-nums">
                      {current.yourEntry ? `#${current.yourEntry.rank} · Band ${current.yourEntry.bestBand.toFixed(1)}` : "Not ranked yet"}
                    </strong>
                    {!current.yourEntry && (
                      <span className="text-[13px] text-muted-foreground">
                        Complete a test with a scored report in this period to join.
                      </span>
                    )}
                  </div>
                  <Badge>
                    {current.totalParticipants} {current.totalParticipants === 1 ? "participant" : "participants"}
                  </Badge>
                </div>
                {current.entries.length === 0 ? (
                  <EmptyState title="No scores for this period yet" action={<TextLink to="/">Start your practice</TextLink>}>
                    Be the first to complete a scored speaking test.
                  </EmptyState>
                ) : (
                  <Table>
                    <caption className="sr-only">{label} top 50 speaking performers</caption>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-16 px-3 text-xs text-muted-foreground">Rank</TableHead>
                        <TableHead className="px-3 text-xs text-muted-foreground">Learner</TableHead>
                        <TableHead className="px-3 text-right text-xs text-muted-foreground">Best band</TableHead>
                        <TableHead className="px-3 text-right text-xs text-muted-foreground">Scored tests</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {current.entries.map((entry, index) => (
                        <TableRow key={index} className={cn(entry.isYou && "bg-blush hover:bg-blush")}>
                          <TableCell className="px-3 py-3">
                            <span
                              className={cn(
                                "inline-grid size-8 place-items-center rounded-md text-sm font-medium text-subtle tabular-nums",
                                entry.rank <= 3 && "bg-gold-soft font-semibold text-gold",
                              )}
                            >
                              {entry.rank}
                            </span>
                          </TableCell>
                          <TableCell className="px-3 py-3 whitespace-normal">
                            <span className="mr-2 font-medium text-foreground break-words">{entry.displayName}</span>
                            {entry.isYou && <Badge tone="accent">You</Badge>}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-right text-base font-semibold text-primary tabular-nums">
                            {entry.bestBand.toFixed(1)}
                          </TableCell>
                          <TableCell className="px-3 py-3 text-right text-subtle tabular-nums">{entry.testsCompleted}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[13px] text-muted-foreground">
                    Showing up to 50 learners · Updated{" "}
                    {new Date(current.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <Button variant="ghost" size="sm" onClick={() => setRevision((value) => value + 1)}>
                    Refresh rankings
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
        <p className="text-[13px] text-muted-foreground">
          Rankings include completed, conclusive reports from the current scoring version. These are practice estimates, not official IELTS
          results.
        </p>
      </div>
    </AppShell>
  );
}
