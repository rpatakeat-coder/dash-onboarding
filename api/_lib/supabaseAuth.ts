// Server-side auth bridge for the Sucesso/Inatividade page. The dash-operations SPA authenticates
// users with Supabase Auth; here we accept its access token (sent as `Authorization: Bearer <token>`)
// and confirm it's a valid, non-expired Supabase session before serving the dataset.
//
// This replaces the churn-tracker's shared app-password cookie session (auth model A). Admin-only
// gating is enforced on the client by AdminOnlyRoute (useUserRole); this is the server-side floor that
// an unauthenticated caller can't pass. No SERVICE_* / upstream secret is involved here — those
// authenticate the server to the Takeat API, never the end user.

import type { ApiRequest } from './http'

export interface SupabaseUser {
  id: string
  email?: string | null
}

/** Extract the bearer token from an `Authorization` header (case-insensitive scheme). */
function bearer(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header
  if (typeof value !== 'string') return ''
  const m = /^Bearer\s+(.+)$/i.exec(value.trim())
  return m ? m[1].trim() : ''
}

/**
 * Validate the caller's Supabase access token against the Auth API. Returns the user on success, or
 * `null` on any failure (missing/invalid/expired token, misconfigured bridge, network) — fail closed.
 * Needs `SUPABASE_URL` + `SUPABASE_ANON_KEY` in the server environment.
 */
export async function requireSupabaseUser(
  req: Pick<ApiRequest, 'headers'>,
): Promise<SupabaseUser | null> {
  const token = bearer(req.headers.authorization)
  if (!token) return null

  const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '')
  const anonKey = process.env.SUPABASE_ANON_KEY
  if (!url || !anonKey) return null // fail closed when the bridge isn't configured

  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    })
    if (!res.ok) return null
    const user = (await res.json().catch(() => null)) as { id?: string; email?: string | null } | null
    return user?.id ? { id: user.id, email: user.email ?? null } : null
  } catch {
    return null
  }
}
