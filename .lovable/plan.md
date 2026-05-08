## Roadmap proposto

Organizei em 4 fases incrementais, da maior para a menor relação valor/esforço, separando o que é **frontend puro** (rápido) do que precisa de **dados novos / backend** (mais investimento). Você aprova fase a fase.

---

### Fase 1 — Camada do gestor (frontend, sem novos dados)

1. **Ranking + metas por ativador** — nova tabela com:
   - posição, ativos, % SLA no prazo, % crítico, MRR sob gestão
   - barra de meta de SLA (default 80% no prazo, configurável em `src/lib/metas.ts`)
   - delta vs. média do time
2. **Heatmap de gargalos (etapa × faixa SLA)** — grid colorido mostrando quantos deals estão em cada cruzamento; clique abre o EstoqueModal já filtrado.
3. **Cards de "Destaques automáticos"** acima dos pontos de atenção:
   - operador com mais críticos
   - etapa com maior MRR travado
   - perfil (P/M/G/GG) com pior SLA
   - variação simples vs. snapshot anterior (quando Fase 3 estiver pronta)
4. **Cruzamento por perfil de cliente (P/M/G/GG)**:
   - novo bloco "SLA por perfil" (já temos `perfis`, falta cruzar com SLA)
   - filtro global "Perfil" no mesmo padrão dos atuais

Entregáveis técnicos: novos componentes em `src/components/dashboard/` (`RankingTable`, `BottleneckHeatmap`, `Highlights`, `PerfilSlaPanel`) + extensão do `useDashOperacoes` para cruzamentos; nada novo no Supabase.

---

### Fase 2 — Visão do ativador (frontend + leve auth)

1. **Toggle "Só meus deals"** — usa o login Supabase existente, faz match `profiles.full_name` ↔ `dash_operacoes.agente_ativacao`. Quando ativo, todos os módulos passam a operar só na carteira do usuário.
2. **Página `/minha-carteira`** com:
   - KPIs pessoais (SLA médio, ativos, ativados no mês, % meta)
   - comparação com média do time
   - "Próximos 10" priorizados (SLA × MRR), com link HubSpot, ícone de ligação e botão "marcar follow-up" (Fase 4)
3. **Filtro rápido "minhas faixas"** já feito — só falta replicar o pattern no card pessoal.

Entregáveis: nova rota + tabela `vendedores` já existente para mapear nome ↔ usuário (precisa popular). Caso o nome no HubSpot não bata, criar coluna `agente_hubspot` em `vendedores`.

---

### Fase 3 — Dados novos (Supabase + edge functions)

Exigem trabalho de backend, mas destravam o resto.

1. **Snapshots diários de `dash_operacoes`** (cron + edge function):
   - tabela `dash_operacoes_snapshots` (id_deal, data, etapa, sla_dias, mrr)
   - habilita **tendências históricas** (linha de SLA/MRR/estoque por semana)
   - habilita **conversão por etapa** real (taxa que avança vs. trava + tempo médio até a próxima etapa)
   - habilita o "variação vs. semana passada" da Fase 1
2. **Motivos de bloqueio/pausa**:
   - sincronizar campo do HubSpot (`hs_pipeline_stage` + propriedade de motivo) para `dash_operacoes` ou tabela paralela
   - mostrar lista agrupada nos cards de "Pendências" e "Processo Pausado"
3. **Score de risco/churn** (regra simples, sem ML):
   - fórmula: `dias_na_fase × peso_etapa × peso_perfil`
   - badge de risco (Baixo/Médio/Alto) em cada card de cliente
   - ranking "Top 10 risco de churn" no painel do gestor

Entregáveis: 1 migration (snapshots), 1 edge function diária via `pg_cron`, atualização do `useDashOperacoes` para consumir histórico.

---

### Fase 4 — Distribuição & operação

1. **Exportar CSV/Excel** dos modais (Estoque, Carteira, Travados) — usar a skill xlsx do servidor ou geração client-side com `xlsx`/`papaparse`.
2. **Compartilhar link com filtros** — serializar estado de filtros na URL (`?ativador=...&band=critico,atencao&periodo=semana`), restaurar no mount.
3. **Resumo diário automático** — edge function que monta um JSON com KPIs + alertas e:
   - envia por e-mail (Resend) ou Slack webhook
   - opção "às 8h dias úteis" via `pg_cron`
4. **Modo TV/fullscreen** — rota `/tv` com layout grande, rotação automática entre 3 telas (KPIs, ranking, gargalos), refresh a cada 60s.

---

## Fora deste roadmap (intencional)

- **ML real de churn**: começamos com score por regra; ML só depois de 90 dias de snapshots.
- **Edição de deals dentro do dashboard**: continuamos como leitura; ações vão pro HubSpot.
- **Notificações push no navegador**: avaliar depois do Slack/e-mail.

---

## Sugestão de ordem de execução

1. Fase 1 inteira (impacto alto, baixo risco, sem backend)
2. Fase 4 itens 1 e 2 (export + URL compartilhável — rápidos)
3. Fase 2 (precisa decidir como mapear usuário ↔ ativador)
4. Fase 3 (snapshots + risco + motivos)
5. Fase 4 itens 3 e 4 (resumo automático + modo TV)

Confirma se faz sentido começarmos pela **Fase 1** ou se quer reordenar/recortar algo antes de eu detalhar a implementação.
