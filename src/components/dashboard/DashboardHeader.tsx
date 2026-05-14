import { Link, useNavigate } from "react-router-dom";
import { LogIn, LogOut, Search, Settings, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import logo from "@/assets/logo-takeat.png";
import { useAuth } from "@/hooks/useAuth";
import { MainNav } from "@/components/MainNav";
import { MobileMainNav } from "@/components/MobileMainNav";
import { NotificationsBell } from "@/components/NotificationsBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { APP_VERSION } from "@/lib/version";
import { usePreferencesDialog } from "@/contexts/PreferencesDialogContext";

export const DashboardHeader = () => {
  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const dashQuery = useQuery({ queryKey: ["dash_operacoes"], enabled: false });
  const lastUpdated = dashQuery.dataUpdatedAt
    ? new Date(dashQuery.dataUpdatedAt).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const { session, fullName, signOut } = useAuth();
  const navigate = useNavigate();
  const prefsDialog = usePreferencesDialog();
  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };
  const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const openPalette = () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: isMac, ctrlKey: !isMac, bubbles: true }),
    );
  };

  return (
    <header className="border-b border-border bg-card/60 backdrop-blur-sm">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 md:px-10">
        {/* Tier 1: Brand · Search · Actions + User */}
        <div className="flex items-center justify-between gap-2 border-b border-border/60 py-3 sm:gap-4 sm:py-4">
          {/* Brand */}
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <img src={logo} alt="Takeat" className="h-8 w-auto sm:h-9" />
            <div className="hidden h-8 w-px bg-border sm:block" />
            <div className="hidden min-w-0 sm:block">
              <p className="font-subtitle text-[10px] uppercase tracking-widest text-muted-foreground leading-tight">
                Painel de Operações
              </p>
              <h1 className="flex items-center gap-2 font-display text-sm font-semibold text-secondary leading-tight sm:text-base">
                Onboarding
                <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-subtitle text-[10px] font-medium uppercase tracking-wider text-muted-foreground" title="Versão do app">
                  v{APP_VERSION}
                </span>
              </h1>
            </div>
          </div>

          {/* Central search (desktop only — mobile uses Tier 2 search button) */}
          <div className="hidden flex-1 max-w-md md:block">
            <button
              type="button"
              onClick={openPalette}
              title="Buscar (Ctrl/Cmd + K)"
              aria-label="Abrir busca global"
              className="group flex w-full items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2 text-left font-subtitle text-sm text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
            >
              <Search className="h-4 w-4" />
              <span className="flex-1">Buscar…</span>
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-numeric text-[10px] text-muted-foreground">
                {isMac ? "⌘" : "Ctrl"}K
              </kbd>
            </button>
          </div>

          {/* Actions cluster + user */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card/60 p-0.5">
              <NotificationsBell />
              <ThemeToggle />
              <button
                type="button"
                onClick={prefsDialog.open}
                title="Preferências (Ctrl/Cmd + ,)"
                aria-label="Abrir preferências"
                className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
            {session ? (
              <div className="flex items-center gap-2 sm:border-l sm:border-border sm:pl-2">
                <span className="hidden items-center gap-1.5 font-subtitle text-xs font-medium text-foreground lg:inline-flex">
                  <User className="h-3 w-3 text-muted-foreground" />
                  <span className="max-w-[140px] truncate">{fullName || session.user.email}</span>
                </span>
                <button
                  onClick={handleSignOut}
                  aria-label="Sair da conta"
                  title="Sair"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card p-2 font-subtitle text-xs text-muted-foreground transition hover:border-destructive/40 hover:text-destructive sm:px-3 sm:py-1.5"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Sair</span>
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

        {/* Tier 2: Navigation · Status (mobile = expandable nav + search, desktop = horizontal nav) */}
        <div className="flex items-center gap-2 py-2 md:hidden">
          <div className="flex-1">
            <MobileMainNav />
          </div>
          <button
            type="button"
            onClick={openPalette}
            aria-label="Abrir busca global"
            title="Buscar"
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-card/60 p-2 text-muted-foreground transition hover:text-foreground"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
        <div className="hidden items-center justify-between gap-4 py-2 md:flex">
          <MainNav />
          <div className="text-right">
            <p className="font-small text-[10px] uppercase tracking-wider text-muted-foreground leading-tight">
              {today}
            </p>
            <p className="flex items-center justify-end gap-2 font-subtitle text-xs font-medium text-foreground leading-tight">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-pulse-soft rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              Atualizado em tempo real
            </p>
          </div>
        </div>
      </div>
    </header>
  );
};
