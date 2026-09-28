"use client";

import { useEffect, useState } from "react";
import { formatDate } from "@/lib/dates";
import { greetingFor } from "@/lib/greeting";

/**
 * The dashboard title and its date line, kept on the clock. The page renders
 * them once on the server; after that they are recomputed every half minute
 * and whenever the app comes back to the front (a phone woken at 5:02 pm shows
 * "Good evening" without a reload).
 */
export function LiveGreeting({ name, tz, initial }: { name: string; tz: string; initial: string }) {
  const [text, setText] = useState(initial);
  useEffect(() => {
    const tick = () => setText(greetingFor(name, tz).replace(/\.$/, ""));
    // Right after hydration too: the offline cache may have served a page rendered hours ago.
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [name, tz]);
  return <>{text}</>;
}

/** "Monday, September 28", kept current past midnight the same way. */
export function LiveDate({ initial }: { initial: string }) {
  const [text, setText] = useState(initial);
  useEffect(() => {
    const tick = () => setText(formatDate(new Date(), "EEEE, MMMM d"));
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  return <>{text}</>;
}
