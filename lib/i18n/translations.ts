export type Language = "en" | "ar";

export interface Translations {
    // Header
    appTitle: string;
    corpusAtlas: string;
    surahs: string;
    tokens: string;
    roots: string;

    // Current Selection Panel
    currentSelection: string;
    view: string;
    surah: string;
    ayah: string;
    root: string;
    lemma: string;
    token: string;
    ayahText: string;

    // Visualizations
    surahDistribution: string;
    radialSura: string;
    rootNetwork: string;
    arcFlow: string;
    dependencyTree: string;
    sankeyFlow: string;
    corpusArchitecture: string;
    heatmap: string;

    // Sidebar
    index: string;
    search: string;
    inspector: string;

    // Actions
    showTools: string;
    hideTools: string;
    loadMore: string;
    filterRoot: string;
    allRoots: string;

    // Theme
    lightTheme: string;
    darkTheme: string;
}

export const translations: Record<Language, Translations> = {
    en: {
        // Header
        appTitle: "Quran Corpus Visualizer",
        corpusAtlas: "Corpus Atlas",
        surahs: "Surahs",
        tokens: "Tokens",
        roots: "Roots",

        // Current Selection Panel
        currentSelection: "Current Selection",
        view: "View",
        surah: "Surah",
        ayah: "Ayah",
        root: "Root",
        lemma: "Lemma",
        token: "Token",
        ayahText: "Ayah Text",

        // Visualizations
        surahDistribution: "Surah Distribution",
        radialSura: "Radial Sura",
        rootNetwork: "Root Network",
        arcFlow: "Arc Flow",
        dependencyTree: "Dependency Tree",
        sankeyFlow: "Sankey Flow",
        corpusArchitecture: "Corpus Architecture",
        heatmap: "Heatmap",

        // Sidebar
        index: "Index",
        search: "Search",
        inspector: "Inspector",

        // Actions
        showTools: "Show Tools",
        hideTools: "Hide Tools",
        loadMore: "Load more",
        filterRoot: "Filter Root",
        allRoots: "All roots",

        // Theme
        lightTheme: "Light theme",
        darkTheme: "Dark theme",
    },
    ar: {
        // Header
        appTitle: "مصوّر القرآن الكريم",
        corpusAtlas: "أطلس القرآن",
        surahs: "سورة",
        tokens: "كلمة",
        roots: "جذر",

        // Current Selection Panel
        currentSelection: "التحديد الحالي",
        view: "العرض",
        surah: "السورة",
        ayah: "الآية",
        root: "الجذر",
        lemma: "اللفظ",
        token: "الكلمة",
        ayahText: "نص الآية",

        // Visualizations
        surahDistribution: "توزيع السور",
        radialSura: "خريطة دائرية",
        rootNetwork: "شبكة الجذور",
        arcFlow: "تدفق القوس",
        dependencyTree: "شجرة التبعية",
        sankeyFlow: "تدفق سانكي",
        corpusArchitecture: "هيكل القرآن",
        heatmap: "خريطة حرارية",

        // Sidebar
        index: "الفهرس",
        search: "بحث",
        inspector: "المفتش",

        // Actions
        showTools: "عرض الأدوات",
        hideTools: "إخفاء الأدوات",
        loadMore: "تحميل المزيد",
        filterRoot: "تصفية الجذر",
        allRoots: "جميع الجذور",

        // Theme
        lightTheme: "النمط الفاتح",
        darkTheme: "النمط الداكن",
    },
};
