import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const AuthPage = () => {
  const { session, signIn, signUp, loading } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  if (!loading && session) return <Navigate to="/" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } =
      mode === "login"
        ? await signIn(email, password)
        : await signUp(email, password, fullName.trim());
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    if (mode === "signup") {
      toast.success("Conta criada — verifique seu e-mail se necessário.");
    }
    nav("/");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-surface px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-8 shadow-xl"
      >
        <div>
          <h1 className="font-display text-2xl font-bold text-secondary">
            {mode === "login" ? "Entrar" : "Criar conta"}
          </h1>
          <p className="mt-1 font-subtitle text-sm text-muted-foreground">
            Painel Operações Takeat
          </p>
        </div>
        {mode === "signup" && (
          <div>
            <label className="font-subtitle text-xs text-muted-foreground">
              Nome completo (deve bater com o agente de ativação)
            </label>
            <Input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ex.: Maria Silva"
            />
          </div>
        )}
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
          {busy ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
        </Button>
        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="w-full text-center font-subtitle text-xs text-muted-foreground hover:text-primary"
        >
          {mode === "login" ? "Não tenho conta — criar" : "Já tenho conta — entrar"}
        </button>
      </form>
    </div>
  );
};

export default AuthPage;
