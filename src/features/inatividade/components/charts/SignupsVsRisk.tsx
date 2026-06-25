// Signups-vs-risk combo chart (AC-016): trailing 18 months — bars = signups that month, line =
// of that cohort, those at risk (band ∈ {critico, alerta, nunca_movimentou}). recem_criado is
// excluded automatically by band assignment (C1), so there is no separate date filter.

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Restaurant } from '../../lib/types'
import { signupsVsRisk } from '../../lib/aggregations'

/** Current `YYYY-MM` in BRT, the trailing window's end. */
function currentBrtMonth(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970'
  const m = parts.find((p) => p.type === 'month')?.value ?? '01'
  return `${y}-${m}`
}

export default function SignupsVsRisk({ data }: { data: Restaurant[] }) {
  const series = signupsVsRisk(data, currentBrtMonth(), 18)
  return (
    <div className="rounded-2xl border border-line bg-white p-[22px] lg:col-span-2">
      <div className="mb-3.5 flex items-center justify-between">
        <div>
          <h3 className="text-[14.5px] font-bold text-ink">Cadastros × risco</h3>
          <p className="text-[12.5px] text-cmuted">Últimos 18 meses</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={230}>
        <ComposedChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1EEEA" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#A8A39D' }} interval={1} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#A8A39D' }} allowDecimals={false} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v) => Number(v).toLocaleString('pt-BR')} />
          <Legend wrapperStyle={{ fontSize: 12.5, color: '#8A8682' }} iconType="circle" />
          <Bar dataKey="signups" name="Cadastros" fill="#D2CCC4" radius={[4, 4, 0, 0]} />
          <Line dataKey="emRisco" name="Em risco" stroke="#D12B27" strokeWidth={2.5} dot={false} strokeLinejoin="round" strokeLinecap="round" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
