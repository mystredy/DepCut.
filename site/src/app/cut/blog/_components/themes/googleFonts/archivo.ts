// Self-hosted from a local file instead of next/font/google: Turbopack's
// Google Fonts resolver ("next/font/google queries have exactly one entry")
// fails intermittently at build time — the file this loads from was fetched
// once from Google Fonts and committed, so there's no build-time network
// call left to flake. See googleFonts/files/ and fonts.ts for the pattern.
import localFont from "next/font/local";

const archivo = localFont({
  src: [
    { path: "./files/archivo-700.woff2", weight: "700", style: "normal" },
    { path: "./files/archivo-800.woff2", weight: "800", style: "normal" },
    { path: "./files/archivo-900.woff2", weight: "900", style: "normal" },
  ],
  preload: false,
});

export const fontFamily = archivo.style.fontFamily;
