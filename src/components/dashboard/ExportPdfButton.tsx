import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { paginateCanvas } from "@/lib/pdfPagination";
import {
  addCoverPage,
  addOutline,
  addTocPage,
  stampPagesWithBranding,
  type SectionAnchor,
} from "@/lib/pdfBranding";
import logoTakeat from "@/assets/logo-takeat.png";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export interface PdfSummaryItem {
  label: string;
  value: string;
}

interface Props {
  /** id do elemento a capturar */
  targetId?: string;
  summary?: PdfSummaryItem[];
  filename?: string;
  /** Título exibido na capa do PDF. */
  title?: string;
  /** Subtítulo exibido sob o título da capa. */
  subtitle?: string;
}

/**
 * Carrega uma imagem importada do bundle como data-URL (necessário para
 * jsPDF.addImage funcionar offline e para a marca d'água).
 */
const loadImageAsDataUrl = async (src: string): Promise<string> => {
  if (src.startsWith("data:")) return src;
  const res = await fetch(src);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Coleta âncoras de seção a partir do DOM capturado. Para cada `<section>`
 * com `data-pdf-title` (ou primeiro `<h3>` interno), grava o título + a
 * posição Y em coordenadas do canvas html2canvas.
 */
const collectSectionAnchors = (
  el: HTMLElement,
  canvas: HTMLCanvasElement,
): Array<{ title: string; canvasY: number }> => {
  const elRect = el.getBoundingClientRect();
  const ratio = canvas.height / el.scrollHeight;
  const out: Array<{ title: string; canvasY: number }> = [];
  el.querySelectorAll<HTMLElement>("section, [data-pdf-section]").forEach((node) => {
    if (node.offsetParent === null) return;
    const explicit = node.getAttribute("data-pdf-title");
    const heading = node.querySelector<HTMLElement>("h2, h3");
    const title = (explicit || heading?.textContent || "").trim();
    if (!title) return;
    const r = node.getBoundingClientRect();
    const canvasY = Math.max(0, Math.round((r.top - elRect.top) * ratio));
    out.push({ title, canvasY });
  });
  // Dedup por título (alguns wrappers internos repetem o h3) — fica o primeiro
  const seen = new Set<string>();
  return out.filter((a) => {
    if (seen.has(a.title)) return false;
    seen.add(a.title);
    return true;
  });
};

export const ExportPdfButton = ({
  targetId = "dashboard-pdf-root",
  summary = [],
  filename = "operacoes",
  title = "Painel de Operações — Onboarding Takeat",
  subtitle = "Visão consolidada de KPIs, funil, SLA e performance dos ativadores.",
}: Props) => {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ url: string; pages: number; name: string } | null>(null);

  const handle = async () => {
    const el = document.getElementById(targetId);
    if (!el) {
      toast({
        title: "Falha ao exportar PDF",
        description: `Elemento #${targetId} não encontrado.`,
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    document.body.classList.add("pdf-export");
    try {
      const [{ default: html2canvas }, { jsPDF }, logoDataUrl] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
        loadImageAsDataUrl(logoTakeat).catch(() => undefined),
      ]);

      await new Promise((r) => requestAnimationFrame(() => r(null)));

      const bg = getComputedStyle(document.body).backgroundColor || "#ffffff";
      const attempts: Array<{ label: string; opts: Parameters<typeof html2canvas>[1] }> = [
        {
          label: "alta-fidelidade",
          opts: { scale: 2, useCORS: true, backgroundColor: bg, windowWidth: el.scrollWidth },
        },
        {
          label: "sem-cors",
          opts: {
            scale: 1.5,
            useCORS: false,
            allowTaint: true,
            backgroundColor: bg,
            windowWidth: el.scrollWidth,
          },
        },
        {
          label: "minimo",
          opts: {
            scale: 1,
            useCORS: false,
            allowTaint: true,
            foreignObjectRendering: false,
            backgroundColor: bg,
            windowWidth: el.scrollWidth,
            logging: false,
            ignoreElements: (node: Element) => {
              const tag = node.tagName?.toLowerCase();
              return tag === "iframe" || tag === "video" || node.hasAttribute?.("data-pdf-skip");
            },
          },
        },
      ];

      let canvas: HTMLCanvasElement | null = null;
      let lastErr: unknown = null;
      for (const attempt of attempts) {
        try {
          canvas = await html2canvas(el, attempt.opts);
          if (attempt.label !== "alta-fidelidade") {
            console.warn(`[ExportPDF] usado fallback "${attempt.label}"`);
            toast({
              title: "PDF gerado em modo compatível",
              description: `Captura usou fallback "${attempt.label}".`,
            });
          }
          break;
        } catch (e) {
          lastErr = e;
          console.warn(`[ExportPDF] tentativa "${attempt.label}" falhou:`, e);
        }
      }
      if (!canvas) throw lastErr ?? new Error("html2canvas falhou em todas as tentativas");

      const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const usableW = pageW - margin * 2;

      pdf.setProperties({
        title,
        subject: subtitle,
        author: "Takeat",
        creator: "Takeat Dashboard",
      });

      // ===== Página 1: Capa =====
      addCoverPage(pdf, {
        title,
        subtitle,
        period: summary.find((s) => /per[ií]odo/i.test(s.label))?.value,
        filters: summary,
        logoDataUrl,
      });

      // ===== Página 2: Sumário (placeholder; preenchido depois) =====
      pdf.addPage();
      const tocPageNumber = pdf.getNumberOfPages();

      // ===== Páginas 3+: Conteúdo paginado =====
      pdf.addPage();
      const firstContentPage = pdf.getNumberOfPages();

      const pxPerPt = canvas.width / usableW;
      const fullPagePx = Math.floor((pageH - margin * 2) * pxPerPt);

      // Coleta candidatos de quebra segura
      const elRect = el.getBoundingClientRect();
      const domToCanvas = canvas.height / el.scrollHeight;
      const breakSelector =
        "[data-pdf-break], section, article, .rounded-xl, .rounded-2xl, .grid > *, table, tr";
      const breakSet = new Set<number>([0, canvas.height]);
      el.querySelectorAll<HTMLElement>(breakSelector).forEach((node) => {
        if (node.offsetParent === null) return;
        const r = node.getBoundingClientRect();
        const topPx = Math.round((r.top - elRect.top) * domToCanvas);
        const bottomPx = Math.round((r.bottom - elRect.top) * domToCanvas);
        if (topPx > 0 && topPx < canvas.height) breakSet.add(topPx);
        if (bottomPx > 0 && bottomPx < canvas.height) breakSet.add(bottomPx);
      });
      const breaks = Array.from(breakSet).sort((a, b) => a - b);

      // Sem header de conteúdo: primeira página de conteúdo já usa full page
      const slices = paginateCanvas({
        canvasHeight: canvas.height,
        breaks,
        firstPagePx: fullPagePx,
        fullPagePx,
      });

      // Coleta âncoras de seção para sumário/outline
      const sections = collectSectionAnchors(el, canvas);
      const anchors: SectionAnchor[] = [];
      const findPageForCanvasY = (y: number) => {
        for (let i = 0; i < slices.length; i++) {
          if (y >= slices[i].start && y < slices[i].end) return firstContentPage + i;
        }
        return firstContentPage + slices.length - 1;
      };
      for (const s of sections) {
        anchors.push({ title: s.title, page: findPageForCanvasY(s.canvasY) });
      }

      slices.forEach((slice, pageIdx) => {
        const sliceHpx = slice.end - slice.start;
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceHpx;
        const ctx = sliceCanvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(
          canvas,
          0,
          slice.start,
          canvas.width,
          sliceHpx,
          0,
          0,
          canvas.width,
          sliceHpx,
        );
        const data = sliceCanvas.toDataURL("image/jpeg", 0.92);
        if (pageIdx > 0) pdf.addPage();
        const sliceHpt = sliceHpx / pxPerPt;
        pdf.addImage(data, "JPEG", margin, margin, usableW, sliceHpt);
      });

      // ===== Finaliza: sumário, marca d'água + rodapé, outline =====
      addTocPage(pdf, anchors, tocPageNumber);
      addOutline(pdf, anchors);
      stampPagesWithBranding(pdf, {
        logoDataUrl,
        skipPages: [1, tocPageNumber],
      });

      const totalPages = pdf.getNumberOfPages();
      const stamp = new Date().toISOString().slice(0, 10);
      const blob = pdf.output("blob") as Blob;
      const url = URL.createObjectURL(blob);
      setPreview({ url, pages: totalPages, name: `${filename}_${stamp}.pdf` });
    } catch (err) {
      console.error("[ExportPDF]", err);
      toast({
        title: "Falha ao exportar PDF",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      document.body.classList.remove("pdf-export");
      setBusy(false);
    }
  };

  const closePreview = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const downloadPreview = () => {
    if (!preview) return;
    const a = document.createElement("a");
    a.href = preview.url;
    a.download = preview.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast({ title: "PDF baixado", description: `${preview.pages} página(s).` });
    closePreview();
  };

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <button
        onClick={handle}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 font-subtitle text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40"
        title="Exportar dashboard em PDF"
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <FileDown className="h-3 w-3" />
        )}
        {busy ? "Gerando…" : "Exportar PDF"}
      </button>

      <Dialog open={!!preview} onOpenChange={(o) => !o && closePreview()}>
        <DialogContent className="max-w-5xl p-0 sm:max-w-[min(95vw,1100px)]">
          <DialogHeader className="px-6 pt-5">
            <DialogTitle className="font-display text-base">
              Prévia do PDF · {preview?.pages} página(s)
            </DialogTitle>
          </DialogHeader>
          <div className="h-[70vh] w-full overflow-hidden border-y border-border bg-muted">
            {preview && (
              <iframe
                src={preview.url}
                title="Prévia PDF"
                className="h-full w-full"
              />
            )}
          </div>
          <DialogFooter className="gap-2 px-6 pb-5">
            <button
              onClick={closePreview}
              className="rounded-lg border border-border bg-card px-3 py-1.5 font-subtitle text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
            <button
              onClick={() => preview && window.open(preview.url, "_blank", "noopener")}
              className="rounded-lg border border-border bg-card px-3 py-1.5 font-subtitle text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Abrir em nova aba
            </button>
            <button
              onClick={downloadPreview}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 font-subtitle text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              <FileDown className="h-3 w-3" />
              Baixar PDF
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
