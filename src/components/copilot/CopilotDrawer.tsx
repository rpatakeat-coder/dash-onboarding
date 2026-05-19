import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Sparkles, Trash2, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCopilot } from "@/hooks/useCopilot";
import { useAtivadorScope } from "@/hooks/useAtivadorScope";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const ADMIN_SUGGESTIONS = [
  "Quais deals estão críticos esta semana?",
  "Compare ativações de abril vs maio de 2026",
  "Ranking dos ativadores por SLA",
  "Resumo dos KPIs do mês atual",
];

const userSuggestions = (nome: string) => [
  "Quais dos meus deals estão críticos?",
  "Resumo da minha carteira",
  `Stats do ${nome || "meu trabalho"}`,
  "Compare minhas ativações de abril vs maio de 2026",
];

export const CopilotDrawer = ({ open, onOpenChange }: Props) => {
  const { messages, isSending, pending, send, clear } = useCopilot();
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-focus
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending, isSending]);

  const handleSubmit = async (text?: string) => {
    const value = (text ?? input).trim();
    if (!value || isSending) return;
    setInput("");
    try {
      await send(value);
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch (e) {
      toast.error("Falha ao consultar copiloto", { description: (e as Error).message });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full max-w-[520px] flex-col gap-0 p-0 sm:max-w-[520px]">
        <SheetHeader className="border-b border-border px-5 py-4 pr-14">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <SheetTitle className="truncate font-display text-base">Copiloto de Operações</SheetTitle>
                <SheetDescription className="truncate text-xs">
                  Pergunte sobre deals, KPIs, ativadores e períodos.
                </SheetDescription>
              </div>
            </div>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Limpar todo o histórico desta conversa?")) clear();
                }}
                title="Limpar conversa"
                className="mr-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </SheetHeader>

        {/* Mensagens */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
          {messages.length === 0 && !pending && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Olá! Posso buscar deals, comparar períodos e analisar a carteira de cada ativador.
                Comece com uma pergunta:
              </p>
              <div className="grid gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSubmit(s)}
                    className="rounded-lg border border-border bg-card px-3 py-2 text-left text-sm text-foreground transition hover:border-primary/40 hover:bg-muted/60"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {messages.map((m) => (
              <Message key={m.id} role={m.role} content={m.content} />
            ))}
            {pending && <Message role="user" content={pending} />}
            {isSending && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Consultando dados…
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="border-t border-border bg-card/40 p-3"
        >
          <div className="flex items-end gap-2 rounded-lg border border-border bg-background p-2 focus-within:border-primary/40">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              rows={1}
              placeholder="Pergunte algo sobre a operação…"
              disabled={isSending}
              className="max-h-32 min-h-[36px] flex-1 resize-none border-0 bg-transparent px-1 py-1.5 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isSending}
              className="h-8 w-8 shrink-0"
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            Enter envia · Shift+Enter quebra linha. As respostas usam dados reais via RLS.
          </p>
        </form>
      </SheetContent>
    </Sheet>
  );
};

const Message = ({ role, content }: { role: "user" | "assistant"; content: string }) => {
  const isUser = role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted/60 text-foreground",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-p:leading-relaxed prose-ul:my-2 prose-ul:pl-4 prose-ol:my-2 prose-ol:pl-4 prose-li:my-1 prose-li:marker:text-muted-foreground prose-strong:text-foreground prose-strong:font-semibold prose-headings:font-display prose-headings:mt-3 prose-headings:mb-1.5 prose-code:rounded prose-code:bg-background/60 prose-code:px-1 prose-code:py-0.5 prose-code:text-[12px] prose-code:before:content-none prose-code:after:content-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                table: ({ node, ...props }) => (
                  <div className="my-3 overflow-x-auto rounded-lg border border-border">
                    <table className="w-full border-collapse text-xs" {...props} />
                  </div>
                ),
                thead: (props) => <thead className="bg-background/60" {...props} />,
                th: (props) => (
                  <th
                    className="border-b border-border px-2.5 py-1.5 text-left font-semibold text-foreground"
                    {...props}
                  />
                ),
                td: (props) => (
                  <td
                    className="border-b border-border/60 px-2.5 py-1.5 align-top text-foreground/90 last:border-b-0"
                    {...props}
                  />
                ),
                tr: (props) => <tr className="even:bg-background/30" {...props} />,
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
};
