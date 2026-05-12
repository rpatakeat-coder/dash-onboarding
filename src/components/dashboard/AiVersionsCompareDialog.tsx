import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { diffLines, Change } from "diff";
import { GitCompare, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { AiInsightVersion } from "@/hooks/useAiInsights";
import { AiExportMenu } from "./AiExportMenu";
import type { AiExportMeta } from "@/lib/aiInsightExport";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: AiInsightVersion[];
  /** Title shown in the dialog header (e.g. "Insights da IA · Executivo"). */
  title: string;
  /** Subtitle (e.g. KPI name). */
  subtitle?: string;
  typeLabel?: string;
}

const labelFor = (versions: AiInsightVersion[], i: number) => {
  if (i === 0) return "Atual";
  return `v${versions.length - i}`;
};

const timeFmt = (ts: number) =>
  new Date(ts).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export const AiVersionsCompareDialog = ({
  open,
  onOpenChange,
  versions,
  title,
  subtitle,
  typeLabel,
}: Props) => {
  const enough = versions.length >= 2;
  const [leftIdx, setLeftIdx] = useState(enough ? versions.length - 1 : 0);
  const [rightIdx, setRightIdx] = useState(0);
  const [highlight, setHighlight] = useState(true);

  // Reset on open
  useEffect(() => {
    if (open && enough) {
      setLeftIdx(versions.length - 1);
      setRightIdx(0);
    }
  }, [open, enough, versions.length]);

  const left = versions[leftIdx];
  const right = versions[rightIdx];

  const diff = useMemo<Change[] | null>(() => {
    if (!highlight || !left || !right) return null;
    return diffLines(left.data.content, right.data.content);
  }, [highlight, left, right]);

  const exportMeta: AiExportMeta | null = right
    ? {
        title: `Comparação · ${title}`,
        subtitle,
        typeLabel,
        model: right.data.model,
        generatedAt: right.at,
        extras: left
          ? [
              {
                heading: `Versão A — ${labelFor(versions, leftIdx)} (${timeFmt(left.at)})`,
                body: left.data.content,
              },
              {
                heading: `Versão B — ${labelFor(versions, rightIdx)} (${timeFmt(right.at)})`,
                body: right.data.content,
              },
            ]
          : [],
      }
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-primary" />
            Comparar versões
            <span className="font-subtitle text-xs font-normal text-muted-foreground">
              · {title}
            </span>
          </DialogTitle>
          {subtitle && (
            <DialogDescription>{subtitle}</DialogDescription>
          )}
        </DialogHeader>

        {!enough ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
            <Sparkles className="mx-auto mb-2 h-6 w-6 text-primary/60" />
            <p className="font-subtitle text-sm font-medium text-foreground">
              Gere ao menos 2 análises para comparar
            </p>
            <p className="mt-1 font-small text-xs text-muted-foreground">
              Use "Regenerar" para criar novas versões.
            </p>
          </div>
        ) : (
          <>
            {/* Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <VersionSelect
                  label="Versão A"
                  value={leftIdx}
                  onChange={setLeftIdx}
                  versions={versions}
                />
                <VersionSelect
                  label="Versão B"
                  value={rightIdx}
                  onChange={setRightIdx}
                  versions={versions}
                />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    id="highlight-diff"
                    checked={highlight}
                    onCheckedChange={setHighlight}
                  />
                  <Label htmlFor="highlight-diff" className="text-xs">
                    Realçar diferenças
                  </Label>
                </div>
                {exportMeta && (
                  <AiExportMenu
                    content={right!.data.content}
                    meta={exportMeta}
                    auditContext="ai_insights_compare"
                  />
                )}
              </div>
            </div>

            {/* Desktop: side-by-side. Mobile: tabs. */}
            <div className="hidden md:grid md:grid-cols-2 md:gap-3">
              <Pane
                title={`Versão A · ${labelFor(versions, leftIdx)}`}
                version={left!}
                diff={diff}
                side="left"
              />
              <Pane
                title={`Versão B · ${labelFor(versions, rightIdx)}`}
                version={right!}
                diff={diff}
                side="right"
              />
            </div>
            <div className="md:hidden">
              <Tabs defaultValue="b">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="a">A · {labelFor(versions, leftIdx)}</TabsTrigger>
                  <TabsTrigger value="b">B · {labelFor(versions, rightIdx)}</TabsTrigger>
                </TabsList>
                <TabsContent value="a" className="mt-3">
                  <Pane title="Versão A" version={left!} diff={diff} side="left" />
                </TabsContent>
                <TabsContent value="b" className="mt-3">
                  <Pane title="Versão B" version={right!} diff={diff} side="right" />
                </TabsContent>
              </Tabs>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

const VersionSelect = ({
  label,
  value,
  onChange,
  versions,
}: {
  label: string;
  value: number;
  onChange: (i: number) => void;
  versions: AiInsightVersion[];
}) => (
  <div className="flex items-center gap-1.5">
    <span className="font-subtitle text-[10px] uppercase tracking-wider text-muted-foreground">
      {label}
    </span>
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className="h-8 w-[180px] text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {versions.map((v, i) => (
          <SelectItem key={v.at} value={String(i)} className="text-xs">
            {labelFor(versions, i)} · {timeFmt(v.at)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

const Pane = ({
  title,
  version,
  diff,
  side,
}: {
  title: string;
  version: AiInsightVersion;
  diff: Change[] | null;
  side: "left" | "right";
}) => (
  <div className="flex max-h-[60vh] flex-col overflow-hidden rounded-lg border border-border bg-card">
    <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-1.5">
      <p className="font-subtitle text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <span className="font-small text-[10px] text-muted-foreground">
        {timeFmt(version.at)}
      </span>
    </div>
    <div className="overflow-y-auto px-3 py-3">
      {diff ? (
        <DiffView diff={diff} side={side} />
      ) : (
        <div className="prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-strong:text-foreground prose-li:my-0.5">
          <ReactMarkdown>{version.data.content}</ReactMarkdown>
        </div>
      )}
    </div>
  </div>
);

const DiffView = ({ diff, side }: { diff: Change[]; side: "left" | "right" }) => (
  <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-snug text-foreground">
    {diff.map((part, i) => {
      // Left pane shows removals (and unchanged); right pane shows additions (and unchanged)
      if (part.added && side === "left") return null;
      if (part.removed && side === "right") return null;
      return (
        <span
          key={i}
          className={cn(
            "block rounded px-1",
            part.added && "bg-success/15 text-success",
            part.removed && "bg-destructive/15 text-destructive",
          )}
        >
          {part.value.replace(/\n$/, "")}
        </span>
      );
    })}
  </pre>
);
