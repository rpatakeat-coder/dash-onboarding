import { createContext, ReactNode, useContext, useState } from "react";
import { DealDrawer } from "@/components/dashboard/DealDrawer";
import type { DashRow } from "@/hooks/useDashOperacoes";

interface Ctx {
  open: (deal: DashRow) => void;
}
const DealDrawerCtx = createContext<Ctx | null>(null);

export function DealDrawerProvider({ children }: { children: ReactNode }) {
  const [deal, setDeal] = useState<DashRow | null>(null);
  return (
    <DealDrawerCtx.Provider value={{ open: setDeal }}>
      {children}
      <DealDrawer
        deal={deal}
        onClose={() => setDeal(null)}
      />
    </DealDrawerCtx.Provider>
  );
}

export function useDealDrawer() {
  const ctx = useContext(DealDrawerCtx);
  if (!ctx) throw new Error("useDealDrawer must be inside DealDrawerProvider");
  return ctx;
}
