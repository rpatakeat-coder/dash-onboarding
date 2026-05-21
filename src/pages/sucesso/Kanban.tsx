import { Columns3 } from "lucide-react";
import { SucessoPlaceholder } from "@/components/sucesso/SucessoPlaceholder";
export default function SucessoKanban() {
  return (
    <SucessoPlaceholder
      title="Kanban"
      description="Quadro visual por etapa da jornada de Sucesso para acompanhar o fluxo da carteira."
      icon={Columns3}
    />
  );
}
