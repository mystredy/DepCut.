// See archivo.ts for why this loads from a local file.
import localFont from "next/font/local";

const libreFranklin = localFont({
  src: [
    { path: "./files/libreFranklin-600.woff2", weight: "600", style: "normal" },
    { path: "./files/libreFranklin-700.woff2", weight: "700", style: "normal" },
    { path: "./files/libreFranklin-800.woff2", weight: "800", style: "normal" },
  ],
  preload: false,
});

export const fontFamily = libreFranklin.style.fontFamily;
