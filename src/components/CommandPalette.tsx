import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Briefcase, LayoutDashboard, Tv as TvIcon, Moon, Sun, Settings, Building2, User } from "lucide-react";
import { useDashOperacoes } from "@/hooks/useDashOperacoes";
import { useDealDrawer } from "@/contexts/DealDrawer";
import { usePreferences } from "@/contexts/PreferencesContext";

interface Props {
  onOpenPreferences: () => void;
}

export const CommandPalette = ({ onOpenPreferences }: Props) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data } = useDashOperacoes();
  const { open: openDeal } = useDealDrawer();
  const { cycleTheme, theme } = usePreferences();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        onOpenPreferences();
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        cycleTheme();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenPreferences, cycleTheme]);

  const run = (fn: () => void) => {
    setOpen(false);
    setTimeout(fn, 50);
  };

  const operators = data?.operadores?.slice(0, 30) ?? [];
  const deals = data?.rows?.slice(0, 100) ?? [];

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar páginas, operadores, deals ou ações..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado.</CommandEmpty>
        <CommandGroup heading="Navegação">
          <CommandItem onSelect={() => run(() => navigate("/"))}>
            <LayoutDashboard className="mr-2 h-4 w-4" /> Visão geral
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate("/minha-carteira"))}>
            <Briefcase className="mr-2 h-4 w-4" /> Minha carteira
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate("/tv"))}>
            <TvIcon className="mr-2 h-4 w-4" /> Modo TV
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Ações">
          <CommandItem onSelect={() => run(cycleTheme)}>
            {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
            Alternar tema (atual: {theme})
          </CommandItem>
          <CommandItem onSelect={() => run(onOpenPreferences)}>
            <Settings className="mr-2 h-4 w-4" /> Preferências
          </CommandItem>
        </CommandGroup>
        {operators.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Operadores">
              {operators.map((op) => (
                <CommandItem
                  key={op.nome}
                  value={`op ${op.nome}`}
                  onSelect={() =>
                    run(() => {
                      window.dispatchEvent(
                        new CustomEvent("open-operator", { detail: op }),
                      );
                    })
                  }
                >
                  <User className="mr-2 h-4 w-4" />
                  <span className="flex-1">{op.nome}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {op.ativos} ativos
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {deals.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Deals">
              {deals.map((d) => (
                <CommandItem
                  key={d.id_deal}
                  value={`deal ${d.nome_negocio ?? d.id_deal}`}
                  onSelect={() => run(() => openDeal(d))}
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  <span className="flex-1 truncate">{d.nome_negocio || `Deal ${d.id_deal}`}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {d.etapa_negocio ?? "—"}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
};
