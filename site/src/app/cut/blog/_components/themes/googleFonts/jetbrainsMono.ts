// See archivo.ts for why this loads from a local file.
import localFont from "next/font/local";

const jetbrainsMono = localFont({
  src: [
    { path: "./files/jetbrainsMono-400.woff2", weight: "400", style: "normal" },
    { path: "./files/jetbrainsMono-500.woff2", weight: "500", style: "normal" },
    { path: "./files/jetbrainsMono-600.woff2", weight: "600", style: "normal" },
    { path: "./files/jetbrainsMono-700.woff2", weight: "700", style: "normal" },
  ],
  preload: false,
});

export const fontFamily = jetbrainsMono.style.fontFamily;
