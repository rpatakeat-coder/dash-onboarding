// Inactivity-band histogram (AC-015): dias_inativo bucketed; never-moved rows excluded.
// Bars ramp from soft red to deep brand red as the inactivity window widens.

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Restaurant } from '../../lib/types'
import { inactivityBuckets } from '../../lib/aggregations'

// Severity ramp, one color per bucket (0–7 … +365).
const RAMP = ['#F0A6A2', '#F0A6A2', '#E26B66', '#E26B66', '#D6433D', '#D6433D', '#C8131B']

export default function InactivityBands({ data }: { data: Restaurant[] }) {
  const buckets = inactivityBuckets(data)
  return (
    <div className="rounded-2xl border border-line bg-white p-[22px]">
      <h3 className="text-[14.5px] font-bold text-ink">Dias de inatividade</h3>
      <p className="mb-3.5 text-[12.5px] text-cmuted">Distribuição por faixa</p>
      <ResponsiveContainer width="100%" height={196}>
        <BarChart data={buckets} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1EEEA" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8A8682', fontWeight: 600 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#A8A39D' }} allowDecimals={false} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: 'rgba(200,19,27,.05)' }}
            formatter={(v) => [Number(v).toLocaleString('pt-BR'), 'Restaurantes']}
          />
          <Bar dataKey="count" radius={[7, 7, 0, 0]}>
            {buckets.map((b, i) => (
              <Cell key={b.label} fill={RAMP[i] ?? '#C8131B'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
