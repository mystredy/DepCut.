// Every custom typeface a blog theme uses, kept separate from
// cut/lib/googleFonts.ts (the editor's own font registry) since this one
// serves the public blog, not the Cut editor. A theme names its faces
// through THEME_FONTS below, never a raw <link> or an unloaded font-family
// string, so what themes.ts promised (Fraunces, Playfair Display, JetBrains
// Mono, …) actually renders.
//
// Each font loads via next/font/local from a .woff2 committed under
// googleFonts/files/ (fetched once from Google Fonts — see git history for
// the fetch script) rather than next/font/google fetching from Google at
// build time: Turbopack's Google Fonts resolver ("next/font/google queries
// have exactly one entry") was nondeterministically failing on a different
// font on real Vercel builds, network flakiness with nothing local to fall
// back on. A committed file can't flake. Each font stays its own module
// under googleFonts/ from the era when that was the mitigation being tried;
// no longer load-bearing now, but no reason to undo it either.
import { fontFamily as archivo } from "./googleFonts/archivo";
import { fontFamily as baloo2 } from "./googleFonts/baloo2";
import { fontFamily as caveatFamily } from "./googleFonts/caveat";
import { fontFamily as fraunces } from "./googleFonts/fraunces";
import { fontFamily as ibmPlexMono } from "./googleFonts/ibmPlexMono";
import { fontFamily as ibmPlexSans } from "./googleFonts/ibmPlexSans";
import { fontFamily as jetbrainsMono } from "./googleFonts/jetbrainsMono";
import { fontFamily as libreFranklin } from "./googleFonts/libreFranklin";
import { fontFamily as playfairDisplay } from "./googleFonts/playfairDisplay";
import { fontFamily as quicksand } from "./googleFonts/quicksand";
import { fontFamily as sora } from "./googleFonts/sora";
import { fontFamily as sourceSerif4 } from "./googleFonts/sourceSerif4";
import { fontFamily as spaceGrotesk } from "./googleFonts/spaceGrotesk";
import { fontFamily as unbounded } from "./googleFonts/unbounded";

import type { BlogThemeId } from "@/lib/blog/themes";

const SANS = `${ibmPlexSans}, system-ui, sans-serif`;
const MONO = `${ibmPlexMono}, ui-monospace, monospace`;

/** A theme's two faces, as ready-to-use font-family values (loaded family
 * plus a plain fallback) — never the loaded font object itself, so callers
 * just drop these into an inline style. */
export const THEME_FONTS: Record<BlogThemeId, { headline: string; body: string }> = {
  glass: { headline: "inherit", body: "inherit" },
  ledger: { headline: `${sourceSerif4}, Georgia, serif`, body: SANS },
  bulletin: { headline: `${archivo}, system-ui, sans-serif`, body: SANS },
  quietPaper: { headline: `${fraunces}, Georgia, serif`, body: SANS },
  nightdesk: { headline: `${spaceGrotesk}, system-ui, sans-serif`, body: SANS },
  deck: { headline: `${sora}, system-ui, sans-serif`, body: SANS },
  digest: { headline: `${libreFranklin}, system-ui, sans-serif`, body: SANS },
  broadsheet: { headline: `${playfairDisplay}, Georgia, serif`, body: SANS },
  terminal: { headline: `${jetbrainsMono}, ui-monospace, monospace`, body: MONO },
  polaroid: { headline: `${baloo2}, system-ui, sans-serif`, body: SANS },
  brutalist: { headline: `${unbounded}, system-ui, sans-serif`, body: MONO },
  pastelStack: { headline: `${quicksand}, system-ui, sans-serif`, body: SANS },
  indexCard: { headline: SANS, body: SANS },
};

/** Polaroid's handwritten-style tag accent — the one face no other theme
 * shares, so it isn't worth a THEME_FONTS slot of its own. */
export const CAVEAT_FONT = `${caveatFamily}, cursive`;
