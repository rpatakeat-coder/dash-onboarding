## Objetivo

Tornar o nome de cada cliente/deal clicável em todo o dashboard, abrindo o deal correspondente no HubSpot em nova aba:

```
https://app.hubspot.com/contacts/24373118/deal/{id_deal}
```

O `id_deal` já vem do Supabase (`dash_operacoes.id_deal`) e em vários pontos já está propagado como `id` nas linhas usadas pela UI.

## Onde aplicar

Cada lista/tabela onde aparece o nome de um cliente vira um link externo (`<a target="_blank" rel="noopener noreferrer">`), com estilo sutil de hover (sublinhado + cor primária), mantendo o layout atual:

1. **EstoqueModal** — coluna "Cliente" da tabela principal (já tem `r.id`).
2. **OperatorCarteiraModal** — nome do cliente em cada faixa de SLA (já tem `c.id`).
3. **SlaCritico** — itens da lista de clientes críticos.
4. **AttentionPoints** — lista "Top MRR travado".
5. **StalledTable** — coluna do nome na tabela de estagnados.

## Ajustes técnicos necessários

- **`useDashOperacoes.ts`**: incluir `id` (= `id_deal`) nos objetos retornados para `topMrrTravado` (AttentionPoints) e nas linhas usadas por `StalledTable` e `SlaCritico`, caso ainda não exista. Atualizar os tipos correspondentes (`AttentionPointsProps`, `StalledTable` row, `SlaCritico` item) para incluir `id: number`.
- Criar um pequeno helper compartilhado `hubspotDealUrl(id: number)` em `src/lib/hubspot.ts` para centralizar o padrão da URL (facilita trocar o portalId `24373118` no futuro).
- Componentizar opcionalmente um `<DealLink id={...}>{nome}</DealLink>` reutilizado pelos 5 pontos acima, garantindo estilo consistente (`hover:underline hover:text-primary`, `title="Abrir no HubSpot"`).

## Fora de escopo

- Não muda comportamento de cliques em linhas inteiras (ex.: abrir modal do operador continua funcionando — o link no nome usa `stopPropagation` quando necessário).
- Não altera filtros, ordenação, dados ou layout das tabelas.
- Não adiciona ícone de "external link" salvo confirmação.
