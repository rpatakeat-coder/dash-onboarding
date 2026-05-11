import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Briefcase, Tv as TvIcon, Shield, Users2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/useIsAdmin";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  title?: string;
  adminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Visão geral", icon: LayoutDashboard },
  { to: "/?tab=gestao", label: "Gestão", icon: Users2, title: "Visão gerencial por operador" },
  { to: "/minha-carteira", label: "Minha carteira", icon: Briefcase },
  { to: "/tv", label: "Modo TV", icon: TvIcon, title: "Tela cheia para TV da operação" },
  { to: "/admin", label: "Admin", icon: Shield, title: "Painel de administração", adminOnly: true },
];

interface Props {
  className?: string;
  orientation?: "horizontal" | "vertical";
  onNavigate?: () => void;
}

export const MainNav = ({ className, orientation = "horizontal", onNavigate }: Props) => {
  const vertical = orientation === "vertical";
  const { isAdmin } = useIsAdmin();
  const location = useLocation();
  const items = NAV_ITEMS.filter((i) => !i.adminOnly || isAdmin);
  const currentTab = new URLSearchParams(location.search).get("tab");
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
      {items.map(({ to, label, icon: Icon, title }, idx) => {
        const [path, query] = to.split("?");
        const itemTab = query ? new URLSearchParams(query).get("tab") : null;
        const isHome = path === "/";
        const pathMatches = isHome ? location.pathname === "/" : location.pathname.startsWith(path);
        const active = pathMatches && (itemTab ? currentTab === itemTab : !(isHome && currentTab));
        return (
          <NavLink
            key={to}
            to={to}
            end={path === "/"}
            title={title}
            onClick={onNavigate}
            style={vertical ? { animationDelay: `${idx * 60}ms`, animationFillMode: "both" } : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-lg font-subtitle font-medium transition-all duration-200 hover:translate-x-0.5",
              vertical ? "w-full px-3 py-2.5 text-sm animate-fade-in" : "px-3 py-1.5 text-xs",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className={vertical ? "h-4 w-4" : "h-3.5 w-3.5"} />
            <span>{label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
};
