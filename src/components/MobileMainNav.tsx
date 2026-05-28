import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu } from "lucide-react";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useUserRole } from "@/hooks/useUserRole";
import { MainNav, getNavItemsForArea } from "@/components/MainNav";
import { useArea } from "@/contexts/AreaContext";

/**
 * Mobile version of MainNav: a single full-width trigger that expands a
 * vertical nav panel inline (preserves the two-tier header hierarchy on
 * small screens). Fully keyboard accessible:
 *   - Toggle: Enter / Space
 *   - Close: Esc (returns focus to trigger)
 *   - Click outside closes
 *   - aria-expanded / aria-controls wired
 */
export const MobileMainNav = ({ className }: { className?: string }) => {
  const [open, setOpen] = useState(false);
  const { isAdmin } = useIsAdmin();
  const { isViewer } = useUserRole();
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = "mobile-mainnav-panel";

  const { area } = useArea();
  const allItems = getNavItemsForArea(area).filter((i) => !i.adminOnly || isAdmin);
  const items = isViewer ? allItems.filter((i) => i.to === "/") : allItems;
  const currentTab = new URLSearchParams(location.search).get("tab");
  const current =
    items.find((i) => {
      const [path, query] = i.to.split("?");
      const itemTab = query ? new URLSearchParams(query).get("tab") : null;
      const isHome = path === "/";
      const pathMatches = isHome ? location.pathname === "/" : location.pathname.startsWith(path);
      return pathMatches && (itemTab ? currentTab === itemTab : !(isHome && currentTab));
    }) ?? items[0];

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);

  // Esc to close + click outside
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const Icon = current?.icon ?? Menu;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-card/60 px-3 py-2 text-left font-subtitle text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <span className="flex items-center gap-2 truncate">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="truncate">{current?.label ?? "Menu"}</span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          id={panelId}
          role="region"
          aria-label="Navegação principal"
          className="absolute left-0 right-0 top-[calc(100%+0.375rem)] z-40 origin-top animate-fade-in rounded-lg border border-border bg-popover p-2 shadow-lg"
        >
          <MainNav orientation="vertical" onNavigate={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
};
