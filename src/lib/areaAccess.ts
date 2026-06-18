import type { AppArea } from "@/contexts/AreaContext";
import type { AppRole } from "@/hooks/useUserRole";

// "Time" do usuário (coluna user_roles_operations.equipe) — define quais áreas ele enxerga.
export type AppTeam = "onboarding" | "sucesso" | "gestor";

export const TEAM_LABELS: Record<AppTeam, string> = {
  onboarding: "Onboarding",
  sucesso: "Sucesso",
  gestor: "Gestor",
};

// Default por papel quando equipe ainda é NULL (sem backfill no banco).
export const defaultTeamForRole = (role: AppRole): AppTeam =>
  role === "admin" || role === "super_admin" ? "gestor" : "onboarding";

/**
 * Áreas que o usuário pode acessar.
 *  - admin/super_admin: tudo (o Time não restringe admins — decisão de produto).
 *  - viewer: conforme o Time (gestor=tudo, sucesso=só Sucesso, onboarding/null=só Onboarding).
 *  - user/ativador: sempre só Onboarding (RLS impede leitura de dados de Sucesso).
 */
export const getAllowedAreas = (role: AppRole, equipe: AppTeam | null): Set<AppArea> => {
  if (role === "admin" || role === "super_admin") return new Set<AppArea>(["onboarding", "sucesso"]);
  if (role === "viewer") {
    if (equipe === "gestor") return new Set<AppArea>(["onboarding", "sucesso"]);
    if (equipe === "sucesso") return new Set<AppArea>(["sucesso"]);
    return new Set<AppArea>(["onboarding"]);
  }
  return new Set<AppArea>(["onboarding"]);
};

// Rota inicial coerente com as áreas permitidas (quem só tem Sucesso cai em /sucesso).
export const homeRouteForAreas = (areas: Set<AppArea>): string =>
  areas.has("onboarding") ? "/" : "/sucesso";
