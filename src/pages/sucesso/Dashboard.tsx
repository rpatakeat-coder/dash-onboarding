import { LayoutDashboard } from "lucide-react";
import { SucessoPlaceholder } from "@/components/sucesso/SucessoPlaceholder";
export default function SucessoDashboard() {
  return (
    <SucessoPlaceholder
      title="Dashboard de Sucesso"
      description="Visão consolidada da carteira pós-ativação — KPIs, retenção e saúde dos clientes."
      icon={LayoutDashboard}
    />
  );
}
