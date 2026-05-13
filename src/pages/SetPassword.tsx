import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";

type Status =
  | { kind: "loading" }
  | { kind: "ready"; isRecovery: boolean } // sessão válida, pode definir senha
  | { kind: "expired" } // link expirou ou já foi usado
  | { kind: "invalid" } // link malformado / sem token
  | { kind: "done" }; // senha definida com sucesso

/**
 * Página de primeiro acesso / redefinição de senha (alias /acesso-dash).
 * Lê o hash que o Supabase devolve após validar o token e mostra mensagens
 * claras para cada situação: válido, expirado, já usado ou inválido.
 */
const SetPasswordPage = () => {
  const nav = useNavigate();
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // 1. Detecta erro vindo no hash (#error=...&error_code=otp_expired)
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : "";
    const hashParams = new URLSearchParams(hash);
    const errorCode = hashParams.get("error_code") || hashParams.get("error");
    const hasToken =
      hashParams.has("access_token") || hashParams.has("refresh_token");

    if (errorCode) {
      // Códigos comuns: otp_expired, access_denied, invalid_request
      if (
        errorCode === "otp_expired" ||
        errorCode === "access_denied" ||
        hashParams.get("error_description")?.toLowerCase().includes("expired")
      ) {
        setStatus({ kind: "expired" });
      } else {
        setStatus({ kind: "invalid" });
      }
      // limpa o hash para não poluir a URL
      history.replaceState(null, "", window.location.pathname);
      return;
    }

    // 2. Detecta tipo do link (invite vs recovery) antes do hash ser limpo
    const linkType = hashParams.get("type"); // "invite" | "recovery" | "signup"
    const isRecovery = linkType === "recovery";

    // 3. Aguarda o Supabase processar o hash e criar sessão
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (s) {
        setStatus({ kind: "ready", isRecovery: event === "PASSWORD_RECOVERY" || isRecovery });
      } else if (!hasToken) {
        // Sem token no hash e sem sessão → link inválido / acesso direto
        setStatus({ kind: "invalid" });
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setStatus({ kind: "ready", isRecovery });
      } else if (!hasToken) {
        setStatus({ kind: "invalid" });
      }
      // Se há token mas ainda sem sessão, deixa o onAuthStateChange resolver
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
    setStatus({ kind: "done" });
    setTimeout(() => nav("/", { replace: true }), 1500);
  };



  if (status.kind === "loading") {
    return (
      <Card>
        <p className="text-center font-subtitle text-sm text-muted-foreground">
          Validando seu link de acesso…
        </p>
      </Card>
    );
  }

  if (status.kind === "expired") {
    return (
      <Card>
        <div className="flex flex-col items-center text-center">
          <Clock className="h-10 w-10 text-amber-500" />
          <h1 className="mt-3 font-display text-xl font-bold text-secondary">
            Link expirado ou já utilizado
          </h1>
          <p className="mt-2 font-subtitle text-sm text-muted-foreground">
            Este convite não é mais válido. Peça ao administrador para reenviar
            um novo link de acesso.
          </p>
        </div>
        <Button className="w-full" onClick={() => nav("/auth", { replace: true })}>
          Ir para login
        </Button>
      </Card>
    );
  }

  if (status.kind === "invalid") {
    return (
      <Card>
        <div className="flex flex-col items-center text-center">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <h1 className="mt-3 font-display text-xl font-bold text-secondary">
            Link inválido
          </h1>
          <p className="mt-2 font-subtitle text-sm text-muted-foreground">
            Não conseguimos validar este link de acesso. Verifique se você abriu
            o link mais recente ou solicite um novo convite ao administrador.
          </p>
        </div>
        <Button className="w-full" onClick={() => nav("/auth", { replace: true })}>
          Ir para login
        </Button>
      </Card>
    );
  }

  if (status.kind === "done") {
    return (
      <Card>
        <div className="flex flex-col items-center text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          <h1 className="mt-3 font-display text-xl font-bold text-secondary">
            Convite aceito!
          </h1>
          <p className="mt-2 font-subtitle text-sm text-muted-foreground">
            Sua senha foi salva. Redirecionando para o painel…
          </p>
        </div>
      </Card>
    );
  }

  // status.kind === "ready"
  return (
    <Card>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-secondary">
            {status.isRecovery ? "Redefinir senha" : "Defina sua senha"}
          </h1>
          <p className="mt-1 font-subtitle text-sm text-muted-foreground">
            {status.isRecovery
              ? "Escolha uma nova senha para acessar o painel."
              : "Primeiro acesso ao Painel Operações Takeat."}
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
    </Card>
  );
};

export default SetPasswordPage;
