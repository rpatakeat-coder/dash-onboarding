import { NavLink } from "react-router-dom";
import { LayoutDashboard, Briefcase, Tv as TvIcon, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  title?: string;
}

const ITEMS: NavItem[] = [
  { to: "/", label: "Visão geral", icon: LayoutDashboard },
  { to: "/minha-carteira", label: "Minha carteira", icon: Briefcase },
  { to: "/tv", label: "Modo TV", icon: TvIcon, title: "Tela cheia para TV da operação" },
];

interface Props {
  className?: string;
}

export const MainNav = ({ className }: Props) => (
  <nav
    aria-label="Navegação principal"
    className={cn(
      "flex items-center gap-1 overflow-x-auto pdf-hide [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
      className,
    )}
  >
    {ITEMS.map(({ to, label, icon: Icon, title }) => (
      <NavLink
        key={to}
        to={to}
        end={to === "/"}
        title={title}
        className={({ isActive }) =>
          cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 font-subtitle text-xs font-medium transition",
            isActive
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )
        }
      >
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </NavLink>
    ))}
  </nav>
);
