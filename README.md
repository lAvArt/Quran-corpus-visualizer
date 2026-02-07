# Quran Corpus Visualizer

A sophisticated interactive tool for exploring the linguistic and morphological structure of the Quran. Built upon the [Quranic Arabic Corpus](https://corpus.quran.com) API, this project transforms linear text into dynamic, explorable graphs.

![Quran Corpus Visualizer Preview](/public/og-image.jpg)

## 🌟 Key Features

### Interactive Visualizations

- **Radial Surah Map**: Visualize the entire Quran or specific Surahs as a radial tree, highlighting relationships between Ayahs and roots.
- **Root Network Graph**: Explore the connectivity of Arabic roots across the corpus using force-directed graphs.
- **Surah Distribution**: Analyze the distribution of specific roots or lemmas across all Surahs.
- **Arc Flow Diagram**: Trace the flow of roots and grammatical connections within an Ayah.
- **Ayah Dependency Graph**: Deep dive into the syntactic dependency structure of individual Ayahs.

### Advanced Search & Analysis

- **Morphological Search**: Filter by Root, Lemma, Part-of-Speech (POS), or specific Ayah.
- **Cross-Reference**: Instantly see where else a root or word appears in the Quran.
- **Full-Text Search**: Search both Arabic text and English translations.

### Modern UX/UI

- **Immersive Design**: A "neural" dark mode interface designed for deep focus.
- **Responsive**: Fully optimized for Desktop, Tablet, and Mobile with collapsible panels.
- **Internationalization**: Full support for English and Arabic interfaces (RTL).

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. **Clone the repository**

    ```bash
    git clone https://github.com/yourusername/quran-corpus-visualizer.git
    cd quran-corpus-visualizer
    ```

2. **Install dependencies**

    ```bash
    npm install
    ```

3. **Fetch Cache Data** (Optional but recommended for offline dev)

    ```bash
    npm run fetch:morphology
    ```

4. **Run the development server**

    ```bash
    npm run dev
    ```

    Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 🛠️ Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **Visualization**: [D3.js](https://d3js.org/) for complex graphs
- **Animation**: Framer Motion
- **Styling**: Tailwind CSS / CSS Modules
- **Internationalization**: next-intl

## 📂 Project Structure

```text
├── app/                  # Next.js App Router pages and layouts
├── components/
│   ├── visualisations/   # D3.js visualization components
│   ├── ui/               # Reusable UI elements (Sidebar, Search, etc.)
├── lib/
│   ├── corpus/           # Data loaders and types for Quranic data
│   ├── data/             # Static data (Surah names, help text)
│   ├── hooks/            # Custom React hooks (Zoom, Resize, etc.)
├── public/               # Static assets
└── ...
```

## 📜 Attribution & Data Sources

This project uses data and APIs from the **Quranic Arabic Corpus**, an open-source project created by **Kais Dukes** (Rahimahullah) and maintained by the community.

- **Source**: [github.com/kaisdukes/quranic-corpus](https://github.com/kaisdukes/quranic-corpus)
- **Website**: [corpus.quran.com](https://corpus.quran.com)

We explicitly acknowledge and thank the original authors for their monumental work in digitizing and annotating the linguistic structure of the Quran.

## ⚖️ License

This project is licensed under the **GNU General Public License v3.0 (GPL-3.0)** - see the [LICENSE](LICENSE) file for details.

This ensures that this project and any derivatives remain free and open for the benefit of the community, consistent with the upstream corpus license.
