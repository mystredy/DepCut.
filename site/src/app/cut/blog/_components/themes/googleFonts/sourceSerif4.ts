// See archivo.ts for why this loads from a local file.
import localFont from "next/font/local";

const sourceSerif4 = localFont({
  src: [
    { path: "./files/sourceSerif4-500.woff2", weight: "500", style: "normal" },
    { path: "./files/sourceSerif4-600.woff2", weight: "600", style: "normal" },
    { path: "./files/sourceSerif4-700.woff2", weight: "700", style: "normal" },
  ],
  preload: false,
});

export const fontFamily = sourceSerif4.style.fontFamily;
