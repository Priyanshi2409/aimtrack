import Link from "next/link";
import { Logo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <Logo />
        <p className="mt-10 font-mono text-6xl font-semibold text-volt-strong">404</p>
        <h1 className="mt-3 text-xl font-semibold">Off target</h1>
        <p className="mt-2 text-sm text-muted">This page doesn&apos;t exist, or it isn&apos;t yours to see.</p>
        <Button asChild className="mt-6">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
