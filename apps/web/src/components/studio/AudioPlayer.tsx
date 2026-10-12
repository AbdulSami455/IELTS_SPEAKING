interface AudioPlayerProps {
  src: string;
  label: string;
}

export function AudioPlayer({ src, label }: AudioPlayerProps) {
  return (
    <div className="grid gap-1.5 rounded-lg border border-border bg-card px-4 py-3">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <audio controls src={src} aria-label={label} className="h-10 w-full" />
    </div>
  );
}
