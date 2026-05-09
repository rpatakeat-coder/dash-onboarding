import { useState } from "react";
import { Link } from "react-router-dom";
import { LogIn, LogOut, Menu, Search, Settings, User } from "lucide-react";
import logo from "@/assets/logo-takeat.png";
import { useAuth } from "@/hooks/useAuth";
import { MainNav } from "@/components/MainNav";
import { NotificationsBell } from "@/components/NotificationsBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { APP_VERSION } from "@/lib/version";
import { usePreferencesDialog } from "@/contexts/PreferencesDialogContext";

export const DashboardHeader = () => {
  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const { session, fullName, signOut } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  const prefsDialog = usePreferencesDialog();
  const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const openPalette = () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: isMac, ctrlKey: !isMac, bubbles: true }),
    );
  };

  return (
    <header className="border-b border-border bg-card/60 backdrop-blur-sm">
      <div className="mx-auto max-w-[1400px] px-4 py-3 sm:px-6 sm:py-4 md:px-10">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Sheet open={navOpen} onOpenChange={setNavOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label={navOpen ? "Fechar menu de navegação" : "Abrir menu de navegação"}
                  className="inline-flex items-center justify-center rounded-lg border border-border bg-card p-2 text-muted-foreground transition-all duration-200 hover:scale-105 hover:text-foreground active:scale-95 md:hidden"
                >
                  <Menu
                    className={cn(
                      "h-4 w-4 transition-transform duration-300 ease-out",
                      navOpen ? "rotate-90 scale-110" : "rotate-0",
                    )}
                  />
                </button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-72 p-0 duration-300 data-[state=closed]:duration-200 motion-safe:data-[state=open]:ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:data-[state=closed]:ease-[cubic-bezier(0.4,0,1,1)]"
              >
                <SheetHeader className="border-b border-border px-5 py-4 text-left">
                  <SheetTitle className="font-display text-base font-semibold text-secondary">
                    Navegação
                  </SheetTitle>
                </SheetHeader>
                <div className="px-3 py-4">
                  <MainNav orientation="vertical" onNavigate={() => setNavOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
            <img src={logo} alt="Takeat" className="h-9 w-auto" />
            <div className="hidden h-8 w-px bg-border md:block" />
            <div className="hidden md:block">
              <p className="font-subtitle text-xs uppercase tracking-widest text-muted-foreground">
                Painel de Operações
              </p>
              <h1 className="flex items-center gap-2 font-display text-lg font-semibold text-secondary">
                Onboarding
                <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 font-subtitle text-[10px] font-medium uppercase tracking-wider text-muted-foreground" title="Versão do app">
                  v{APP_VERSION}
                </span>
              </h1>
            </div>
            <MainNav className="ml-2 hidden md:flex" />
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
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={openPalette}
                title="Buscar (Ctrl/Cmd + K)"
                aria-label="Abrir busca global"
                className="hidden items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 font-subtitle text-xs text-muted-foreground transition hover:text-foreground md:inline-flex"
              >
                <Search className="h-3.5 w-3.5" />
                <span>Buscar</span>
                <kbd className="ml-2 rounded border border-border bg-muted px-1.5 py-0.5 font-numeric text-[10px] text-muted-foreground">
                  {isMac ? "⌘" : "Ctrl"}K
                </kbd>
              </button>
              <NotificationsBell />
              <ThemeToggle />
              <button
                type="button"
                onClick={prefsDialog.open}
                title="Preferências (Ctrl/Cmd + ,)"
                aria-label="Abrir preferências"
                className="inline-flex items-center justify-center rounded-lg border border-border bg-card p-2 text-muted-foreground transition hover:text-foreground"
              >
                <Settings className="h-4 w-4" />
              </button>
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
        
      </div>
    </header>
  );
};
