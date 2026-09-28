import { cn } from "@/lib/utils";

/** AimTrack mark: a reticle whose inner arc is a rising progress line. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <rect width="32" height="32" rx="9" className="fill-volt" />
      <circle cx="16" cy="16" r="9" fill="none" stroke="#0a0b0d" strokeWidth="2.2" strokeDasharray="42 15" strokeLinecap="round" transform="rotate(-40 16 16)" />
      <path d="M10.5 18.5l3.6-3.6 2.8 2.8 5-5.4" fill="none" stroke="#0a0b0d" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark />
      <span className="text-[17px]">
        Aim<span className="text-muted">Track</span>
      </span>
    </span>
  );
}
