import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Suspense } from "react";
import "./globals.css";

import { publicSiteSettings } from "@/lib/siteSettings";
import { QueryProvider } from "@/queries/QueryProvider";
import { ErrorReporter } from "./_components/ErrorReporter";
import { PostHogProvider } from "./_components/PostHogProvider";
import { TopProgressBar } from "./_components/TopProgressBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// admin/settings/general's Website Name and Description. generateMetadata
// (not a static export) because both come from the database.
export async function generateMetadata(): Promise<Metadata> {
  const { appName, description } = await publicSiteSettings();
  return {
    description: description ?? "A video editor that does all its work on your Mac.",
    title: appName,
    manifest: "/manifest.webmanifest",
    // Makes "Add to Home Screen" on iOS Safari launch standalone (no
    // browser chrome) instead of just bookmarking the URL — Android/Chrome's
    // install behavior comes from manifest.ts instead, this is iOS-only.
    appleWebApp: {
      capable: true,
      title: appName,
      statusBarStyle: "black-translucent",
    },
  };
}

// themeColor lives on Viewport, not Metadata, as of this Next.js version.
export async function generateViewport(): Promise<Viewport> {
  const { accentColor } = await publicSiteSettings();
  return {
    themeColor: accentColor ?? "#0a0a0a",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { accentColor } = await publicSiteSettings();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // The signed-in app's ThemeScript can add "dark" to this element before
      // React hydrates, which would otherwise read as a hydration mismatch
      // here even though it's an intentional, pre-paint change.
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {/* admin/settings/general's Brand / Accent Color: overrides --primary
            (globals.css's @theme maps --color-primary to it), the one lever
            this offers rather than recoloring every token in the palette. A
            raw <style> tag applies its cascade the same regardless of where
            it sits in the tree, so this needs no special <head> placement. */}
        {accentColor && <style>{`:root{--primary:${accentColor}}`}</style>}
        <Suspense fallback={null}>
          <TopProgressBar />
        </Suspense>
        <PostHogProvider>
          <QueryProvider>
            {children}
            <ErrorReporter />
          </QueryProvider>
        </PostHogProvider>
        {/* Leave NEXT_PUBLIC_GA_ID unset (e.g. local dev) to disable — same
            opt-in-by-env pattern as PostHog above. */}
        {process.env.NEXT_PUBLIC_GA_ID && (
          <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
        )}
      </body>
    </html>
  );
}
