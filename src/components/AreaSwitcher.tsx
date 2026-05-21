import { ChevronsUpDown, Check, LayoutDashboard, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useArea, AREA_LABELS, type AppArea } from "@/contexts/AreaContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { cn } from "@/lib/utils";

const AREA_META: Record<AppArea, { icon: typeof LayoutDashboard; home: string; hint: string }> = {
  onboarding: { icon: LayoutDashboard, home: "/", hint: "Ativação de novos clientes" },
  sucesso: { icon: Sparkles, home: "/sucesso", hint: "Carteira pós-ativação" },
};

export const AreaSwitcher = ({ className }: { className?: string }) => {
  const { isAdmin } = useIsAdmin();
  const { area, setArea } = useArea();
  const navigate = useNavigate();

  // Non-admins always see Onboarding label, no switcher
  if (!isAdmin) {
    return <span className={className}>Onboarding</span>;
  }

  const Current = AREA_META[area].icon;

  const choose = (next: AppArea) => {
    setArea(next);
    navigate(AREA_META[next].home);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "group inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 -mx-1.5 transition hover:bg-muted",
          className,
        )}
        aria-label="Trocar de área"
        title="Trocar de área"
      >
        <Current className="h-4 w-4 text-muted-foreground" />
        <span>{AREA_LABELS[area]}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground transition group-hover:text-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Áreas
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(Object.keys(AREA_META) as AppArea[]).map((key) => {
          const Icon = AREA_META[key].icon;
          const isCurrent = key === area;
          return (
            <DropdownMenuItem
              key={key}
              onSelect={() => choose(key)}
              className="flex items-start gap-2"
            >
              <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{AREA_LABELS[key]}</p>
                <p className="text-[11px] text-muted-foreground">{AREA_META[key].hint}</p>
              </div>
              {isCurrent && <Check className="mt-0.5 h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
