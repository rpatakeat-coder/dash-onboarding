import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { paginateCanvas } from "@/lib/pdfPagination";
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
}

export const ExportPdfButton = ({
  targetId = "dashboard-pdf-root",
  summary = [],
  filename = "operacoes",
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
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ]);

      // Aguarda 1 frame para o CSS de export ser aplicado antes da captura
      await new Promise((r) => requestAnimationFrame(() => r(null)));

      const bg = getComputedStyle(document.body).backgroundColor || "#ffffff";
      // Tentativas em cascata: do mais fiel ao mais tolerante.
      // Cada fallback reduz scale, desativa recursos que costumam quebrar
      // (CORS de imagens externas, fontes web, foreignObject) e por fim
      // ignora nodes problemáticos (canvas/iframes) para garantir saída.
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

      // ===== Cabeçalho =====
      const date = new Date().toLocaleString("pt-BR");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.setTextColor(20);
      pdf.text("Painel de Operações — Onboarding Takeat", margin, margin + 4);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(120);
      pdf.text(`Gerado em ${date}`, margin, margin + 18);

      // Resumo de filtros estruturado (label : value), com wrap
      const labelW = 110; // pt — acomoda labels com sufixos descritivos
      const valueW = usableW - labelW - 8;
      const lineH = 11;
      let cursorY = margin + 34;

      if (summary.length) {
        // Linha divisória sutil
        pdf.setDrawColor(220);
        pdf.setLineWidth(0.5);
        pdf.line(margin, cursorY - 6, margin + usableW, cursorY - 6);

        for (const item of summary) {
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(8);
          pdf.setTextColor(90);
          const labelLines = pdf.splitTextToSize(item.label.toUpperCase(), labelW) as string[];
          pdf.text(labelLines, margin, cursorY);

          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(9);
          pdf.setTextColor(40);
          const valueLines = pdf.splitTextToSize(item.value, valueW) as string[];
          pdf.text(valueLines, margin + labelW, cursorY);
          const rows = Math.max(labelLines.length, valueLines.length);
          cursorY += rows * lineH;
        }
        cursorY += 4;
        pdf.setDrawColor(220);
        pdf.line(margin, cursorY - 4, margin + usableW, cursorY - 4);
      }

      const contentTop = cursorY + 6;
      const availPerPage = pageH - contentTop - margin;

      // ===== Imagem do dashboard, paginada sem cortes nem repetições =====
      const pxPerPt = canvas.width / usableW;
      const firstPagePx = Math.floor((pageH - contentTop - margin) * pxPerPt);
      const fullPagePx = Math.floor((pageH - margin * 2) * pxPerPt);

      // Coleta candidatos de "quebra segura": topo de cada card/linha relevante,
      // mapeado do espaço do DOM para coordenadas do canvas.
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

      const slices = paginateCanvas({
        canvasHeight: canvas.height,
        breaks,
        firstPagePx,
        fullPagePx,
      });
      const totalPages = slices.length;

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
        const top = pageIdx === 0 ? contentTop : margin;
        pdf.addImage(data, "JPEG", margin, top, usableW, sliceHpt);

        pdf.setFontSize(8);
        pdf.setTextColor(150);
        pdf.text(
          `Página ${pageIdx + 1} de ${totalPages} · Takeat`,
          pageW - margin,
          pageH - 10,
          { align: "right" },
        );
      });

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

  // Limpa blob URL quando o componente é desmontado
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
