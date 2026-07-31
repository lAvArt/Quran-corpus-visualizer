
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Quran Observatory",
    short_name: "Observatory",
    description:
      "Interactive exploration of Quranic linguistic structure and morphology through dynamic visualizations.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // Follow the device's natural orientation rather than free-rotating — an
    // installed PWA with "any" spins even when the phone's rotation is locked;
    // "natural" keeps it upright (portrait on phones) and respects the lock.
    orientation: "natural",
    // Match the dark shell (--bg-0) so the install splash and app chrome
    // don't flash the old slate blue before the app paints.
    background_color: "#0e161a",
    theme_color: "#0e161a",
    lang: "en",
    dir: "auto",
    categories: ["education", "reference", "productivity"],
    icons: [
      {
        src: "/icon-any.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Open Arabic",
        short_name: "Arabic",
        description: "Open the Arabic interface",
        url: "/ar",
      },
      {
        name: "Open English",
        short_name: "English",
        description: "Open the English interface",
        url: "/en",
      },
    ],
  };
}
