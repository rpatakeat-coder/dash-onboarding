import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";

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

  const handle = async () => {
    const el = document.getElementById(targetId);
    if (!el) return;
    setBusy(true);
    document.body.classList.add("pdf-export");
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ]);

      // Aguarda 1 frame para o CSS de export ser aplicado antes da captura
      await new Promise((r) => requestAnimationFrame(() => r(null)));

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
        windowWidth: el.scrollWidth,
      });

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
      const labelW = 70; // pt
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
          pdf.text(item.label.toUpperCase(), margin, cursorY);

          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(9);
          pdf.setTextColor(40);
          const lines = pdf.splitTextToSize(item.value, valueW) as string[];
          pdf.text(lines, margin + labelW, cursorY);
          cursorY += Math.max(lineH, lines.length * lineH);
        }
        cursorY += 4;
        pdf.setDrawColor(220);
        pdf.line(margin, cursorY - 4, margin + usableW, cursorY - 4);
      }

      const contentTop = cursorY + 6;
      const availPerPage = pageH - contentTop - margin;

      // ===== Imagem do dashboard, paginada =====
      const pxPerPt = canvas.width / usableW;
      const pageHeightPx = availPerPage * pxPerPt;
      let renderedPx = 0;
      let pageIdx = 0;
      const totalPages = Math.ceil(canvas.height / pageHeightPx);

      while (renderedPx < canvas.height) {
        const sliceHpx = Math.min(pageHeightPx, canvas.height - renderedPx);
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceHpx;
        const ctx = sliceCanvas.getContext("2d");
        if (!ctx) break;
        ctx.drawImage(
          canvas,
          0,
          renderedPx,
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

        // Rodapé
        pdf.setFontSize(8);
        pdf.setTextColor(150);
        pdf.text(
          `Página ${pageIdx + 1} de ${totalPages} · Takeat`,
          pageW - margin,
          pageH - 10,
          { align: "right" },
        );

        renderedPx += sliceHpx;
        pageIdx++;
      }

      const stamp = new Date().toISOString().slice(0, 10);
      pdf.save(`${filename}_${stamp}.pdf`);
    } finally {
      document.body.classList.remove("pdf-export");
      setBusy(false);
    }
  };

  return (
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
  );
};
