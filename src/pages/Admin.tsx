import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Shield, ShieldCheck, Users, Settings as SettingsIcon, Trash2, Loader2, History, RefreshCw, UserPlus, Mail, Send, Copy, MessageCircle, Link2, Sparkles, Plus, Contact2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
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
import { ACESSO_LABELS, acessoToRoleEquipe, roleEquipeToAcesso, type AppTeam, type AcessoOption } from "@/lib/areaAccess";

interface AdminUser {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  roles: string[];
  /** Papel bruto do banco: 'super_admin' | 'admin' | 'user' | null se ainda não tem linha em user_roles_operations. */
  rawRole: "super_admin" | "admin" | "user" | null;
  agente_ativacao?: string | null;
  /** Time do usuário (controla quais áreas enxerga). null = usa o default por papel. */
  equipe?: AppTeam | null;
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
            <TabsTrigger value="hubspot" className="gap-1.5"><Contact2 className="h-3.5 w-3.5" />Agentes HubSpot</TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5"><Users className="h-3.5 w-3.5" />Usuários</TabsTrigger>
            <TabsTrigger value="podium" className="gap-1.5"><Trophy className="h-3.5 w-3.5" />Pódium</TabsTrigger>
            <TabsTrigger value="config" className="gap-1.5"><SettingsIcon className="h-3.5 w-3.5" />Configurações</TabsTrigger>
            <TabsTrigger value="auditoria" className="gap-1.5"><History className="h-3.5 w-3.5" />Auditoria</TabsTrigger>
          </TabsList>
          <TabsContent value="operators" className="mt-4"><AdminOperators /></TabsContent>
          <TabsContent value="hubspot" className="mt-4"><AdminHubspotAgents /></TabsContent>
          <TabsContent value="users" className="mt-4"><AdminUsers /></TabsContent>
          <TabsContent value="podium" className="mt-4"><AdminPodium /></TabsContent>
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
  role: "admin" | "user" | "super_admin" | "viewer";
  agente_ativacao: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  has_password?: boolean | null;
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
  const [form, setForm] = useState({ email: "", full_name: "", acesso: "onboarding" as AcessoOption, agente_ativacao: "" });

  const load = async () => {
    setLoading(true);
    const [{ data: ops, error: oErr }, { data: ags, error: aErr }, { data: hsAgents, error: hsErr }] = await Promise.all([
      supabase.rpc("list_operators"),
      supabase.rpc("distinct_agentes_ativacao"),
      supabase.from("hubspot_agents").select("name"),
    ]);
    setLoading(false);
    if (oErr) return toast.error("Erro ao carregar operadores", { description: oErr.message });
    if (aErr) toast.error("Erro ao carregar agentes", { description: aErr.message });
    if (hsErr) toast.error("Erro ao carregar agentes HubSpot", { description: hsErr.message });
    setList((ops as OperatorRow[]) ?? []);
    const fromDb = ((ags as { agente: string }[]) ?? []).map((a) => a.agente);
    const fromTable = ((hsAgents as { name: string }[]) ?? []).map((a) => a.name);
    // Nomes a esconder/normalizar (ex.: grafia antiga "Ramona Sarmento" → usar "Rhamona Sarmento")
    const blocked = new Set(["ramona sarmento"]);
    const merged = Array.from(new Set([...fromDb, ...fromTable]))
      .filter((a) => !blocked.has(a.trim().toLowerCase()))
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
    setAgentes(merged);
  };

  const myRole = list.find((o) => o.user_id === user?.id)?.role ?? null;
  const isSuperAdmin = myRole === "super_admin";

  useEffect(() => { load(); }, []);

  const invite = async (channels: ("email" | "whatsapp" | "link_only")[]) => {
    if (!form.email.trim()) return toast.error("Informe o email");
    const { role, equipe } = acessoToRoleEquipe(form.acesso);
    const requiresAgente = role === "user"; // edge function exige agente p/ papel 'user'
    if (requiresAgente && !form.agente_ativacao.trim()) {
      return toast.error(form.acesso === "sucesso" ? "Informe o agente de Sucesso" : "Informe o agente HubSpot");
    }
    setBusy(true);
    const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr || !refreshed.session) {
      setBusy(false);
      await supabase.auth.signOut();
      toast.error("Sessão expirada", { description: "Faça login novamente." });
      window.location.href = "/auth";
      return;
    }
    const { data, error } = await supabase.functions.invoke("admin-create-operator", {
      body: {
        email: form.email.trim(),
        full_name: form.full_name.trim() || undefined,
        role,
        agente_ativacao: requiresAgente ? form.agente_ativacao : undefined,
        channels,
      },
    });
    setBusy(false);
    if (error || (data as { error?: string })?.error) {
      const msg = (data as { error?: string })?.error || error?.message;
      if (typeof msg === "string" && (msg.includes("invalid_token") || msg.includes("missing_auth"))) {
        await supabase.auth.signOut();
        toast.error("Sessão expirada", { description: "Faça login novamente." });
        window.location.href = "/auth";
        return;
      }
      return toast.error("Erro ao convidar", { description: typeof msg === "string" ? msg : "falha desconhecida" });
    }

    // Define o Time do novo usuário (a edge function cria a linha em user_roles_operations;
    // aqui só atualizamos a coluna equipe — admin tem permissão RLS para isso).
    const newUserId = (data as { user_id?: string })?.user_id;
    if (newUserId) {
      const { error: eqErr } = await supabase
        .from("user_roles_operations")
        .update({ equipe })
        .eq("user_id", newUserId);
      if (eqErr) toast.error("Convite criado, mas falhou ao definir o Time", { description: eqErr.message });
    }

    const link =
      (data as { short_link?: string })?.short_link ||
      (data as { action_link?: string })?.action_link ||
      null;
    const labels: Record<string, string> = {
      email: "Email enviado",
      whatsapp: "WhatsApp acionado",
      link_only: "Link copiado",
    };
    toast.success(`Convite criado para ${form.email} — ${channels.map((c) => labels[c]).join(" + ")}`);
    if (link) {
      try {
        await navigator.clipboard.writeText(link);
      } catch {
        /* ignore clipboard errors */
      }
      setInviteLink({ email: form.email.trim(), link });
    }
    void logAudit({
      action: "operator.invite",
      entity_type: "user_role",
      entity_id: form.email,
      summary: `Convidou ${form.email} (Acesso ${ACESSO_LABELS[form.acesso]}) via ${channels.join(", ")} — agente ${form.agente_ativacao || "—"}`,
      metadata: { email: form.email, acesso: form.acesso, role, equipe, agente_ativacao: form.agente_ativacao, channels },
    });
    setForm({ email: "", full_name: "", acesso: "onboarding", agente_ativacao: "" });
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
            <label className="font-subtitle text-[10px] uppercase tracking-wider text-muted-foreground">Acesso</label>
            <select
              value={form.acesso}
              onChange={(e) => setForm((f) => ({ ...f, acesso: e.target.value as AcessoOption }))}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="onboarding">{ACESSO_LABELS.onboarding}</option>
              <option value="sucesso">{ACESSO_LABELS.sucesso}</option>
              <option value="viewer">{ACESSO_LABELS.viewer}</option>
              {isSuperAdmin && <option value="gestor">{ACESSO_LABELS.gestor}</option>}
            </select>
          </div>
          <div>
            <label className="font-subtitle text-[10px] uppercase tracking-wider text-muted-foreground">
              {form.acesso === "sucesso" ? "Agente de Sucesso" : "Agente HubSpot"}
              {!(form.acesso === "onboarding" || form.acesso === "sucesso") && <span className="ml-1 normal-case tracking-normal text-muted-foreground/70">(não exigido)</span>}
            </label>
            {form.acesso === "sucesso" ? (
              <Input
                value={form.agente_ativacao}
                onChange={(e) => setForm((f) => ({ ...f, agente_ativacao: e.target.value }))}
                placeholder="Nome do agente de Sucesso"
              />
            ) : (
              <select
                value={form.agente_ativacao}
                onChange={(e) => setForm((f) => ({ ...f, agente_ativacao: e.target.value }))}
                disabled={form.acesso !== "onboarding"}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
              >
                <option value="">{form.acesso === "onboarding" ? "Selecione…" : "—"}</option>
                {agentes.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            )}
          </div>

        </div>
        <div className="mt-3 flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={busy} className="gap-1.5">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Enviar convite
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="text-xs">Enviar convite via</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => invite(["email"])}>
                <Mail className="mr-2 h-3.5 w-3.5" /> Email
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => invite(["whatsapp"])}>
                <MessageCircle className="mr-2 h-3.5 w-3.5" /> WhatsApp
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => invite(["email", "whatsapp"])}>
                <Send className="mr-2 h-3.5 w-3.5" /> Email + WhatsApp
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => invite(["link_only"])}>
                <Link2 className="mr-2 h-3.5 w-3.5" /> Apenas copiar link
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
                const targetIsPrivileged = op.role === "admin" || op.role === "super_admin";
                const canModify = !targetIsPrivileged || isSuperAdmin;
                const lockReason = !canModify ? "Apenas super-admin pode alterar admins" : undefined;
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
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${
                        op.role === "super_admin"
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-500"
                          : op.role === "admin"
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border bg-muted text-foreground"
                      }`}>
                        {op.role === "super_admin" ? "super-admin" : op.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {op.agente_ativacao || <span className="italic text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {op.has_password ? (
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-500">Ativo</span>
                      ) : op.last_sign_in_at || op.email_confirmed_at ? (
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-500" title="Abriu o link, mas ainda não definiu senha">Convite aberto</span>
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
                              disabled={resendId === op.user_id || !canModify}
                              className="gap-1.5"
                              title={lockReason}
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
                              <MessageCircle className="mr-2 h-3.5 w-3.5" /> WhatsApp
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
                          disabled={delId === op.user_id || isMe || !canModify}
                          onClick={() => remove(op)}
                          className="gap-1.5 text-destructive hover:text-destructive"
                          title={isMe ? "Você não pode excluir a si mesmo" : lockReason}
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
  const [editProfileId, setEditProfileId] = useState<string | null>(null);
  const [editProfileName, setEditProfileName] = useState("");
  const [editProfileAvatar, setEditProfileAvatar] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: profilesData, error: pErr }, { data: opsData, error: oErr }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, avatar_url, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("user_roles_operations")
        .select("user_id, role, agente_ativacao, equipe"),
    ]);
    setLoading(false);
    if (pErr || oErr) {
      toast.error("Erro ao carregar usuários", { description: (pErr ?? oErr)?.message });
      return;
    }
    const opsMap = new Map<string, { role: "super_admin" | "admin" | "user"; agente_ativacao: string | null; equipe: AppTeam | null }>(
      (opsData ?? []).map((o) => [o.user_id, { role: o.role as "super_admin" | "admin" | "user", agente_ativacao: o.agente_ativacao, equipe: (o.equipe as AppTeam | null) ?? null }]),
    );
    const merged: AdminUser[] = (profilesData ?? []).map((p) => {
      const op = opsMap.get(p.id);
      const rawRole = op?.role ?? null;
      const roles =
        rawRole === "super_admin" ? ["super-admin"]
        : rawRole === "admin" ? ["admin"]
        : rawRole === "user" ? ["user"]
        : [];
      return {
        id: p.id,
        full_name: p.full_name,
        avatar_url: p.avatar_url,
        created_at: p.created_at,
        roles,
        rawRole,
        agente_ativacao: op?.agente_ativacao ?? null,
        equipe: op?.equipe ?? null,
      };
    });
    setUsers(merged);
  };

  // O viewer atual é super-admin? (necessário para gerenciar outros super-admins.)
  const mySelf = users.find((u) => u.id === user?.id);
  const iAmSuperAdmin = mySelf?.rawRole === "super_admin";
  const iAmAdmin = mySelf?.rawRole === "admin" || mySelf?.rawRole === "super_admin";

  useEffect(() => { load(); }, []);

  const saveAgente = async (u: AdminUser) => {
    const value = editAgenteValue.trim() || null;
    setSavingAgente(true);
    // Preserva o papel atual (inclusive super_admin); default 'user' quando ainda não existe linha.
    const keepRole = u.rawRole ?? "user";
    const { error } = await supabase
      .from("user_roles_operations")
      .upsert(
        { user_id: u.id, agente_ativacao: value, role: keepRole },
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

  // Define o Acesso do usuário (Time = papel): grava papel + equipe de uma vez.
  const saveAcesso = async (u: AdminUser, acesso: AcessoOption) => {
    const { role, equipe } = acessoToRoleEquipe(acesso);
    setBusyId(u.id);
    const { error } = await supabase
      .from("user_roles_operations")
      .upsert(
        { user_id: u.id, role, equipe, agente_ativacao: u.agente_ativacao ?? null },
        { onConflict: "user_id" },
      );
    setBusyId(null);
    if (error) return toast.error("Erro ao definir acesso", { description: error.message });
    toast.success(`Acesso de ${u.full_name || "usuário"} definido como ${ACESSO_LABELS[acesso]}`);
    void logAudit({
      action: "user.set_acesso",
      entity_type: "user_role",
      entity_id: u.id,
      summary: `Definiu acesso de ${u.full_name || u.id} como ${ACESSO_LABELS[acesso]}`,
      metadata: { target_user_id: u.id, target_name: u.full_name, acesso, role, equipe },
    });
    await load();
  };

  const saveProfile = async (u: AdminUser) => {
    setSavingProfile(true);
    const name = editProfileName.trim() || null;
    const avatar = editProfileAvatar.trim() || null;
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name, avatar_url: avatar })
      .eq("id", u.id);
    setSavingProfile(false);
    if (error) return toast.error("Erro ao salvar perfil", { description: error.message });
    toast.success("Perfil atualizado");
    void logAudit({
      action: "user.update_profile",
      entity_type: "outro",
      entity_id: u.id,
      summary: `Atualizou perfil de ${u.full_name || u.id}`,
      metadata: { target_user_id: u.id, full_name: name, avatar_url: avatar },
    });
    setEditProfileId(null);
    await load();
  };

  // Upload de foto (admin/super-admin). Grava na pasta do próprio admin — exigência
  // do RLS do storage — e a URL pública é salva no perfil do usuário-alvo.
  const uploadAvatar = async (file: File) => {
    if (!user || !editProfileId) return;
    if (!file.type.startsWith("image/")) return toast.error("Selecione uma imagem");
    if (file.size > 5 * 1024 * 1024) return toast.error("Imagem muito grande (máx 5MB)");
    setUploadingAvatar(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${user.id}/users/${editProfileId}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
      upsert: true,
      cacheControl: "3600",
      contentType: file.type || "image/png",
    });
    if (upErr) {
      setUploadingAvatar(false);
      return toast.error("Erro ao enviar imagem", { description: upErr.message });
    }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    setEditProfileAvatar(pub.publicUrl);
    setUploadingAvatar(false);
    toast.success("Imagem enviada — clique em Salvar para aplicar");
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
              <th className="px-4 py-3 font-subtitle text-xs uppercase tracking-wider text-muted-foreground" title="Define papel + áreas: Gestor=admin, Onboarding/Sucesso=usuário (cada um só vê sua área), Viewer=só leitura">
                Acesso
              </th>
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
              const isAdmin = u.rawRole === "admin" || u.rawRole === "super_admin";
              const isTargetSuper = u.rawRole === "super_admin";
              // Apenas super-admins podem excluir outros super-admins. Ninguém se exclui.
              const canDelete = !isMe && (!isTargetSuper || iAmSuperAdmin);
              return (
                <tr key={u.id} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-3">
                    {editProfileId === u.id ? (
                      <div className="flex flex-col gap-1.5">
                        <Input
                          value={editProfileName}
                          onChange={(e) => setEditProfileName(e.target.value)}
                          placeholder="Nome completo"
                          className="h-8 max-w-[220px] text-xs"
                          autoFocus
                        />
                        <Input
                          value={editProfileAvatar}
                          onChange={(e) => setEditProfileAvatar(e.target.value)}
                          placeholder="URL da foto (https://…)"
                          className="h-8 max-w-[260px] text-xs"
                        />
                        <div className="flex items-center gap-2">
                          {editProfileAvatar ? (
                            <img src={editProfileAvatar} alt="" className="h-9 w-9 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground">
                              {(editProfileName || u.full_name || "?").slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <label className="cursor-pointer rounded-md border border-dashed border-border px-2 py-1 text-[11px] text-muted-foreground hover:border-primary hover:text-primary">
                            {uploadingAvatar ? "Enviando…" : "Enviar foto"}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={uploadingAvatar}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) void uploadAvatar(f);
                                e.target.value = "";
                              }}
                            />
                          </label>
                          {editProfileAvatar && (
                            <button
                              type="button"
                              onClick={() => setEditProfileAvatar("")}
                              className="text-[11px] text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
                            >
                              Remover
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button size="sm" onClick={() => saveProfile(u)} disabled={savingProfile || uploadingAvatar} className="h-7 px-2 text-xs">
                            {savingProfile ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditProfileId(null)} className="h-7 px-2 text-xs">
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
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
                        {iAmAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditProfileId(u.id);
                              setEditProfileName(u.full_name ?? "");
                              setEditProfileAvatar(u.avatar_url ?? "");
                            }}
                            className="ml-1 rounded border border-dashed border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground hover:border-primary hover:text-primary"
                            title="Editar nome e foto"
                          >
                            editar
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {u.rawRole === "super_admin" ? (
                      <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-500">Super-admin</span>
                    ) : (
                      <select
                        value={roleEquipeToAcesso(u.rawRole, u.equipe ?? null)}
                        onChange={(e) => saveAcesso(u, e.target.value as AcessoOption)}
                        disabled={busyId === u.id || isMe || (isAdmin && !iAmSuperAdmin)}
                        className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground disabled:opacity-50"
                        title={isMe ? "Você não pode alterar seu próprio acesso" : isAdmin && !iAmSuperAdmin ? "Só super-admin altera um Gestor/Admin" : undefined}
                      >
                        <option value="onboarding">{ACESSO_LABELS.onboarding}</option>
                        <option value="sucesso">{ACESSO_LABELS.sucesso}</option>
                        <option value="viewer">{ACESSO_LABELS.viewer}</option>
                        <option value="gestor" disabled={!iAmSuperAdmin}>{ACESSO_LABELS.gestor}</option>
                      </select>
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
                        variant="ghost"
                        disabled={delId === u.id || !canDelete}
                        onClick={() => removeUser(u)}
                        className="gap-1.5 text-destructive hover:text-destructive"
                        title={
                          isMe
                            ? "Você não pode excluir a si mesmo"
                            : isTargetSuper && !iAmSuperAdmin
                            ? "Apenas super-admins podem excluir outro super-admin"
                            : "Apagar usuário (auth + perfil + papel)"
                        }
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
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhum usuário encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============ CONFIG ============
const metasSchema = z.object({
  slaPrazoDias: z
    .number({ invalid_type_error: "Informe um número" })
    .int("Use um número inteiro")
    .min(1, "Mínimo 1 dia")
    .max(365, "Máximo 365 dias"),
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
  churnMax: z
    .number({ invalid_type_error: "Informe um número" })
    .min(0, "Mínimo 0%")
    .max(100, "Máximo 100%"),
  ativacaoMrr: z
    .number({ invalid_type_error: "Informe um número" })
    .min(0, "Mínimo 0%")
    .max(100, "Máximo 100%"),
});

type MetasValues = z.infer<typeof metasSchema>;
type MetasErrors = Partial<Record<keyof MetasValues, string>>;
type AppSettingsRow = Database["public"]["Tables"]["app_settings"]["Row"];
type AppSettingsInsert = Database["public"]["Tables"]["app_settings"]["Insert"];

const APP_SETTINGS_TABLE = "app_settings" as const;

const DEFAULT_METAS: MetasValues = {
  slaPrazoDias: 30,
  slaNoPrazo: 80,
  maxCritico: 10,
  tempoMedioMax: 18,
  churnMax: 9,
  ativacaoMrr: 91,
};

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
      .from(APP_SETTINGS_TABLE)
      .select("value")
      .eq("key", "metas")
      .maybeSingle();
    setLoading(false);
    if (error) return toast.error("Erro ao carregar metas", { description: error.message });
    const settings = data as Pick<AppSettingsRow, "value"> | null;
    if (settings) {
      const v = { ...DEFAULT_METAS, ...(settings.value as Partial<MetasValues>) };
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

  const dirty = (Object.keys(form) as (keyof MetasValues)[]).some(
    (k) => form[k] !== original[k],
  );

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
    const payload: AppSettingsInsert = {
      key: "metas",
      value: form as unknown as Json,
      updated_by: user?.id ?? null,
    };
    const { error } = await supabase.from(APP_SETTINGS_TABLE).upsert(
      payload,
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
    const { error } = await supabase.from(APP_SETTINGS_TABLE).delete().eq("key", "metas");
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
            label="SLA (prazo)"
            hint="Prazo do onboarding, em dias"
            value={form.slaPrazoDias}
            onChange={(raw) => updateField("slaPrazoDias", raw)}
            suffix="d"
            min={1}
            max={365}
            error={errors.slaPrazoDias}
          />
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
          <MetaField
            label="Churn máximo"
            hint="% máximo aceitável de churn"
            value={form.churnMax}
            onChange={(raw) => updateField("churnMax", raw)}
            suffix="%"
            min={0}
            max={100}
            step={0.1}
            error={errors.churnMax}
          />
          <MetaField
            label="Ativação MRR (meta)"
            hint="MRR ativado / MRR criado (mês anterior)"
            value={form.ativacaoMrr}
            onChange={(raw) => updateField("ativacaoMrr", raw)}
            suffix="%"
            min={0}
            max={100}
            step={0.1}
            error={errors.ativacaoMrr}
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
  label, hint, value, onChange, suffix, min, max, step = 1, error,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (raw: string) => void;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  error?: string;
}) => (
  <label className="flex flex-col gap-1">
    <span className="font-subtitle text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
    <div className="relative">
      <Input
        type="number"
        inputMode="numeric"
        step={step}
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

// ============ COPILOT PROMPT ============
const CopilotPromptEditor = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [existed, setExisted] = useState(false);
  const [original, setOriginal] = useState<string>(DEFAULT_COPILOT_SYSTEM_PROMPT);
  const [value, setValue] = useState<string>(DEFAULT_COPILOT_SYSTEM_PROMPT);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from(APP_SETTINGS_TABLE)
      .select("value")
      .eq("key", COPILOT_PROMPT_SETTINGS_KEY)
      .maybeSingle();
    setLoading(false);
    if (error) return toast.error("Erro ao carregar prompt", { description: error.message });
    const settings = data as Pick<AppSettingsRow, "value"> | null;
    const stored = (settings?.value as { prompt?: string } | null)?.prompt?.trim();
    if (stored) {
      setOriginal(stored);
      setValue(stored);
      setExisted(true);
    } else {
      setExisted(false);
      setOriginal(DEFAULT_COPILOT_SYSTEM_PROMPT);
      setValue(DEFAULT_COPILOT_SYSTEM_PROMPT);
    }
  };

  useEffect(() => { load(); }, []);

  const dirty = value.trim() !== original.trim();
  const tooShort = value.trim().length < 40;

  const save = async () => {
    if (tooShort) return toast.error("O prompt está muito curto. Capriche nas instruções.");
    setSaving(true);
    const payload: AppSettingsInsert = {
      key: COPILOT_PROMPT_SETTINGS_KEY,
      value: { prompt: value.trim() } as Json,
      updated_by: user?.id ?? null,
    };
    const { error } = await supabase.from(APP_SETTINGS_TABLE).upsert(
      payload,
      { onConflict: "key" },
    );
    setSaving(false);
    if (error) return toast.error("Erro ao salvar prompt", { description: error.message });
    void logAudit({
      action: existed ? "copilot_prompt.update" : "copilot_prompt.create",
      entity_type: "config",
      entity_id: COPILOT_PROMPT_SETTINGS_KEY,
      summary: existed ? "Atualizou o prompt do Copiloto" : "Definiu prompt customizado do Copiloto",
      metadata: { length: value.trim().length },
    });
    toast.success("Prompt do Copiloto salvo");
    setOriginal(value.trim());
    setExisted(true);
  };

  const restoreDefault = async () => {
    if (!existed) {
      setValue(DEFAULT_COPILOT_SYSTEM_PROMPT);
      return;
    }
    if (!confirm("Restaurar o prompt padrão do Copiloto? O texto customizado será removido.")) return;
    setRemoving(true);
    const { error } = await supabase
      .from(APP_SETTINGS_TABLE)
      .delete()
      .eq("key", COPILOT_PROMPT_SETTINGS_KEY);
    setRemoving(false);
    if (error) return toast.error("Erro ao restaurar prompt", { description: error.message });
    void logAudit({
      action: "copilot_prompt.delete",
      entity_type: "config",
      entity_id: COPILOT_PROMPT_SETTINGS_KEY,
      summary: "Restaurou o prompt padrão do Copiloto",
      metadata: {},
    });
    toast.success("Prompt padrão restaurado");
    setExisted(false);
    setOriginal(DEFAULT_COPILOT_SYSTEM_PROMPT);
    setValue(DEFAULT_COPILOT_SYSTEM_PROMPT);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h3 className="font-display text-base font-semibold text-secondary">Prompt do Copiloto</h3>
            <p className="mt-1 font-small text-sm text-muted-foreground">
              Define o comportamento, tom e formato de resposta do Copiloto de Operações. As alterações afetam todos os usuários.
            </p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${existed ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground"}`}>
          {existed ? "Customizado" : "Padrão"}
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            spellCheck={false}
            rows={18}
            className="mt-4 w-full resize-y rounded-lg border border-border bg-background p-3 font-mono text-xs leading-relaxed text-foreground outline-none focus:border-primary/40"
            placeholder="Instruções do sistema para o Copiloto…"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span>{value.length.toLocaleString("pt-BR")} caracteres</span>
            <span>Use markdown nas instruções (ex.: **negrito**, listas com "- ", tabelas com `|`).</span>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="ghost"
              onClick={restoreDefault}
              disabled={removing || saving || (!existed && !dirty)}
              className="gap-1.5 text-destructive hover:text-destructive"
            >
              {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Restaurar padrão
            </Button>
            <Button onClick={save} disabled={!dirty || saving || tooShort} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {existed ? "Salvar alterações" : "Salvar prompt customizado"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

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


// ============ HUBSPOT AGENTS ============
interface HubspotAgentRow {
  id: string;
  name: string;
  hubspot_id: string;
  created_at: string;
}

const AdminHubspotAgents = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<HubspotAgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", hubspot_id: "" });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("hubspot_agents")
      .select("id, name, hubspot_id, created_at")
      .order("name", { ascending: true });
    setLoading(false);
    if (error) return toast.error("Erro ao carregar agentes", { description: error.message });
    setRows((data as HubspotAgentRow[]) ?? []);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    const name = form.name.trim();
    const hubspot_id = form.hubspot_id.trim();
    if (!name) return toast.error("Informe o nome do agente");
    if (!hubspot_id) return toast.error("Informe o ID do HubSpot");
    setBusy(true);
    const { error } = await supabase
      .from("hubspot_agents")
      .insert({ name, hubspot_id, created_by: user?.id ?? null });
    setBusy(false);
    if (error) return toast.error("Erro ao criar agente", { description: error.message });
    toast.success("Agente criado");
    await logAudit({
      action: "hubspot_agent.create",
      entity_type: "hubspot_agent",
      summary: `Criou agente HubSpot ${name} (ID ${hubspot_id})`,
      metadata: { name, hubspot_id },
    });
    setForm({ name: "", hubspot_id: "" });
    load();
  };

  const remove = async (row: HubspotAgentRow) => {
    setDelId(row.id);
    const { error } = await supabase.from("hubspot_agents").delete().eq("id", row.id);
    setDelId(null);
    if (error) return toast.error("Erro ao remover", { description: error.message });
    toast.success("Agente removido");
    await logAudit({
      action: "hubspot_agent.delete",
      entity_type: "hubspot_agent",
      entity_id: row.id,
      summary: `Removeu agente HubSpot ${row.name}`,
      metadata: { name: row.name, hubspot_id: row.hubspot_id },
    });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="font-display text-lg font-semibold text-secondary">Novo agente HubSpot</h2>
        <p className="mt-1 font-small text-sm text-muted-foreground">
          Cadastre o nome do agente e o respectivo ID do HubSpot. O nome ficará disponível para vincular a operadores.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <label className="mb-1 block font-subtitle text-xs uppercase tracking-wider text-muted-foreground">Nome</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ex.: Kauan Nunes"
              disabled={busy}
            />
          </div>
          <div>
            <label className="mb-1 block font-subtitle text-xs uppercase tracking-wider text-muted-foreground">ID HubSpot</label>
            <Input
              value={form.hubspot_id}
              onChange={(e) => setForm((f) => ({ ...f, hubspot_id: e.target.value }))}
              placeholder="Ex.: 12345678"
              disabled={busy}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={create} disabled={busy} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Adicionar
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-lg font-semibold text-secondary">Agentes cadastrados</h2>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="px-5 py-8 text-center font-small text-sm text-muted-foreground">Nenhum agente cadastrado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-subtitle text-xs uppercase tracking-wider">Nome</th>
                  <th className="px-4 py-3 font-subtitle text-xs uppercase tracking-wider">ID HubSpot</th>
                  <th className="px-4 py-3 font-subtitle text-xs uppercase tracking-wider">Criado em</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-3 text-foreground">{r.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{r.hubspot_id}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(r)}
                        disabled={delId === r.id}
                        className="gap-1.5 text-destructive hover:text-destructive"
                      >
                        {delId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        Remover
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ============ PODIUM (fechar pódium do mês anterior) ============
import { useMemo as _useMemo } from "react";
import { useDashOperacoes } from "@/hooks/useDashOperacoes";
import { computeRanking } from "@/components/dashboard/RankingMetasMedalhas";
import { Medal } from "lucide-react";

const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const PODIUM_MEDALS = [
  { text: "text-amber-400", bg: "bg-amber-400/10 ring-amber-400/40", label: "Ouro" },
  { text: "text-slate-300", bg: "bg-slate-300/10 ring-slate-300/40", label: "Prata" },
  { text: "text-orange-400", bg: "bg-orange-500/10 ring-orange-500/40", label: "Bronze" },
];

const AdminPodium = () => {
  const { data, isLoading } = useDashOperacoes();
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<{ first: string; second: string | null; third: string | null } | null>(null);
  const [checking, setChecking] = useState(true);

  const now = new Date();
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0); // último dia do mês anterior
  const monthKey = `${prevStart.getFullYear()}-${String(prevStart.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = `${MONTH_LABELS[prevStart.getMonth()]}/${prevStart.getFullYear()}`;

  const top3 = _useMemo(() => {
    if (!data?.rows) return [];
    const { ranked } = computeRanking(data.rows, "custom", { start: prevStart, end: prevEnd });
    return ranked.slice(0, 3);
  }, [data, prevStart, prevEnd]);

  useEffect(() => {
    let cancel = false;
    setChecking(true);
    supabase
      .from("podium_history")
      .select("first, second, third")
      .eq("month", monthKey)
      .maybeSingle()
      .then(({ data: row }) => {
        if (cancel) return;
        setExisting(row ?? null);
        setChecking(false);
      });
    return () => { cancel = true; };
  }, [monthKey]);

  const save = async () => {
    if (top3.length === 0) {
      toast.error("Sem dados suficientes para fechar o pódium deste mês");
      return;
    }
    setSaving(true);
    const payload = {
      month: monthKey,
      first: top3[0].ativador,
      second: top3[1]?.ativador ?? null,
      third: top3[2]?.ativador ?? null,
    };
    const { error } = await supabase
      .from("podium_history")
      .upsert(payload, { onConflict: "month" });
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar pódium", { description: error.message });
      return;
    }
    toast.success(`Pódium de ${monthLabel} salvo`);
    setExisting({ first: payload.first, second: payload.second, third: payload.third });
    void logAudit({
      action: "podium.save",
      entity_type: "outro",
      entity_id: monthKey,
      summary: `Fechou pódium de ${monthLabel}: 1º ${payload.first}, 2º ${payload.second ?? "—"}, 3º ${payload.third ?? "—"}`,
      metadata: payload,
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Trophy className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-secondary">Fechar pódium do mês</h3>
            <p className="font-small text-xs text-muted-foreground">
              Mês alvo: <span className="font-semibold text-foreground">{monthLabel}</span> ({monthKey})
            </p>
          </div>
        </div>

        {isLoading || checking ? (
          <div className="mt-6 flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <>
            {existing && (
              <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-200">
                Já existe pódium salvo para este mês ({existing.first} · {existing.second ?? "—"} · {existing.third ?? "—"}). Salvar novamente irá sobrescrever.
              </div>
            )}

            {top3.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-border py-10 text-center font-subtitle text-sm text-muted-foreground">
                Sem dados suficientes para o mês anterior.
              </div>
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {top3.map((r, i) => {
                  const m = PODIUM_MEDALS[i];
                  return (
                    <div
                      key={r.ativador}
                      className={`rounded-xl p-4 ring-1 ${m.bg}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Medal className={`h-6 w-6 ${m.text}`} />
                          <div>
                            <p className={`font-subtitle text-[10px] uppercase tracking-wider ${m.text}`}>{m.label}</p>
                            <p className="font-numeric text-xs text-muted-foreground tabular-nums">{i + 1}º lugar</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-numeric text-2xl font-bold tabular-nums ${m.text}`}>{Math.round(r.scoreFinal)}</p>
                          <p className="font-small text-[10px] uppercase tracking-wider text-muted-foreground">Score</p>
                        </div>
                      </div>
                      <p className="mt-3 font-display text-base font-semibold text-foreground truncate">{r.ativador}</p>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <Button onClick={save} disabled={saving || top3.length === 0} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
                Salvar pódium de {monthLabel}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Admin;
