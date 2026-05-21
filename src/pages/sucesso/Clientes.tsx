import { Users } from "lucide-react";
import { SucessoPlaceholder } from "@/components/sucesso/SucessoPlaceholder";
export default function SucessoClientes() {
  return (
    <SucessoPlaceholder
      title="Clientes"
      description="Cadastro e ficha detalhada de cada cliente sob gestão do time de Sucesso."
      icon={Users}
    />
  );
}
