import Link from "next/link";
import { Logo } from "@/components/app/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link href="/" aria-label="AimTrack home">
          <Logo />
        </Link>
        <div className="flex flex-1 items-center justify-center py-12">{children}</div>
      </div>
      <aside className="relative hidden overflow-hidden border-l border-border bg-surface lg:block">
        <div className="bg-grid absolute inset-0" />
        <div className="absolute -right-32 -top-32 size-[520px] rounded-full bg-volt/10 blur-3xl" />
        <div className="relative flex h-full flex-col justify-end p-14">
          <p className="max-w-md text-3xl font-semibold leading-tight tracking-tight">
            &ldquo;A goal without a plan is just a wish.&rdquo;
            <span className="mt-3 block text-base font-normal text-muted">
              AimTrack builds the plan from how real people did it, then keeps it honest every day.
            </span>
          </p>
          <div className="mt-10 grid max-w-md grid-cols-3 gap-3 text-sm">
            {[
              ["Cited", "research, every claim linked"],
              ["Adaptive", "replans when life happens"],
              ["Daily", "tasks sized to your time"],
            ].map(([a, b]) => (
              <div key={a} className="rounded-xl border border-border bg-surface-2 p-3">
                <div className="font-semibold text-volt-strong">{a}</div>
                <div className="mt-0.5 text-xs text-muted">{b}</div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
