import { Settings } from "lucide-react";
import { SucessoPlaceholder } from "@/components/sucesso/SucessoPlaceholder";
export default function SucessoConfig() {
  return (
    <SucessoPlaceholder
      title="Configurações"
      description="Parâmetros, automações e integrações específicas da operação de Sucesso."
      icon={Settings}
    />
  );
}
