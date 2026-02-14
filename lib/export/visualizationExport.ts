export type ExportFormat = "svg" | "png" | "jpeg" | "pdf";

interface ExportVisualizationOptions {
  container: HTMLElement;
  format: ExportFormat;
  fileBaseName: string;
  scale?: number;
  jpegQuality?: number;
  backgroundColor?: string;
}

const STYLE_PROPERTIES = [
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-opacity",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-dasharray",
  "stroke-dashoffset",
  "opacity",
  "color",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "letter-spacing",
  "text-anchor",
  "dominant-baseline",
  "vector-effect",
  "paint-order",
  "shape-rendering",
  "display",
  "visibility",
  "mix-blend-mode",
  "transform",
  "transform-origin",
] as const;

const MAX_EXPORT_EDGE = 8192;

interface SvgSnapshot {
  markup: string;
  width: number;
  height: number;
}

function sanitizeFileBaseName(name: string): string {
  const normalized = name.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
  return normalized.replace(/-+/g, "-").replace(/^-|-$/g, "") || "visualization";
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function numericAttr(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function resolveSvgDimensions(svg: SVGSVGElement): { width: number; height: number } {
  const rect = svg.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) {
    return { width: rect.width, height: rect.height };
  }

  const widthAttr = numericAttr(svg.getAttribute("width"));
  const heightAttr = numericAttr(svg.getAttribute("height"));
  if (widthAttr && heightAttr) {
    return { width: widthAttr, height: heightAttr };
  }

  const viewBox = svg.viewBox.baseVal;
  if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
    return { width: viewBox.width, height: viewBox.height };
  }

  return { width: 1200, height: 800 };
}

function svgScore(svg: SVGSVGElement): number {
  const rect = svg.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) {
    return rect.width * rect.height;
  }
  const { width, height } = resolveSvgDimensions(svg);
  return width * height;
}

function findTargetSvg(container: HTMLElement): SVGSVGElement | null {
  const svgs = Array.from(container.querySelectorAll("svg"));
  if (svgs.length === 0) return null;
  return svgs.reduce((best, current) => (svgScore(current) > svgScore(best) ? current : best));
}

function inlineComputedStyles(sourceSvg: SVGSVGElement, clonedSvg: SVGSVGElement): void {
  const sourceElements = [sourceSvg, ...Array.from(sourceSvg.querySelectorAll("*"))];
  const clonedElements = [clonedSvg, ...Array.from(clonedSvg.querySelectorAll("*"))];
  const count = Math.min(sourceElements.length, clonedElements.length);

  for (let i = 0; i < count; i += 1) {
    const sourceEl = sourceElements[i];
    const clonedEl = clonedElements[i];
    const computed = window.getComputedStyle(sourceEl);
    const styleParts: string[] = [];

    for (const prop of STYLE_PROPERTIES) {
      const value = computed.getPropertyValue(prop);
      if (!value) continue;
      styleParts.push(`${prop}:${value}`);
    }

    if (styleParts.length === 0) continue;
    const existingStyle = clonedEl.getAttribute("style");
    const joined = styleParts.join(";");
    clonedEl.setAttribute("style", existingStyle ? `${existingStyle};${joined}` : joined);
  }
}

function buildSvgSnapshot(svg: SVGSVGElement): SvgSnapshot {
  const cloned = svg.cloneNode(true) as SVGSVGElement;
  const { width, height } = resolveSvgDimensions(svg);

  inlineComputedStyles(svg, cloned);

  cloned.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  cloned.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  cloned.setAttribute("width", `${Math.round(width)}`);
  cloned.setAttribute("height", `${Math.round(height)}`);

  if (!cloned.getAttribute("viewBox")) {
    cloned.setAttribute("viewBox", `0 0 ${Math.round(width)} ${Math.round(height)}`);
  }

  const serializer = new XMLSerializer();
  const markup = serializer.serializeToString(cloned);
  return { markup, width, height };
}

async function loadImageFromSvg(svgMarkup: string): Promise<HTMLImageElement> {
  const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  const blobUrl = URL.createObjectURL(blob);

  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Unable to decode SVG image for export."));
      image.src = blobUrl;
    });
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

function scaleDimensions(width: number, height: number, scale: number): { width: number; height: number } {
  const rawWidth = Math.max(1, Math.round(width * scale));
  const rawHeight = Math.max(1, Math.round(height * scale));
  const ratio = Math.min(1, MAX_EXPORT_EDGE / rawWidth, MAX_EXPORT_EDGE / rawHeight);
  return {
    width: Math.max(1, Math.round(rawWidth * ratio)),
    height: Math.max(1, Math.round(rawHeight * ratio)),
  };
}

async function canvasFromSvg(
  snapshot: SvgSnapshot,
  scale: number,
  backgroundColor?: string
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  const image = await loadImageFromSvg(snapshot.markup);
  const scaled = scaleDimensions(snapshot.width, snapshot.height, scale);
  const canvas = document.createElement("canvas");
  canvas.width = scaled.width;
  canvas.height = scaled.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to acquire 2D canvas context for export.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  if (backgroundColor) {
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  context.setTransform(canvas.width / snapshot.width, 0, 0, canvas.height / snapshot.height, 0, 0);
  context.drawImage(image, 0, 0, snapshot.width, snapshot.height);

  return { canvas, width: canvas.width, height: canvas.height };
}

async function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob> {
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error(`Failed to render ${mimeType} blob.`));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality
    );
  });
}

function defaultBackgroundColor(): string {
  const theme = document.documentElement.getAttribute("data-theme");
  return theme === "dark" ? "#0c0b0d" : "#f7f3ea";
}

function uint8FromString(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function concatenateBytes(chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return output;
}

function generatePdfFromJpeg(jpegBytes: Uint8Array, imageWidth: number, imageHeight: number): Blob {
  const isLandscape = imageWidth >= imageHeight;
  const pageWidth = isLandscape ? 841.89 : 595.28;
  const pageHeight = isLandscape ? 595.28 : 841.89;
  const margin = 24;

  const maxWidth = pageWidth - margin * 2;
  const maxHeight = pageHeight - margin * 2;
  const imageRatio = imageWidth / imageHeight;

  let drawWidth = maxWidth;
  let drawHeight = drawWidth / imageRatio;
  if (drawHeight > maxHeight) {
    drawHeight = maxHeight;
    drawWidth = drawHeight * imageRatio;
  }

  const drawX = (pageWidth - drawWidth) / 2;
  const drawY = (pageHeight - drawHeight) / 2;
  const contentStream = `q
${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${drawX.toFixed(2)} ${drawY.toFixed(2)} cm
/Im0 Do
Q
`;

  const objectOffsets: number[] = [0];
  const chunks: Uint8Array[] = [];
  let offset = 0;

  const pushText = (text: string) => {
    const bytes = uint8FromString(text);
    chunks.push(bytes);
    offset += bytes.length;
  };

  const pushBytes = (bytes: Uint8Array) => {
    chunks.push(bytes);
    offset += bytes.length;
  };

  pushBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  objectOffsets[1] = offset;
  pushText("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  objectOffsets[2] = offset;
  pushText("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");

  objectOffsets[3] = offset;
  pushText(
    `3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Resources << /ProcSet [/PDF /ImageC] /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>
endobj
`
  );

  objectOffsets[4] = offset;
  pushText(
    `4 0 obj
<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>
stream
`
  );
  pushBytes(jpegBytes);
  pushText("\nendstream\nendobj\n");

  const contentBytes = uint8FromString(contentStream);
  objectOffsets[5] = offset;
  pushText(`5 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`);
  pushBytes(contentBytes);
  pushText("endstream\nendobj\n");

  const xrefOffset = offset;
  pushText("xref\n0 6\n0000000000 65535 f \n");
  for (let i = 1; i <= 5; i += 1) {
    pushText(`${objectOffsets[i].toString().padStart(10, "0")} 00000 n \n`);
  }

  pushText(`trailer
<< /Size 6 /Root 1 0 R >>
startxref
${xrefOffset}
%%EOF`);

  const bytes = concatenateBytes(chunks);
  return new Blob([bytes], { type: "application/pdf" });
}

export async function exportVisualization(options: ExportVisualizationOptions): Promise<void> {
  const targetSvg = findTargetSvg(options.container);
  if (!targetSvg) {
    throw new Error("No SVG visualization found in export target.");
  }

  const snapshot = buildSvgSnapshot(targetSvg);
  const baseName = sanitizeFileBaseName(options.fileBaseName);
  const scale = options.scale ?? 2;

  if (options.format === "svg") {
    const svgBlob = new Blob([snapshot.markup], { type: "image/svg+xml;charset=utf-8" });
    triggerDownload(svgBlob, `${baseName}.svg`);
    return;
  }

  if (options.format === "png") {
    const { canvas } = await canvasFromSvg(snapshot, scale, options.backgroundColor);
    const pngBlob = await canvasToBlob(canvas, "image/png");
    triggerDownload(pngBlob, `${baseName}.png`);
    return;
  }

  if (options.format === "jpeg") {
    const background = options.backgroundColor ?? defaultBackgroundColor();
    const { canvas } = await canvasFromSvg(snapshot, scale, background);
    const jpegBlob = await canvasToBlob(canvas, "image/jpeg", options.jpegQuality ?? 0.95);
    triggerDownload(jpegBlob, `${baseName}.jpg`);
    return;
  }

  const background = options.backgroundColor ?? defaultBackgroundColor();
  const { canvas, width, height } = await canvasFromSvg(snapshot, scale, background);
  const jpegBlob = await canvasToBlob(canvas, "image/jpeg", options.jpegQuality ?? 0.95);
  const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
  const pdfBlob = generatePdfFromJpeg(jpegBytes, width, height);
  triggerDownload(pdfBlob, `${baseName}.pdf`);
}
