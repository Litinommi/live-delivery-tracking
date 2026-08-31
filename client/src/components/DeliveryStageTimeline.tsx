import { Check } from "lucide-react";
import { DeliveryStage } from "../types";
import { DELIVERY_STAGES, STAGE_LABELS, stageIndex } from "../services/deliveryLifecycle";

interface DeliveryStageTimelineProps {
  currentStage: DeliveryStage;
}

/**
 * The lifecycle checklist: ✓ done, a pulsing dot for the active stage, an
 * empty ring for what's still ahead. Shared by the customer sidebar and the
 * mobile tracking screen so both read the same source of truth the same way.
 */
export function DeliveryStageTimeline({ currentStage }: DeliveryStageTimelineProps) {
  const currentIndex = stageIndex(currentStage);

  return (
    <ol className="space-y-2.5">
      {DELIVERY_STAGES.map((stage, index) => {
        const isDone = index < currentIndex;
        const isActive = index === currentIndex;
        return (
          <li key={stage} className="flex items-center gap-2.5">
            {isDone ? (
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Check size={11} strokeWidth={3} />
              </span>
            ) : isActive ? (
              <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
                <span className="absolute inline-flex h-full w-full rounded-full bg-accent-500 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent-600" />
              </span>
            ) : (
              <span className="h-4 w-4 shrink-0 rounded-full border-2 border-slate-200 dark:border-slate-700" />
            )}
            <span
              className={`text-sm ${
                isActive
                  ? "font-semibold text-slate-900 dark:text-white"
                  : isDone
                    ? "font-medium text-slate-500 dark:text-slate-400"
                    : "text-slate-400 dark:text-slate-600"
              }`}
            >
              {STAGE_LABELS[stage]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
