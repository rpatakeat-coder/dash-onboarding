// Status distribution donut (AC-014): the five bands with their full-universe counts (sum to N).
// Donut on the left, a counted legend on the right (Variation A layout).

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { BandCounts, RiskBandKey } from '../../lib/types'
import { BAND_COLOR, KEY_TO_SHORT_LABEL } from '../../lib/risk'

// Legend/segment order matches the design: most-severe first.
const ORDER: RiskBandKey[] = ['critico', 'alerta', 'nunca_movimentou', 'ativo', 'recem_criado']

export default function StatusDonut({ summary }: { summary: BandCounts }) {
  const data = ORDER.map((key) => ({ key, name: KEY_TO_SHORT_LABEL[key], value: summary[key] }))
  const total = data.reduce((sum, d) => sum + d.value, 0)
  return (
    <div className="rounded-2xl border border-line bg-white p-[22px]">
      <h3 className="text-[14.5px] font-bold text-ink">Distribuição por status</h3>
      <p className="mb-3 text-[12.5px] text-cmuted">{total.toLocaleString('pt-BR')} restaurantes monitorados</p>
      <div className="flex items-center gap-6">
        <div className="relative h-[168px] w-[168px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={84} paddingAngle={2} stroke="none">
                {data.map((d) => (
                  <Cell key={d.key} fill={BAND_COLOR[d.key]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => Number(v).toLocaleString('pt-BR')} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="flex flex-1 flex-col gap-2.5">
          {data.map((d) => (
            <li key={d.key} className="flex items-center gap-2.5 text-[13.5px] text-ink2">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: BAND_COLOR[d.key] }} />
              <span className="font-semibold">{d.name}</span>
              <span className="ml-auto font-bold text-ink tabular-nums">{d.value.toLocaleString('pt-BR')}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
