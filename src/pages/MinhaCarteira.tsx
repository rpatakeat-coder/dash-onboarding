import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, AlertTriangle } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { useAuth } from "@/hooks/useAuth";
import {
  fmtBRL,
  slaBand,
  SLA_BAND_META,
  useDashOperacoes,
  type DashRow,
} from "@/hooks/useDashOperacoes";
import { METAS } from "@/lib/metas";

const slaOf = (r: DashRow) => {
  const n = parseFloat(String(r.sla_dias ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const mrrOf = (r: DashRow) =>
  parseFloat(String(r.mrr ?? "").replace(",", ".")) || 0;
const PESO_BAND: Record<string, number> = {
  critico: 4, atencao: 3, alerta: 2, saudavel: 1,
};

const MinhaCarteira = () => {
  const { session, fullName, loading } = useAuth();
  const { data } = useDashOperacoes();
  const allRows = data?.rows ?? [];

  const myRows = useMemo(() => {
    if (!fullName) return [];
    const norm = (s: string) => s.trim().toLowerCase();
    const me = norm(fullName);
    return allRows.filter((r) => norm(r.agente_ativacao ?? "") === me);
  }, [allRows, fullName]);

  const kpis = useMemo(() => {
    const total = myRows.length;
    const mrr = myRows.reduce((s, r) => s + mrrOf(r), 0);
    const noPrazo = myRows.filter((r) => slaOf(r) <= 30).length;
    const critico = myRows.filter((r) => slaBand(slaOf(r)) === "critico").length;
    const slaAvg = total
      ? myRows.reduce((s, r) => s + slaOf(r), 0) / total
      : 0;
    return {
      total,
      mrr,
      pctNoPrazo: total ? (noPrazo / total) * 100 : 0,
      critico,
      slaAvg,
    };
  }, [myRows]);

  const teamAvg = useMemo(() => {
    if (!allRows.length) return { pctNoPrazo: 0, slaAvg: 0 };
    const noPrazo = allRows.filter((r) => slaOf(r) <= 30).length;
    const slaAvg = allRows.reduce((s, r) => s + slaOf(r), 0) / allRows.length;
    return { pctNoPrazo: (noPrazo / allRows.length) * 100, slaAvg };
  }, [allRows]);

  const proximos = useMemo(() => {
    return [...myRows]
      .map((r) => ({
        r,
        score: PESO_BAND[slaBand(slaOf(r))] * (1 + Math.log10(1 + mrrOf(r))),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [myRows]);

  if (!loading && !session) {
    return (
      <div className="min-h-screen bg-gradient-surface">
        <DashboardHeader />
        <main className="mx-auto max-w-xl px-6 py-16 text-center">
          <h2 className="font-display text-2xl font-bold text-secondary">
            Faça login para ver sua carteira
          </h2>
          <Link
            to="/auth"
            className="mt-6 inline-flex rounded-lg bg-primary px-4 py-2 font-subtitle text-sm font-medium text-primary-foreground"
          >
            Entrar
          </Link>
        </main>
      </div>
    );
  }

  const renderDelta = (mine: number, team: number, suffix = "%") => {
    const d = mine - team;
    const tone = d >= 0 ? "text-success" : "text-destructive";
    return (
      <span className={`font-subtitle text-xs ${tone}`}>
        {d >= 0 ? "+" : ""}
        {d.toFixed(1)}
        {suffix} vs time
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-surface">
      <DashboardHeader />
      <main className="mx-auto max-w-[1200px] px-6 py-8 md:px-10 md:py-10">
        <div className="mb-8">
          <p className="font-subtitle text-xs uppercase tracking-widest text-muted-foreground">
            Olá, {fullName || "agente"}
          </p>
          <h2 className="font-display text-3xl font-bold tracking-tight text-secondary md:text-4xl">
            Minha carteira
          </h2>
        </div>

        {fullName && myRows.length === 0 && (
          <div className="mb-6 flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/[0.06] p-4 text-warning">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <div>
              <p className="font-subtitle text-sm font-semibold">
                Nenhum cliente vinculado a "{fullName}"
              </p>
              <p className="font-small text-xs opacity-80">
                Confirme se o nome cadastrado é exatamente igual ao "agente_ativacao" usado no HubSpot.
              </p>
            </div>
          </div>
        )}

        {/* KPIs */}
        <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
              Carteira
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-foreground">
              {kpis.total}
            </p>
            <p className="font-small text-xs text-muted-foreground">clientes ativos</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
              MRR sob gestão
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-foreground">
              {fmtBRL(kpis.mrr)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
              SLA no prazo
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-foreground">
              {kpis.pctNoPrazo.toFixed(1)}%
            </p>
            <div className="mt-1 flex items-center justify-between gap-2">
              {renderDelta(kpis.pctNoPrazo, teamAvg.pctNoPrazo)}
              <span className="font-small text-[10px] text-muted-foreground">
                meta {METAS.slaNoPrazo}%
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary"
                style={{ width: `${Math.min(100, kpis.pctNoPrazo)}%` }}
              />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
              Críticos
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-destructive">
              {kpis.critico}
            </p>
            <p className="font-small text-xs text-muted-foreground">
              SLA médio {kpis.slaAvg.toFixed(1)}d
            </p>
          </div>
        </section>

        {/* Próximos 10 */}
        <section>
          <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Próximos 10 (priorizados por risco × MRR)
          </h3>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40">
                <tr className="font-subtitle text-[11px] uppercase tracking-widest text-muted-foreground">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Etapa</th>
                  <th className="px-3 py-2 text-right">SLA</th>
                  <th className="px-3 py-2 text-right">MRR</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {proximos.map(({ r }, i) => {
                  const b = slaBand(slaOf(r));
                  const meta = SLA_BAND_META[b];
                  return (
                    <tr key={r.id_deal} className="border-t border-border">
                      <td className="px-3 py-2 font-numeric text-xs text-muted-foreground">
                        {i + 1}
                      </td>
                      <td className="px-3 py-2 font-medium text-foreground">
                        {r.nome_negocio?.trim() || "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.etapa_negocio?.trim() || "—"}
                      </td>
                      <td
                        className="px-3 py-2 text-right font-numeric font-semibold tabular-nums"
                        style={{ color: `hsl(var(${meta.cssVar}))` }}
                      >
                        {slaOf(r).toFixed(0)}d
                      </td>
                      <td className="px-3 py-2 text-right font-numeric tabular-nums text-foreground">
                        {fmtBRL(mrrOf(r))}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <a
                          href={`https://app.hubspot.com/contacts/_/deal/${r.id_deal}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          HubSpot <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
                {!proximos.length && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                      Sem clientes na carteira.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
};

export default MinhaCarteira;
