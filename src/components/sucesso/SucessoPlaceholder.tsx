import { Construction, type LucideIcon } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";

interface Props {
  title: string;
  description: string;
  icon: LucideIcon;
}

export const SucessoPlaceholder = ({ title, description, icon: Icon }: Props) => {
  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 md:px-10">
        <div className="mx-auto max-w-2xl rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="h-7 w-7" />
          </div>
          <p className="font-subtitle text-[10px] uppercase tracking-widest text-muted-foreground">
            Sucesso
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-secondary">{title}</h1>
          <p className="mt-3 font-small text-sm text-muted-foreground">{description}</p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 font-subtitle text-xs text-muted-foreground">
            <Construction className="h-3.5 w-3.5" />
            Em construção
          </div>
        </div>
      </main>
    </div>
  );
};
