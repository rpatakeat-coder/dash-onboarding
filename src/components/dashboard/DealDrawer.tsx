import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import {
  fmtBRL,
  slaBand,
  SLA_BAND_META,
  type DashRow,
} from "@/hooks/useDashOperacoes";
import { computeRisk } from "@/lib/risk";
import {
  ExternalLink,
  Phone,
  Calendar,
  Flag,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";

interface Props {
  deal: DashRow | null;
  onClose: () => void;
}

const num = (v: unknown) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const fmtDate = (s: string | null | undefined) => {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const daysBetween = (a: string | null | undefined, b: string | null | undefined) => {
  if (!a || !b) return null;
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (!Number.isFinite(da) || !Number.isFinite(db)) return null;
  return Math.round((db - da) / 86_400_000);
};

const ETAPAS_CRITICAS = new Set([
  "Pré-Cancelamento",
  "Inativo",
  "Pendências",
  "Processo Pausado",
]);

function suggestActions(deal: DashRow, lastMeeting: Date | null, lastCall: Date | null) {
  const out: string[] = [];
  const sla = num(deal.sla_dias);
  const mrr = num(deal.mrr);
  const etapa = (deal.etapa_negocio ?? "").trim();
  if (sla > 60 && ETAPAS_CRITICAS.has(etapa)) {
    out.push("SLA acima de 60 dias em etapa crítica — escalar para liderança.");
  } else if (sla > 30) {
    out.push("SLA estourado (>30d). Revisar bloqueios diretamente com o cliente.");
  }
  const sinceMeeting = lastMeeting
    ? Math.round((Date.now() - lastMeeting.getTime()) / 86_400_000)
    : null;
  if (mrr >= 1500 && (sinceMeeting === null || sinceMeeting > 14)) {
    out.push(
      `MRR alto (${fmtBRL(mrr)}) sem reunião nos últimos ${sinceMeeting ?? "—"} dias — agendar QBR.`,
    );
  }
  const sinceCall = lastCall
    ? Math.round((Date.now() - lastCall.getTime()) / 86_400_000)
    : null;
  if ((sinceCall === null || sinceCall > 7) && ETAPAS_CRITICAS.has(etapa)) {
    out.push("Mais de 7 dias sem ligação registrada — fazer follow-up imediato.");
  }
  if (etapa === "Treinamento" && sla > 14) {
    out.push("Treinamento parado >14d — agendar sessão guiada de implementação.");
  }
  if (!out.length) out.push("Nenhuma ação crítica detectada — manter cadência atual.");
  return out;
}

export const DealDrawer = ({ deal, onClose }: Props) => {
  const open = !!deal;
  const id = deal?.id_deal;

  const { data: ligacoes } = useQuery({
    queryKey: ["deal-ligacoes", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("Ligações Realizadas" as any)
        .select("id_chamada,resultado_chamada,duracao_chamada,data_realizada,seller,nome_tarefa")
        .eq("id_deal", String(id))
        .order("data_realizada", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as Array<{
        id_chamada: number;
        resultado_chamada: string | null;
        duracao_chamada: string | null;
        data_realizada: string | null;
        seller: string | null;
        nome_tarefa: string | null;
      }>;
    },
  });

  const { data: reunioes } = useQuery({
    queryKey: ["deal-reunioes", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("Reuniões Marcadas" as any)
        .select("id_deal,data_reuniao,data_reuniao_realizada,reuniao_realizada,seller")
        .eq("id_deal", id!)
        .order("data_reuniao", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as Array<{
        data_reuniao: string | null;
        data_reuniao_realizada: string | null;
        reuniao_realizada: string | null;
        seller: string | null;
      }>;
    },
  });

  const risk = useMemo(() => (deal ? computeRisk([deal])[0] : null), [deal]);

  const lastCall = useMemo(() => {
    const d = ligacoes?.[0]?.data_realizada;
    return d ? new Date(d) : null;
  }, [ligacoes]);
  const lastMeeting = useMemo(() => {
    const r = reunioes?.find((x) => x.data_reuniao_realizada);
    const d = r?.data_reuniao_realizada ?? reunioes?.[0]?.data_reuniao ?? null;
    return d ? new Date(d) : null;
  }, [reunioes]);

  const sugestoes = deal ? suggestActions(deal, lastMeeting, lastCall) : [];
  const sla = deal ? num(deal.sla_dias) : 0;
  const meta = SLA_BAND_META[slaBand(sla)];
  const diasNaFase = deal ? daysBetween(deal.data_entrada_fase, new Date().toISOString()) : null;
  const diasTotal = deal ? daysBetween(deal.data_criacao, new Date().toISOString()) : null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-xl"
      >
        {deal && (
          <>
            <SheetHeader className="space-y-2 text-left">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <SheetTitle className="truncate font-display text-xl">
                    {deal.nome_negocio?.trim() || "—"}
                  </SheetTitle>
                  <p className="font-subtitle text-xs text-muted-foreground">
                    {deal.agente_ativacao?.trim() || "Sem ativador"} ·{" "}
                    {(deal.perfil_cliente?.trim().split(/\s+/)[0] || "—").toUpperCase()} ·{" "}
                    {fmtBRL(num(deal.mrr))}/mês
                  </p>
                </div>
                <a
                  href={`https://app.hubspot.com/contacts/_/deal/${deal.id_deal}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 font-subtitle text-xs text-primary hover:bg-primary/10"
                >
                  HubSpot <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <span
                  className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-numeric text-xs font-semibold tabular-nums"
                  style={{
                    color: `hsl(var(${meta.cssVar}))`,
                    borderColor: `hsl(var(${meta.cssVar}) / 0.35)`,
                    backgroundColor: `hsl(var(${meta.cssVar}) / 0.12)`,
                  }}
                >
                  SLA {sla.toFixed(0)}d · {meta.label}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-0.5 font-subtitle text-xs">
                  Etapa: {deal.etapa_negocio?.trim() || "—"}
                </span>
                {risk && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-0.5 font-numeric text-xs font-semibold text-destructive">
                    Risco {risk.score.toFixed(0)} · {risk.band}
                  </span>
                )}
              </div>
            </SheetHeader>

            {/* Timeline */}
            <section className="mt-6">
              <h4 className="mb-3 flex items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <Flag className="h-3.5 w-3.5" /> Linha do tempo
              </h4>
              <ol className="space-y-3 border-l border-border pl-4">
                <li>
                  <p className="font-subtitle text-xs text-muted-foreground">Criado</p>
                  <p className="font-medium">{fmtDate(deal.data_criacao)}</p>
                  {diasTotal !== null && (
                    <p className="font-numeric text-[11px] text-muted-foreground">
                      há {diasTotal}d
                    </p>
                  )}
                </li>
                <li>
                  <p className="font-subtitle text-xs text-muted-foreground">
                    Entrou na etapa atual
                  </p>
                  <p className="font-medium">{fmtDate(deal.data_entrada_fase)}</p>
                  {diasNaFase !== null && (
                    <p className="font-numeric text-[11px] text-muted-foreground">
                      há {diasNaFase}d
                    </p>
                  )}
                </li>
              </ol>
            </section>

            {/* Atividade */}
            <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" /> Últimas ligações
                </h4>
                {!ligacoes?.length ? (
                  <p className="rounded-lg border border-dashed border-border p-3 font-small text-xs text-muted-foreground">
                    Nenhuma ligação registrada.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {ligacoes.slice(0, 5).map((l) => (
                      <li
                        key={l.id_chamada}
                        className="rounded-lg border border-border bg-card p-2 text-xs"
                      >
                        <div className="flex justify-between gap-2">
                          <span className="font-medium">{fmtDate(l.data_realizada)}</span>
                          <span className="text-muted-foreground">{l.duracao_chamada || "—"}</span>
                        </div>
                        <p className="text-muted-foreground">
                          {l.resultado_chamada || l.nome_tarefa || "—"}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h4 className="mb-2 flex items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" /> Reuniões
                </h4>
                {!reunioes?.length ? (
                  <p className="rounded-lg border border-dashed border-border p-3 font-small text-xs text-muted-foreground">
                    Nenhuma reunião registrada.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {reunioes.slice(0, 5).map((r, i) => (
                      <li
                        key={i}
                        className="rounded-lg border border-border bg-card p-2 text-xs"
                      >
                        <div className="flex justify-between gap-2">
                          <span className="font-medium">{fmtDate(r.data_reuniao)}</span>
                          <span
                            className={
                              (r.reuniao_realizada || "").toLowerCase().includes("sim") ||
                              r.data_reuniao_realizada
                                ? "text-success"
                                : "text-muted-foreground"
                            }
                          >
                            {r.data_reuniao_realizada
                              ? "realizada"
                              : (r.reuniao_realizada ?? "marcada")}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {/* Ações sugeridas */}
            <section className="mt-6">
              <h4 className="mb-2 flex items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <Lightbulb className="h-3.5 w-3.5" /> Ações sugeridas
              </h4>
              <ul className="space-y-2">
                {sugestoes.map((s, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
