import { Link } from "react-router-dom";
import { LogIn, LogOut, User } from "lucide-react";
import logo from "@/assets/logo-takeat.png";
import { useAuth } from "@/hooks/useAuth";
import { MainNav } from "@/components/MainNav";

export const DashboardHeader = () => {
  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const { session, fullName, signOut } = useAuth();

  return (
    <header className="border-b border-border bg-card/60 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 py-4 md:px-10">
        <div className="flex items-center gap-4">
          <img src={logo} alt="Takeat" className="h-9 w-auto" />
          <div className="hidden h-8 w-px bg-border md:block" />
          <div className="hidden md:block">
            <p className="font-subtitle text-xs uppercase tracking-widest text-muted-foreground">
              Painel de Operações
            </p>
            <h1 className="font-display text-lg font-semibold text-secondary">
              Onboarding
            </h1>
          </div>
          {session && (
            <nav className="ml-4 hidden items-center gap-1 md:flex">
              <Link
                to="/"
                className={`rounded-lg px-3 py-1.5 font-subtitle text-xs font-medium ${
                  loc.pathname === "/"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Visão geral
              </Link>
              <Link
                to="/minha-carteira"
                className={`rounded-lg px-3 py-1.5 font-subtitle text-xs font-medium ${
                  loc.pathname === "/minha-carteira"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Minha carteira
              </Link>
              <Link
                to="/tv"
                className={`rounded-lg px-3 py-1.5 font-subtitle text-xs font-medium ${
                  loc.pathname === "/tv"
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Tela cheia para TV da operação"
              >
                Modo TV
              </Link>
            </nav>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden text-right md:block">
            <p className="font-small text-xs uppercase tracking-wider text-muted-foreground">
              {today}
            </p>
            <p className="flex items-center justify-end gap-2 font-subtitle text-sm font-medium text-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-pulse-soft rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              Atualizado em tempo real
            </p>
          </div>
          {session ? (
            <div className="flex items-center gap-2">
              <span className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 font-subtitle text-xs text-muted-foreground sm:inline-flex">
                <User className="h-3 w-3" />
                {fullName || session.user.email}
              </span>
              <button
                onClick={() => signOut()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 font-subtitle text-xs text-muted-foreground hover:text-destructive"
              >
                <LogOut className="h-3 w-3" /> Sair
              </button>
            </div>
          ) : (
            <Link
              to="/auth"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 font-subtitle text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <LogIn className="h-3 w-3" /> Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
