import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const TTL_MS = 10 * 60 * 1000;

export type AiInsightMode = "dashboard" | "kpi";

interface AiInsightsResponse {
  content: string;
  model: string;
  mode: AiInsightMode;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
}

interface CacheEntry {
  data: AiInsightsResponse;
  at: number;
}

function readCache(key: string): CacheEntry | null {
  try {
    const raw = sessionStorage.getItem(`ai-insights:${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (Date.now() - parsed.at > TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(key: string, data: AiInsightsResponse) {
  try {
    sessionStorage.setItem(
      `ai-insights:${key}`,
      JSON.stringify({ data, at: Date.now() } satisfies CacheEntry),
    );
  } catch {
    /* ignore */
  }
}

export function useAiInsights<TPayload>(mode: AiInsightMode, cacheKey: string) {
  const [data, setData] = useState<AiInsightsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<number | null>(null);

  // hydrate from cache when key changes
  useEffect(() => {
    const cached = readCache(cacheKey);
    if (cached) {
      setData(cached.data);
      setLastGeneratedAt(cached.at);
      setError(null);
    } else {
      setData(null);
      setLastGeneratedAt(null);
    }
  }, [cacheKey]);

  const generate = useCallback(
    async (payload: TPayload, opts?: { force?: boolean }) => {
      if (!opts?.force) {
        const cached = readCache(cacheKey);
        if (cached) {
          setData(cached.data);
          setLastGeneratedAt(cached.at);
          return cached.data;
        }
      }
      setIsLoading(true);
      setError(null);
      try {
        const { data: res, error: invokeErr } = await supabase.functions.invoke<
          AiInsightsResponse | { error: string; message?: string }
        >("ai-insights", { body: { mode, payload } });

        if (invokeErr) throw new Error(invokeErr.message);
        if (!res || (res as { error?: string }).error) {
          const msg = (res as { message?: string })?.message ?? "Falha ao gerar insight.";
          throw new Error(msg);
        }
        const ok = res as AiInsightsResponse;
        setData(ok);
        const now = Date.now();
        setLastGeneratedAt(now);
        writeCache(cacheKey, ok);
        return ok;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro desconhecido.";
        setError(msg);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [mode, cacheKey],
  );

  return { data, isLoading, error, generate, lastGeneratedAt };
}
