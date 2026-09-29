// See archivo.ts for why this loads from a local file.
import localFont from "next/font/local";

const playfairDisplay = localFont({
  src: [
    { path: "./files/playfairDisplay-600.woff2", weight: "600", style: "normal" },
    { path: "./files/playfairDisplay-700.woff2", weight: "700", style: "normal" },
    { path: "./files/playfairDisplay-800.woff2", weight: "800", style: "normal" },
  ],
  preload: false,
});

export const fontFamily = playfairDisplay.style.fontFamily;
