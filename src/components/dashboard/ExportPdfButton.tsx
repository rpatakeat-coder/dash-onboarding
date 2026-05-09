import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { paginateCanvas } from "@/lib/pdfPagination";
import {
  addCoverPage,
  addOutline,
  addTocPage,
  stampPagesWithBranding,
  type SectionAnchor,
} from "@/lib/pdfBranding";
import logoTakeat from "@/assets/logo-takeat.png";
import { Clock, FileDown, History, Loader2, Play, RotateCcw, Settings2, Star, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useExportHistory, type ExportHistoryEntry } from "@/hooks/useExportHistory";

export interface PdfSummaryItem {
  label: string;
  value: string;
}

interface Props {
  /** id do elemento a capturar */
  targetId?: string;
  summary?: PdfSummaryItem[];
  filename?: string;
  /** Título sugerido (editável no modal). */
  title?: string;
  /** Subtítulo sugerido (editável no modal). */
  subtitle?: string;
}

interface ExportConfig {
  title: string;
  subtitle: string;
  period: string;
  filtersText: string; // multiline "Label: valor"
  includeCover: boolean;
  includeToc: boolean;
  includeWatermark: boolean;
  includeFooter: boolean;
}

const DEFAULT_TITLE = "Painel de Operações — Onboarding Takeat";
const DEFAULT_SUBTITLE =
  "Visão consolidada de KPIs, funil, SLA e performance dos ativadores.";

const summaryToText = (summary: PdfSummaryItem[]) =>
  summary.map((s) => `${s.label}: ${s.value}`).join("\n");

const parseFiltersText = (text: string): PdfSummaryItem[] =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf(":");
      if (idx === -1) return { label: line, value: "" };
      return {
        label: line.slice(0, idx).trim(),
        value: line.slice(idx + 1).trim(),
      };
    });

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
  title = DEFAULT_TITLE,
  subtitle = DEFAULT_SUBTITLE,
}: Props) => {
  const [busy, setBusy] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [preview, setPreview] = useState<{ url: string; pages: number; name: string } | null>(null);
  const history = useExportHistory();
  const [autoSaveDefault, setAutoSaveDefault] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("takeat:pdf-export-autosave:v1") === "1";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "takeat:pdf-export-autosave:v1",
      autoSaveDefault ? "1" : "0",
    );
  }, [autoSaveDefault]);

  const restoreFromHistory = (entry: ExportHistoryEntry) => {
    setConfig({
      title: entry.title,
      subtitle: entry.subtitle,
      period: entry.period,
      filtersText: entry.filtersText,
      includeCover: entry.includeCover,
      includeToc: entry.includeToc,
      includeWatermark: entry.includeWatermark,
      includeFooter: entry.includeFooter,
    });
    toast({
      title: "Configuração restaurada",
      description: "Ajuste o que precisar e clique em Gerar prévia.",
    });
  };

  const regenerateFromHistory = (entry: ExportHistoryEntry) => {
    const cfg: ExportConfig = {
      title: entry.title,
      subtitle: entry.subtitle,
      period: entry.period,
      filtersText: entry.filtersText,
      includeCover: entry.includeCover,
      includeToc: entry.includeToc,
      includeWatermark: entry.includeWatermark,
      includeFooter: entry.includeFooter,
    };
    setConfig(cfg);
    toast({
      title: "Gerando novamente…",
      description: "Reaproveitando a configuração desta exportação.",
    });
    void runExport(cfg);
  };

  const initialPeriod = useMemo(
    () => summary.find((s) => /per[ií]odo/i.test(s.label))?.value ?? "",
    [summary],
  );

  const [config, setConfig] = useState<ExportConfig>(() => {
    const def = history.defaults;
    if (def) return { ...def };
    return {
      title,
      subtitle,
      period: initialPeriod,
      filtersText: summaryToText(summary),
      includeCover: true,
      includeToc: true,
      includeWatermark: true,
      includeFooter: true,
    };
  });

  // Sincroniza valores quando o usuário reabre o modal (props podem ter mudado)
  useEffect(() => {
    if (!configOpen) return;
    setConfig((prev) => ({
      ...prev,
      title: prev.title || title,
      subtitle: prev.subtitle || subtitle,
      period: prev.period || initialPeriod,
      filtersText: prev.filtersText || summaryToText(summary),
    }));
  }, [configOpen, title, subtitle, initialPeriod, summary]);

  const update = <K extends keyof ExportConfig>(key: K, value: ExportConfig[K]) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  // Auto-salva o padrão (debounce 600ms) enquanto o modal está aberto.
  useEffect(() => {
    if (!autoSaveDefault || !configOpen) return;
    const t = window.setTimeout(() => {
      history.saveDefault({ ...config });
    }, 600);
    return () => window.clearTimeout(t);
  }, [autoSaveDefault, configOpen, config, history]);

  const runExport = async (cfg: ExportConfig) => {
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
        title: cfg.title,
        subject: cfg.subtitle,
        author: "Takeat",
        creator: "Takeat Dashboard",
      });

      const filters = parseFiltersText(cfg.filtersText);
      const skipPages: number[] = [];
      let tocPageNumber: number | null = null;

      // ===== Capa (opcional) =====
      if (cfg.includeCover) {
        addCoverPage(pdf, {
          title: cfg.title,
          subtitle: cfg.subtitle,
          period: cfg.period || undefined,
          filters,
          logoDataUrl,
        });
        skipPages.push(pdf.getNumberOfPages());
      }

      // ===== Sumário (opcional, placeholder) =====
      if (cfg.includeToc) {
        if (cfg.includeCover) pdf.addPage();
        tocPageNumber = pdf.getNumberOfPages();
        skipPages.push(tocPageNumber);
      }

      // ===== Conteúdo paginado =====
      if (cfg.includeCover || cfg.includeToc) pdf.addPage();
      const firstContentPage = pdf.getNumberOfPages();

      const pxPerPt = canvas.width / usableW;
      const fullPagePx = Math.floor((pageH - margin * 2) * pxPerPt);

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
        firstPagePx: fullPagePx,
        fullPagePx,
      });

      const sections = collectSectionAnchors(el, canvas);
      const findPageForCanvasY = (y: number) => {
        for (let i = 0; i < slices.length; i++) {
          if (y >= slices[i].start && y < slices[i].end) return firstContentPage + i;
        }
        return firstContentPage + slices.length - 1;
      };
      const anchors: SectionAnchor[] = sections.map((s) => ({
        title: s.title,
        page: findPageForCanvasY(s.canvasY),
      }));

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

      // ===== Finaliza =====
      if (cfg.includeToc && tocPageNumber !== null) {
        addTocPage(pdf, anchors, tocPageNumber);
      }
      addOutline(pdf, anchors);
      if (cfg.includeFooter || cfg.includeWatermark) {
        stampPagesWithBranding(pdf, {
          logoDataUrl: cfg.includeWatermark ? logoDataUrl : undefined,
          skipPages,
        });
      }

      const totalPages = pdf.getNumberOfPages();
      const stamp = new Date().toISOString().slice(0, 10);
      const blob = pdf.output("blob") as Blob;
      const url = URL.createObjectURL(blob);
      setPreview({ url, pages: totalPages, name: `${filename}_${stamp}.pdf` });
      history.add({
        title: cfg.title,
        subtitle: cfg.subtitle,
        period: cfg.period,
        filtersText: cfg.filtersText,
        includeCover: cfg.includeCover,
        includeToc: cfg.includeToc,
        includeWatermark: cfg.includeWatermark,
        includeFooter: cfg.includeFooter,
        pageCount: totalPages,
      });
      setConfigOpen(false);
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
        onClick={() => setConfigOpen(true)}
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

      {/* === Modal de configuração === */}
      <Dialog open={configOpen} onOpenChange={(o) => !busy && setConfigOpen(o)}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-base">
              <Settings2 className="h-4 w-4" />
              Configurar exportação
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="pdf-title" className="text-xs">Título do relatório</Label>
              <Input
                id="pdf-title"
                value={config.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder={DEFAULT_TITLE}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="pdf-subtitle" className="text-xs">Subtítulo</Label>
              <Input
                id="pdf-subtitle"
                value={config.subtitle}
                onChange={(e) => update("subtitle", e.target.value)}
                placeholder={DEFAULT_SUBTITLE}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="pdf-period" className="text-xs">Período coberto</Label>
              <Input
                id="pdf-period"
                value={config.period}
                onChange={(e) => update("period", e.target.value)}
                placeholder="Ex.: 01/05/2026 — 09/05/2026"
              />
            </div>

            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="pdf-filters" className="text-xs">
                  Filtros aplicados
                </Label>
                <span className="text-[10px] text-muted-foreground">
                  Um por linha · formato <code>Rótulo: valor</code>
                </span>
              </div>
              <Textarea
                id="pdf-filters"
                value={config.filtersText}
                onChange={(e) => update("filtersText", e.target.value)}
                rows={4}
                className="font-mono text-xs"
                placeholder={"Período: Mês\nOperador: Maria"}
              />
            </div>

            <div className="grid gap-3 rounded-lg border border-border bg-muted/40 p-3">
              <div className="text-xs font-semibold text-muted-foreground">
                Componentes do PDF
              </div>
              {[
                {
                  key: "includeCover" as const,
                  label: "Página de capa",
                  hint: "Logo, título, período e filtros",
                },
                {
                  key: "includeToc" as const,
                  label: "Sumário com âncoras",
                  hint: "Lista clicável de seções",
                },
                {
                  key: "includeWatermark" as const,
                  label: "Marca d'água Takeat",
                  hint: "Logo diagonal em todas as páginas",
                },
                {
                  key: "includeFooter" as const,
                  label: "Rodapé com numeração",
                  hint: "Página X de Y em todas as folhas",
                },
              ].map((opt) => (
                <div key={opt.key} className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <Label
                      htmlFor={`pdf-${opt.key}`}
                      className="text-xs font-medium"
                    >
                      {opt.label}
                    </Label>
                    <p className="text-[10px] text-muted-foreground">{opt.hint}</p>
                  </div>
                  <Switch
                    id={`pdf-${opt.key}`}
                    checked={config[opt.key]}
                    onCheckedChange={(v) => update(opt.key, v)}
                  />
                </div>
              ))}
            </div>

            {history.entries.length > 0 && (
              <div className="grid gap-2 rounded-lg border border-border bg-muted/40 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <History className="h-3.5 w-3.5" />
                    Últimas exportações
                    <span className="ml-1 hidden font-normal text-[10px] text-muted-foreground/80 sm:inline">
                      · <kbd className="rounded border border-border bg-card px-1 text-[9px]">↑</kbd>/<kbd className="rounded border border-border bg-card px-1 text-[9px]">↓</kbd> navegam · <kbd className="rounded border border-border bg-card px-1 text-[9px]">PgUp</kbd>/<kbd className="rounded border border-border bg-card px-1 text-[9px]">PgDn</kbd> saltam · <kbd className="rounded border border-border bg-card px-1 text-[9px]">Enter</kbd>/<kbd className="rounded border border-border bg-card px-1 text-[9px]">G</kbd> geram de novo
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => history.clear()}
                    className="text-[10px] text-muted-foreground hover:text-destructive"
                  >
                    Limpar tudo
                  </button>
                </div>
                <ul className="-mx-1 max-h-44 space-y-1 overflow-y-auto pr-1">
                  {history.entries.map((entry) => (
                    <li
                      key={entry.id}
                      tabIndex={0}
                      role="button"
                      aria-label={`Item ${entry.title}. Setas para navegar, Enter ou G para gerar de novo.`}
                      onKeyDown={(e) => {
                        // Ignora se o foco está num botão interno
                        if (e.target !== e.currentTarget) return;

                        const li = e.currentTarget;
                        const ul = li.parentElement;
                        if (!ul) return;
                        const items = Array.from(
                          ul.querySelectorAll<HTMLLIElement>(":scope > li[tabindex='0']"),
                        );
                        const idx = items.indexOf(li);

                        const focusAt = (i: number) => {
                          const target = items[Math.max(0, Math.min(items.length - 1, i))];
                          target?.focus();
                          target?.scrollIntoView({ block: "nearest" });
                        };

                        switch (e.key) {
                          case "ArrowDown":
                            e.preventDefault();
                            focusAt(idx + 1);
                            return;
                          case "ArrowUp":
                            e.preventDefault();
                            focusAt(idx - 1);
                            return;
                          case "Home":
                            e.preventDefault();
                            focusAt(0);
                            return;
                          case "End":
                            e.preventDefault();
                            focusAt(items.length - 1);
                            return;
                          case "PageDown":
                            e.preventDefault();
                            focusAt(idx + 5);
                            return;
                          case "PageUp":
                            e.preventDefault();
                            focusAt(idx - 5);
                            return;
                        }

                        if (busy) return;
                        if (e.key === "Enter" || e.key.toLowerCase() === "g") {
                          e.preventDefault();
                          regenerateFromHistory(entry);
                        }
                      }}
                      className="group flex items-start gap-2 rounded-md border border-transparent bg-card/60 px-2 py-1.5 outline-none hover:border-border focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/40"
                    >
                      {(() => {
                        const isDefault = history.isDefaultEntry(entry);
                        return (
                          <>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate text-xs font-medium text-foreground">
                                  {entry.title}
                                </span>
                                {isDefault && (
                                  <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary">
                                    <Star className="h-2.5 w-2.5 fill-current" />
                                    Padrão
                                  </span>
                                )}
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="h-2.5 w-2.5" />
                                  {new Date(entry.createdAt).toLocaleString("pt-BR", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                                {entry.period && <span>· {entry.period}</span>}
                                <span>· {entry.pageCount} pág.</span>
                                {entry.filtersText && (
                                  <span className="truncate">
                                    ·{" "}
                                    {entry.filtersText
                                      .split(/\r?\n/)
                                      .filter(Boolean)
                                      .length}{" "}
                                    filtro(s)
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                if (isDefault) {
                                  history.clearDefault();
                                  toast({
                                    title: "Padrão removido",
                                    description: "O modal voltará ao preenchimento normal.",
                                  });
                                } else {
                                  history.saveDefault({
                                    title: entry.title,
                                    subtitle: entry.subtitle,
                                    period: entry.period,
                                    filtersText: entry.filtersText,
                                    includeCover: entry.includeCover,
                                    includeToc: entry.includeToc,
                                    includeWatermark: entry.includeWatermark,
                                    includeFooter: entry.includeFooter,
                                  });
                                  toast({
                                    title: "Definido como padrão",
                                    description: "Da próxima vez o modal abrirá com estas opções.",
                                  });
                                }
                              }}
                              title={isDefault ? "Desmarcar padrão" : "Definir como padrão"}
                              aria-label={isDefault ? "Desmarcar padrão" : "Definir como padrão"}
                              className={
                                isDefault
                                  ? "rounded p-1 text-primary hover:bg-muted"
                                  : "rounded p-1 text-muted-foreground hover:bg-muted hover:text-primary"
                              }
                            >
                              <Star
                                className={`h-3.5 w-3.5 ${isDefault ? "fill-current" : ""}`}
                              />
                            </button>
                          </>
                        );
                      })()}
                      <button
                        type="button"
                        onClick={() => regenerateFromHistory(entry)}
                        disabled={busy}
                        title="Gerar de novo com esta configuração"
                        aria-label="Gerar de novo com esta configuração"
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-primary disabled:opacity-40"
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => restoreFromHistory(entry)}
                        title="Restaurar configuração (sem gerar)"
                        aria-label="Restaurar configuração desta exportação"
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-primary"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => history.remove(entry.id)}
                        title="Remover do histórico"
                        aria-label="Remover do histórico"
                        className="rounded p-1 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-muted hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  history.saveDefault({ ...config });
                  toast({
                    title: "Padrão salvo",
                    description:
                      "O modal abrirá com estas opções nas próximas exportações.",
                  });
                }}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 font-subtitle text-xs font-medium text-muted-foreground hover:text-primary disabled:opacity-40"
                title="Salvar configuração atual como padrão"
              >
                <Star
                  className={`h-3 w-3 ${
                    history.defaults &&
                    history.defaults.title === config.title &&
                    history.defaults.subtitle === config.subtitle &&
                    history.defaults.period === config.period &&
                    history.defaults.filtersText === config.filtersText &&
                    history.defaults.includeCover === config.includeCover &&
                    history.defaults.includeToc === config.includeToc &&
                    history.defaults.includeWatermark === config.includeWatermark &&
                    history.defaults.includeFooter === config.includeFooter
                      ? "fill-current text-primary"
                      : ""
                  }`}
                />
                Salvar como padrão
              </button>
              {history.defaults && (
                <button
                  type="button"
                  onClick={() => {
                    history.clearDefault();
                    toast({
                      title: "Padrão removido",
                      description: "O modal voltará ao preenchimento normal.",
                    });
                  }}
                  disabled={busy}
                  className="rounded-lg px-2 py-1 font-subtitle text-[11px] text-muted-foreground hover:text-destructive disabled:opacity-40"
                >
                  Limpar padrão
                </button>
              )}
              <label
                className="ml-1 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card/60 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                title="Sempre que você ajustar título, filtros ou toggles, o padrão é atualizado automaticamente."
              >
                <Switch
                  checked={autoSaveDefault}
                  onCheckedChange={(v) => {
                    setAutoSaveDefault(v);
                    if (v) history.saveDefault({ ...config });
                    toast({
                      title: v ? "Auto-salvar ativado" : "Auto-salvar desativado",
                      description: v
                        ? "Mudanças no modal viram padrão automaticamente."
                        : "O padrão só será atualizado quando você clicar em Salvar.",
                    });
                  }}
                />
                Auto-salvar padrão
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setConfigOpen(false)}
                disabled={busy}
                className="rounded-lg border border-border bg-card px-3 py-1.5 font-subtitle text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={() => runExport(config)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 font-subtitle text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
              >
                {busy ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <FileDown className="h-3 w-3" />
                )}
                {busy ? "Gerando…" : "Gerar prévia"}
              </button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Modal de prévia === */}
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
