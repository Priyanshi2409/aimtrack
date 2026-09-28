import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { ServiceWorker } from "@/components/app/service-worker";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "AimTrack: goals grounded in real-world paths", template: "%s · AimTrack" },
  description:
    "Write any goal. AimTrack researches how real people achieved it, builds a cited, realistic roadmap, breaks it into daily tasks, and adapts as you go.",
  applicationName: "AimTrack",
  appleWebApp: { capable: true, title: "AimTrack", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0b0d" },
    { media: "(prefers-color-scheme: light)", color: "#f6f6f1" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          {children}
          <Toaster
            position="top-center"
            toastOptions={{ className: "!bg-surface-3 !text-fg !border-border !rounded-xl" }}
          />
          <ServiceWorker />
        </ThemeProvider>
      </body>
    </html>
  );
}
