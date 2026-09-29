// See archivo.ts for why this loads from a local file.
import localFont from "next/font/local";

const baloo2 = localFont({
  src: [
    { path: "./files/baloo2-600.woff2", weight: "600", style: "normal" },
    { path: "./files/baloo2-700.woff2", weight: "700", style: "normal" },
  ],
  preload: false,
});

export const fontFamily = baloo2.style.fontFamily;
