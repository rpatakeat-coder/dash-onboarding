-- Cada Agente HubSpot pertence a um Time (equipe). Usado no Admin para filtrar a lista de
-- agentes ao criar um usuário/viewer (escolhe-se o agente do Time correspondente).
-- NULL = ainda não atribuído (atribuir pelo painel Admin → aba Agentes HubSpot).
ALTER TABLE public.hubspot_agents
  ADD COLUMN IF NOT EXISTS equipe public.app_team;
