import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  Clock,
  Headphones,
  MessageSquare,
  Mic,
  Sparkles,
  Target,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { api, type TestListItem } from "../../lib/api";
import { bandText, criterionLabel, formatDateTime } from "../../lib/format";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { AppShell } from "../../components/layout/AppShell";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  IconTile,
  LoadingState,
  PageHeading,
  SectionHeading,
  Segmented,
  Skeleton,
  Stat,
  StatGrid,
  TextLink,
  useConfirm,
} from "../../components/studio";
import { StudioIllustration } from "../../components/studio/StudioIllustration";
import { useUser } from "../auth/useUser";
import { useProgress } from "../progress/useProgress";
import { AttemptList, attemptLink } from "./AttemptList";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const PAGE_SIZE = 5;
const RESUMABLE_STATES = ["CREATED", "DEVICE_CHECK", "READY", "PART1", "PART2_PREP", "PART2_SPEAK", "PART3", "UPLOADING"];

const byNewest = (a: TestListItem, b: TestListItem) => (Date.parse(b.createdAt ?? "") || 0) - (Date.parse(a.createdAt ?? "") || 0);

const HOW_IT_WORKS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Mic, title: "Check your microphone", body: "A 4-second sample makes sure the examiner can hear you." },
  { icon: MessageSquare, title: "Talk through Parts 1–3", body: "About 11–14 minutes, spoken — just like the real test." },
  { icon: ChartNoAxesCombined, title: "Get your report", body: "A band estimate per criterion, corrections, and a practice plan." },
];

export function DashboardPage() {
  const { user } = useUser();
  const navigate = useNavigate();
  const progress = useProgress();
  const { confirm, dialog } = useConfirm();
  const [tests, setTests] = useState<TestListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "completed">("all");
  const [page, setPage] = useState(1);
  useDocumentTitle("Overview");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setHistoryError(null);
    api
      .listTests()
      .then((next) => {
        if (active) setTests(next);
      })
      .catch((err: Error) => {
        if (active) setHistoryError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [revision]);

  async function start() {
    setBusy(true);
    setLocalError(null);
    try {
      const test = await api.createTest();
      navigate(`/tests/${test.testId}/device-check`);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not start");
    } finally {
      setBusy(false);
    }
  }

  async function removeTest(test: TestListItem) {
    const ok = await confirm({
      title: "Delete this attempt?",
      body: `The attempt from ${formatDateTime(test.createdAt) || "this session"}, its report, and its recordings will be permanently removed.`,
      confirmLabel: "Delete attempt",
      tone: "danger",
    });
    if (!ok) return;
    setDeleting(test.testId);
    setLocalError(null);
    try {
      await api.deleteTest(test.testId);
      setTests((items) => items.filter((item) => item.testId !== test.testId));
      progress.refresh();
      toast.success("Attempt deleted");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not delete attempt");
    } finally {
      setDeleting(null);
    }
  }

  async function deleteAccount() {
    const ok = await confirm({
      title: "Delete your account?",
      body: "Your account, every recording, all reports, and your practice history will be permanently deleted. This cannot be undone.",
      confirmLabel: "Delete everything",
      tone: "danger",
    });
    if (!ok) return;
    setDeleting("account");
    try {
      await api.deleteAccount();
      window.location.href = "/login";
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not delete account");
    } finally {
      setDeleting(null);
    }
  }

  const data = progress.data;
  const sorted = [...tests].sort(byNewest);
  const filtered = sorted.filter((test) => filter === "all" || test.state === "COMPLETED");
  const resumable = sorted.find((test) => RESUMABLE_STATES.includes(test.state));
  const resumeLink = resumable ? attemptLink(resumable) : null;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const statsLoading = progress.loading && !data;
  const scoredExams = data?.examHistory?.exams.length ?? 0;
  const isNewLearner = Boolean(data) && (data?.testsCompleted ?? 0) === 0 && scoredExams === 0;
  const firstName = user?.displayName?.split(" ")[0];
  const canStart = Boolean(user) && !user?.consentRequired;

  const stats = [
    {
      label: "Latest band",
      value: bandText(data?.latestBand),
      note: data?.latestBand != null ? "Your most recent estimate" : "After your first scored test",
      icon: <ChartNoAxesCombined />,
    },
    {
      label: "Lifetime average",
      value: bandText(data?.examHistory?.lifetimeOverallBand ?? data?.overallEstimate ?? undefined),
      note: data?.examHistory?.scoredExamCount
        ? `Across ${data.examHistory.scoredExamCount} scored test${data.examHistory.scoredExamCount === 1 ? "" : "s"}`
        : "Available after one usable test",
      icon: <Sparkles />,
    },
    { label: "Tests completed", value: String(data?.testsCompleted ?? 0), note: "Full speaking sessions", icon: <Check /> },
    {
      label: "Your target",
      value: bandText(data?.activeGoal?.targetBand),
      note: data?.activeGoal ? (
        "Set in My progress"
      ) : (
        <TextLink to="/progress#goal" size="sm">
          Set a goal
        </TextLink>
      ),
      icon: <Target />,
    },
  ];

  return (
    <AppShell>
      {dialog}
      <div className="grid gap-6">
        <PageHeading
          kicker={new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          title={firstName ? `Welcome${isNewLearner ? "" : " back"}, ${firstName}.` : "Your speaking practice"}
          lead="A little practice today. A little more confidence tomorrow."
          action={
            <TextLink to="/learn" size="sm">
              Your speaking guide
            </TextLink>
          }
        />

        {localError && <Alert tone="error">{localError}</Alert>}

        <section
          className="grid items-center gap-8 rounded-lg border border-border bg-blush p-6 md:grid-cols-[1.25fr_1fr] md:p-9"
          aria-labelledby="hero-title"
        >
          <div className="grid gap-4">
            <span className="inline-flex items-center gap-1.5 justify-self-start rounded-md bg-card/70 px-2.5 py-1 text-xs font-semibold text-primary">
              <Sparkles className="size-3.5" aria-hidden="true" /> IELTS speaking practice
            </span>
            <h2 id="hero-title" className="text-[clamp(28px,3.2vw,40px)] leading-[1.15]">
              {resumeLink ? (
                <>
                  Pick up where
                  <br />
                  <em>you left off.</em>
                </>
              ) : (
                <>
                  Your next conversation
                  <br />
                  <em>starts here.</em>
                </>
              )}
            </h2>
            <p className="max-w-[50ch] text-subtle">
              {resumeLink
                ? "Your unfinished session is saved. Continue with the examiner, or start a fresh test."
                : "Practise a full speaking test with an AI examiner. Get an estimated band, detailed feedback, and a plan for your next session."}
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-subtle">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4 text-primary" aria-hidden="true" /> 11–14 minutes
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Mic className="size-4 text-primary" aria-hidden="true" /> Microphone required
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Headphones className="size-4 text-primary" aria-hidden="true" /> Headphones recommended
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-3 max-sm:[&>*]:w-full">
              {resumeLink ? (
                <>
                  <Button size="lg" to={resumeLink}>
                    Resume practice <ArrowRight />
                  </Button>
                  <Button variant="secondary" size="lg" onClick={start} loading={busy} disabled={!canStart}>
                    Start a new test
                  </Button>
                </>
              ) : (
                <Button size="lg" onClick={start} loading={busy} disabled={!canStart}>
                  {busy ? "Preparing your test…" : "Start practice test"}
                  {!busy && <ArrowRight />}
                </Button>
              )}
            </div>
          </div>
          <div className="justify-self-center max-md:hidden">
            <StudioIllustration compact />
          </div>
        </section>

        {progress.error && (
          <Alert
            tone="error"
            title="Progress could not be loaded."
            action={
              <Button size="sm" variant="secondary" onClick={progress.refresh}>
                Retry
              </Button>
            }
          >
            {progress.error}
          </Alert>
        )}

        {isNewLearner ? (
          <Card className="grid gap-5" aria-labelledby="how-title">
            <SectionHeading kicker="Getting started" title="How a practice test works" titleId="how-title" />
            <ol className="grid gap-4 md:grid-cols-3">
              {HOW_IT_WORKS.map((step, index) => {
                const Icon = step.icon;
                return (
                  <li key={step.title} className="grid content-start gap-1.5 rounded-lg border border-border bg-background p-5">
                    <IconTile className="mb-1.5">
                      <Icon className="size-5" aria-hidden="true" />
                    </IconTile>
                    <span className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">Step {index + 1}</span>
                    <strong>{step.title}</strong>
                    <p className="text-[13px] text-muted-foreground">{step.body}</p>
                  </li>
                );
              })}
            </ol>
            <p className="text-[13px] text-muted-foreground">
              Your band history, skill balance, and practice plan will appear here after your first test.
            </p>
          </Card>
        ) : (
          <>
            <StatGrid aria-label="Your speaking statistics" aria-busy={statsLoading}>
              {stats.map((stat) => (
                <Stat
                  key={stat.label}
                  label={stat.label}
                  icon={stat.icon}
                  value={statsLoading ? <Skeleton width={72} height={34} /> : progress.error && !data ? "—" : stat.value}
                  note={stat.note}
                />
              ))}
            </StatGrid>

            {data && (data.testsCompleted ?? 0) > 0 && !Number.isFinite(data.latestBand) && (
              <Alert
                tone="info"
                title="Your latest test has no reliable band yet."
                action={
                  data.latestReportId && (
                    <Button size="sm" variant="secondary" to={`/reports/${data.latestReportId}`}>
                      Open report
                    </Button>
                  )
                }
              >
                One usable test is enough — more tests aren’t required to unlock a score. The report explains what prevented scoring.
              </Alert>
            )}

            {data?.weakestSkill && (
              <Link
                to="/progress"
                className="group flex items-center gap-4 rounded-lg border border-border bg-blush px-5 py-4 no-underline transition-colors hover:border-input"
              >
                <IconTile className="bg-card">
                  <Target className="size-5" aria-hidden="true" />
                </IconTile>
                <span className="grid min-w-0 gap-0.5">
                  <span className="kicker">Recommended focus</span>
                  <strong className="text-base">{criterionLabel(data.weakestSkill)}</strong>
                  <span className="text-[13px] text-muted-foreground">
                    Your lowest average skill. See targeted activities in your practice plan.
                  </span>
                </span>
                <ArrowRight
                  className="ml-auto size-5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            )}

            {data && !isNewLearner && (
              <TextLink to="/progress" size="sm">
                Explore your progress and practice plan
              </TextLink>
            )}
          </>
        )}

        {(loading || historyError || tests.length > 0) && (
          <Card className="grid gap-5" aria-labelledby="history-title">
            <SectionHeading
              kicker="Session history"
              title="Recent practice"
              titleId="history-title"
              action={
                <Segmented
                  label="Filter attempts"
                  value={filter}
                  onChange={(value) => {
                    setFilter(value);
                    setPage(1);
                  }}
                  options={[
                    { value: "all", label: "All" },
                    { value: "completed", label: "Completed" },
                  ]}
                />
              }
            />
            {loading ? (
              <LoadingState label="Loading your attempts…" compact />
            ) : historyError ? (
              <Alert
                tone="error"
                action={
                  <Button variant="secondary" size="sm" onClick={() => setRevision((n) => n + 1)}>
                    Retry
                  </Button>
                }
              >
                {historyError}
              </Alert>
            ) : visible.length === 0 ? (
              <EmptyState title="No completed tests yet">Finish a conversation to see its report here.</EmptyState>
            ) : (
              <AttemptList tests={visible} progress={data} deleting={deleting} onDelete={removeTest} />
            )}
            {pageCount > 1 && (
              <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
                <span className="text-[13px] text-muted-foreground">
                  Page {currentPage} of {pageCount}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                    Previous
                  </Button>
                  <Button size="sm" variant="secondary" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        <Collapsible className="no-print border-t border-border pt-4">
          <CollapsibleTrigger className="group inline-flex items-center gap-1.5 py-2 text-[13px] font-medium text-muted-foreground hover:text-foreground">
            Account &amp; data settings
            <ChevronDown className="size-4 transition-transform group-data-open:rotate-180" aria-hidden="true" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-card px-5 py-4">
              <p className="text-[13px] text-muted-foreground">Permanently remove your account, recordings, and practice history.</p>
              <Button variant="danger" size="sm" onClick={deleteAccount} disabled={deleting !== null} loading={deleting === "account"}>
                Delete account
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </AppShell>
  );
}
