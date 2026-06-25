// Charts row (S6): status donut, inactivity histogram, signups-vs-risk combo. All read the full
// universe; the math lives in `lib/aggregations.ts`.

import type { BandCounts, Restaurant } from '../../lib/types'
import StatusDonut from './StatusDonut'
import InactivityBands from './InactivityBands'
import SignupsVsRisk from './SignupsVsRisk'

export default function Charts({ data, summary }: { data: Restaurant[]; summary: BandCounts }) {
  return (
    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
      <StatusDonut summary={summary} />
      <InactivityBands data={data} />
      <SignupsVsRisk data={data} />
    </div>
  )
}
