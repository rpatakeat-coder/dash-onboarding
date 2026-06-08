## Objetivo

Alinhar o cálculo de **% Churn Onboarding** do **Rastro mensal** com a mesma lógica do card "% Churn Real": usar como denominador o **MRR de início de cada mês** lido da planilha Google Sheets (aba `Dados 2026`, coluna A = mês, coluna B = Receita Inicial), em vez de `MRR Criado no mês`.

A edge function `churn-real-sheet` já retorna `mrrBaseByMonth` — um array de 12 posições com a Receita Inicial de cada mês do ano corrente. Vamos reaproveitar.

## Mudanças

### 1. `src/components/dashboard/RastroMensal.tsx`
- Buscar `mrrBaseByMonth` via `supabase.functions.invoke('churn-real-sheet')` ao montar (mesmo padrão usado em `ChurnKpis.tsx`).
- Guardar em estado (`useState<(number|null)[]>`) com fallback `Array(12).fill(null)` enquanto carrega/erro.
- No `useMemo` que monta `data`, substituir o cálculo de `pctChurn`:
  - **De:** `pctChurn = m.mrrCriado > 0 ? (m.churnMrr / m.mrrCriado) * 100 : 0`
  - **Para:** usar `mrrBaseByMonth[i]` como denominador. Se `null` ou `0` → `pctChurn = null` (mostra `—`).
- Atualizar `fmtPct` / renderização da linha para exibir `—` quando o denominador da planilha não estiver disponível para aquele mês (não mostrar `0%` enganoso).
- Atualizar o `InfoTooltip` do cabeçalho:
  - **De:** `... ÷ MRR criado no mês × 100.`
  - **Para:** `... ÷ MRR de início do mês (planilha Dados 2026) × 100.`
- Atualizar a nota de rodapé (linha ~349) para refletir o novo denominador.

### 2. Sem mudanças em
- `churn-real-sheet/index.ts` — já retorna `mrrBaseByMonth` no formato necessário.
- `isChurnRow` / numerador — permanece igual (etapa `Churn`, pipeline `Sucesso`, origem `Onboarding`, `data_fechamento` no mês).
- Limite visual de 9% (vermelho) — permanece.

## Observações
- Meses sem valor na planilha exibirão `—` em vez de `0%`, evitando interpretação errada.
- O fetch é feito uma vez por montagem do componente (mesmo padrão do KPI card); sem cache compartilhado.
