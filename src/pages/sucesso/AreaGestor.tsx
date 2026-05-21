import { Users2 } from "lucide-react";
import { SucessoPlaceholder } from "@/components/sucesso/SucessoPlaceholder";
export default function SucessoGestor() {
  return (
    <SucessoPlaceholder
      title="Área do Gestor"
      description="Visão gerencial do time de Sucesso — ranking, metas e performance individual."
      icon={Users2}
    />
  );
}
