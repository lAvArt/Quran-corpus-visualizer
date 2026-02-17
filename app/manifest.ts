
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Quran Corpus Visualizer",
    short_name: "Quran Corpus",
    description:
      "Interactive exploration of Quranic linguistic structure and morphology through dynamic visualizations.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#05070d",
    theme_color: "#0f172a",
    lang: "en",
    dir: "auto",
    categories: ["education", "reference", "productivity"],
    icons: [
      {
        src: "/logo.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/favicon.svg",
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
