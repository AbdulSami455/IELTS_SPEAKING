interface AudioPlayerProps {
  src: string;
  label: string;
}

export function AudioPlayer({ src, label }: AudioPlayerProps) {
  return (
    <div className="audio-dock">
      <span className="caption">{label}</span>
      <audio controls src={src} aria-label={label} />
    </div>
  );
}
