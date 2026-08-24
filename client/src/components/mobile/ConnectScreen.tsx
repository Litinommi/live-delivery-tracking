import { FormEvent, useState } from "react";
import { Navigation } from "lucide-react";

interface ConnectScreenProps {
  onConnect: (code: string) => void;
  connecting: boolean;
  errorMessage: string | null;
}

export function ConnectScreen({ onConnect, connecting, errorMessage }: ConnectScreenProps) {
  const [code, setCode] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (code.trim().length < 4) return;
    onConnect(code.trim().toUpperCase());
  };

  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm animate-fade-in-up">
        <div className="mx-auto mb-6 h-14 w-14 rounded-2xl bg-accent-50 dark:bg-accent-900/30 flex items-center justify-center">
          <Navigation className="text-accent-600 dark:text-accent-400" size={24} />
        </div>
        <h1 className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-1">
          Live Delivery
        </h1>
        <p className="text-center text-slate-500 dark:text-slate-400 mb-8">Connect to your order</p>

        <label
          htmlFor="trackingCode"
          className="block text-xs font-semibold tracking-wider text-slate-400 dark:text-slate-500 mb-2"
        >
          TRACKING CODE
        </label>
        <input
          id="trackingCode"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABC123"
          maxLength={8}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="w-full text-center text-2xl font-mono font-semibold tracking-[0.3em] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white py-4 mb-4 outline-none focus:ring-2 focus:ring-accent-500 transition-shadow"
        />

        {errorMessage && <p className="text-sm text-red-500 mb-4 text-center">{errorMessage}</p>}

        <button
          type="submit"
          disabled={connecting || code.trim().length < 4}
          className="w-full rounded-xl bg-accent-600 hover:bg-accent-700 disabled:opacity-60 text-white font-medium py-4 shadow-sm shadow-accent-600/20 active:scale-[0.98] transition-all"
        >
          {connecting ? "Connecting…" : "Connect"}
        </button>

        <p className="text-xs text-center text-slate-400 dark:text-slate-500 mt-6">
          Your location will be used for live delivery tracking.
        </p>
      </form>
    </div>
  );
}
