import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Briefcase,
  Tv as TvIcon,
  Shield,
  Users2,
  Users,
  List,
  Columns3,
  TrendingDown,
  Activity,
  Settings as SettingsIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useUserRole } from "@/hooks/useUserRole";
import { useArea, type AppArea } from "@/contexts/AreaContext";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  title?: string;
  adminOnly?: boolean;
  /** Mais restrito que adminOnly: só aparece para role "super_admin". */
  superAdminOnly?: boolean;
}

export const NAV_ITEMS_ONBOARDING: NavItem[] = [
  { to: "/", label: "Visão geral", icon: LayoutDashboard },
  { to: "/?tab=gestao", label: "Gestão", icon: Users2, title: "Visão gerencial por operador", adminOnly: true },
  { to: "/minha-carteira", label: "Minha carteira", icon: Briefcase },
  { to: "/tv", label: "Modo TV", icon: TvIcon, title: "Tela cheia para TV da operação" },
  { to: "/admin", label: "Admin", icon: Shield, title: "Painel de administração", adminOnly: true },
];

export const NAV_ITEMS_SUCESSO: NavItem[] = [
  { to: "/sucesso", label: "Dashboard", icon: LayoutDashboard },
  { to: "/sucesso/churn", label: "Churn", icon: TrendingDown },
  { to: "/sucesso/inatividade", label: "Inatividade", icon: Activity, title: "Monitor de inatividade · CS", superAdminOnly: true },
  { to: "/sucesso/clientes", label: "Clientes", icon: Users, adminOnly: true },
  { to: "/sucesso/lista", label: "Lista", icon: List, adminOnly: true },
  { to: "/sucesso/kanban", label: "Kanban", icon: Columns3, adminOnly: true },
  { to: "/sucesso/gestor", label: "Área do Gestor", icon: Users2, adminOnly: true },
  { to: "/sucesso/config", label: "Config", icon: SettingsIcon, adminOnly: true },
  { to: "/admin", label: "Admin", icon: Shield, title: "Painel de administração", adminOnly: true },
];

// Back-compat export (used by MobileMainNav fallback / steps)
export const NAV_ITEMS = NAV_ITEMS_ONBOARDING;

export const getNavItemsForArea = (area: AppArea): NavItem[] =>
  area === "sucesso" ? NAV_ITEMS_SUCESSO : NAV_ITEMS_ONBOARDING;

interface Props {
  className?: string;
  orientation?: "horizontal" | "vertical";
  onNavigate?: () => void;
}

export const MainNav = ({ className, orientation = "horizontal", onNavigate }: Props) => {
  const vertical = orientation === "vertical";
  const { isAdmin } = useIsAdmin();
  const { isViewer, isSuperAdmin } = useUserRole();
  const location = useLocation();
  const { area } = useArea();
  const allItems = getNavItemsForArea(area).filter(
    (i) => (!i.adminOnly || isAdmin) && (!i.superAdminOnly || isSuperAdmin),
  );
  // Viewer de Onboarding só enxerga a Home (rankings). Em Sucesso (Time Sucesso/Gestor),
  // o viewer vê as telas da área (itens adminOnly como Config/Área do Gestor já saíram acima).
  const items = area === "onboarding" && isViewer ? allItems.filter((i) => i.to === "/") : allItems;
  const currentTab = new URLSearchParams(location.search).get("tab");
  return (
    <nav
      aria-label="Navegação principal"
      data-tour="nav"
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
        const isSucessoHome = path === "/sucesso";
        const pathMatches = isHome
          ? location.pathname === "/"
          : isSucessoHome
            ? location.pathname === "/sucesso"
            : location.pathname.startsWith(path);
        const active = pathMatches && (itemTab ? currentTab === itemTab : !(isHome && currentTab));
        return (
          <NavLink
            key={to}
            to={to}
            end={path === "/" || path === "/sucesso"}
            title={title}
            onClick={onNavigate}
            style={vertical ? { animationDelay: `${idx * 60}ms`, animationFillMode: "both" } : undefined}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative inline-flex shrink-0 items-center gap-2 rounded-lg font-subtitle font-medium transition-all duration-200 hover:translate-x-0.5",
              vertical ? "w-full px-3 py-2.5 text-sm animate-fade-in" : "px-3 py-1.5 text-xs",
              active
                ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/30 hover:translate-x-0"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className={vertical ? "h-4 w-4" : "h-3.5 w-3.5"} />
            <span>{label}</span>
            {active && (
              <span
                aria-hidden
                className={cn(
                  "absolute rounded-full bg-primary-foreground/90",
                  vertical ? "left-0 top-1/2 h-5 w-1 -translate-y-1/2" : "-bottom-1 left-2 right-2 h-0.5",
                )}
              />
            )}
          </NavLink>
        );
      })}
    </nav>
  );
};
