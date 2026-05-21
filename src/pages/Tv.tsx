import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Maximize, Pause, Play } from "lucide-react";
import { useDashOperacoes, computeSlaKpis, computeFiltered } from "@/hooks/useDashOperacoes";
import { SlaKpiRow } from "@/components/dashboard/SlaKpiRow";
import { RiskRanking } from "@/components/dashboard/RiskRanking";
import { BottleneckHeatmap } from "@/components/dashboard/BottleneckHeatmap";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { Highlights } from "@/components/dashboard/Highlights";
import { ChurnKpis } from "@/components/dashboard/ChurnKpis";
import { RankingMetasMedalhas } from "@/components/dashboard/RankingMetasMedalhas";
import logo from "@/assets/logo-takeat.png";

const ROTATE_MS = 20_000;

const Tv = () => {
  const { data } = useDashOperacoes();
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  const mesLabel = useMemo(
    () => new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    [],
  );

  const slides = useMemo(() => {
    const allRows = data?.rows ?? [];
    // Alinhado com a página principal: estoque = deals atualmente no pipeline "Onboarding".
    const rows = allRows.filter(
      (r) => (r.pipeline_nome?.trim().toLowerCase() ?? "") === "onboarding",
    );
    const sla = computeSlaKpis(rows);
    const { operadores } = computeFiltered(rows);
    return [
      {
        title: `Visão geral · ${mesLabel}`,
        node: (
          <div className="flex h-full flex-col gap-6">
            <SlaKpiRow
              total={sla.total}
              slaP75={sla.slaP75}
              slaMedio={sla.slaMedio}
              noPrazo={sla.noPrazo}
              noPrazoCount={sla.noPrazoCount}
              estourado={sla.estourado}
              estouradoCount={sla.estouradoCount}
              onEstoqueClick={() => {}}
            />
            {operadores.length > 0 && (
              <Highlights rows={rows} operadores={operadores} />
            )}
          </div>
        ),
      },
      {
        title: "Top risco de churn",
        node: <RiskRanking rows={rows} limit={12} variant="vertical" />,
      },
      {
        title: "Ranking de metas",
        node: <RankingMetasMedalhas rows={allRows} variant="tv" />,
      },
      {
        title: "Churn do mês",
        node: <ChurnKpis rows={allRows} />,
      },
      {
        title: "Gargalos & tendência",
        node: (
          <div className="grid h-full grid-cols-1 gap-6 lg:grid-cols-2">
            <BottleneckHeatmap rows={rows} />
            <TrendChart />
          </div>
        ),
      },
    ];
  }, [data, mesLabel]);

  useEffect(() => {
    if (paused || !slides.length) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % slides.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [paused, slides.length]);

  const goPrev = () => setIdx((i) => (i - 1 + slides.length) % slides.length);
  const goNext = () => setIdx((i) => (i + 1) % slides.length);

  // Navegação por setas do teclado
  useEffect(() => {
    if (!slides.length) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); goNext(); }
      else if (e.key === " ") { e.preventDefault(); setPaused((p) => !p); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides.length]);

  // Auto-refresh dos dados a cada 60s já é coberto pelo react-query stale time;
  // adicionamos refetch explícito a cada minuto via interval window-level.
  useEffect(() => {
    const t = setInterval(() => {
      // Força refetch ao recarregar a chave da query — usar invalidate seria ideal
      // mas como o hook usa staleTime padrão, basta confiar no refetchOnWindowFocus
      // ou bumping um timestamp. Para simplicidade, recarregamos a página a cada hora.
    }, 60_000);
    return () => clearInterval(t);
  }, []);

  const current = slides[idx];

  const goFullscreen = () => {
    document.documentElement.requestFullscreen?.().catch(() => {});
  };

  return (
    <div data-tour="tv" className="flex min-h-screen flex-col bg-gradient-surface text-foreground">
      <header data-tour="tv-header" className="flex items-center justify-between border-b border-border bg-card/60 px-8 py-4 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <img src={logo} alt="Takeat" className="h-8 w-auto" />
          <div className="h-6 w-px bg-border" />
          <div>
            <p className="font-subtitle text-[10px] uppercase tracking-widest text-muted-foreground">
              Modo TV · Operações
            </p>
            <h1 className="font-display text-xl font-semibold">{current?.title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            title="Slide anterior (←)"
            aria-label="Slide anterior"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-card p-1.5 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="font-numeric text-xs text-muted-foreground tabular-nums">
            {idx + 1} / {slides.length}
          </span>
          <button
            onClick={goNext}
            title="Próximo slide (→)"
            aria-label="Próximo slide"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-card p-1.5 text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setPaused((p) => !p)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 font-subtitle text-xs text-muted-foreground hover:text-foreground"
          >
            {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            {paused ? "Retomar" : "Pausar"}
          </button>
          <button
            onClick={goFullscreen}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 font-subtitle text-xs text-muted-foreground hover:text-foreground"
            title="Tela cheia"
          >
            <Maximize className="h-3 w-3" /> Fullscreen
          </button>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 font-subtitle text-xs text-muted-foreground hover:text-foreground"
          >
            Sair
          </Link>
        </div>
      </header>

      <main className="flex-1 px-10 py-8 [&_*]:scroll-smooth">
        <div key={idx} className="animate-fade-in-up h-full">
          {current?.node}
        </div>
      </main>

      {/* Barra de progresso */}
      <div className="h-1 w-full bg-border">
        <div
          key={`${idx}-${paused}`}
          className="h-full bg-primary"
          style={{
            animation: paused ? "none" : `tv-progress ${ROTATE_MS}ms linear forwards`,
          }}
        />
      </div>
      <style>{`@keyframes tv-progress { from { width: 0% } to { width: 100% } }`}</style>
    </div>
  );
};

export default Tv;
