"use client";

import { FadeIn } from "@/components/motion/primitives";

/** Every page in the app enters with a 200 ms fade + rise (instant under reduced motion). */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <FadeIn>{children}</FadeIn>;
}
