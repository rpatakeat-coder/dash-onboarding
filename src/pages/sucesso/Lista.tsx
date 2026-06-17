import { List } from "lucide-react";
import { SucessoPlaceholder } from "@/components/sucesso/SucessoPlaceholder";
export default function SucessoLista() {
  return (
    <SucessoPlaceholder
      title="Lista"
      description="Tabela operacional dos clientes com filtros, ordenação e ações rápidas."
      icon={List}
      showRefresh
    />
  );
}
