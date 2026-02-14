<div align="center">

# Quran Corpus Visualizer

**Interactive exploration of Quranic linguistic structure and morphology**

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![CI](https://github.com/lAvArt/Quran-corpus-visualizer/actions/workflows/ci.yml/badge.svg)](https://github.com/lAvArt/Quran-corpus-visualizer/actions/workflows/ci.yml)
[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel)](https://quran.pluragate.org)

[**Live Demo**](https://quran.pluragate.org) · [**Report Bug**](https://github.com/lAvArt/Quran-corpus-visualizer/issues/new?template=bug_report.md) · [**Request Feature**](https://github.com/lAvArt/Quran-corpus-visualizer/issues/new?template=feature_request.md)

</div>

---

<img width="2558" height="1266" alt="Quran Corpus Visualizer – Radial Surah Map" src="https://github.com/user-attachments/assets/6127e2ef-69e2-43ba-9ade-4a9a160f257a" />

A sophisticated interactive tool for exploring the linguistic and morphological structure of the Quran. Built upon the [Quranic Arabic Corpus](https://corpus.quran.com) API, this project transforms linear text into dynamic, explorable graphs.

> **If you find this project useful, please consider giving it a ⭐ — it helps others discover it!**

## Key Features

### Interactive Visualizations

- **Radial Surah Map** — Visualize the entire Quran or specific Surahs as a radial tree, highlighting relationships between Ayahs and roots.
- **Root Network Graph** — Explore the connectivity of Arabic roots across the corpus using force-directed graphs.
- **Surah Distribution** — Analyze the distribution of specific roots or lemmas across all Surahs.
- **Arc Flow Diagram** — Trace the flow of roots and grammatical connections within an Ayah.
- **Ayah Dependency Graph** — Deep dive into the syntactic dependency structure of individual Ayahs.
- **Root Flow Sankey** — Track how Arabic roots flow through different grammatical forms.
- **Corpus Architecture Map** — See the structural overview of the entire corpus.

### Advanced Search & Analysis

- **Morphological Search** — Filter by Root, Lemma, Part-of-Speech (POS), or specific Ayah.
- **Cross-Reference** — Instantly see where else a root or word appears in the Quran.
- **Full-Text Search** — Search both Arabic text and English translations.

### Modern UX/UI

- **Immersive Design** — A "neural" dark mode interface designed for deep focus.
- **Responsive** — Fully optimized for Desktop, Tablet, and Mobile with collapsible panels.
- **Internationalization** — Full support for English and Arabic interfaces (RTL).

<details>
<summary><strong>📸 More Screenshots</strong></summary>
<br/>

<img width="2553" height="1258" alt="Root Network Graph" src="https://github.com/user-attachments/assets/fab1fc07-f131-4f7b-8816-d30030b8cb93" />

<img width="2552" height="1246" alt="Surah Distribution" src="https://github.com/user-attachments/assets/2f89bef1-86b3-4b7b-ad9f-8570b6d6cea3" />

<img width="2559" height="1260" alt="Arc Flow Diagram" src="https://github.com/user-attachments/assets/40970f66-0c43-4532-a37f-d656a2ef9783" />

<img width="2554" height="1253" alt="Ayah Dependency Graph" src="https://github.com/user-attachments/assets/14579b20-74d4-47ce-9e65-8352d9791099" />

<img width="2558" height="1260" alt="Morphology Inspector" src="https://github.com/user-attachments/assets/06ea15df-22d7-441f-9669-e171cb8d7b3e" />

<img width="2553" height="1269" alt="Search Results" src="https://github.com/user-attachments/assets/09f0d47c-b574-45ec-b664-7105275c8cb3" />

<img width="2556" height="1263" alt="Arabic RTL Interface" src="https://github.com/user-attachments/assets/69d89927-4500-426b-b9e0-a68b3f3035c4" />

<img width="2557" height="1260" alt="Mobile Responsive View" src="https://github.com/user-attachments/assets/ab32616d-0ed1-446d-82ae-43c0d45d10d5" />

</details>

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. **Clone the repository**

    ```bash
    git clone https://github.com/lAvArt/Quran-corpus-visualizer.git
    cd Quran-corpus-visualizer
    ```

2. **Install dependencies**

    ```bash
    npm install
    ```

3. **Configure feedback email (optional)**

    ```bash
    BREVO_API_KEY=your_brevo_api_key_here
    FEEDBACK_TO_EMAIL=info@pluragate.org
    FEEDBACK_FROM_EMAIL=info@pluragate.org
    FEEDBACK_FROM_NAME=Quran Corpus Visualizer
    ```

    `FEEDBACK_TO_EMAIL` can be replaced with `NEXT_PUBLIC_FEEDBACK_EMAIL` for backward compatibility, but server-side `FEEDBACK_TO_EMAIL` is preferred.

4. **Fetch Cache Data** (Optional but recommended for offline dev)

    ```bash
    npm run fetch:morphology
    ```

5. **Run the development server**

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

## Project Structure

```text
├── app/                  # Next.js App Router pages and layouts
│   ├── [locale]/         # Localized pages (en, ar)
│   └── api/              # API routes (feedback)
├── components/
│   ├── visualisations/   # D3.js visualization components
│   ├── inspectors/       # Detailed data inspection panels
│   └── ui/               # Reusable UI elements (Sidebar, Search, etc.)
├── lib/
│   ├── corpus/           # Data loaders and types for Quranic data
│   ├── data/             # Static data (Surah names, help text)
│   ├── hooks/            # Custom React hooks (Zoom, Resize, etc.)
│   ├── schema/           # TypeScript types and validation
│   └── search/           # Search indexing and root flows
├── messages/             # i18n translation files (en, ar)
├── public/               # Static assets and corpus data
├── scripts/              # Build/dev helper scripts
└── docs/                 # Project documentation
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) before submitting a Pull Request.

See the [Roadmap](docs/ROADMAP.md) for planned features and priorities.

## Attribution & Data Sources

This project uses data and APIs from the **Quranic Arabic Corpus**, an open-source project created by **Kais Dukes** (Rahimahullah) and maintained by the community.

- **Source**: [github.com/kaisdukes/quranic-corpus](https://github.com/kaisdukes/quranic-corpus)
- **Website**: [corpus.quran.com](https://corpus.quran.com)

We explicitly acknowledge and thank the original authors for their monumental work in digitizing and annotating the linguistic structure of the Quran.

## Security

Please see [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

## License

This project is licensed under the **GNU General Public License v3.0 (GPL-3.0)** — see the [LICENSE](LICENSE) file for details.

This ensures that this project and any derivatives remain free and open for the benefit of the community, consistent with the upstream corpus license.

---

<div align="center">

**Built with reverence for the Quran and its linguistic heritage.**

[Live Demo](https://quran.pluragate.org) · [Documentation](docs/) · [Report Issue](https://github.com/lAvArt/Quran-corpus-visualizer/issues)

</div>
