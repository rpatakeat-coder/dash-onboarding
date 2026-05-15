import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Shield, ShieldCheck, ShieldOff, Users, Settings as SettingsIcon, Trash2, Loader2, History, RefreshCw, UserPlus, Mail, Send, Copy, MessageCircle, Link2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { AccessDenied } from "@/components/AccessDenied";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { DEFAULT_COPILOT_SYSTEM_PROMPT, COPILOT_PROMPT_SETTINGS_KEY } from "@/lib/copilotPrompt";

interface AdminUser {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  roles: string[];
  agente_ativacao?: string | null;
}


const Admin = () => {
  const { session, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin();

  if (authLoading || roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!session) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <AccessDenied showClaimAdmin />;

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <DashboardHeader />
      <main className="mx-auto max-w-[1400px] px-3 py-6 sm:px-6 sm:py-8 md:px-10 md:py-10">
        <header className="mb-6">
          <p className="font-subtitle text-xs uppercase tracking-widest text-muted-foreground">Administração</p>
          <h1 className="font-display text-2xl font-bold text-secondary">Painel de admin</h1>
          <p className="mt-1 font-small text-sm text-muted-foreground">
            Gerencie usuários, operadores e configurações do painel.
          </p>
        </header>

        <Tabs defaultValue="operators" className="w-full">
          <TabsList>
            <TabsTrigger value="operators" className="gap-1.5"><UserPlus className="h-3.5 w-3.5" />Operadores</TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5"><Users className="h-3.5 w-3.5" />Usuários</TabsTrigger>
            <TabsTrigger value="config" className="gap-1.5"><SettingsIcon className="h-3.5 w-3.5" />Configurações</TabsTrigger>
            <TabsTrigger value="auditoria" className="gap-1.5"><History className="h-3.5 w-3.5" />Auditoria</TabsTrigger>
          </TabsList>
          <TabsContent value="operators" className="mt-4"><AdminOperators /></TabsContent>
          <TabsContent value="users" className="mt-4"><AdminUsers /></TabsContent>
          <TabsContent value="config" className="mt-4"><AdminConfig /></TabsContent>
          <TabsContent value="auditoria" className="mt-4"><AdminAuditoria /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

const ClaimAdminScreen = () => {
  const [busy, setBusy] = useState(false);
  const claim = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("claim_first_admin");
    setBusy(false);
    if (error) {
      toast.error("Erro ao reivindicar admin", { description: error.message });
      return;
    }
    if (data === true) {
      toast.success("Você é admin agora. Recarregando…");
      setTimeout(() => window.location.reload(), 700);
    } else {
      toast.error("Já existe um admin. Peça para promoverem você.");
    }
  };
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <Shield className="h-10 w-10 text-muted-foreground" />
      <div>
        <h1 className="font-display text-xl font-bold text-secondary">Acesso restrito</h1>
        <p className="mt-1 max-w-sm font-small text-sm text-muted-foreground">
          Você não é admin. Se ainda não há nenhum admin no sistema, você pode reivindicar essa função agora.
        </p>
      </div>
      <Button onClick={claim} disabled={busy} className="gap-2">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        Reivindicar admin
      </Button>
    </div>
  );
};

// ============ OPERATORS (real users with auth) ============
interface OperatorRow {
  user_id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: "admin" | "user";
  agente_ativacao: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  invited_at: string | null;
}

const AdminOperators = () => {
  const { user } = useAuth();
  const [list, setList] = useState<OperatorRow[]>([]);
  const [agentes, setAgentes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);
  const [resendId, setResendId] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<{ email: string; link: string } | null>(null);
  const [form, setForm] = useState({ email: "", full_name: "", role: "user" as "admin" | "user", agente_ativacao: "" });

  const load = async () => {
    setLoading(true);
    const [{ data: ops, error: oErr }, { data: ags, error: aErr }] = await Promise.all([
      supabase.rpc("list_operators"),
      supabase.rpc("distinct_agentes_ativacao"),
    ]);
    setLoading(false);
    if (oErr) return toast.error("Erro ao carregar operadores", { description: oErr.message });
    if (aErr) toast.error("Erro ao carregar agentes", { description: aErr.message });
    setList((ops as OperatorRow[]) ?? []);
    setAgentes(((ags as { agente: string }[]) ?? []).map((a) => a.agente));
  };

  useEffect(() => { load(); }, []);

  const invite = async () => {
    if (!form.email.trim()) return toast.error("Informe o email");
    if (form.role !== "admin" && !form.agente_ativacao.trim()) {
      return toast.error("Informe o agente HubSpot");
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-create-operator", {
      body: {
        email: form.email.trim(),
        full_name: form.full_name.trim() || undefined,
        role: form.role,
        agente_ativacao: form.role === "admin" ? undefined : form.agente_ativacao,
      },
    });
    setBusy(false);
    if (error || (data as { error?: string })?.error) {
      const msg = (data as { error?: string })?.error || error?.message;
      return toast.error("Erro ao convidar", { description: typeof msg === "string" ? msg : "falha desconhecida" });
    }
    const link = (data as { action_link?: string })?.action_link ?? null;
    toast.success(`Convite gerado para ${form.email}`);
    if (link) {
      try {
        await navigator.clipboard.writeText(link);
        toast.success("Link copiado para a área de transferência");
      } catch {
        /* ignore clipboard errors */
      }
      setInviteLink({ email: form.email.trim(), link });
    }
    void logAudit({
      action: "operator.invite",
      entity_type: "user_role",
      entity_id: form.email,
      summary: `Convidou ${form.email} (${form.role}) — agente ${form.agente_ativacao || "—"}`,
      metadata: { email: form.email, role: form.role, agente_ativacao: form.agente_ativacao },
    });
    setForm({ email: "", full_name: "", role: "user", agente_ativacao: "" });
    await load();
  };

  const remove = async (op: OperatorRow) => {
    if (op.user_id === user?.id) return toast.error("Você não pode excluir a si mesmo");
    if (!confirm(`Apagar definitivamente ${op.email || op.full_name || op.user_id}? Essa ação remove o login, perfil e papel.`)) return;
    setDelId(op.user_id);
    const { data, error } = await supabase.functions.invoke("admin-delete-operator", {
      body: { user_id: op.user_id },
    });
    setDelId(null);
    if (error || (data as { error?: string })?.error) {
      const msg = (data as { error?: string })?.error || error?.message;
      return toast.error("Erro ao excluir", { description: typeof msg === "string" ? msg : "falha desconhecida" });
    }
    toast.success("Operador excluído");
    void logAudit({
      action: "operator.delete",
      entity_type: "user_role",
      entity_id: op.user_id,
      summary: `Excluiu operador ${op.email || op.full_name || op.user_id}`,
      metadata: { email: op.email, role: op.role, agente_ativacao: op.agente_ativacao },
    });
    await load();
  };

  const resend = async (op: OperatorRow, channels: ("email" | "whatsapp" | "link_only")[]) => {
    setResendId(op.user_id);
    const { data, error } = await supabase.functions.invoke("admin-resend-invite", {
      body: { user_id: op.user_id, channels },
    });
    setResendId(null);
    if (error || (data as { error?: string })?.error) {
      const msg = (data as { error?: string })?.error || error?.message;
      return toast.error("Erro ao reenviar", { description: typeof msg === "string" ? msg : "falha desconhecida" });
    }
    const link =
      (data as { short_link?: string })?.short_link ||
      (data as { action_link?: string })?.action_link ||
      null;
    if (link) {
      try { await navigator.clipboard.writeText(link); } catch { /* ignore */ }
      setInviteLink({ email: op.email || op.user_id, link });
    }
    const labels: Record<string, string> = {
      email: "Email enviado",
      whatsapp: "WhatsApp acionado",
      link_only: "Link copiado",
    };
    toast.success(channels.map((c) => labels[c]).join(" + "));
    void logAudit({
      action: "operator.invite_resend",
      entity_type: "user_role",
      entity_id: op.user_id,
      summary: `Reenviou convite para ${op.email || op.user_id} via ${channels.join(", ")}`,
      metadata: { email: op.email, channels },
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="font-display text-base font-semibold text-secondary">Convidar novo operador</h3>
        <p className="mt-1 font-small text-sm text-muted-foreground">
          Envia um convite por email. O usuário define a senha ao acessar o link.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <label className="font-subtitle text-[10px] uppercase tracking-wider text-muted-foreground">Email</label>
            <Input
              type="email"
              placeholder="email@empresa.com"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="font-subtitle text-[10px] uppercase tracking-wider text-muted-foreground">Nome (opcional)</label>
            <Input
              placeholder="Nome completo"
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            />
          </div>
          <div>
            <label className="font-subtitle text-[10px] uppercase tracking-wider text-muted-foreground">
              Agente HubSpot{form.role === "admin" && <span className="ml-1 normal-case tracking-normal text-muted-foreground/70">(não exigido)</span>}
            </label>
            <select
              value={form.agente_ativacao}
              onChange={(e) => setForm((f) => ({ ...f, agente_ativacao: e.target.value }))}
              disabled={form.role === "admin"}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
            >
              <option value="">{form.role === "admin" ? "—" : "Selecione…"}</option>
              {agentes.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="font-subtitle text-[10px] uppercase tracking-wider text-muted-foreground">Papel</label>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as "admin" | "user" }))}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="user">Usuário</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={invite} disabled={busy} className="gap-1.5">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Enviar convite
          </Button>
        </div>
        {inviteLink && (
          <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-small text-xs text-muted-foreground">
                Link de convite para <span className="font-medium text-foreground">{inviteLink.email}</span>
              </p>
              <Button size="sm" variant="ghost" onClick={() => setInviteLink(null)}>
                Fechar
              </Button>
            </div>
            <div className="mt-2 flex items-stretch gap-2">
              <code className="flex-1 break-all rounded bg-background px-2 py-1.5 text-[11px] text-foreground">
                {inviteLink.link}
              </code>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(inviteLink.link);
                    toast.success("Link copiado");
                  } catch {
                    toast.error("Não foi possível copiar");
                  }
                }}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copiar
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-subtitle text-xs uppercase tracking-wider text-muted-foreground">Operador</th>
                <th className="px-4 py-3 font-subtitle text-xs uppercase tracking-wider text-muted-foreground">Email</th>
                <th className="px-4 py-3 font-subtitle text-xs uppercase tracking-wider text-muted-foreground">Papel</th>
                <th className="px-4 py-3 font-subtitle text-xs uppercase tracking-wider text-muted-foreground">Agente HubSpot</th>
                <th className="px-4 py-3 font-subtitle text-xs uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-4 py-3 font-subtitle text-xs uppercase tracking-wider text-muted-foreground">Criado em</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="px-4 py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></td></tr>
              )}
              {!loading && list.map((op) => {
                const isMe = op.user_id === user?.id;
                return (
                  <tr key={op.user_id} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {op.avatar_url ? (
                          <img src={op.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                            {(op.full_name || op.email || "?").slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <span className="font-medium text-foreground">
                          {op.full_name || <span className="text-muted-foreground">Sem nome</span>}
                          {isMe && <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">você</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{op.email ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${op.role === "admin" ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-muted text-foreground"}`}>
                        {op.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {op.agente_ativacao || <span className="italic text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {op.last_sign_in_at ? (
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-500">Ativo</span>
                      ) : op.email_confirmed_at ? (
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-500">Confirmado</span>
                      ) : (
                        <span className="rounded-full border border-muted-foreground/30 bg-muted px-2 py-0.5 text-xs text-muted-foreground">Pendente</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-numeric text-xs text-muted-foreground">
                      {new Date(op.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={resendId === op.user_id}
                              className="gap-1.5"
                            >
                              {resendId === op.user_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                              Reenviar
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuLabel className="text-xs">Reenviar convite via</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => resend(op, ["email"])}>
                              <Mail className="mr-2 h-3.5 w-3.5" /> Email
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => resend(op, ["whatsapp"])}>
                              <MessageCircle className="mr-2 h-3.5 w-3.5" /> WhatsApp (webhook)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => resend(op, ["email", "whatsapp"])}>
                              <Send className="mr-2 h-3.5 w-3.5" /> Email + WhatsApp
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => resend(op, ["link_only"])}>
                              <Link2 className="mr-2 h-3.5 w-3.5" /> Apenas copiar link
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={delId === op.user_id || isMe}
                          onClick={() => remove(op)}
                          className="gap-1.5 text-destructive hover:text-destructive"
                          title={isMe ? "Você não pode excluir a si mesmo" : undefined}
                        >
                          {delId === op.user_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          Excluir
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && list.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nenhum operador cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ============ USERS ============
const AdminUsers = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [editAgenteId, setEditAgenteId] = useState<string | null>(null);
  const [editAgenteValue, setEditAgenteValue] = useState("");
  const [savingAgente, setSavingAgente] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: profilesData, error: pErr }, { data: opsData, error: oErr }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, avatar_url, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("user_roles_operations")
        .select("user_id, role, agente_ativacao"),
    ]);
    setLoading(false);
    if (pErr || oErr) {
      toast.error("Erro ao carregar usuários", { description: (pErr ?? oErr)?.message });
      return;
    }
    const opsMap = new Map<string, { role: string; agente_ativacao: string | null }>(
      (opsData ?? []).map((o) => [o.user_id, { role: o.role, agente_ativacao: o.agente_ativacao }]),
    );
    const merged: AdminUser[] = (profilesData ?? []).map((p) => {
      const op = opsMap.get(p.id);
      return {
        id: p.id,
        full_name: p.full_name,
        avatar_url: p.avatar_url,
        created_at: p.created_at,
        roles: op?.role === "admin" ? ["admin"] : op ? ["user"] : [],
        agente_ativacao: op?.agente_ativacao ?? null,
      };
    });
    setUsers(merged);
  };

  useEffect(() => { load(); }, []);

  const saveAgente = async (u: AdminUser) => {
    const value = editAgenteValue.trim() || null;
    setSavingAgente(true);
    const { error } = await supabase
      .from("user_roles_operations")
      .upsert(
        { user_id: u.id, agente_ativacao: value, role: u.roles.includes("admin") ? "admin" : "user" },
        { onConflict: "user_id" },
      );
    setSavingAgente(false);
    if (error) return toast.error("Erro ao salvar", { description: error.message });
    toast.success(value ? `Vinculado a "${value}"` : "Vínculo removido");
    void logAudit({
      action: "user.set_agente_ativacao",
      entity_type: "outro",
      entity_id: u.id,
      summary: `Definiu agente_ativacao de ${u.full_name || u.id} para ${value ?? "(nenhum)"}`,
      metadata: { target_user_id: u.id, value },
    });
    setEditAgenteId(null);
    await load();
  };

  const toggleAdmin = async (u: AdminUser) => {
    const isAdmin = u.roles.includes("admin");
    setBusyId(u.id);
    const newRole = isAdmin ? "user" : "admin";
    const { error } = await supabase
      .from("user_roles_operations")
      .upsert(
        { user_id: u.id, role: newRole, agente_ativacao: u.agente_ativacao ?? null },
        { onConflict: "user_id" },
      );
    setBusyId(null);
    if (error) return toast.error(isAdmin ? "Erro ao remover admin" : "Erro ao promover", { description: error.message });
    toast.success(isAdmin
      ? `${u.full_name || "Usuário"} não é mais admin`
      : `${u.full_name || "Usuário"} promovido a admin`);
    void logAudit({
      action: isAdmin ? "role.remove_admin" : "role.grant_admin",
      entity_type: "user_role",
      entity_id: u.id,
      summary: isAdmin
        ? `Removeu admin de ${u.full_name || u.id}`
        : `Promoveu ${u.full_name || u.id} a admin`,
      metadata: { target_user_id: u.id, target_name: u.full_name },
    });
    await load();
  };

  const removeUser = async (u: AdminUser) => {
    if (u.id === user?.id) return toast.error("Você não pode excluir a si mesmo");
    if (!confirm(`Apagar definitivamente ${u.full_name || u.id}? Essa ação remove o login, perfil e papel.`)) return;
    setDelId(u.id);
    const { data, error } = await supabase.functions.invoke("admin-delete-operator", {
      body: { user_id: u.id },
    });
    setDelId(null);
    if (error || (data as { error?: string })?.error) {
      const msg = (data as { error?: string })?.error || error?.message;
      return toast.error("Erro ao excluir", { description: typeof msg === "string" ? msg : "falha desconhecida" });
    }
    toast.success("Usuário excluído");
    void logAudit({
      action: "user.delete",
      entity_type: "user_role",
      entity_id: u.id,
      summary: `Excluiu usuário ${u.full_name || u.id}`,
      metadata: { target_user_id: u.id, target_name: u.full_name },
    });
    await load();
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-3 font-subtitle text-xs uppercase tracking-wider text-muted-foreground">Nome</th>
              <th className="px-4 py-3 font-subtitle text-xs uppercase tracking-wider text-muted-foreground">Papéis</th>
              <th className="px-4 py-3 font-subtitle text-xs uppercase tracking-wider text-muted-foreground" title="Nome usado no campo agente_ativacao do HubSpot">
                Agente (HubSpot)
              </th>
              <th className="px-4 py-3 font-subtitle text-xs uppercase tracking-wider text-muted-foreground">Criado em</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isMe = u.id === user?.id;
              const isAdmin = u.roles.includes("admin");
              return (
                <tr key={u.id} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                          {(u.full_name || "?").slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <span className="font-medium text-foreground">
                        {u.full_name || <span className="text-muted-foreground">Sem nome</span>}
                        {isMe && <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">você</span>}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {u.roles.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <span key={r} className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-foreground">
                            {r}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editAgenteId === u.id ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={editAgenteValue}
                          onChange={(e) => setEditAgenteValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveAgente(u);
                            if (e.key === "Escape") setEditAgenteId(null);
                          }}
                          placeholder="Ex.: João Silva"
                          autoFocus
                          className="h-8 max-w-[180px] text-xs"
                        />
                        <Button
                          size="sm"
                          onClick={() => saveAgente(u)}
                          disabled={savingAgente}
                          className="h-8 px-2"
                        >
                          {savingAgente ? <Loader2 className="h-3 w-3 animate-spin" /> : "OK"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditAgenteId(null)}
                          className="h-8 px-2"
                        >
                          ✕
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditAgenteId(u.id);
                          setEditAgenteValue(u.agente_ativacao ?? "");
                        }}
                        className="rounded border border-dashed border-border px-2 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary"
                      >
                        {u.agente_ativacao || <span className="italic">não vinculado</span>}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 font-numeric text-xs text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant={isAdmin ? "outline" : "default"}
                        disabled={busyId === u.id || isMe}
                        onClick={() => toggleAdmin(u)}
                        className="gap-1.5"
                        title={isMe ? "Você não pode remover seu próprio admin" : undefined}
                      >
                        {busyId === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isAdmin ? <ShieldOff className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                        {isAdmin ? "Remover admin" : "Promover a admin"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={delId === u.id || isMe}
                        onClick={() => removeUser(u)}
                        className="gap-1.5 text-destructive hover:text-destructive"
                        title={isMe ? "Você não pode excluir a si mesmo" : "Apagar usuário (auth + perfil + papel)"}
                      >
                        {delId === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        Excluir
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhum usuário encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============ CONFIG ============
const metasSchema = z.object({
  slaNoPrazo: z
    .number({ invalid_type_error: "Informe um número" })
    .int("Use um número inteiro")
    .min(0, "Mínimo 0%")
    .max(100, "Máximo 100%"),
  maxCritico: z
    .number({ invalid_type_error: "Informe um número" })
    .int("Use um número inteiro")
    .min(0, "Mínimo 0%")
    .max(100, "Máximo 100%"),
  tempoMedioMax: z
    .number({ invalid_type_error: "Informe um número" })
    .int("Use um número inteiro")
    .min(1, "Mínimo 1 dia")
    .max(365, "Máximo 365 dias"),
});

type MetasValues = z.infer<typeof metasSchema>;
type MetasErrors = Partial<Record<keyof MetasValues, string>>;

const DEFAULT_METAS: MetasValues = { slaNoPrazo: 80, maxCritico: 10, tempoMedioMax: 18 };

const validateMetas = (v: MetasValues): MetasErrors => {
  const res = metasSchema.safeParse(v);
  if (res.success) return {};
  const errs: MetasErrors = {};
  for (const issue of res.error.issues) {
    const k = issue.path[0] as keyof MetasValues | undefined;
    if (typeof k === "string" && !errs[k]) errs[k] = issue.message;
  }
  return errs;
};

const AdminConfig = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [existed, setExisted] = useState(false);
  const [original, setOriginal] = useState<MetasValues>(DEFAULT_METAS);
  const [form, setForm] = useState<MetasValues>(DEFAULT_METAS);
  const [errors, setErrors] = useState<MetasErrors>({});

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "metas")
      .maybeSingle();
    setLoading(false);
    if (error) return toast.error("Erro ao carregar metas", { description: error.message });
    if (data) {
      const v = { ...DEFAULT_METAS, ...(data.value as Partial<MetasValues>) };
      setOriginal(v);
      setForm(v);
      setExisted(true);
    } else {
      setExisted(false);
      setOriginal(DEFAULT_METAS);
      setForm(DEFAULT_METAS);
    }
    setErrors({});
  };

  useEffect(() => { load(); }, []);

  const dirty =
    form.slaNoPrazo !== original.slaNoPrazo ||
    form.maxCritico !== original.maxCritico ||
    form.tempoMedioMax !== original.tempoMedioMax;

  const hasErrors = Object.keys(errors).length > 0;

  const updateField = (k: keyof MetasValues, raw: string) => {
    const v = raw === "" ? Number.NaN : Number(raw);
    const next = { ...form, [k]: v };
    setForm(next);
    setErrors(validateMetas(next));
  };

  const save = async () => {
    const errs = validateMetas(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Corrija os campos destacados antes de salvar.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("app_settings").upsert(
      { key: "metas", value: form as never, updated_by: user?.id ?? null },
      { onConflict: "key" },
    );
    setSaving(false);
    if (error) return toast.error("Erro ao salvar metas", { description: error.message });

    const action = existed ? "meta.update" : "meta.create";
    const changes: Record<string, { from: number; to: number }> = {};
    (Object.keys(form) as (keyof MetasValues)[]).forEach((k) => {
      if (form[k] !== original[k]) changes[k] = { from: original[k], to: form[k] };
    });
    void logAudit({
      action,
      entity_type: "meta",
      entity_id: "metas",
      summary: existed
        ? `Atualizou metas (${Object.keys(changes).join(", ") || "sem diff"})`
        : "Criou metas iniciais",
      metadata: existed ? { changes } : { value: form },
    });
    toast.success("Metas salvas");
    setOriginal(form);
    setExisted(true);
  };

  const remove = async () => {
    if (!existed) return;
    if (!confirm("Remover as metas configuradas? Os valores padrão voltam a vigorar.")) return;
    setRemoving(true);
    const { error } = await supabase.from("app_settings").delete().eq("key", "metas");
    setRemoving(false);
    if (error) return toast.error("Erro ao remover metas", { description: error.message });
    void logAudit({
      action: "meta.delete",
      entity_type: "meta",
      entity_id: "metas",
      summary: "Removeu metas (voltou ao padrão)",
      metadata: { previous: original },
    });
    toast.success("Metas removidas");
    setExisted(false);
    setOriginal(DEFAULT_METAS);
    setForm(DEFAULT_METAS);
    setErrors({});
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold text-secondary">Metas operacionais</h3>
            <p className="mt-1 font-small text-sm text-muted-foreground">
              Define os pactos do time de onboarding. Alterações são auditadas.
            </p>
          </div>
          <span className={`rounded-full border px-2 py-0.5 text-xs ${existed ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground"}`}>
            {existed ? "Personalizadas" : "Padrão"}
          </span>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <MetaField
            label="% SLA no prazo (meta)"
            hint="Inteiro entre 0 e 100"
            value={form.slaNoPrazo}
            onChange={(raw) => updateField("slaNoPrazo", raw)}
            suffix="%"
            min={0}
            max={100}
            error={errors.slaNoPrazo}
          />
          <MetaField
            label="% crítico máx."
            hint="Inteiro entre 0 e 100"
            value={form.maxCritico}
            onChange={(raw) => updateField("maxCritico", raw)}
            suffix="%"
            min={0}
            max={100}
            error={errors.maxCritico}
          />
          <MetaField
            label="Tempo médio máx."
            hint="Inteiro entre 1 e 365 dias"
            value={form.tempoMedioMax}
            onChange={(raw) => updateField("tempoMedioMax", raw)}
            suffix="d"
            min={1}
            max={365}
            error={errors.tempoMedioMax}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          {existed && (
            <Button variant="ghost" onClick={remove} disabled={removing || saving} className="gap-1.5 text-destructive hover:text-destructive">
              {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Restaurar padrão
            </Button>
          )}
          <Button onClick={save} disabled={!dirty || saving || hasErrors} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {existed ? "Salvar alterações" : "Criar metas"}
          </Button>
        </div>
      </div>

      <CopilotPromptEditor />

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-display text-base font-semibold text-secondary">Limites de SLA</h3>
        <p className="mt-1 font-small text-sm text-muted-foreground">
          As bandas (saudável / atenção / alerta / crítico) hoje vivem em <code className="rounded bg-muted px-1 py-0.5 text-xs">src/lib/risk.ts</code>. Quando movermos para o banco, as alterações também serão auditadas.
        </p>
      </div>
    </div>
  );
};

const MetaField = ({
  label, hint, value, onChange, suffix, min, max, error,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (raw: string) => void;
  suffix?: string;
  min?: number;
  max?: number;
  error?: string;
}) => (
  <label className="flex flex-col gap-1">
    <span className="font-subtitle text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
    <div className="relative">
      <Input
        type="number"
        inputMode="numeric"
        step={1}
        min={min}
        max={max}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        className={`pr-8 ${error ? "border-destructive focus-visible:ring-destructive/40" : ""}`}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
    {error ? (
      <span className="text-[11px] font-medium text-destructive">{error}</span>
    ) : (
      <span className="text-[11px] text-muted-foreground">{hint}</span>
    )}
  </label>
);

// ============ AUDITORIA ============
interface AuditRow {
  id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const ENTITY_LABEL: Record<string, string> = {
  operador: "Operador",
  meta: "Meta",
  config: "Configuração",
  user_role: "Papel de usuário",
  outro: "Outro",
};

const AdminAuditoria = () => {
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(sevenDaysAgo);
  const [to, setTo] = useState(today);
  const [entity, setEntity] = useState<string>("all");
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("audit_logs")
      .select("id, user_id, user_name, action, entity_type, entity_id, summary, metadata, created_at")
      .gte("created_at", `${from}T00:00:00`)
      .lte("created_at", `${to}T23:59:59`)
      .order("created_at", { ascending: false })
      .limit(500);
    if (entity !== "all") q = q.eq("entity_type", entity);
    const { data, error } = await q;
    setLoading(false);
    if (error) return toast.error("Erro ao carregar auditoria", { description: error.message });
    setRows((data as unknown as AuditRow[]) ?? []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-3">
        <div className="flex flex-col gap-1">
          <label className="font-subtitle text-[10px] uppercase tracking-wider text-muted-foreground">De</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[150px]" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-subtitle text-[10px] uppercase tracking-wider text-muted-foreground">Até</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[150px]" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-subtitle text-[10px] uppercase tracking-wider text-muted-foreground">Entidade</label>
          <select
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="all">Todas</option>
            <option value="operador">Operador</option>
            <option value="meta">Meta</option>
            <option value="config">Configuração</option>
            <option value="user_role">Papel de usuário</option>
          </select>
        </div>
        <Button onClick={load} disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Filtrar
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-subtitle text-xs uppercase tracking-wider text-muted-foreground">Quando</th>
                <th className="px-4 py-3 font-subtitle text-xs uppercase tracking-wider text-muted-foreground">Quem</th>
                <th className="px-4 py-3 font-subtitle text-xs uppercase tracking-wider text-muted-foreground">Entidade</th>
                <th className="px-4 py-3 font-subtitle text-xs uppercase tracking-wider text-muted-foreground">Ação</th>
                <th className="px-4 py-3 font-subtitle text-xs uppercase tracking-wider text-muted-foreground">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="px-4 py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhum registro no período.</td></tr>
              )}
              {!loading && rows.map((r) => (
                <tr key={r.id} className="border-b border-border/50 align-top last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 font-numeric text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-foreground">{r.user_name || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs">
                      {ENTITY_LABEL[r.entity_type] ?? r.entity_type}
                    </span>
                  </td>
                  <td className="px-4 py-3"><code className="rounded bg-muted px-1.5 py-0.5 text-xs">{r.action}</code></td>
                  <td className="px-4 py-3 text-foreground">
                    <div>{r.summary}</div>
                    {r.metadata && Object.keys(r.metadata).length > 0 && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">metadata</summary>
                        <pre className="mt-1 max-w-xl overflow-x-auto rounded bg-muted/50 p-2 text-[11px] leading-snug">{JSON.stringify(r.metadata, null, 2)}</pre>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Admin;
