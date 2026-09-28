import type { MetadataRoute } from "next";

import { publicSiteSettings } from "@/lib/siteSettings";

// Dynamic in place of a static manifest.json, so admin/settings/general's
// name/description/accent-color edits take effect without a rebuild — same
// reasoning as icon.tsx/apple-icon.tsx. Icons point at the bundled
// depcut-app-icon.png (a real 1024x1024 source, unlike the favicon/apple
// touch icon defaults, which are sized for a browser tab and don't hold up
// scaled to a 512px install icon) rather than /apple-icon, so this doesn't
// silently track a future admin-uploaded touch icon at the wrong size.
export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { appName, description, accentColor } = await publicSiteSettings();

  return {
    name: appName,
    short_name: appName,
    description: description ?? undefined,
    start_url: "/app",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: accentColor ?? "#0a0a0a",
    icons: [
      { src: "/depcut-app-icon.png", sizes: "192x192", type: "image/png" },
      { src: "/depcut-app-icon.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
