// Authenticated dashboard shell. Fetches the dataset once, derives KPIs/charts from the full universe
// (A-5), and drives the table from the client-side filter/sort/pagination state. CSV exports the
// current filtered+sorted view (AC-022). Data refreshes nightly via cron — there is no manual reload.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dataset } from '../lib/types'
import { fetchDataset, UnauthorizedError } from '../lib/api'
import { kpis } from '../lib/aggregations'
import {
  EMPTY_FILTERS,
  filterRestaurants,
  paginate,
  pageCount,
  sortRows,
  type SortDir,
  type SortKey,
  type TableFilters,
} from '../lib/table'
import { csvFilename, downloadCsv, toCsv } from '../lib/csv'
import { formatBrtTimestamp } from '../lib/format'
import KpiCards from './KpiCards'
import Filters from './Filters'
import RestaurantTable from './RestaurantTable'
import Charts from './charts/Charts'
import RetentionQueue from './RetentionQueue'

type DashboardView = 'painel' | 'fila'

const PAGE_SIZE = 25

// Logout/identidade vêm do app (DashboardHeader + Supabase Auth); este shell só carrega e exibe.
export default function Dashboard() {
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [view, setView] = useState<DashboardView>('painel')
  const [filters, setFilters] = useState<TableFilters>(EMPTY_FILTERS)
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'inatividade', dir: 'desc' })
  const [page, setPage] = useState(1)

  // Anchor for the "Ver agora" banner CTA — filtering to no-owner rows scrolls the table into view.
  const tableRef = useRef<HTMLDivElement>(null)

  async function load(refresh = false) {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const data = await fetchDataset({ refresh })
      setDataset(data)
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        setError('Sua sessão expirou. Recarregue a página para entrar novamente.')
        return
      }
      setError(e instanceof Error ? e.message : 'Falha ao carregar dados.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reset to page 1 whenever the filtered/sorted view changes.
  function updateFilters(next: TableFilters) {
    setFilters(next)
    setPage(1)
  }

  // Click a sortable header: same column → flip direction; new column → start descending.
  function onSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }))
    setPage(1)
  }

  const kpiValues = useMemo(() => (dataset ? kpis(dataset.summary) : null), [dataset])

  // Rows with no CS owner — surfaced as a call-to-action banner (clicking filters the table to them).
  const semResponsavel = useMemo(
    () => (dataset ? dataset.data.filter((r) => r.responsavel_cs === null).length : 0),
    [dataset],
  )

  // Badge for the Fila tab: how many restaurants sit in the Alto tier (the queue's default focus).
  const filaCount = useMemo(
    () => (dataset ? dataset.data.filter((r) => r.faixa_risco === 'Alto').length : 0),
    [dataset],
  )

  const sortedFiltered = useMemo(() => {
    if (!dataset) return []
    return sortRows(filterRestaurants(dataset.data, filters), sort.key, sort.dir)
  }, [dataset, filters, sort])

  const totalPages = pageCount(sortedFiltered.length, PAGE_SIZE)
  const safePage = Math.min(page, totalPages)
  const pageRows = useMemo(
    () => paginate(sortedFiltered, safePage, PAGE_SIZE),
    [sortedFiltered, safePage],
  )

  function exportCsv() {
    downloadCsv(toCsv(sortedFiltered), csvFilename(new Date()))
  }

  return (
    <div className="min-h-screen bg-surface text-ink2">
      <div className="border-b border-line bg-white px-7 py-4">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="flex h-[38px] w-[38px] items-center justify-center rounded-[11px] bg-brand shadow-[0_2px_6px_rgba(200,19,27,.28)]">
              <span className="text-xl font-extrabold tracking-tight text-white">t</span>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-[18px] font-bold tracking-tight text-ink">Monitor de Inatividade</h1>
                <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-semibold text-brand">CS</span>
              </div>
              <p className="mt-0.5 text-[12.5px] text-cmuted">
                {dataset?.generated_at ? `Atualizado em ${formatBrtTimestamp(dataset.generated_at)}` : 'Carregando…'}
                {dataset && ` · ${dataset.data.length.toLocaleString('pt-BR')} restaurantes`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {dataset?.stale && (
              <span role="status" className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800">
                Dados possivelmente desatualizados
              </span>
            )}
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing || loading}
              className="rounded-[10px] border border-line2 bg-white px-4 py-2 text-[13px] font-semibold text-cmuted transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? 'Atualizando…' : 'Atualizar'}
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl space-y-[18px] px-7 py-6">
        {loading && <p className="text-sm text-cmuted">Carregando dados…</p>}

        {error && !dataset && (
          <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}{' '}
            <button type="button" onClick={() => void load()} className="font-semibold underline">
              Tentar novamente
            </button>
          </div>
        )}

        {dataset && kpiValues && (
          <>
            {/* View toggle: Painel analítico (default) ↔ Fila de retenção (CS worklist). */}
            <div className="flex gap-2 border-b border-line">
              {([
                { key: 'painel' as const, label: 'Painel analítico' },
                { key: 'fila' as const, label: `Fila de retenção${filaCount ? ` · ${filaCount}` : ''}` },
              ]).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setView(t.key)}
                  className={`-mb-px rounded-t-[11px] border border-b-0 px-4 py-2.5 text-[13.5px] font-bold transition ${
                    view === t.key
                      ? 'border-line bg-white text-ink'
                      : 'border-transparent text-cmuted hover:text-ink2'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {view === 'fila' && (
              <RetentionQueue
                rows={dataset.data}
                owners={dataset.owners}
                scoresGeneratedAt={dataset.scores_generated_at}
              />
            )}

            {view === 'painel' && (
            <>
            {semResponsavel > 0 && (
              <div className="flex items-center gap-3 rounded-xl border border-[#F6E2C0] bg-[#FFF7EC] px-4 py-3.5">
                <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg bg-alerta">
                  <span className="text-[15px] font-extrabold text-white">!</span>
                </div>
                <p className="text-[13.5px] text-[#8A5A07]">
                  <strong className="font-bold text-[#7A4D06]">
                    {semResponsavel.toLocaleString('pt-BR')} restaurantes
                  </strong>{' '}
                  ainda estão sem responsável de CS atribuído.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    updateFilters({ ...filters, owner: 'none' })
                    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                  className="ml-auto rounded-[9px] border border-[#EAD3A8] bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-[#8A5A07] transition hover:bg-[#FFF1DC]"
                >
                  Ver agora
                </button>
              </div>
            )}

            {dataset.warnings.length > 0 && (
              <div role="status" className="rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
                {dataset.warnings.join(' · ')}
              </div>
            )}

            <KpiCards kpis={kpiValues} />

            <Charts data={dataset.data} summary={dataset.summary} />

            <div className="flex flex-wrap items-end justify-between gap-4">
              <Filters filters={filters} owners={dataset.owners} onChange={updateFilters} />
              <button
                type="button"
                onClick={exportCsv}
                className="flex items-center gap-2 rounded-[11px] bg-ink px-[18px] py-2.5 text-[13.5px] font-bold text-white transition hover:bg-ink2"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
                </svg>
                Exportar CSV
              </button>
            </div>

            {dataset.scores_generated_at && (
              <p className="text-[12.5px] text-cmuted">
                <span className="font-semibold text-faint">Risco de churn (beta)</span> — score preditivo
                de {dataset.scores_generated_at}. Churn real observado por faixa: Baixo 10,4% · Médio 25,2% ·
                Alto 60,9%.
              </p>
            )}

            <div ref={tableRef} className="scroll-mt-6">
              <RestaurantTable
                rows={pageRows}
                sortKey={sort.key}
                sortDir={sort.dir}
                onSort={onSort}
                page={safePage}
                pageCount={totalPages}
                onPageChange={setPage}
                totalFiltered={sortedFiltered.length}
              />
            </div>
            </>
            )}
          </>
        )}
      </main>
    </div>
  )
}
