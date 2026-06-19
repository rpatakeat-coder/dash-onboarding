/**
 * Extrai a mensagem REAL de erro de uma chamada a Edge Function do Supabase.
 *
 * Quando a função responde com status não-2xx, o supabase-js põe apenas a string
 * genérica "Edge Function returned a non-2xx status code" em `error.message`; o
 * corpo JSON real (`{ error: ... }`) fica em `error.context` (um `Response`).
 * Lemos de lá para mostrar o motivo de verdade.
 *
 * Uso: `throw new Error(await edgeErrorMessage(error, data))` ou
 *      `toast.error(await edgeErrorMessage(error, data))`.
 */
export async function edgeErrorMessage(error: unknown, data?: unknown): Promise<string> {
  // 1) Algumas funções retornam 200 com { error }/{ message } no corpo.
  const body0 = data as { error?: unknown; message?: unknown } | null;
  const inBody = body0?.error ?? body0?.message;
  if (inBody) return typeof inBody === "string" ? inBody : JSON.stringify(inBody);

  // 2) Erro HTTP (não-2xx): o corpo real está em error.context (Response).
  const ctx = (error as { context?: unknown } | null)?.context;
  if (ctx instanceof Response) {
    try {
      const parsed = (await ctx.clone().json()) as { error?: unknown; message?: unknown };
      const m = parsed?.error ?? parsed?.message;
      if (m) return typeof m === "string" ? m : JSON.stringify(m);
    } catch {
      try {
        const txt = (await ctx.clone().text()).trim();
        if (txt) return txt;
      } catch {
        /* ignore */
      }
    }
  }

  return (error as { message?: string } | null)?.message ?? "falha desconhecida";
}
