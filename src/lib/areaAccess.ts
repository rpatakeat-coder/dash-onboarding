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
 * Áreas que o usuário pode acessar (o Time define o papel/acesso).
 *  - admin/super_admin (Gestor): tudo.
 *  - user: Time Sucesso → só Sucesso; senão só Onboarding (ativador da própria carteira).
 *          O RLS de dash_sucesso libera leitura para Time sucesso/gestor.
 *  - viewer (caso específico): gestor=tudo, sucesso=só Sucesso, onboarding/null=só Onboarding.
 */
export const getAllowedAreas = (role: AppRole, equipe: AppTeam | null): Set<AppArea> => {
  if (role === "admin" || role === "super_admin") return new Set<AppArea>(["onboarding", "sucesso"]);
  if (role === "viewer") {
    if (equipe === "gestor") return new Set<AppArea>(["onboarding", "sucesso"]);
    if (equipe === "sucesso") return new Set<AppArea>(["sucesso"]);
    return new Set<AppArea>(["onboarding"]);
  }
  // role "user"
  if (equipe === "sucesso") return new Set<AppArea>(["sucesso"]);
  return new Set<AppArea>(["onboarding"]);
};

// Rota inicial coerente com as áreas permitidas (quem só tem Sucesso cai em /sucesso).
export const homeRouteForAreas = (areas: Set<AppArea>): string =>
  areas.has("onboarding") ? "/" : "/sucesso";

// ---- "Acesso": controle único no Admin que define papel + Time ----
export type AcessoOption = "gestor" | "onboarding" | "sucesso" | "viewer";

export const ACESSO_LABELS: Record<AcessoOption, string> = {
  gestor: "Gestor (admin)",
  onboarding: "Onboarding",
  sucesso: "Sucesso",
  viewer: "Viewer (só leitura)",
};

// Acesso → (papel, Time). Gestor = admin; Onboarding/Sucesso = user; Viewer à parte.
export const acessoToRoleEquipe = (
  a: AcessoOption,
): { role: "admin" | "user" | "viewer"; equipe: AppTeam | null } => {
  switch (a) {
    case "gestor": return { role: "admin", equipe: "gestor" };
    case "sucesso": return { role: "user", equipe: "sucesso" };
    case "viewer": return { role: "viewer", equipe: null };
    default: return { role: "user", equipe: "onboarding" };
  }
};

// (papel, Time) → Acesso, para exibir o valor atual. super_admin é tratado à parte (travado).
export const roleEquipeToAcesso = (role: AppRole, equipe: AppTeam | null): AcessoOption => {
  if (role === "admin" || role === "super_admin") return "gestor";
  if (role === "viewer") return "viewer";
  return equipe === "sucesso" ? "sucesso" : "onboarding";
};
