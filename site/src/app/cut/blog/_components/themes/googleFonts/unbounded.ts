// See archivo.ts for why this loads from a local file.
import localFont from "next/font/local";

const unbounded = localFont({
  src: [
    { path: "./files/unbounded-600.woff2", weight: "600", style: "normal" },
    { path: "./files/unbounded-700.woff2", weight: "700", style: "normal" },
    { path: "./files/unbounded-800.woff2", weight: "800", style: "normal" },
  ],
  preload: false,
});

export const fontFamily = unbounded.style.fontFamily;
