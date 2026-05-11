import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Shield, ShieldCheck, ShieldOff, UserCog, Users, Settings as SettingsIcon, Plus, Trash2, Loader2, History, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { logAudit } from "@/lib/audit";

interface AdminUser {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  roles: string[];
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
            <TabsTrigger value="users" className="gap-1.5"><Users className="h-3.5 w-3.5" />Usuários</TabsTrigger>
            <TabsTrigger value="operadores" className="gap-1.5"><UserCog className="h-3.5 w-3.5" />Operadores</TabsTrigger>
            <TabsTrigger value="config" className="gap-1.5"><SettingsIcon className="h-3.5 w-3.5" />Configurações</TabsTrigger>
          </TabsList>
          <TabsContent value="users" className="mt-4"><AdminUsers /></TabsContent>
          <TabsContent value="operadores" className="mt-4"><AdminOperadores /></TabsContent>
          <TabsContent value="config" className="mt-4"><AdminConfig /></TabsContent>
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

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("list_admin_users");
    setLoading(false);
    if (error) {
      toast.error("Erro ao carregar usuários", { description: error.message });
      return;
    }
    setUsers((data as AdminUser[]) ?? []);
  };

  useEffect(() => { load(); }, []);

  const toggleAdmin = async (u: AdminUser) => {
    const isAdmin = u.roles.includes("admin");
    setBusyId(u.id);
    if (isAdmin) {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", u.id)
        .eq("role", "admin");
      setBusyId(null);
      if (error) return toast.error("Erro ao remover admin", { description: error.message });
      toast.success(`${u.full_name || "Usuário"} não é mais admin`);
    } else {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: u.id, role: "admin" });
      setBusyId(null);
      if (error) return toast.error("Erro ao promover", { description: error.message });
      toast.success(`${u.full_name || "Usuário"} promovido a admin`);
    }
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
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Nenhum usuário encontrado.</td></tr>
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
    const { error } = await supabase.from("vendedores").insert({ nome });
    setAdding(false);
    if (error) return toast.error("Erro ao adicionar", { description: error.message });
    toast.success(`Operador "${nome}" adicionado`);
    setNovo("");
    await load();
  };

  const saveEdit = async (id: string) => {
    const nome = editNome.trim();
    if (!nome) return;
    const { error } = await supabase.from("vendedores").update({ nome }).eq("id", id);
    if (error) return toast.error("Erro ao salvar", { description: error.message });
    toast.success("Operador atualizado");
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
    const { error } = await supabase.from("vendedores").update({ avatar_url: url }).eq("id", id);
    if (error) return toast.error("Erro ao salvar avatar", { description: error.message });
    toast.success("Avatar atualizado");
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
const AdminConfig = () => {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-display text-base font-semibold text-secondary">Metas mensais</h3>
        <p className="mt-1 font-small text-sm text-muted-foreground">
          Edição de metas por operador será liberada na <span className="font-medium">Fase B2 — Metas e gamificação</span>.
        </p>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-display text-base font-semibold text-secondary">Limites de SLA</h3>
        <p className="mt-1 font-small text-sm text-muted-foreground">
          Os limites das bandas (saudável / atenção / alerta / crítico) hoje vivem em <code className="rounded bg-muted px-1 py-0.5 text-xs">src/lib/risk.ts</code>. Em uma próxima fase moveremos para configuração no banco.
        </p>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-display text-base font-semibold text-secondary">Modelo de IA padrão</h3>
        <p className="mt-1 font-small text-sm text-muted-foreground">
          Configuração disponível na <span className="font-medium">Fase A — Inteligência no dashboard</span>.
        </p>
      </div>
    </div>
  );
};

export default Admin;
