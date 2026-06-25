// Minimal structural request/response types for the serverless handlers. Kept dependency-free on
// purpose: the Vercel runtime passes richer `VercelRequest`/`VercelResponse` objects, and these
// interfaces are a compatible subset of them — so handlers stay testable with plain mock objects
// and the repo needs no extra dev dependency just to type the `api/` layer.

export interface ApiRequest {
  method?: string
  /** Node `IncomingHttpHeaders`-compatible; `cookie` carries the session. */
  headers: Record<string, string | string[] | undefined>
  /** Parsed JSON body (Vercel parses `application/json` automatically). */
  body?: unknown
  query?: Record<string, string | string[] | undefined>
}

export interface ApiResponse {
  status(code: number): ApiResponse
  json(body: unknown): void
  setHeader(name: string, value: string | string[]): void
  end(body?: string): void
}

/** A Vercel-style default-export handler. */
export type ApiHandler = (req: ApiRequest, res: ApiResponse) => void | Promise<void>
