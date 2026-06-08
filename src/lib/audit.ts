import { supabase } from "@/integrations/supabase/client";

export type AuditEntity = "operador" | "meta" | "config" | "user_role" | "hubspot_agent" | "outro";

export interface AuditPayload {
  action: string;
  entity_type: AuditEntity;
  entity_id?: string | number | null;
  summary?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Registra uma ação de auditoria. Silencioso em caso de erro (não bloqueia UX).
 */
export async function logAudit(p: AuditPayload): Promise<void> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) return;

    let user_name: string | null = null;
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    user_name = prof?.full_name ?? user.email ?? null;

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      user_name,
      action: p.action,
      entity_type: p.entity_type,
      entity_id: p.entity_id != null ? String(p.entity_id) : null,
      summary: p.summary ?? null,
      metadata: (p.metadata ?? {}) as never,
    });
  } catch (e) {
    console.warn("[audit] falhou ao registrar", e);
  }
}
