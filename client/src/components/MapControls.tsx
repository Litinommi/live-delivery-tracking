import { LocateFixed, Minus, Plus } from "lucide-react";

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecenter: () => void;
  isFollowing: boolean;
}

export function MapControls({ onZoomIn, onZoomOut, onRecenter, isFollowing }: MapControlsProps) {
  return (
    <div className="absolute right-4 bottom-6 z-[400] flex flex-col gap-2">
      <div className="flex flex-col rounded-xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <button
          onClick={onZoomIn}
          aria-label="Zoom in"
          className="h-10 w-10 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Plus size={18} />
        </button>
        <div className="h-px bg-slate-200 dark:bg-slate-700" />
        <button
          onClick={onZoomOut}
          aria-label="Zoom out"
          className="h-10 w-10 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Minus size={18} />
        </button>
      </div>
      <button
        onClick={onRecenter}
        aria-label="Recenter map on delivery location"
        className={`h-10 w-10 flex items-center justify-center rounded-xl shadow-lg border transition-colors ${
          isFollowing
            ? "bg-accent-600 border-accent-600 text-white"
            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        }`}
      >
        <LocateFixed size={18} />
      </button>
    </div>
  );
}
