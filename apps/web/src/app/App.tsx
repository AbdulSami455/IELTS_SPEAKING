import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigationType } from "react-router-dom";
import { RequireAuth } from "../features/auth/RequireAuth";
import { LoginPage } from "../features/auth/LoginPage";
import { DeviceCheckPage } from "../features/device-check/DeviceCheckPage";
import { TestRunnerPage } from "../features/test-runner/TestRunnerPage";
import { ProcessingPage } from "../features/processing/ProcessingPage";
import { ReportPage } from "../features/report/ReportPage";
import { ProgressPage } from "../features/progress/ProgressPage";
import { LeaderboardPage } from "../features/leaderboard/LeaderboardPage";
import { HomeGate } from "../features/marketing/HomeGate";
import { LearnPage } from "../features/marketing/LearnPage";
import { StartPage } from "../features/marketing/StartPage";
import {
  AcceptableUsePage,
  PrivacyPage,
  RefundPolicyPage,
  TermsPage,
} from "../features/marketing/LegalPage";

// New pages open at the top; back/forward keeps the browser's own restoration.
function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  useEffect(() => {
    if (navigationType !== "POP") window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname, navigationType]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/learn" element={<LearnPage />} />
        <Route path="/start" element={<StartPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/refunds" element={<RefundPolicyPage />} />
        <Route path="/acceptable-use" element={<AcceptableUsePage />} />
        <Route path="/" element={<HomeGate />} />
        <Route
          path="/tests/:testId/device-check"
          element={
            <RequireAuth>
              <DeviceCheckPage />
            </RequireAuth>
          }
        />
        <Route
          path="/tests/:testId/processing"
          element={
            <RequireAuth>
              <ProcessingPage />
            </RequireAuth>
          }
        />
        <Route
          path="/tests/:testId"
          element={
            <RequireAuth>
              <TestRunnerPage />
            </RequireAuth>
          }
        />
        <Route
          path="/reports/:reportId"
          element={
            <RequireAuth>
              <ReportPage />
            </RequireAuth>
          }
        />
        <Route
          path="/reports/by-test/:testId"
          element={
            <RequireAuth>
              <ReportPage />
            </RequireAuth>
          }
        />
        <Route
          path="/progress"
          element={
            <RequireAuth>
              <ProgressPage />
            </RequireAuth>
          }
        />
        <Route
          path="/leaderboard"
          element={
            <RequireAuth>
              <LeaderboardPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
