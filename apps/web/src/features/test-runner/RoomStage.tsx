import type { CSSProperties } from "react";
import { Mic } from "lucide-react";
import { TimerRing } from "../../components/studio";
import type { RoomCopy } from "./roomCopy";
import { cn } from "@/lib/utils";

interface RoomStageProps {
  room: RoomCopy;
  showMeter: boolean;
  micLevel: number;
  secondsLeft?: number | null;
  totalSeconds?: number;
}

export function RoomStage({ room, showMeter, micLevel, secondsLeft, totalSeconds }: RoomStageProps) {
  const speaking = room.mode === "speak";
  const dimmed = room.mode === "wait" || room.mode === "think";
  return (
    <div className="grid w-full grid-cols-[88px_minmax(0,1fr)] items-center gap-x-4 gap-y-1 text-left md:grid-cols-1 md:justify-items-center md:gap-y-3.5 md:text-center">
      <div className="orb-halo row-span-3 size-[88px] md:row-span-1 md:size-[210px]" aria-hidden="true">
        <div
          className={cn(
            "voice-orb size-16 md:size-[150px]",
            room.mode === "listen" && "orb-breathe",
            speaking && "bg-primary text-card",
            dimmed && "opacity-55",
          )}
          style={{ "--voice-scale": 1 + Math.min(0.15, micLevel * 2) } as CSSProperties}
        >
          <Mic strokeWidth={1.6} />
        </div>
      </div>
      <div className="grid gap-0.5 md:gap-1.5" role="status" aria-live="polite">
        <p className={cn("text-[11px] font-semibold tracking-[0.1em] uppercase", speaking || room.mode === "listen" ? "text-primary" : "text-muted-foreground")}>
          {room.kicker}
        </p>
        <h1 className="text-[21px] md:text-[clamp(24px,2.4vw,30px)]">{room.title}</h1>
        <p className="max-w-[40ch] text-[13px] text-muted-foreground md:mx-auto md:text-sm">{room.hint}</p>
      </div>
      {room.mode === "prep" && secondsLeft != null && totalSeconds !== undefined && (
        <div className="col-start-2 justify-self-start md:col-start-auto md:justify-self-center">
          <TimerRing seconds={secondsLeft} total={totalSeconds} size={72} />
        </div>
      )}
      <div className="col-start-2 flex h-5 items-center justify-start gap-1 md:col-start-auto md:h-9 md:justify-center" aria-hidden="true">
        {Array.from({ length: 17 }, (_, index) => {
          const level = showMeter ? Math.min(1, micLevel * 9) : 0;
          const height = 5 + level * (12 + 22 * Math.abs(Math.sin(index * 1.7)));
          return (
            <span
              key={index}
              className="w-[3px] min-h-1 rounded-full bg-indigo-vivid transition-[height] duration-100"
              style={{ height, opacity: showMeter ? 0.4 + level * 0.6 : 0.2 }}
            />
          );
        })}
      </div>
    </div>
  );
}
