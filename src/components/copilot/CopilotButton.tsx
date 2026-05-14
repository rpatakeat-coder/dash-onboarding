import { useState } from "react";
import { Sparkles } from "lucide-react";
import { CopilotDrawer } from "./CopilotDrawer";

export const CopilotButton = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Copiloto de Operações (IA)"
        aria-label="Abrir copiloto de IA"
        className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1.5 font-subtitle text-xs font-medium text-primary transition hover:border-primary/60 hover:bg-primary/10 sm:gap-2"
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Copiloto</span>
      </button>
      <CopilotDrawer open={open} onOpenChange={setOpen} />
    </>
  );
};
