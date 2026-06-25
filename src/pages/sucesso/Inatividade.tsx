// Sucesso → Inatividade (Monitor de Inatividade · CS). Página portada do takeat-churn-tracker:
// ranqueia restaurantes por risco de inatividade/churn e mostra a fila de retenção do CS.
// O cabeçalho/menu do app vêm do DashboardHeader; o shell interno (KPIs, gráficos, tabela, fila)
// é o Dashboard portado em src/features/inatividade. Dados via /api/restaurants (auth Supabase).

import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import Dashboard from "@/features/inatividade/components/Dashboard";

const Inatividade = () => {
  return (
    <>
      <DashboardHeader />
      <Dashboard />
    </>
  );
};

export default Inatividade;
