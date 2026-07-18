# Embedding Visualizations

Quran Corpus Visualizer supports embedding individual visualizations in external websites, blogs, or documentation via iframes.

## Quick Start

```html
<iframe
  src="https://quranobservatory.org/embed/root-network?surah=3&theme=dark"
  width="800"
  height="600"
  style="border:0;border-radius:8px"
  loading="lazy"
  allowfullscreen
></iframe>
```

## URL Format

```
https://quranobservatory.org/embed/{vizMode}?surah={number}&theme={light|dark}&root={root}
```

## Available Visualization Modes

| Mode | Description |
|---|---|
| `radial-sura` | Radial Surah Map |
| `root-network` | Root Network Graph |
| `arc-flow` | Arc Flow |
| `dependency-tree` | Ayah Dependency Tree |
| `sankey-flow` | Root Flow Sankey |
| `surah-distribution` | Surah Distribution |
| `corpus-architecture` | Corpus Architecture |
| `knowledge-graph` | Knowledge Graph |
| `collocation-network` | Collocation Network |
| `heatmap` | Heatmap |

## Query Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `surah` | number | `1` | Surah number (1-114) |
| `theme` | string | `light` | `light` or `dark` |
| `root` | string | — | Optional Arabic root to focus on |

## Examples

### Root Network for Surah Al Imran (dark theme)

```html
<iframe
  src="https://quranobservatory.org/embed/root-network?surah=3&theme=dark"
  width="800"
  height="600"
  style="border:0;border-radius:8px"
  loading="lazy"
  allowfullscreen
></iframe>
```

### Radial Surah Map (light theme)

```html
<iframe
  src="https://quranobservatory.org/embed/radial-sura?surah=36&theme=light"
  width="800"
  height="600"
  style="border:0;border-radius:8px"
  loading="lazy"
  allowfullscreen
></iframe>
```

### Sankey Flow for Surah Al-Baqarah

```html
<iframe
  src="https://quranobservatory.org/embed/sankey-flow?surah=2&theme=dark"
  width="800"
  height="600"
  style="border:0;border-radius:8px"
  loading="lazy"
  allowfullscreen
></iframe>
```

## Responsive Embedding

For responsive layouts, wrap the iframe in a container:

```html
<div style="position:relative;width:100%;padding-bottom:75%;overflow:hidden">
  <iframe
    src="https://quranobservatory.org/embed/root-network?surah=3&theme=dark"
    style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;border-radius:8px"
    loading="lazy"
    allowfullscreen
  ></iframe>
</div>
```
