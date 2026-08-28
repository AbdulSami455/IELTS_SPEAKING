import { TimerRing } from "../../components/ui";
import type { RoomCopy } from "./roomCopy";

interface RoomStageProps {
  room: RoomCopy;
  showMeter: boolean;
  micLevel: number;
  secondsLeft?: number | null;
  totalSeconds?: number;
}

const BAR_COUNT = 5;

export function RoomStage({ room, showMeter, micLevel, secondsLeft, totalSeconds }: RoomStageProps) {
  return (
    <div className={`room-stage ${room.mode}`} aria-live="assertive">
      <p className="room-kicker">{room.kicker}</p>
      <h1 className="room-title">{room.title}</h1>
       <p className="room-hint">{room.hint}</p>
        {room.mode === "prep" && secondsLeft !== null && totalSeconds !== undefined && (
          <div className="prep-timer">
            <TimerRing seconds={secondsLeft!} total={totalSeconds!} />
          </div>
        )}
      {showMeter && (
        <div className="mic-meter" aria-hidden="true">
          {Array.from({ length: BAR_COUNT }).map((_, index) => {
            const normalized = Math.min(1, Math.max(0, (micLevel - index / BAR_COUNT) * BAR_COUNT));
            const height = 8 + normalized * 34;
            const on = normalized > 0.1;
            return (
              <span
                key={index}
                className={`bar${on ? " on" : ""}`}
                style={{
                  height: `${height}px`,
                  opacity: on ? 0.4 + normalized * 0.6 : 0.15,
                  transition: "height 0.06s ease-out, opacity 0.06s ease-out",
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
