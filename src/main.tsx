import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Intercepta links de convite/recovery do Supabase: se a URL trouxer
// type=invite ou type=recovery (ou erro de OTP) no hash, força a navegação
// para /acesso-dash ANTES do app montar — evita que o usuário entre direto
// no dashboard sem definir senha.
(() => {
  if (typeof window === "undefined") return;
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  if (!hash) return;
  const params = new URLSearchParams(hash);
  const type = params.get("type");
  const hasError = params.has("error") || params.has("error_code");
  const isInviteFlow =
    type === "invite" || type === "recovery" || type === "signup" || hasError;
  if (isInviteFlow && window.location.pathname !== "/acesso-dash") {
    window.history.replaceState(null, "", `/acesso-dash${window.location.search}${window.location.hash}`);
  }
})();

createRoot(document.getElementById("root")!).render(<App />);
