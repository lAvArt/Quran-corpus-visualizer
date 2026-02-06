import { VizExplainerContent } from "@/components/ui/VizExplainerDialog";

export const VIZ_HELP_CONTENT: Record<string, VizExplainerContent> = {
    "corpus-architecture": {
        title: "Corpus Architecture Map",
        description: "An interactive radial dendrogram visualizing the hierarchical structure of the Quran, from the full Corpus down to Surahs and their most frequent Roots.",
        sections: [
            {
                label: "Hierarchy Levels",
                text: "The center node represents the entire Quran. The first ring of nodes are the 114 Surahs. Branching out from each Surah are its top recurring Roots.",
            },
            {
                label: "Nodes & Size",
                text: "Surah (colorful) and Root (white) nodes. Larger nodes indicate higher token volume or frequency within their parent scope.",
            },
            {
                label: "Interactions",
                text: "Click a Surah to verify focus (drill down). Click a Root to see detailed stats. Use mouse wheel to zoom/pan.",
            },
        ],
    },
    "root-network": {
        title: "Root Network Graph",
        description: "A force-directed graph revealing the linguistic connections between Roots and Lemmas based on their co-occurrence and derivation patterns.",
        sections: [
            {
                label: "Roots & Lemmas",
                text: "Large central nodes are Roots (trilateral origins). Smaller peripheral nodes are Lemmas (dictionary forms) derived from them.",
            },
            {
                label: "Link Distance",
                text: "Shorter links indicate a stronger, more frequent connection between a Root and a Lemma.",
            },
            {
                label: "Node Size",
                text: "Proportional to the total frequency of occurrences in the selected scope (Surah or full Quran).",
            },
        ],
    },
    "radial-sura": {
        title: "Radial Surah Map",
        description: "A compact circular visualization of a single Surah's composition, plotting every Ayah (verse) and its constituent tokens.",
        sections: [
            {
                label: "Rings & Ayahs",
                text: "The circle is divided into segments representing Ayahs. The number of rings corresponds to the length/complexity of the Ayah.",
            },
            {
                label: "Token Dots",
                text: "Each dot is a word/token. Color represents the Part of Speech (Noun, Verb, Particle).",
            },
            {
                label: "Navigation",
                text: "Hover over dots to read the specific word and its translation. Click to focus on that token's connections.",
            },
        ],
    },
    "root-flow-sankey": {
        title: "Root-Lemma Flow",
        description: "A Sankey diagram tracing the flow from Arabic unique Roots to their various derived Lemmas, visualizing morphological productivity.",
        sections: [
            {
                label: "Flow Width",
                text: "The thickness of each band represents the Frequency of that specific Root-to-Lemma derivation.",
            },
            {
                label: "Left to Right",
                text: "Left column lists Roots. Right column lists Lemmas. The flow shows which roots generate which lemmas.",
            },
            {
                label: "Scope Awareness",
                text: "Counts update based on whether you are viewing the whole Quran or a specific Surah.",
            },
        ],
    },
    "surah-distribution": {
        title: "Surah Distribution Graph",
        description: "A linear distribution plot comparing Surahs based on length, token density, or other selected metrics.",
        sections: [
            {
                label: "Y-Axis Height",
                text: "Height of each bar/point represents the total token count (or selected metric) for that Surah.",
            },
            {
                label: "X-Axis Sequence",
                text: "Arranged in standard Mushaf order (1. Al-Fatiha to 114. An-Nas).",
            },
            {
                label: "Highlights",
                text: "Colored markers indicate Surahs containing the currently selected Root or Lemma.",
            },
        ],
    },
    "arc-flow": {
        title: "Arc Flow Diagram",
        description: "Compares grouped linguistic units in an arc layout, with curved links showing meaningful co-occurrence patterns.",
        sections: [
            {
                label: "By Root",
                text: "Each bar is a Root. Bar length shows frequency in scope. Curves connect roots that share lemmas.",
            },
            {
                label: "By POS",
                text: "Each bar is a Part-of-Speech tag from morphology data (N, V, ADJ, PRON, P, PART, CONJ). Curves show adjacent POS pairs inside the same Ayah.",
            },
            {
                label: "By Ayah",
                text: "Each bar is an Ayah in current context. Curves connect ayahs when selected context tokens transition across ayah boundaries.",
            },
        ],
    },
    "dependency-tree": {
        title: "Dependency Tree",
        description: "A hierarchical tree view of the grammatical structure within a single Ayah.",
        sections: [
            {
                label: "Tree Structure",
                text: "Top nodes are the main clauses. Child nodes represent dependent words (subjects, objects, modifiers).",
            },
            {
                label: "Links",
                text: "Lines represent grammatical dependencies (e.g., 'subject of', 'modified by').",
            },
        ],
    }
};
