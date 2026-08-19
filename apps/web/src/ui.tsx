import { Link, useLocation } from "react-router-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { setToken } from "./lib/api";

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <div>
      <div className="shell">
        <header className="topbar">
          <Link to="/" className="brand">
            Atelier <span>Speaking</span>
          </Link>
          <nav>
            <Link className={location.pathname === "/" ? "active" : ""} to="/">
              Studio
            </Link>
            <Link className={location.pathname.startsWith("/progress") ? "active" : ""} to="/progress">
              Progress
            </Link>
            <button
              className="ghost"
              onClick={() => {
                setToken(null);
                window.location.href = "/login";
              }}
            >
              Sign out
            </button>
          </nav>
        </header>
        {children}
      </div>
    </div>
  );
}

export function PartSteps({ state }: { state: string }) {
  const parts = [
    { id: "1", label: "Interview", on: ["PART1", "READY"].includes(state) || ["PART2_PREP", "PART2_SPEAK", "PART3"].includes(state) },
    { id: "2", label: "Long turn", on: state.startsWith("PART2") || state === "PART3" },
    { id: "3", label: "Discussion", on: state === "PART3" },
  ];
  if (state === "READY") parts[0].on = true;
  return (
    <div className="steps">
      {parts.map((part) => (
        <div className={`step ${part.on ? "on" : ""}`} key={part.id}>
          <span className="n">Part {part.id}</span>
          {part.label}
        </div>
      ))}
    </div>
  );
}

export function TimerRing({ seconds, total }: { seconds: number; total: number }) {
  const p = Math.max(0, Math.min(100, (seconds / Math.max(total, 1)) * 100));
  return (
    <div className="timer-wrap">
      <div className="timer-ring" style={{ ["--p" as string]: p }}>
        <p className="timer">{seconds}s</p>
      </div>
    </div>
  );
}

export function VolumeAudio({ src, label }: { src: string; label: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [volume, setVolume] = useState(1);
  useEffect(() => {
    if (ref.current) ref.current.volume = volume;
  }, [volume, src]);
  return (
    <div className="audio-dock">
      <p className="muted" style={{ margin: 0 }}>
        {label}
      </p>
      <audio ref={ref} controls src={src} />
      <input
        className="range"
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        onChange={(event) => setVolume(Number(event.target.value))}
        aria-label="Volume"
      />
    </div>
  );
}

export function packTitle(slug: string) {
  return slug.replace(/-v\d+$/, "").replaceAll("-", " ");
}

export function prettyState(state: string) {
  return state.replaceAll("_", " ").toLowerCase();
}

export function criterionLabel(key: string) {
  return key.replaceAll("_", " ");
}
