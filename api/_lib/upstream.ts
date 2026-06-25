// Shared client for the Takeat backend (`INACTIVE_RISK_HOST`).
//
// Auth model A (brief Rev 4): users do NOT log in upstream. The server authenticates once with a
// dedicated SERVICE admin account (`SERVICE_ADMIN_EMAIL` / `SERVICE_ADMIN_PASSWORD`) and reuses that
// JWT to page the `inactive-risk` endpoint (S3 caches it and silently re-mints it on expiry). These
// credentials live only in env — never typed by users, never sent to the browser.

/** Read + normalize the upstream host from the environment. Throws if unset (fail closed). */
export function getUpstreamHost(): string {
  const host = process.env.INACTIVE_RISK_HOST
  if (!host) throw new Error('INACTIVE_RISK_HOST is not configured')
  return host.replace(/\/+$/, '')
}

/** Fetch a path against the upstream host (absolute URLs pass through unchanged). */
export function upstreamFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = /^https?:\/\//.test(path) ? path : `${getUpstreamHost()}${path.startsWith('/') ? '' : '/'}${path}`
  return fetch(url, init)
}

/** Minimal shape of the upstream login user; we only care about `admin`. */
export interface UpstreamUser {
  admin?: boolean
  [key: string]: unknown
}

export interface UpstreamLoginResult {
  status: number
  ok: boolean
  user: UpstreamUser | null
  /** 30-day admin JWT; only present on success. Never forwarded to the browser. */
  token: string | null
}

/**
 * Call the existing admin login `POST /public/sessions/restaurants`. Returns a normalized result;
 * the caller enforces `admin === true`. Network errors propagate so the caller can distinguish an
 * outage from rejected credentials.
 */
export async function upstreamLogin(email: string, password: string): Promise<UpstreamLoginResult> {
  const res = await upstreamFetch('/public/sessions/restaurants', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) return { status: res.status, ok: false, user: null, token: null }
  const data = (await res.json().catch(() => null)) as { user?: UpstreamUser; token?: string } | null
  return { status: res.status, ok: true, user: data?.user ?? null, token: data?.token ?? null }
}

/** Read the service-account credentials from env. Throws if unset (fail closed). */
export function getServiceCredentials(): { email: string; password: string } {
  const email = process.env.SERVICE_ADMIN_EMAIL
  const password = process.env.SERVICE_ADMIN_PASSWORD
  if (!email || !password) throw new Error('SERVICE_ADMIN_EMAIL / SERVICE_ADMIN_PASSWORD are not configured')
  return { email, password }
}

/**
 * Log in with the service admin account and return its JWT. Used by S3 to obtain (and, on upstream
 * 401, silently re-mint) the token that authorizes `inactive-risk` calls. Throws if the service
 * account is rejected or not an admin — that is a server/config fault, not a user-facing 401.
 */
export async function serviceLogin(): Promise<string> {
  const { email, password } = getServiceCredentials()
  const result = await upstreamLogin(email, password)
  if (!result.ok || result.user?.admin !== true || !result.token) {
    throw new Error('Service admin login failed or account is not admin')
  }
  return result.token
}
