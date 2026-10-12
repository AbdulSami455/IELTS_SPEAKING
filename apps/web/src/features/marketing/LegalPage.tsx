import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { MarketingShell } from "./MarketingShell";
import { LEGAL_UPDATED, OPERATOR, PRODUCT_FULL, SUPPORT_EMAIL } from "./site";
import { cn } from "@/lib/utils";

const POLICIES = [
  { to: "/terms", label: "Terms of service" },
  { to: "/privacy", label: "Privacy policy" },
  { to: "/refunds", label: "Refund policy" },
  { to: "/acceptable-use", label: "Acceptable use" },
];

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  useDocumentTitle(title);
  return (
    <MarketingShell>
      <div className="mx-auto grid w-full max-w-[1160px] gap-8 px-5 py-12 md:px-10 md:py-16 lg:grid-cols-[220px_1fr]">
        <nav className="flex flex-wrap gap-1 self-start lg:sticky lg:top-24 lg:grid" aria-label="Policies">
          {POLICIES.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn("rounded-md px-3 py-2 text-sm no-underline transition-colors hover:bg-card hover:text-foreground", isActive ? "bg-card font-medium text-foreground" : "text-subtle")
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <article className="prose-legal max-w-[72ch] rounded-lg border border-border bg-card p-6 md:p-10">
          <p className="kicker">{OPERATOR}</p>
          <h1 className="mt-2 text-[clamp(30px,3.4vw,42px)] leading-[1.1]">{title}</h1>
          <p className="mt-3 text-[13px] text-muted-foreground">
            Last updated {LEGAL_UPDATED}. Questions: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </p>
          <div className="mt-8">{children}</div>
        </article>
      </div>
    </MarketingShell>
  );
}

export function TermsPage() {
  return (
    <LegalPage title="Terms of service">
      <p>
        These terms govern access to {PRODUCT_FULL}, a digital speaking-practice application operated by {OPERATOR} (“we”, “us”). By creating an account, you agree
        to these terms, the privacy policy, the refund policy, and the acceptable use policy. You confirm your agreement when you register, and again whenever we
        publish a new version of these documents.
      </p>
      <h2>The product</h2>
      <p>
        The service is software. It provides a simulated IELTS-style speaking interview, audio processing, an estimated practice band, and related feedback. It is not
        an official IELTS test, is not administered by the IELTS partners, and does not award a certificate those partners recognise.
      </p>
      <p>
        Band figures are practice estimates generated from your session. They can be wrong. They are not a prediction of a future examination result and are not
        professional academic advice.
      </p>
      <h2>Accounts</h2>
      <p>
        You must provide accurate registration details and keep your password confidential. You are responsible for activity under your account. You must be able to
        form a contract in your place of residence. Do not create an account for someone else without their permission.
      </p>
      <h2>Access and pricing</h2>
      <p>
        Access is delivered online to your account. There is no physical good to ship. The service is free to use during the beta period. If we introduce paid plans,
        we will publish the prices and update these terms and the refund policy before any charge applies. We may limit how many practice tests an account can start
        in a day to keep the service available for everyone.
      </p>
      <h2>Your recordings</h2>
      <p>
        You grant us a limited licence to store, transcribe, and analyse your recordings solely to operate the service: scoring, reports, progress, and support. You
        keep ownership of your speech. Do not upload audio you do not have the right to share.
      </p>
      <h2>Acceptable use</h2>
      <p>
        You must follow the acceptable use policy. We may suspend access if you abuse the service, attempt to break it, or use it for anything other than personal exam
        preparation.
      </p>
      <h2>Availability</h2>
      <p>
        We aim to keep the studio available, but we do not guarantee uninterrupted access. Model providers, networks, and maintenance can interrupt a session. If a
        test fails for a technical reason on our side, contact support and we will help you retry.
      </p>
      <h2>Liability</h2>
      <p>
        To the extent the law allows, the service is provided as available. We are not liable for exam outcomes, visa decisions, lost study time, or indirect damages.
        Nothing in these terms limits liability that cannot legally be limited.
      </p>
      <h2>Changes</h2>
      <p>
        We may update these terms. The date at the top will change. If a change is material, the product will ask you to review and accept the new version before you
        start another practice test. Continued use after accepting the update means you agree to the revised terms.
      </p>
    </LegalPage>
  );
}

export function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy">
      <p>This policy explains how {OPERATOR} handles personal data when you use {PRODUCT_FULL}.</p>
      <h2>Who we are</h2>
      <p>
        {OPERATOR} operates the practice studio. For privacy questions, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
      <h2>Data we collect</h2>
      <ul>
        <li>Account data: display name, email address, and a password hash.</li>
        <li>Session data: test state, questions, transcripts, scores, and practice plans.</li>
        <li>Audio: microphone recordings you submit during a test, used to transcribe and score that attempt.</li>
        <li>Consent records: which version of these policies you accepted, when, and the IP address and browser that sent the acceptance.</li>
        <li>Technical data: basic request logs needed to run, rate-limit, and secure the service.</li>
      </ul>
      <h2>Why we use it</h2>
      <ul>
        <li>To provide the interview, report, and progress features you asked for.</li>
        <li>To keep your account secure, enforce usage limits, and prevent abuse.</li>
        <li>To show your display name on the optional leaderboard, alongside your best practice band.</li>
        <li>To respond to support requests you send us.</li>
      </ul>
      <h2>How long we keep it</h2>
      <p>
        Raw answer audio is kept for a short retention window (by default 7 days) and then deleted. Transcripts are kept longer (by default 30 days) so a report can
        be rebuilt if needed. Reports stay on your account for a longer period (by default up to 365 days) unless you delete the attempt or your account sooner. These
        windows can be adjusted in the running configuration; the product applies the window that is active when the file is stored.
      </p>
      <h2>Processors</h2>
      <p>
        We use infrastructure and model providers to host the app, store files, and run speech and language processing. Audio and transcript text are sent to those
        providers only to perform transcription, examiner speech, and scoring. We do not sell your recordings, and we do not use them to train models.
      </p>
      <h2>Your choices</h2>
      <p>
        You can delete an individual attempt from your Overview page, or delete your account and all associated practice data from the “Account &amp; data settings”
        section at the bottom of the Overview page. Deletion is immediate and removes your recordings, transcripts, reports, and progress. You may also email us to
        request access to or correction of your account details. If a law gives you additional rights, contact us and we will respond.
      </p>
      <h2>Children</h2>
      <p>The service is not directed at children under 16. Do not create an account if you are under 16.</p>
    </LegalPage>
  );
}

export function RefundPolicyPage() {
  return (
    <LegalPage title="Refund policy">
      <p>
        {PRODUCT_FULL} is a digital service. During the beta period there is nothing to pay, so there is nothing to refund. This page explains what will apply if we
        introduce paid plans, and what you can expect from us today when something goes wrong.
      </p>
      <h2>Today, while the service is free</h2>
      <ul>
        <li>If a test fails for a technical reason on our side, it does not count against your daily limit once we confirm the fault. Email support with the date and time.</li>
        <li>If a report is clearly wrong because of a processing error, we will reassess the attempt where the recordings are still within their retention window.</li>
      </ul>
      <h2>If we introduce paid plans</h2>
      <p>We will publish prices, the billing provider, and the exact refund terms before any charge applies. As a minimum, we will refund you when:</p>
      <ul>
        <li>You were charged and could not access the studio because of a fault on our side, and we cannot restore access within a reasonable time.</li>
        <li>You were charged twice for the same purchase.</li>
        <li>A law where you live requires a refund we cannot contract out of, including any cooling-off right that still applies to unused digital content.</li>
      </ul>
      <p>We will not refund a completed practice test because you dislike the estimated band, or because you expected an official IELTS certificate.</p>
      <h2>How to ask</h2>
      <p>
        Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> from the address on the account, with the date and what failed. We aim to reply within 2
        business days.
      </p>
    </LegalPage>
  );
}

export function AcceptableUsePage() {
  return (
    <LegalPage title="Acceptable use">
      <p>{PRODUCT_FULL} is a digital practice tool for people preparing for a speaking exam. Use it for that purpose.</p>
      <h2>You may</h2>
      <ul>
        <li>Create an account and take practice tests for your own preparation.</li>
        <li>Review your reports, delete attempts, and delete your account.</li>
        <li>Share your own report privately with a teacher you choose.</li>
      </ul>
      <h2>You may not</h2>
      <ul>
        <li>Present a practice band as an official IELTS score, or claim we are an IELTS test centre.</li>
        <li>Upload someone else’s voice without their consent, or use the studio to record people covertly.</li>
        <li>Resell access, scrape the service, or build a competing dataset from our prompts and outputs.</li>
        <li>Probe, overload, or attempt to break the application or other people’s accounts.</li>
        <li>Try to manipulate the examiner or the scoring, for example by speaking instructions to the AI instead of answering the question.</li>
        <li>Use the service for unlawful content, harassment, or anything other than exam practice.</li>
      </ul>
      <h2>Enforcement</h2>
      <p>
        We may suspend or close an account that breaks these rules, remove leaderboard entries that were obtained by manipulating the scoring, and remove content that
        creates legal or security risk. If we do, we will email the account address unless we must act immediately to stop harm.
      </p>
    </LegalPage>
  );
}
