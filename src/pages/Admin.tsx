import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Shield, ShieldCheck, ShieldOff, UserCog, Users, Settings as SettingsIcon, Plus, Trash2, Loader2, History, RefreshCw, UserPlus, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

interface AdminUser {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  roles: string[];
  agente_ativacao?: string | null;
}

interface Vendedor {
  id: string;
  nome: string;
  avatar_url: string | null;
  created_at: string;
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
  if (!isAdmin) return <ClaimAdminScreen />;

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

        <Tabs defaultValue="users" className="w-full">
          <TabsList>
            <TabsTrigger value="operators" className="gap-1.5"><UserPlus className="h-3.5 w-3.5" />Operadores</TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5"><Users className="h-3.5 w-3.5" />Usuários</TabsTrigger>
            <TabsTrigger value="vendedores" className="gap-1.5"><UserCog className="h-3.5 w-3.5" />Vendedores</TabsTrigger>
            <TabsTrigger value="config" className="gap-1.5"><SettingsIcon className="h-3.5 w-3.5" />Configurações</TabsTrigger>
            <TabsTrigger value="auditoria" className="gap-1.5"><History className="h-3.5 w-3.5" />Auditoria</TabsTrigger>
          </TabsList>
          <TabsContent value="operators" className="mt-4"><AdminOperators /></TabsContent>
          <TabsContent value="users" className="mt-4"><AdminUsers /></TabsContent>
          <TabsContent value="vendedores" className="mt-4"><AdminOperadores /></TabsContent>
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

// ============ USERS ============
const AdminUsers = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
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

// ============ OPERADORES ============
const AdminOperadores = () => {
  const [list, setList] = useState<Vendedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [novo, setNovo] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("vendedores")
      .select("id, nome, avatar_url, created_at")
      .order("nome", { ascending: true });
    setLoading(false);
    if (error) return toast.error("Erro ao carregar operadores", { description: error.message });
    setList((data as Vendedor[]) ?? []);
  };

  useEffect(() => { load(); }, []);

  const addVendedor = async () => {
    const nome = novo.trim();
    if (!nome) return;
    setAdding(true);
    const { data: inserted, error } = await supabase
      .from("vendedores")
      .insert({ nome })
      .select("id")
      .maybeSingle();
    setAdding(false);
    if (error) return toast.error("Erro ao adicionar", { description: error.message });
    toast.success(`Operador "${nome}" adicionado`);
    void logAudit({
      action: "operador.create",
      entity_type: "operador",
      entity_id: inserted?.id,
      summary: `Adicionou operador "${nome}"`,
      metadata: { nome },
    });
    setNovo("");
    await load();
  };

  const saveEdit = async (id: string) => {
    const nome = editNome.trim();
    if (!nome) return;
    const before = list.find((v) => v.id === id);
    const { error } = await supabase.from("vendedores").update({ nome }).eq("id", id);
    if (error) return toast.error("Erro ao salvar", { description: error.message });
    toast.success("Operador atualizado");
    void logAudit({
      action: "operador.rename",
      entity_type: "operador",
      entity_id: id,
      summary: `Renomeou "${before?.nome ?? "?"}" → "${nome}"`,
      metadata: { from: before?.nome, to: nome },
    });
    setEditId(null);
    await load();
  };

  const uploadAvatar = async (id: string, file: File) => {
    const ext = file.name.split(".").pop();
    const path = `vendedores/${id}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) return toast.error("Erro no upload", { description: upErr.message });
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = `${data.publicUrl}?v=${Date.now()}`;
    const before = list.find((v) => v.id === id);
    const { error } = await supabase.from("vendedores").update({ avatar_url: url }).eq("id", id);
    if (error) return toast.error("Erro ao salvar avatar", { description: error.message });
    toast.success("Avatar atualizado");
    void logAudit({
      action: "operador.avatar_update",
      entity_type: "operador",
      entity_id: id,
      summary: `Atualizou avatar de "${before?.nome ?? id}"`,
      metadata: { file_name: file.name, file_size: file.size },
    });
    await load();
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
        <Input
          placeholder="Nome do novo operador"
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addVendedor()}
          className="max-w-sm"
        />
        <Button onClick={addVendedor} disabled={adding || !novo.trim()} className="gap-1.5">
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Adicionar
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-subtitle text-xs uppercase tracking-wider text-muted-foreground">Avatar</th>
                <th className="px-4 py-3 font-subtitle text-xs uppercase tracking-wider text-muted-foreground">Nome</th>
                <th className="px-4 py-3 font-subtitle text-xs uppercase tracking-wider text-muted-foreground">Criado em</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((v) => (
                <tr key={v.id} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-3">
                    <label className="inline-flex cursor-pointer items-center" title="Trocar avatar">
                      {v.avatar_url ? (
                        <img src={v.avatar_url} alt={v.nome} className="h-9 w-9 rounded-full object-cover ring-2 ring-transparent transition hover:ring-primary/40" />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground ring-2 ring-transparent transition hover:ring-primary/40">
                          {v.nome.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadAvatar(v.id, f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    {editId === v.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editNome}
                          onChange={(e) => setEditNome(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(v.id);
                            if (e.key === "Escape") setEditId(null);
                          }}
                          className="max-w-xs"
                          autoFocus
                        />
                        <Button size="sm" onClick={() => saveEdit(v.id)}>Salvar</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>Cancelar</Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setEditId(v.id); setEditNome(v.nome); }}
                        className="text-left font-medium text-foreground hover:text-primary"
                      >
                        {v.nome}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 font-numeric text-xs text-muted-foreground">
                    {new Date(v.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled
                      title="A exclusão de operadores está desabilitada para preservar histórico."
                      className="gap-1.5 text-muted-foreground"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Excluir
                    </Button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Nenhum operador cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
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
