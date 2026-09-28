import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const GOAL_COLORS: Record<string, { dot: string; soft: string; text: string }> = {
  lime: { dot: "bg-volt", soft: "bg-volt-soft", text: "text-volt-strong" },
  ember: { dot: "bg-ember", soft: "bg-ember-soft", text: "text-ember" },
  sky: { dot: "bg-sky", soft: "bg-sky-soft", text: "text-sky" },
  iris: { dot: "bg-iris", soft: "bg-iris-soft", text: "text-iris" },
};
export const COLOR_KEYS = Object.keys(GOAL_COLORS);
export const goalColor = (c: string) => GOAL_COLORS[c] ?? GOAL_COLORS.lime;

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function greeting(hour: number) {
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
