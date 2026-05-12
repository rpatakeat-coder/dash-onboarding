import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldOff, ArrowLeft, LogOut, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface AccessDeniedProps {
  title?: string;
  message?: string;
  showClaimAdmin?: boolean;
}

export const AccessDenied = ({
  title = "Acesso negado",
  message = "Você não tem permissão para acessar esta área. Apenas administradores podem visualizar o painel. Se você acredita que isso é um engano, peça a um admin para promover sua conta.",
  showClaimAdmin = false,
}: AccessDeniedProps) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

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
      toast.error("Já existe um admin no sistema.", {
        description: "Peça para um admin existente promover sua conta.",
      });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldOff className="h-7 w-7" />
        </div>
        <h1 className="font-display text-2xl font-bold text-secondary">{title}</h1>
        <p className="mt-2 font-small text-sm text-muted-foreground">{message}</p>

        {user?.email && (
          <p className="mt-4 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Conectado como <span className="font-medium text-foreground">{user.email}</span>
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2">
          <Button asChild variant="default" className="gap-2">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              Voltar ao início
            </Link>
          </Button>

          {showClaimAdmin && (
            <Button onClick={claim} disabled={busy} variant="outline" className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Reivindicar admin
            </Button>
          )}

          <Button
            onClick={handleSignOut}
            variant="ghost"
            className="gap-2 text-muted-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sair da conta
          </Button>
        </div>
      </div>
    </div>
  );
};
