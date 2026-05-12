import { useState } from "react";
import { ChevronDown, Copy, Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import {
  AiExportMeta,
  copyMarkdown,
  downloadMarkdown,
  downloadPdf,
} from "@/lib/aiInsightExport";
import { logAudit } from "@/lib/audit";

interface Props {
  /** Markdown content to export. */
  content: string;
  meta: AiExportMeta;
  /** Optional context for audit log (e.g. "dashboard:executive"). */
  auditContext?: string;
  size?: "sm" | "default";
  variant?: "outline" | "ghost" | "secondary";
  disabled?: boolean;
}

export const AiExportMenu = ({
  content,
  meta,
  auditContext,
  size = "sm",
  variant = "outline",
  disabled,
}: Props) => {
  const [busy, setBusy] = useState(false);
  const isEmpty = !content?.trim();

  const audit = (format: "markdown_copy" | "markdown_download" | "pdf") => {
    logAudit({
      action: "ai_insights_exported",
      entity_type: "outro",
      entity_id: auditContext ?? null,
      summary: `${format} · ${meta.title}`,
      metadata: { format, model: meta.model, type: meta.typeLabel },
    });
  };

  const handleCopyMd = async () => {
    try {
      await copyMarkdown(content, meta);
      toast({ title: "Copiado", description: "Conteúdo em Markdown na área de transferência." });
      audit("markdown_copy");
    } catch {
      toast({ title: "Falha ao copiar", variant: "destructive" });
    }
  };

  const handleDownloadMd = () => {
    try {
      downloadMarkdown(content, meta);
      audit("markdown_download");
    } catch (e) {
      toast({ title: "Falha ao baixar Markdown", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleDownloadPdf = async () => {
    setBusy(true);
    try {
      await downloadPdf(content, meta);
      audit("pdf");
    } catch (e) {
      toast({ title: "Falha ao gerar PDF", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size={size}
          variant={variant}
          disabled={disabled || isEmpty || busy}
          className="gap-1.5"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          Exportar
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={handleCopyMd}>
          <Copy className="mr-2 h-3.5 w-3.5" /> Copiar como Markdown
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownloadMd}>
          <FileText className="mr-2 h-3.5 w-3.5" /> Baixar .md
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDownloadPdf}>
          <Download className="mr-2 h-3.5 w-3.5" /> Baixar PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
