// See archivo.ts for why this loads from a local file.
import localFont from "next/font/local";

const caveat = localFont({
  src: [
    { path: "./files/caveat-600.woff2", weight: "600", style: "normal" },
    { path: "./files/caveat-700.woff2", weight: "700", style: "normal" },
  ],
  preload: false,
});

export const fontFamily = caveat.style.fontFamily;
