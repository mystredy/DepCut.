// See archivo.ts for why this loads from a local file.
import localFont from "next/font/local";

const spaceGrotesk = localFont({
  src: [
    { path: "./files/spaceGrotesk-500.woff2", weight: "500", style: "normal" },
    { path: "./files/spaceGrotesk-600.woff2", weight: "600", style: "normal" },
    { path: "./files/spaceGrotesk-700.woff2", weight: "700", style: "normal" },
  ],
  preload: false,
});

export const fontFamily = spaceGrotesk.style.fontFamily;
