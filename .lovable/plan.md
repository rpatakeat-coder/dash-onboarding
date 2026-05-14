## Contexto

Hoje o projeto já tem `ai-insights` (edge function) com modos **kpi** e **dashboard**, gerando textos executivos, riscos, oportunidades, etc. Os próximos passos elevam isso de "explicador de KPI" para um **copiloto operacional**.

## Recomendações (escolha 1 ou mais para começar)

### 1. Copiloto conversacional (chat com a operação)
Um chat lateral onde você pergunta em linguagem natural:
- *"Quais deals da Marina passaram de 30 dias?"*
- *"Compare o MRR ativado de abril vs maio"*
- *"Quem da equipe está com pior SLA esta semana?"*

Usa AI SDK + tool calling com ferramentas que leem `dash_operacoes` e respondem com tabelas/links para os deals.

### 2. Previsão de risco por deal (score preditivo)
Para cada deal no estoque, calcular um **score 0–100 de probabilidade de estourar SLA / virar crítico** com base em:
- dias na etapa atual vs média histórica daquela etapa
- perfil do cliente, MRR, ativador
- comparação com deals que viraram críticos no passado

Mostrar como nova coluna em `DealsTable` + filtro "Em risco".

### 3. Resumo diário automático (e-mail / TV)
Um cron job (já existe `send-daily-alert`) gera todo dia 8h um briefing curto:
- 3 destaques do dia (positivos)
- 3 pontos de atenção
- ação recomendada para cada ativador
Enviado por e-mail ou exibido no `/tv`.

### 4. Recomendações por ativador (coaching)
Em `OperatorCarteiraModal`, adicionar bloco "Sugestões da IA":
- *"3 deals podem virar críticos esta semana — priorize X, Y, Z"*
- *"Seu SLA médio caiu 18% vs semana anterior — verifique etapa Onboarding Técnico"*
- *"Carteira acima da média (24 vs 15) — considere redistribuir"*

### 5. Detecção de anomalias
Comparar dia a dia e alertar quando algo foge do padrão:
- pico de entradas em uma etapa
- queda de ativações vs média móvel
- ativador com salto de SLA
Vira card no topo do dashboard + entrada no sino de notificações.

### 6. Comparação narrativa de períodos
Hoje há `PeriodCompare` numérico. Adicionar **narrativa gerada**: *"Maio teve 11 ativações vs 9 em abril (+22%). MRR ativado caiu 8% pois o ticket médio reduziu de R$ 580 para R$ 530, puxado por 3 deals do perfil Light."*

### 7. Busca semântica de deals
Caixa de busca onde você descreve o que procura: *"restaurantes de SP que travaram no integração POS"* → retorna deals relevantes mesmo sem match exato no nome.

### 8. Auto-categorização de motivos de atraso
Edge function que lê notas/tarefas do HubSpot por deal e classifica por que está parado (cliente sumiu, integração técnica, financeiro, etc.) — vira tag/coluna nova.

## Sugestão de prioridade

```text
Quick wins (1–2 dias)
  3. Resumo diário automático
  6. Comparação narrativa de períodos

Alto impacto (3–5 dias)
  1. Copiloto conversacional
  4. Recomendações por ativador
  5. Detecção de anomalias

Maior esforço (1+ semana)
  2. Score preditivo de risco
  7. Busca semântica
  8. Auto-categorização via HubSpot
```

## Próximo passo

Me diga **quais dessas você quer** (pode escolher mais de uma) e eu volto com plano detalhado de implementação para cada uma.
