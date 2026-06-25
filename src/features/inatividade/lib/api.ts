// SPA client for the dataset endpoint. Authenticates with the dash-operations Supabase session: we
// send the user's access token as a Bearer header, which the serverless route validates
// (api/_lib/supabaseAuth). Replaces the churn-tracker's cookie session.

import type { Dataset } from './types'
import { USE_MOCK, makeMockDataset } from './mockData'
import { supabase } from '@/integrations/supabase/client'

/** Thrown when there's no valid Supabase session so the page can prompt re-login (AC-003). */
export class UnauthorizedError extends Error {}

/** Fetch the enriched dataset. `refresh` forces an upstream rebuild (the manual refresh control). */
export async function fetchDataset(opts?: { refresh?: boolean }): Promise<Dataset> {
  // Demo mode (`VITE_USE_MOCK=true`): serve fabricated data, no backend. Eliminated in prod builds.
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, opts?.refresh ? 400 : 150))
    return makeMockDataset()
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new UnauthorizedError('no supabase session')

  const qs = opts?.refresh ? '?refresh=1' : ''
  const res = await fetch(`/api/restaurants${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) throw new UnauthorizedError('session expired')
  if (!res.ok) throw new Error(`Falha ao carregar dados (${res.status})`)
  return (await res.json()) as Dataset
}
