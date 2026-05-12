import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Trash2, Shield } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { usePreferences, type ThemeMode, type Density, type HomeRoute } from "@/contexts/PreferencesContext";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export const PreferencesDialog = ({ open, onOpenChange }: Props) => {
  const p = usePreferences();
  const { user, fullName } = useAuth();
  const { isAdmin } = useIsAdmin();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle()
      .then(({ data }) => setAvatarUrl(data?.avatar_url ?? null));
  }, [open, user]);
  const handleUpload = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) return toast.error("Selecione uma imagem");
    if (file.size > 5 * 1024 * 1024) return toast.error("Imagem muito grande (máx 5MB)");
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
      upsert: true,
      cacheControl: "3600",
      contentType: file.type || "image/png",
    });
    if (upErr) {
      console.error("[avatar] upload error", upErr);
      setUploading(false);
      return toast.error("Erro ao enviar", { description: upErr.message });
    }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = pub.publicUrl;
    const { error: profErr } = await supabase
      .from("profiles")
      .update({ avatar_url: url })
      .eq("id", user.id);
    setUploading(false);
    if (profErr) return toast.error("Erro ao salvar perfil", { description: profErr.message });
    setAvatarUrl(url);
    toast.success("Foto atualizada");
  };

  const handleRemove = async () => {
    if (!user) return;
    setUploading(true);
    const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
    setUploading(false);
    if (error) return toast.error("Erro ao remover", { description: error.message });
    setAvatarUrl(null);
    toast.success("Foto removida");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-md flex-col gap-0 p-0 sm:max-h-[85vh]">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="font-display">Preferências</DialogTitle>
        </DialogHeader>
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <section>
            <h4 className="mb-2 font-subtitle text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Foto de perfil
            </h4>
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-base font-medium text-muted-foreground">
                  {(fullName || user?.email || "?").slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{fullName || "Sem nome"}</p>
                <p className="text-xs text-muted-foreground">PNG/JPG até 5MB</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={`inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-muted ${uploading ? "pointer-events-none opacity-60" : ""}`}>
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Enviar
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="sr-only"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleUpload(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                {avatarUrl && (
                  <Button size="sm" variant="ghost" disabled={uploading} onClick={handleRemove} className="gap-1.5 text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" /> Remover
                  </Button>
                )}
              </div>
            </div>
          </section>
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
          {isAdmin && (
            <section>
              <h4 className="mb-2 font-subtitle text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Administração
              </h4>
              <Button asChild variant="outline" className="w-full justify-start gap-2" onClick={() => onOpenChange(false)}>
                <Link to="/admin">
                  <Shield className="h-4 w-4" />
                  Acessar painel de admin
                </Link>
              </Button>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
