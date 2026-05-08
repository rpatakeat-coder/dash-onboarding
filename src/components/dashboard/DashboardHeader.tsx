import logo from "@/assets/logo-takeat.png";

export const DashboardHeader = () => {
  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <header className="border-b border-border bg-card/60 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4 md:px-10">
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
        </div>
        <div className="text-right">
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
      </div>
    </header>
  );
};
