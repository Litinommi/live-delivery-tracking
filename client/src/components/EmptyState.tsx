import { PackageSearch } from "lucide-react";

interface EmptyStateProps {
  onCreateOrder: () => void;
  creating: boolean;
  errorMessage: string | null;
}

export function EmptyState({ onCreateOrder, creating, errorMessage }: EmptyStateProps) {
  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center animate-fade-in-up">
        <div className="mx-auto mb-6 h-16 w-16 rounded-2xl bg-accent-50 dark:bg-accent-900/30 flex items-center justify-center">
          <PackageSearch className="text-accent-600 dark:text-accent-400" size={28} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
          Live Delivery Tracking
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mb-8">
          See your delivery move in real time, the moment it leaves for you.
        </p>
        <button
          onClick={onCreateOrder}
          disabled={creating}
          className="inline-flex items-center justify-center rounded-xl bg-accent-600 hover:bg-accent-700 disabled:opacity-60 text-white font-medium px-6 py-3 shadow-sm shadow-accent-600/20 active:scale-[0.98] transition-all"
        >
          {creating ? "Creating order…" : "Create Fake Order"}
        </button>
        {errorMessage && <p className="text-sm text-red-500 mt-4">{errorMessage}</p>}
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-6">
          Your live delivery will appear here
        </p>
      </div>
    </div>
  );
}
