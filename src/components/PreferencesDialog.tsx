import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { usePreferences, type ThemeMode, type Density, type HomeRoute } from "@/contexts/PreferencesContext";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export const PreferencesDialog = ({ open, onOpenChange }: Props) => {
  const p = usePreferences();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Preferências</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-2">
          <section>
            <h4 className="mb-2 font-subtitle text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tema
            </h4>
            <RadioGroup
              value={p.theme}
              onValueChange={(v) => p.setTheme(v as ThemeMode)}
              className="grid grid-cols-3 gap-2"
            >
              {(["light", "dark", "system"] as ThemeMode[]).map((t) => (
                <Label
                  key={t}
                  htmlFor={`theme-${t}`}
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/10"
                >
                  <RadioGroupItem id={`theme-${t}`} value={t} className="sr-only" />
                  <span className="capitalize">{t === "system" ? "Auto" : t === "light" ? "Claro" : "Escuro"}</span>
                </Label>
              ))}
            </RadioGroup>
          </section>
          <section>
            <h4 className="mb-2 font-subtitle text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Densidade
            </h4>
            <RadioGroup
              value={p.density}
              onValueChange={(v) => p.setDensity(v as Density)}
              className="grid grid-cols-2 gap-2"
            >
              {(["comfortable", "compact"] as Density[]).map((d) => (
                <Label
                  key={d}
                  htmlFor={`d-${d}`}
                  className="flex cursor-pointer items-center justify-center rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/10"
                >
                  <RadioGroupItem id={`d-${d}`} value={d} className="sr-only" />
                  {d === "comfortable" ? "Confortável" : "Compacta"}
                </Label>
              ))}
            </RadioGroup>
          </section>
          <section>
            <h4 className="mb-2 font-subtitle text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Página inicial
            </h4>
            <RadioGroup
              value={p.homeRoute}
              onValueChange={(v) => p.setHomeRoute(v as HomeRoute)}
              className="space-y-1.5"
            >
              {[
                { v: "/", label: "Visão geral" },
                { v: "/minha-carteira", label: "Minha carteira" },
                { v: "/tv", label: "Modo TV" },
              ].map((o) => (
                <Label
                  key={o.v}
                  htmlFor={`h-${o.v}`}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/10"
                >
                  <RadioGroupItem id={`h-${o.v}`} value={o.v} />
                  {o.label}
                </Label>
              ))}
            </RadioGroup>
          </section>
          <section>
            <h4 className="mb-2 font-subtitle text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Notificações
            </h4>
            <div className="space-y-2">
              {[
                { k: "slaCritico" as const, label: "SLA crítico" },
                { k: "parado" as const, label: "Deal parado" },
                { k: "meta" as const, label: "Meta atingida" },
              ].map((o) => (
                <div key={o.k} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm">
                  <span>{o.label}</span>
                  <Switch
                    checked={p.notif[o.k]}
                    onCheckedChange={(checked) => p.setNotif({ [o.k]: checked })}
                  />
                </div>
              ))}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};
