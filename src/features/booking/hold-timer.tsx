"use client";

import { Timer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { countdown } from "@/lib/format";

interface HoldTimerProps {
  /** ISO instant when the hold ends, from the server. */
  expiresAt: string;
  /** Called once when the time runs out. */
  onExpire?: () => void;
  label?: string;
}

/** Counts down to a server-supplied instant, so the screen never decides when a hold ends. */
export function HoldTimer({ expiresAt, onExpire, label }: HoldTimerProps) {
  // null until mounted: the clock is only read in the browser.
  const [seconds, setSeconds] = useState<number | null>(null);
  // Latest callback without restarting the interval whenever the parent re-renders.
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  useEffect(() => {
    const end = new Date(expiresAt).getTime();
    let fired = false;
    const tick = () => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setSeconds(left);
      if (left === 0 && !fired) {
        fired = true;
        onExpireRef.current?.();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return (
    <p
      role="timer"
      className="bg-mist text-ink flex items-center justify-between gap-3 rounded-[14px] px-4 py-3 text-sm font-medium"
    >
      <span className="flex items-center gap-2">
        <Timer className="size-4" aria-hidden />
        {label ?? "Hours held. Time left"}
      </span>
      <span className="font-display text-2xl tabular-nums">
        {seconds === null ? "--:--" : countdown(seconds)}
      </span>
    </p>
  );
}
