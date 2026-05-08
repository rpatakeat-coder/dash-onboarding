import { Download } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { DashRow } from "@/hooks/useDashOperacoes";

interface Props {
  rows: DashRow[];
  filename?: string;
}

const COLS: Array<[keyof DashRow, string]> = [
  ["id_deal", "ID Deal"],
  ["nome_negocio", "Cliente"],
  ["agente_ativacao", "Ativador"],
  ["perfil_cliente", "Perfil"],
  ["etapa_negocio", "Etapa"],
  ["sla_dias", "SLA (dias)"],
  ["mrr", "MRR"],
  ["data_criacao", "Criado em"],
  ["data_entrada_fase", "Entrou na fase"],
];

const escape = (v: unknown) => {
  const s = String(v ?? "");
  if (s.includes(";") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

export const ExportCsvButton = ({ rows, filename = "operacoes" }: Props) => {
  const handle = () => {
    try {
      if (!rows.length) {
        toast({ title: "Nada para exportar", description: "Nenhum deal nos filtros atuais." });
        return;
      }
      const header = COLS.map(([, label]) => label).join(";");
      const body = rows
        .map((r) => COLS.map(([k]) => escape(r[k])).join(";"))
        .join("\n");
      const csv = "\uFEFF" + header + "\n" + body;
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `${filename}_${date}_${rows.length}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({ title: "CSV exportado", description: `${rows.length} linhas baixadas.` });
    } catch (err) {
      console.error("[ExportCSV]", err);
      toast({
        title: "Falha ao exportar CSV",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  };

  return (
    <button
      onClick={handle}
      disabled={!rows.length}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 font-subtitle text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40"
      title={`Exportar ${rows.length} deals filtrados`}
    >
      <Download className="h-3 w-3" />
      Exportar CSV
    </button>
  );
};
