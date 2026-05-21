import { useState } from "react";
import {
  Filter,
  Search,
  CreditCard,
  Calendar,
  Sparkles,
  Circle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Barra de filtros do Kanban de Sucesso.
 * UI-only por enquanto — quando a fonte de dados estiver definida, basta
 * substituir as listas estáticas e elevar o estado ao componente pai.
 */
export const KanbanFilters = () => {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("pendente");
  const [prioridade, setPrioridade] = useState("todas");
  const [responsavel, setResponsavel] = useState("todos");
  const [dealstage, setDealstage] = useState("todos");
  const [pipeline, setPipeline] = useState("todas");
  const [perfil, setPerfil] = useState("todos");
  const [ciclo, setCiclo] = useState("todos");
  const [estrutura, setEstrutura] = useState("todas");
  const [cobrancas, setCobrancas] = useState("todos");
  const [cartao, setCartao] = useState("todos");
  const [ficticias, setFicticias] = useState("todas");
  const [data, setData] = useState("todas");

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-3 shadow-sm">
      {/* Linha 1 */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          title="Filtros avançados"
          aria-label="Filtros avançados"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition hover:text-foreground"
        >
          <Filter className="h-4 w-4" />
        </button>

        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar nome, CPF, ID…"
            className="h-9 pl-8 font-subtitle text-sm"
          />
        </div>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-auto min-w-[140px] gap-2 font-subtitle text-sm">
            <Circle className="h-2 w-2 fill-warning text-warning" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="em_andamento">Em andamento</SelectItem>
            <SelectItem value="concluido">Concluído</SelectItem>
            <SelectItem value="todos">Todos os status</SelectItem>
          </SelectContent>
        </Select>

        <FilterSelect
          value={prioridade}
          onChange={setPrioridade}
          allValue="todas"
          allLabel="Todas prioridades"
          options={[
            { value: "alta", label: "Alta" },
            { value: "media", label: "Média" },
            { value: "baixa", label: "Baixa" },
          ]}
        />
        <FilterSelect
          value={responsavel}
          onChange={setResponsavel}
          allValue="todos"
          allLabel="Todos responsáveis"
          options={[]}
        />
        <FilterSelect
          value={dealstage}
          onChange={setDealstage}
          allValue="todos"
          allLabel="Todos dealstages"
          options={[]}
        />
        <FilterSelect
          value={pipeline}
          onChange={setPipeline}
          allValue="todas"
          allLabel="Todas pipelines"
          options={[]}
        />
        <FilterSelect
          value={perfil}
          onChange={setPerfil}
          allValue="todos"
          allLabel="Todos perfis"
          options={[
            { value: "P", label: "P" },
            { value: "M", label: "M" },
            { value: "G", label: "G" },
            { value: "GG", label: "GG" },
          ]}
        />
        <FilterSelect
          value={ciclo}
          onChange={setCiclo}
          allValue="todos"
          allLabel="Todos ciclos"
          options={[]}
        />
      </div>

      {/* Linha 2 */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <FilterSelect
          value={estrutura}
          onChange={setEstrutura}
          allValue="todas"
          allLabel="Todas estruturas"
          options={[]}
        />
        <FilterSelect
          value={cobrancas}
          onChange={setCobrancas}
          allValue="todos"
          allLabel="Cobranças/cliente (todos)"
          options={[
            { value: "1", label: "1 cobrança" },
            { value: "2-5", label: "2 a 5" },
            { value: "6+", label: "6 ou mais" },
          ]}
        />
        <FilterSelect
          value={cartao}
          onChange={setCartao}
          allValue="todos"
          allLabel="Cartão (todos)"
          icon={<CreditCard className="h-3.5 w-3.5 text-muted-foreground" />}
          options={[
            { value: "com", label: "Com cartão" },
            { value: "sem", label: "Sem cartão" },
          ]}
        />
        <FilterSelect
          value={ficticias}
          onChange={setFicticias}
          allValue="todas"
          allLabel="Fictícias (todas)"
          icon={<Sparkles className="h-3.5 w-3.5 text-muted-foreground" />}
          options={[
            { value: "ocultar", label: "Ocultar fictícias" },
            { value: "somente", label: "Somente fictícias" },
          ]}
        />
        <FilterSelect
          value={data}
          onChange={setData}
          allValue="todas"
          allLabel="Todas as datas"
          icon={<Calendar className="h-3.5 w-3.5 text-muted-foreground" />}
          options={[
            { value: "hoje", label: "Hoje" },
            { value: "7d", label: "Últimos 7 dias" },
            { value: "30d", label: "Últimos 30 dias" },
            { value: "mes_atual", label: "Mês atual" },
          ]}
        />
      </div>
    </div>
  );
};

interface FilterSelectProps {
  value: string;
  onChange: (v: string) => void;
  allValue: string;
  allLabel: string;
  options: { value: string; label: string }[];
  icon?: React.ReactNode;
}

const FilterSelect = ({ value, onChange, allValue, allLabel, options, icon }: FilterSelectProps) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger className="h-9 w-auto min-w-[150px] gap-2 font-subtitle text-sm">
      {icon}
      <SelectValue placeholder={allLabel} />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value={allValue}>{allLabel}</SelectItem>
      {options.map((opt) => (
        <SelectItem key={opt.value} value={opt.value}>
          {opt.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);
