import { useEffect, useRef, useState } from "react";

interface AudioPlayerProps {
  src: string;
  label: string;
}

export function AudioPlayer({ src, label }: AudioPlayerProps) {
  const ref = useRef<HTMLAudioElement>(null);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    if (ref.current) ref.current.volume = volume;
  }, [volume, src]);

  return (
    <div className="audio-dock">
      <p className="caption" style={{ margin: 0 }}>
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
