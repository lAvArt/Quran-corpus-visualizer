/**
 * The indexable visualization gallery.
 *
 * Why this exists: the nine graphs are inline SVG that D3 builds inside
 * `useEffect`, so Google can never index them — there is no image resource to
 * crawl, and an <svg> element in the DOM is markup, not an image. This registry
 * backs a build step that snapshots each graph to a real PNG, plus a landing
 * page per graph that carries the PNG as an <img> on a crawlable URL.
 *
 * One list, three consumers: `scripts/build-graph-images.ts` renders from it,
 * `app/[locale]/viz/[mode]/page.tsx` renders pages from it, and `app/sitemap.ts`
 * lists those pages (with their images) from it. Adding a mode here is the only
 * edit needed to extend the gallery.
 *
 * Deliberately a SUBSET of the nine modes, and the subset is forced, not
 * chosen: only the modes that load per-surah data from local JSON render in a
 * headless capture. Every DB-backed mode -- collocation-network,
 * surah-distribution, corpus-architecture, knowledge-graph, heatmap -- paints
 * an empty frame, because the Supabase corpus tables it reads return nothing
 * (`/api/collocations` answers `{"collocates":[]}`, and the full-corpus fetch
 * aborts). They are omitted because an empty graph is worse than no page at
 * all; add them here once the corpus is seeded and they capture properly.
 */
import type { VisualizationMode } from "@/lib/schema/visualizationTypes";

export interface VizGalleryEntry {
    /** Visualization mode id — also the URL slug and the image basename. */
    mode: VisualizationMode;
    /** Key under the `Visualizations` message namespace holding `.title`. */
    titleKey: string;
    /**
     * Query string appended to `/embed/{mode}` when snapshotting. Modes that
     * need a subject (a root, a surah) get a representative one so the capture
     * shows a populated graph rather than an empty state.
     */
    embedQuery: string;
    /** Params for the live deep link into the full shell, per docs/VIZ_ARCHITECTURE.md. */
    liveQuery: string;
}

/** Rendered image dimensions. 1200x630 doubles as a valid Open Graph size. */
export const GRAPH_IMAGE_WIDTH = 1200;
export const GRAPH_IMAGE_HEIGHT = 630;

export const VIZ_GALLERY: readonly VizGalleryEntry[] = [
    {
        // The signature view, and by far the densest capture (~1500 marks).
        mode: "radial-sura",
        titleKey: "RadialSura",
        // Al-Baqarah: the longest surah, so the ring is fully populated.
        embedQuery: "surah=2",
        liveQuery: "viz=radial-sura&surah=2",
    },
    {
        mode: "sankey-flow",
        titleKey: "RootFlow",
        embedQuery: "surah=2",
        liveQuery: "viz=sankey-flow&surah=2",
    },
    {
        mode: "arc-flow",
        titleKey: "ArcFlow",
        embedQuery: "surah=2",
        liveQuery: "viz=arc-flow&surah=2",
    },
] as const;

export const GALLERY_MODES: readonly string[] = VIZ_GALLERY.map((e) => e.mode);

export function findGalleryEntry(mode: string): VizGalleryEntry | undefined {
    return VIZ_GALLERY.find((e) => e.mode === mode);
}

/** Public path of a mode's rendered PNG (site-root relative). */
export function graphImagePath(mode: string): string {
    return `/graphs/${mode}.png`;
}
