import { WifiOff } from "lucide-react";
import { Logo } from "@/components/app/logo";

export const dynamic = "force-static";

export default function Offline() {
  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <Logo />
        <div className="mx-auto mt-10 grid size-14 place-items-center rounded-2xl bg-surface-2 text-muted">
          <WifiOff className="size-6" />
        </div>
        <h1 className="mt-5 text-xl font-semibold">You&apos;re offline</h1>
        <p className="mt-2 max-w-xs text-sm text-muted">AimTrack needs a connection to sync your tasks. It&apos;ll pick up where you left off once you&apos;re back online.</p>
      </div>
    </div>
  );
}
