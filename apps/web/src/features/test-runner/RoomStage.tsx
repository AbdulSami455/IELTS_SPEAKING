import type { RoomCopy } from "./roomCopy";

interface RoomStageProps {
  room: RoomCopy;
  showMeter: boolean;
  micLevel: number;
}

const BAR_THRESHOLDS = [0.04, 0.08, 0.12, 0.08, 0.05];

export function RoomStage({ room, showMeter, micLevel }: RoomStageProps) {
  return (
    <div className={`room-stage ${room.mode}`} aria-live="assertive">
      <p className="room-kicker">{room.kicker}</p>
      <h1 className="room-title">{room.title}</h1>
      <p className="room-hint">{room.hint}</p>
      {showMeter && (
        <div className="mic-meter" aria-hidden="true">
          {BAR_THRESHOLDS.map((threshold, index) => (
            <span
              key={index}
              className={micLevel >= threshold ? "on" : ""}
              style={{ height: `${8 + Math.min(34, micLevel * 280 + index * 2)}px` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
