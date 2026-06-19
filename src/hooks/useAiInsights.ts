import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { edgeErrorMessage } from "@/lib/edgeError";

const TTL_MS = 10 * 60 * 1000;
const HISTORY_LIMIT = 5;

export type AiInsightMode = "dashboard" | "kpi";

export interface AiInsightsResponse {
  content: string;
  model: string;
  mode: AiInsightMode;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
}

export interface AiInsightVersion {
  data: AiInsightsResponse;
  at: number;
}

interface CacheEntry {
  // newest first
  versions: AiInsightVersion[];
}

const storageKey = (key: string) => `ai-insights:${key}`;

function readCache(key: string): CacheEntry | null {
  try {
    const raw = sessionStorage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry | { data: AiInsightsResponse; at: number };
    // Backward-compat: legacy single-entry shape
    if ("data" in parsed && "at" in parsed) {
      const legacy = parsed as { data: AiInsightsResponse; at: number };
      if (Date.now() - legacy.at > TTL_MS) return null;
      return { versions: [{ data: legacy.data, at: legacy.at }] };
    }
    const ce = parsed as CacheEntry;
    const fresh = (ce.versions ?? []).filter((v) => Date.now() - v.at <= TTL_MS);
    return fresh.length ? { versions: fresh } : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, entry: CacheEntry) {
  try {
    sessionStorage.setItem(storageKey(key), JSON.stringify(entry));
  } catch {
    /* ignore */
  }
}

export function useAiInsights<TPayload>(mode: AiInsightMode, cacheKey: string) {
  const [versions, setVersions] = useState<AiInsightVersion[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // hydrate from cache when key changes
  useEffect(() => {
    const cached = readCache(cacheKey);
    if (cached) {
      setVersions(cached.versions);
      setActiveIndex(0);
      setError(null);
    } else {
      setVersions([]);
      setActiveIndex(0);
    }
  }, [cacheKey]);

  const active = versions[activeIndex] ?? null;
  const data = active?.data ?? null;
  const lastGeneratedAt = active?.at ?? null;

  const selectVersion = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  const generate = useCallback(
    async (payload: TPayload, opts?: { force?: boolean }) => {
      if (!opts?.force) {
        const cached = readCache(cacheKey);
        if (cached && cached.versions.length) {
          setVersions(cached.versions);
          setActiveIndex(0);
          return cached.versions[0].data;
        }
      }
      setIsLoading(true);
      setError(null);
      try {
        const { data: res, error: invokeErr } = await supabase.functions.invoke<
          AiInsightsResponse | { error: string; message?: string }
        >("ai-insights", { body: { mode, payload } });

        if (invokeErr) throw new Error(await edgeErrorMessage(invokeErr, res));
        if (!res || (res as { error?: string }).error) {
          const msg = (res as { message?: string })?.message ?? "Falha ao gerar insight.";
          throw new Error(msg);
        }
        const ok = res as AiInsightsResponse;
        const now = Date.now();
        const newVersion: AiInsightVersion = { data: ok, at: now };
        // Read current cache to merge with any other regenerations done in
        // parallel from other components sharing the same key.
        const current = readCache(cacheKey)?.versions ?? [];
        const next = [newVersion, ...current].slice(0, HISTORY_LIMIT);
        writeCache(cacheKey, { versions: next });
        setVersions(next);
        setActiveIndex(0);
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

  return {
    data,
    isLoading,
    error,
    generate,
    lastGeneratedAt,
    versions,
    activeIndex,
    selectVersion,
  };
}
