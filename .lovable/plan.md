## Objetivo
Redefinir a regra de **Churn Real** em todo o app para considerar apenas deals que satisfaçam **simultaneamente**:

- `etapa_negocio` = `Churn`
- `pipeline_nome` = `Sucesso`
- `etapa_de_cancelamento` = `Onboarding`
- corte de período por **`data_fechamento`**

A regra antiga (Pré-Churn + OR com cancelamento Onboarding por etapa) será removida.

## Mudanças

### 1. `src/hooks/useDashOperacoes.ts`
- Remover `CHURN_STAGE_IDS` (Pré-Churn/Churn por ID) e a constante `CHURN_CANCELAMENTO_PIPELINE` solta.
- Adicionar um helper exportado `isChurnRow(row)` com a regra AND das 3 condições (case-insensitive, trim).
- Em `computeChurnKpis`: usar `isChurnRow(r) && inRange(r.data_fechamento)`.

### 2. Demais consumidores — trocar o predicado para o novo `isChurnRow`
- `src/components/dashboard/ChurnDetailModal.tsx`
- `src/components/dashboard/RastroMensal.tsx`
- `src/components/dashboard/RankingVariavelAtivadores.tsx`
- `src/components/dashboard/RankingMetasMedalhas.tsx` (duas ocorrências)

Em cada um: remover imports antigos, importar `isChurnRow`, substituir o bloco `CHURN_STAGE_IDS.has(etapa) || cancel === ...` por `isChurnRow(r)`. Manter o corte por `data_fechamento` onde já existe.

### 3. Tooltips/labels
- Em `ChurnKpis.tsx` e tooltips relacionadas: atualizar texto de "Pré-Churn + Churn (Sucesso) + Cancelamento (Onboarding)" para "Etapa **Churn** no pipeline **Sucesso** com origem **Onboarding**, por **data de fechamento**".

## Não muda
- `Churn Máximo` continua = 9% do MRR criado no período.
- `% Churn Real` continua = Churn Real ÷ MRR início do mês (planilha Dados 2026).
- Estrutura visual dos cards e modal permanece igual.

## Validação
- Conferir contagem/valor no card e no modal de detalhe após o ajuste.
- Verificar que Rastro Mensal e Rankings refletem a nova base.