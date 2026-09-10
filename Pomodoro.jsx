import { useCallback, useEffect, useRef, useState } from "react";

const FOCUS_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function Pomodoro() {
  const [mode, setMode] = useState("focus");
  const [secondsLeft, setSecondsLeft] = useState(FOCUS_SECONDS);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef(null);

  const duration = mode === "focus" ? FOCUS_SECONDS : BREAK_SECONDS;
  const progress = 1 - secondsLeft / duration;

  const notify = useCallback((title, body) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    if (Notification.permission === "granted") {
      new Notification(title, { body });
      return;
    }

    if (Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          new Notification(title, { body });
        }
      });
    }
  }, []);

  useEffect(() => {
    if (!isRunning) {
      clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => Math.max(prev - 1, 0));
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  useEffect(() => {
    if (secondsLeft > 0) return;

    const nextMode = mode === "focus" ? "break" : "focus";
    const nextDuration = nextMode === "focus" ? FOCUS_SECONDS : BREAK_SECONDS;

    setMode(nextMode);
    setSecondsLeft(nextDuration);
    setIsRunning(true);

    if (nextMode === "break") {
      notify("Odak süresi bitti", "5 dakikalık molaya geçildi.");
    } else {
      notify("Mola bitti", "25 dakikalık odaklanmaya geçildi.");
    }
  }, [secondsLeft, mode, notify]);

  const handleStart = () => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    setIsRunning(true);
  };

  const handlePause = () => setIsRunning(false);

  const handleReset = () => {
    setIsRunning(false);
    setSecondsLeft(mode === "focus" ? FOCUS_SECONDS : BREAK_SECONDS);
  };

  const handleModeChange = (nextMode) => {
    if (nextMode === mode) return;
    setIsRunning(false);
    setMode(nextMode);
    setSecondsLeft(nextMode === "focus" ? FOCUS_SECONDS : BREAK_SECONDS);
  };

  return (
    <aside className="fixed right-6 top-1/2 z-40 w-[280px] -translate-y-1/2 rounded-3xl border border-stone-200/80 bg-white/80 p-6 shadow-xl shadow-stone-900/10 backdrop-blur-xl dark:border-stone-700/70 dark:bg-stone-900/80 dark:shadow-black/30">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500 dark:text-stone-400">
          Pomodoro
        </p>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
            mode === "focus"
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
              : "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200"
          }`}
        >
          {mode === "focus" ? "Odak" : "Mola"}
        </span>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-stone-100 p-1 dark:bg-stone-800/80">
        <button
          type="button"
          onClick={() => handleModeChange("focus")}
          className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
            mode === "focus"
              ? "bg-white text-stone-900 shadow-sm dark:bg-stone-700 dark:text-stone-50"
              : "text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
          }`}
        >
          25 dk
        </button>
        <button
          type="button"
          onClick={() => handleModeChange("break")}
          className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
            mode === "break"
              ? "bg-white text-stone-900 shadow-sm dark:bg-stone-700 dark:text-stone-50"
              : "text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
          }`}
        >
          5 dk
        </button>
      </div>

      <div className="relative mx-auto mb-6 flex h-40 w-40 items-center justify-center">
        <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            className="stroke-stone-200 dark:stroke-stone-700"
            strokeWidth="8"
          />
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            className={mode === "focus" ? "stroke-emerald-600 dark:stroke-emerald-400" : "stroke-sky-500 dark:stroke-sky-400"}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 52}
            strokeDashoffset={(1 - progress) * 2 * Math.PI * 52}
          />
        </svg>
        <time className="font-mono text-4xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
          {formatTime(secondsLeft)}
        </time>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={handleStart}
          disabled={isRunning}
          className="rounded-xl bg-emerald-700 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          Başlat
        </button>
        <button
          type="button"
          onClick={handlePause}
          disabled={!isRunning}
          className="rounded-xl bg-stone-200 px-3 py-2.5 text-sm font-medium text-stone-800 transition hover:bg-stone-300 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-stone-700 dark:text-stone-100 dark:hover:bg-stone-600"
        >
          Duraklat
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-xl bg-stone-900 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white"
        >
          Sıfırla
        </button>
      </div>
    </aside>
  );
}
