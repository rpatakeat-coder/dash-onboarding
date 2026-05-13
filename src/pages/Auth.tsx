import { useState, type FormEvent } from "react";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePreferences } from "@/contexts/PreferencesContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const AuthPage = () => {
  const { session, signIn, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const location = useLocation();

  const { homeRoute } = usePreferences();

  const requested =
    (location.state as { from?: string } | null)?.from ||
    new URLSearchParams(location.search).get("redirect") ||
    "";
  const safeRedirect =
    requested.startsWith("/") && !requested.startsWith("//") && requested !== "/auth"
      ? requested
      : homeRoute || "/";

  if (!loading && session) return <Navigate to={safeRedirect} replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    nav(safeRedirect, { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-surface px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-8 shadow-xl"
      >
        <div>
          <h1 className="font-display text-2xl font-bold text-secondary">Entrar</h1>
          <p className="mt-1 font-subtitle text-sm text-muted-foreground">
            Painel Operações Takeat
          </p>
        </div>
        <div>
          <label className="font-subtitle text-xs text-muted-foreground">E-mail</label>
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="font-subtitle text-xs text-muted-foreground">Senha</label>
          <Input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Aguarde…" : "Entrar"}
        </Button>
        <p className="text-center font-subtitle text-xs text-muted-foreground">
          Acesso somente por convite. Fale com o administrador.
        </p>
      </form>
    </div>
  );
};

export default AuthPage;
