import type { CSSProperties } from "react";
import { TimerRing } from "../../components/ui";
import type { RoomCopy } from "./roomCopy";

interface RoomStageProps {
  room: RoomCopy;
  showMeter: boolean;
  micLevel: number;
  secondsLeft?: number | null;
  totalSeconds?: number;
}

export function RoomStage({
  room,
  showMeter,
  micLevel,
  secondsLeft,
  totalSeconds,
}: RoomStageProps) {
  return (
    <div className={`room-stage ${room.mode}`}>
      <div className="orb-halo" aria-hidden="true">
        <div
          className="voice-orb"
          style={
            {
              "--voice-scale": 1 + Math.min(0.15, micLevel * 2),
            } as CSSProperties
          }
        />
      </div>
      <div className="stack-sm" role="status" aria-live="polite">
        <p className="room-kicker">{room.kicker}</p>
        <h1 className="room-title">{room.title}</h1>
        <p className="room-hint">{room.hint}</p>
      </div>
      {room.mode === "prep" &&
        secondsLeft != null &&
        totalSeconds !== undefined && (
          <div className="prep-timer">
            <TimerRing seconds={secondsLeft} total={totalSeconds} />
          </div>
        )}
      <div className="mic-meter" aria-hidden="true">
        {Array.from({ length: 17 }, (_, index) => {
          const level = showMeter ? Math.min(1, micLevel * 9) : 0;
          const height =
            5 + level * (12 + 22 * Math.abs(Math.sin(index * 1.7)));
          return (
            <span
              key={index}
              className={`bar${showMeter ? " on" : ""}`}
              style={{ height, opacity: showMeter ? 0.4 + level * 0.6 : 0.2 }}
            />
          );
        })}
      </div>
    </div>
  );
}
