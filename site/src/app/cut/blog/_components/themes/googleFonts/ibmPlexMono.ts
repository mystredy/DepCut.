// See archivo.ts for why this loads from a local file.
import localFont from "next/font/local";

const ibmPlexMono = localFont({
  src: [
    { path: "./files/ibmPlexMono-400.woff2", weight: "400", style: "normal" },
    { path: "./files/ibmPlexMono-500.woff2", weight: "500", style: "normal" },
    { path: "./files/ibmPlexMono-600.woff2", weight: "600", style: "normal" },
  ],
  preload: false,
});

export const fontFamily = ibmPlexMono.style.fontFamily;
