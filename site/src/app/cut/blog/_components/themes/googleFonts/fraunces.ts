// See archivo.ts for why this loads from a local file.
import localFont from "next/font/local";

const fraunces = localFont({
  src: [
    { path: "./files/fraunces-400.woff2", weight: "400", style: "normal" },
    { path: "./files/fraunces-500.woff2", weight: "500", style: "normal" },
    { path: "./files/fraunces-600.woff2", weight: "600", style: "normal" },
  ],
  preload: false,
});

export const fontFamily = fraunces.style.fontFamily;
