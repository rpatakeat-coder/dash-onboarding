import { NavLink } from "react-router-dom";
import { LayoutDashboard, Briefcase, Tv as TvIcon, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  title?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Visão geral", icon: LayoutDashboard },
  { to: "/minha-carteira", label: "Minha carteira", icon: Briefcase },
  { to: "/tv", label: "Modo TV", icon: TvIcon, title: "Tela cheia para TV da operação" },
];

interface Props {
  className?: string;
  orientation?: "horizontal" | "vertical";
  onNavigate?: () => void;
}

export const MainNav = ({ className, orientation = "horizontal", onNavigate }: Props) => {
  const vertical = orientation === "vertical";
  return (
    <nav
      aria-label="Navegação principal"
      className={cn(
        "pdf-hide",
        vertical
          ? "flex flex-col gap-1"
          : "flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {NAV_ITEMS.map(({ to, label, icon: Icon, title }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          title={title}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "inline-flex shrink-0 items-center gap-2 rounded-lg font-subtitle font-medium transition",
              vertical ? "w-full px-3 py-2.5 text-sm" : "px-3 py-1.5 text-xs",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )
          }
        >
          <Icon className={vertical ? "h-4 w-4" : "h-3.5 w-3.5"} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
};
