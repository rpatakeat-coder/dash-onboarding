import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Página de primeiro acesso / redefinição de senha.
 * Acessada via link de convite (type=invite) ou recovery (type=recovery).
 * O cliente Supabase processa o hash da URL automaticamente e cria a sessão;
 * aqui apenas pedimos a nova senha e chamamos updateUser.
 */
const SetPasswordPage = () => {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Aguarda o Supabase processar o hash (detectSessionInUrl) e emitir o evento.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setHasSession(!!s);
      setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("A senha precisa ter ao menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Senha definida com sucesso!");
    nav("/", { replace: true });
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-surface px-4">
        <p className="font-subtitle text-sm text-muted-foreground">Carregando…</p>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-surface px-4">
        <div className="w-full max-w-sm space-y-3 rounded-2xl border border-border bg-card p-8 text-center shadow-xl">
          <h1 className="font-display text-xl font-bold text-secondary">Link inválido ou expirado</h1>
          <p className="font-subtitle text-sm text-muted-foreground">
            Peça ao administrador para reenviar seu convite.
          </p>
          <Button className="w-full" onClick={() => nav("/auth", { replace: true })}>
            Ir para login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-surface px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-8 shadow-xl"
      >
        <div>
          <h1 className="font-display text-2xl font-bold text-secondary">Defina sua senha</h1>
          <p className="mt-1 font-subtitle text-sm text-muted-foreground">
            Primeiro acesso ao Painel Operações Takeat
          </p>
        </div>
        <div>
          <label className="font-subtitle text-xs text-muted-foreground">Nova senha</label>
          <Input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
          />
        </div>
        <div>
          <label className="font-subtitle text-xs text-muted-foreground">Confirmar senha</label>
          <Input
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Salvando…" : "Salvar senha e entrar"}
        </Button>
      </form>
    </div>
  );
};

export default SetPasswordPage;
