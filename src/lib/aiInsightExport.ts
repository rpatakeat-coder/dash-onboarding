/**
 * Helpers to export AI Insights content as Markdown or PDF.
 * Lightweight: PDF is built directly via jsPDF with line-based markdown rendering
 * (no html2canvas needed for plain analytical text).
 */
import logoTakeat from "@/assets/logo-takeat.png";

export interface AiExportMeta {
  /** Top-level document title, e.g. "Insights da IA — Executivo". */
  title: string;
  /** Subtitle / scope (e.g. operator name, KPI name). */
  subtitle?: string;
  /** Type label (Executivo, Riscos, etc.) */
  typeLabel?: string;
  /** Optional applied focus text. */
  focus?: string;
  /** OpenAI model used. */
  model?: string;
  /** Generation timestamp (ms). */
  generatedAt?: number;
  /** Optional secondary block (used by side-by-side comparisons). */
  extras?: Array<{ heading: string; body: string }>;
}

const dateFmt = (ts?: number) =>
  new Date(ts ?? Date.now()).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

// ─────────────────────────────────────────────────────────── Markdown

export function toMarkdown(content: string, meta: AiExportMeta): string {
  const lines: string[] = [];
  lines.push(`# ${meta.title}`);
  if (meta.subtitle) lines.push(`_${meta.subtitle}_`);
  lines.push("");
  const metaLines: string[] = [];
  if (meta.typeLabel) metaLines.push(`**Tipo:** ${meta.typeLabel}`);
  if (meta.focus) metaLines.push(`**Foco:** ${meta.focus}`);
  if (meta.model) metaLines.push(`**Modelo:** ${meta.model}`);
  metaLines.push(`**Gerado em:** ${dateFmt(meta.generatedAt)}`);
  if (metaLines.length) {
    lines.push(metaLines.join(" · "));
    lines.push("");
  }
  lines.push("---");
  lines.push("");
  lines.push(content.trim());
  if (meta.extras?.length) {
    for (const ex of meta.extras) {
      lines.push("");
      lines.push("---");
      lines.push("");
      lines.push(`## ${ex.heading}`);
      lines.push("");
      lines.push(ex.body.trim());
    }
  }
  return lines.join("\n");
}

export async function copyMarkdown(content: string, meta: AiExportMeta) {
  const md = toMarkdown(content, meta);
  await navigator.clipboard.writeText(md);
}

export function downloadMarkdown(content: string, meta: AiExportMeta, filename?: string) {
  const md = toMarkdown(content, meta);
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? defaultFilename(meta, "md");
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function defaultFilename(meta: AiExportMeta, ext: "md" | "pdf"): string {
  const slug = (meta.subtitle ?? meta.title)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const stamp = new Date(meta.generatedAt ?? Date.now())
    .toISOString()
    .slice(0, 16)
    .replace(/[:T]/g, "-");
  return `ai-insights-${slug || "export"}-${stamp}.${ext}`;
}

// ─────────────────────────────────────────────────────────── PDF

const loadImageAsDataUrl = async (src: string): Promise<string | undefined> => {
  try {
    if (src.startsWith("data:")) return src;
    const res = await fetch(src);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
};

interface RenderState {
  y: number;
}

export async function downloadPdf(content: string, meta: AiExportMeta, filename?: string) {
  const [{ jsPDF }, logoDataUrl] = await Promise.all([
    import("jspdf"),
    loadImageAsDataUrl(logoTakeat),
  ]);

  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 56;
  const contentW = pageW - margin * 2;
  const bottomLimit = pageH - 60;

  const state: RenderState = { y: margin };

  drawHeader(pdf, meta, logoDataUrl, pageW, margin);
  state.y = margin + 96;

  const blocks: Array<{ heading?: string; body: string }> = [{ body: content }];
  if (meta.extras?.length) {
    for (const ex of meta.extras) blocks.push({ heading: ex.heading, body: ex.body });
  }

  for (const blk of blocks) {
    if (blk.heading) {
      ensureSpace(pdf, state, 28, margin, pageW, bottomLimit, meta);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.setTextColor(20);
      pdf.text(blk.heading, margin, state.y);
      state.y += 18;
      pdf.setDrawColor(220);
      pdf.line(margin, state.y - 6, pageW - margin, state.y - 6);
      state.y += 4;
    }
    renderMarkdown(pdf, blk.body, state, margin, contentW, bottomLimit, meta, pageW);
    state.y += 8;
  }

  drawFooters(pdf, pageW, pageH);

  pdf.save(filename ?? defaultFilename(meta, "pdf"));
}

function drawHeader(
  pdf: import("jspdf").jsPDF,
  meta: AiExportMeta,
  logoDataUrl: string | undefined,
  pageW: number,
  margin: number,
) {
  pdf.setFillColor(20, 23, 31);
  pdf.rect(0, 0, pageW, 72, "F");

  if (logoDataUrl) {
    const ratio = 1920 / 558;
    const logoH = 28;
    const logoW = logoH * ratio;
    try {
      pdf.addImage(logoDataUrl, "PNG", margin, 22, logoW, logoH);
    } catch {
      /* ignore */
    }
  }

  pdf.setTextColor(255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("Insights da IA · Takeat", pageW - margin, 38, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(200);
  pdf.text(dateFmt(meta.generatedAt), pageW - margin, 54, { align: "right" });

  // Title under header band
  pdf.setTextColor(20);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text(meta.title, margin, 92);

  if (meta.subtitle) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(110);
    pdf.text(meta.subtitle, margin, 108);
  }

  // Meta chips
  pdf.setFontSize(8);
  pdf.setTextColor(120);
  const chips: string[] = [];
  if (meta.typeLabel) chips.push(`Tipo: ${meta.typeLabel}`);
  if (meta.focus) chips.push(`Foco: ${meta.focus}`);
  if (meta.model) chips.push(`Modelo: ${meta.model}`);
  if (chips.length) pdf.text(chips.join("   ·   "), margin, 124);
}

function drawFooters(pdf: import("jspdf").jsPDF, pageW: number, pageH: number) {
  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(230);
    pdf.setLineWidth(0.4);
    pdf.line(40, pageH - 30, pageW - 40, pageH - 30);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(150);
    pdf.text("Takeat · Painel de Operações", 40, pageH - 16);
    pdf.text(`Página ${i} de ${total}`, pageW - 40, pageH - 16, { align: "right" });
  }
}

function ensureSpace(
  pdf: import("jspdf").jsPDF,
  state: RenderState,
  needed: number,
  margin: number,
  pageW: number,
  bottomLimit: number,
  meta: AiExportMeta,
) {
  if (state.y + needed > bottomLimit) {
    pdf.addPage();
    // Lighter header on continuation pages
    pdf.setFillColor(245, 246, 248);
    pdf.rect(0, 0, pageW, 36, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(80);
    pdf.text("Insights da IA · Takeat", margin, 22);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(120);
    pdf.text(meta.title, pageW - margin, 22, { align: "right" });
    state.y = margin + 12;
  }
}

/**
 * Very small markdown renderer that supports:
 *  - `## Heading` and `### Heading`
 *  - `- bullet` lists (single level)
 *  - `**bold**` runs inside paragraphs
 *  - blank lines as paragraph separators
 */
function renderMarkdown(
  pdf: import("jspdf").jsPDF,
  source: string,
  state: RenderState,
  margin: number,
  contentW: number,
  bottomLimit: number,
  meta: AiExportMeta,
  pageW: number,
) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");

  for (let raw of lines) {
    const line = raw.replace(/\s+$/g, "");

    if (!line.trim()) {
      state.y += 6;
      continue;
    }

    if (line.startsWith("## ")) {
      ensureSpace(pdf, state, 26, margin, pageW, bottomLimit, meta);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.setTextColor(15);
      const wrapped = pdf.splitTextToSize(line.slice(3).trim(), contentW) as string[];
      pdf.text(wrapped, margin, state.y);
      state.y += wrapped.length * 16 + 4;
      pdf.setDrawColor(230);
      pdf.line(margin, state.y - 2, margin + 40, state.y - 2);
      state.y += 6;
      continue;
    }

    if (line.startsWith("### ")) {
      ensureSpace(pdf, state, 20, margin, pageW, bottomLimit, meta);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(30);
      const wrapped = pdf.splitTextToSize(line.slice(4).trim(), contentW) as string[];
      pdf.text(wrapped, margin, state.y);
      state.y += wrapped.length * 14 + 2;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const text = line.replace(/^[-*]\s+/, "");
      ensureSpace(pdf, state, 14, margin, pageW, bottomLimit, meta);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(80);
      pdf.text("•", margin + 2, state.y);
      drawRichText(pdf, text, margin + 14, contentW - 14, state, bottomLimit, meta, margin, pageW);
      continue;
    }

    drawRichText(pdf, line, margin, contentW, state, bottomLimit, meta, margin, pageW);
  }
}

/**
 * Draws a paragraph that may contain `**bold**` runs by splitting and toggling
 * the font weight per token, then wrapping at word boundaries within `width`.
 */
function drawRichText(
  pdf: import("jspdf").jsPDF,
  text: string,
  x: number,
  width: number,
  state: RenderState,
  bottomLimit: number,
  meta: AiExportMeta,
  margin: number,
  pageW: number,
) {
  const lineH = 13;
  pdf.setFontSize(10);
  pdf.setTextColor(40);

  const tokens: Array<{ text: string; bold: boolean }> = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) tokens.push({ text: text.slice(last, m.index), bold: false });
    tokens.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) tokens.push({ text: text.slice(last), bold: false });
  if (!tokens.length) tokens.push({ text, bold: false });

  let cursorX = x;
  ensureSpace(pdf, state, lineH, margin, pageW, bottomLimit, meta);

  const flushNewLine = () => {
    state.y += lineH;
    cursorX = x;
    ensureSpace(pdf, state, lineH, margin, pageW, bottomLimit, meta);
  };

  for (const tok of tokens) {
    pdf.setFont("helvetica", tok.bold ? "bold" : "normal");
    // Split on whitespace but keep separators
    const parts = tok.text.split(/(\s+)/);
    for (const part of parts) {
      if (!part) continue;
      const w = pdf.getTextWidth(part);
      if (cursorX - x + w > width && cursorX !== x) {
        flushNewLine();
      }
      // Hard wrap very long unbreakable words
      if (w > width) {
        for (const ch of part) {
          const cw = pdf.getTextWidth(ch);
          if (cursorX - x + cw > width && cursorX !== x) flushNewLine();
          pdf.text(ch, cursorX, state.y);
          cursorX += cw;
        }
        continue;
      }
      pdf.text(part, cursorX, state.y);
      cursorX += w;
    }
  }
  state.y += lineH + 2;
}
