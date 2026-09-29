// See archivo.ts for why this loads from a local file.
import localFont from "next/font/local";

const quicksand = localFont({
  src: [
    { path: "./files/quicksand-500.woff2", weight: "500", style: "normal" },
    { path: "./files/quicksand-600.woff2", weight: "600", style: "normal" },
    { path: "./files/quicksand-700.woff2", weight: "700", style: "normal" },
  ],
  preload: false,
});

export const fontFamily = quicksand.style.fontFamily;
