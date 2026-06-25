// The five KPI cards (AC-013). Values reflect the full universe (A-5), not the table filters.
// "Total em risco" leads as a filled brand card; the rest are white with per-band accents.

import type { Kpis } from '../lib/aggregations'

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

const LABEL = 'text-[11.5px] font-bold uppercase tracking-[.05em]'
const VALUE = 'mt-2.5 text-[34px] font-extrabold leading-none tracking-tight'

function Card({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: number
  hint?: string
  accent: string
}) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <p className={`${LABEL} text-cmuted`}>{label}</p>
      <p className={`${VALUE} ${accent}`}>{value.toLocaleString('pt-BR')}</p>
      {hint && <p className="mt-2 text-xs text-cmuted2">{hint}</p>}
    </div>
  )
}

export default function KpiCards({ kpis }: { kpis: Kpis }) {
  return (
    <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 lg:grid-cols-5">
      <div className="rounded-2xl bg-brand p-5 shadow-[0_6px_18px_rgba(200,19,27,.22)]">
        <p className={`${LABEL} text-primary-foreground/80`}>Total em risco</p>
        <p className={`${VALUE} text-primary-foreground`}>{kpis.totalEmRisco.toLocaleString('pt-BR')}</p>
        <p className="mt-2 text-xs text-primary-foreground/70">crítico + alerta + nunca mov.</p>
      </div>
      <Card label="Crítico" value={kpis.critico} hint={`+30 dias · ${pct(kpis.criticoPct)}`} accent="text-critico" />
      <Card label="Alerta" value={kpis.alerta} hint={`8–30 dias · ${pct(kpis.alertaPct)}`} accent="text-alerta" />
      <Card label="Nunca movimentou" value={kpis.nuncaMovimentou} hint={pct(kpis.total === 0 ? 0 : kpis.nuncaMovimentou / kpis.total)} accent="text-ink" />
      <Card label="Recém-cadastrados" value={kpis.recemCriado} hint="≤ 7 dias" accent="text-ink" />
    </div>
  )
}
