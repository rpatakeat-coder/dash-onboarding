/**
 * PDF branding helpers used by ExportPdfButton.
 *
 * Pure-ish: each function receives a jsPDF instance and writes to it.
 * Keeps ExportPdfButton focused on capture/pagination orchestration.
 */
import type { jsPDF } from "jspdf";

const A4_W_PT = 595.28;
const A4_H_PT = 841.89;

export interface CoverOptions {
  title: string;
  subtitle?: string;
  /** Período coberto pelo relatório (ex.: "01/05/2026 — 09/05/2026"). */
  period?: string;
  /** Quem gerou o PDF. */
  generatedBy?: string;
  /** Linhas extras de filtros (label: value) impressas no rodapé da capa. */
  filters?: Array<{ label: string; value: string }>;
  /** Logo PNG/JPG em data-URL (1920×558 ou similar). */
  logoDataUrl?: string;
  logoAspectRatio?: number;
}

export interface SectionAnchor {
  /** Título exibido no sumário e no painel de bookmarks. */
  title: string;
  /** Página (1-based, considerando capa+sumário) onde a seção começa. */
  page: number;
}

/**
 * Adiciona uma página de capa ANTES de qualquer conteúdo.
 * Deve ser chamada quando o PDF ainda está vazio (page 1).
 */
export const addCoverPage = (pdf: jsPDF, opts: CoverOptions) => {
  const margin = 56;
  const w = pdf.internal.pageSize.getWidth();
  const h = pdf.internal.pageSize.getHeight();

  // Faixa decorativa superior
  pdf.setFillColor(20, 23, 31);
  pdf.rect(0, 0, w, 210, "F");

  // Logo (centralizado dentro da faixa)
  if (opts.logoDataUrl) {
    const ratio = opts.logoAspectRatio ?? 1920 / 558;
    const logoW = 220;
    const logoH = logoW / ratio;
    pdf.addImage(opts.logoDataUrl, "PNG", (w - logoW) / 2, 80, logoW, logoH);
  } else {
    pdf.setTextColor(255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(28);
    pdf.text("TAKEAT", w / 2, 130, { align: "center" });
  }

  // Título principal
  pdf.setTextColor(20);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(26);
  const titleLines = pdf.splitTextToSize(opts.title, w - margin * 2) as string[];
  let y = 280;
  pdf.text(titleLines, w / 2, y, { align: "center" });
  y += titleLines.length * 30;

  if (opts.subtitle) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(13);
    pdf.setTextColor(110);
    const subLines = pdf.splitTextToSize(opts.subtitle, w - margin * 2) as string[];
    pdf.text(subLines, w / 2, y, { align: "center" });
    y += subLines.length * 18 + 6;
  }

  // Bloco de metadados
  y = Math.max(y, 420);
  pdf.setDrawColor(220);
  pdf.setLineWidth(0.5);
  pdf.line(margin, y, w - margin, y);
  y += 22;

  const meta: Array<[string, string]> = [];
  if (opts.period) meta.push(["Período", opts.period]);
  if (opts.generatedBy) meta.push(["Gerado por", opts.generatedBy]);
  meta.push(["Data de emissão", new Date().toLocaleString("pt-BR")]);

  pdf.setFontSize(10);
  for (const [label, value] of meta) {
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(90);
    pdf.text(label.toUpperCase(), margin, y);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(30);
    pdf.text(value, margin + 130, y);
    y += 16;
  }

  // Filtros (opcional)
  if (opts.filters?.length) {
    y += 12;
    pdf.setDrawColor(230);
    pdf.line(margin, y, w - margin, y);
    y += 18;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(90);
    pdf.text("FILTROS APLICADOS", margin, y);
    y += 14;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(40);
    for (const f of opts.filters) {
      const valueLines = pdf.splitTextToSize(
        `${f.label}: ${f.value}`,
        w - margin * 2,
      ) as string[];
      pdf.text(valueLines, margin, y);
      y += valueLines.length * 12;
      if (y > h - 100) break;
    }
  }

  // Rodapé da capa
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(140);
  pdf.text(
    "Painel de Operações · Onboarding Takeat",
    w / 2,
    h - 40,
    { align: "center" },
  );
};

/**
 * Adiciona uma página de sumário com âncoras clicáveis para cada seção.
 * Deve ser chamada APÓS addCoverPage e ANTES de gerar o conteúdo.
 * Retorna o número de páginas consumidas pelo sumário (1 ou mais).
 */
export const addTocPage = (
  pdf: jsPDF,
  anchors: SectionAnchor[],
  /** Página onde o sumário será desenhado (1-based, já existente). */
  tocPage: number,
): number => {
  if (!anchors.length) return 0;
  pdf.setPage(tocPage);
  const w = pdf.internal.pageSize.getWidth();
  const h = pdf.internal.pageSize.getHeight();
  const margin = 56;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.setTextColor(20);
  pdf.text("Sumário", margin, 90);

  pdf.setDrawColor(225);
  pdf.setLineWidth(0.5);
  pdf.line(margin, 104, w - margin, 104);

  let y = 140;
  const lineH = 22;
  pdf.setFontSize(11);

  for (const anchor of anchors) {
    if (y > h - 60) {
      pdf.addPage();
      y = 80;
    }
    const linkY = y - 10;
    const linkH = 16;

    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(30);
    pdf.text(anchor.title, margin, y);

    // Linha pontilhada entre título e número de página
    const titleW = pdf.getTextWidth(anchor.title);
    const pageNumW = pdf.getTextWidth(String(anchor.page));
    const dotsStart = margin + titleW + 6;
    const dotsEnd = w - margin - pageNumW - 6;
    if (dotsEnd > dotsStart) {
      pdf.setTextColor(180);
      const dotW = pdf.getTextWidth(".");
      const dotsCount = Math.max(0, Math.floor((dotsEnd - dotsStart) / dotW));
      if (dotsCount > 0) pdf.text(".".repeat(dotsCount), dotsStart, y);
    }

    pdf.setTextColor(30);
    pdf.text(String(anchor.page), w - margin, y, { align: "right" });

    // Link clicável cobrindo a linha inteira
    pdf.link(margin, linkY, w - margin * 2, linkH, { pageNumber: anchor.page });

    y += lineH;
  }

  return 1;
};

/**
 * Registra cada seção no painel de bookmarks (outline) do PDF.
 * Algumas builds antigas do jsPDF não expõem `outline` — protegemos com try/catch.
 */
export const addOutline = (pdf: jsPDF, anchors: SectionAnchor[]) => {
  try {
    // jsPDF 2.x expõe pdf.outline; tipos não declaram.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outline = (pdf as any).outline;
    if (!outline?.add) return;
    for (const a of anchors) {
      outline.add(null, a.title, { pageNumber: a.page });
    }
  } catch (e) {
    console.warn("[pdfBranding] outline indisponível:", e);
  }
};

/**
 * Desenha uma marca d'água (logo em baixa opacidade) e o rodapé padrão
 * em TODAS as páginas existentes, exceto as páginas listadas em `skipPages`
 * (1-based). Tipicamente: capa e sumário.
 */
export const stampPagesWithBranding = (
  pdf: jsPDF,
  {
    logoDataUrl,
    logoAspectRatio = 1920 / 558,
    skipPages = [],
    footerLeft = "Takeat · Painel de Operações",
  }: {
    logoDataUrl?: string;
    logoAspectRatio?: number;
    skipPages?: number[];
    footerLeft?: string;
  },
) => {
  // jsPDF tipa getNumberOfPages como existente
  const total = pdf.getNumberOfPages();
  const skip = new Set(skipPages);
  const w = pdf.internal.pageSize.getWidth();
  const h = pdf.internal.pageSize.getHeight();

  for (let i = 1; i <= total; i++) {
    if (skip.has(i)) continue;
    pdf.setPage(i);

    // Marca d'água diagonal centralizada
    if (logoDataUrl) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyPdf = pdf as any;
        anyPdf.saveGraphicsState?.();
        anyPdf.setGState?.(anyPdf.GState?.({ opacity: 0.06 }));
        const wmW = w * 0.7;
        const wmH = wmW / logoAspectRatio;
        // Centro da página
        const cx = w / 2;
        const cy = h / 2;
        // jsPDF addImage com rotação
        pdf.addImage(
          logoDataUrl,
          "PNG",
          cx - wmW / 2,
          cy - wmH / 2,
          wmW,
          wmH,
          undefined,
          "FAST",
          -25,
        );
        anyPdf.restoreGraphicsState?.();
      } catch (e) {
        console.warn("[pdfBranding] watermark falhou:", e);
      }
    }

    // Rodapé padrão
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(150);
    pdf.setDrawColor(230);
    pdf.setLineWidth(0.4);
    pdf.line(24, h - 22, w - 24, h - 22);
    pdf.text(footerLeft, 24, h - 10);
    pdf.text(`Página ${i} de ${total}`, w - 24, h - 10, { align: "right" });
  }
};

export const A4 = { W: A4_W_PT, H: A4_H_PT };
