// Demo dataset for visual preview without real credentials. Used only when `VITE_USE_MOCK=true`
// (the `dev:mock` script). The branch that imports this is statically eliminated from the
// production build, so this file never ships. The numbers are fabricated but internally
// consistent: bands derive from `status_risco` labels via `bandLabel`, and `summary` is computed
// from the same rows with `bandCounts`, so KPIs, charts, and the table always reconcile.

import type { ChurnFaixa, Dataset, Restaurant, RiskBandKey } from './types'
import { bandLabel } from './risk'
import { bandCounts } from './aggregations'
import { formatBrtTimestamp } from './format'

/** A BRT `DD/MM/YYYY HH:MM` string for a date `days` ago (reused for `criado_em`/`ultimo_pedido`). */
function brtDaysAgo(days: number, hour = 11, minute = 30): string {
  const d = new Date()
  d.setUTCHours(hour, minute, 0, 0)
  d.setUTCDate(d.getUTCDate() - days)
  return formatBrtTimestamp(d.toISOString())
}

// [name, owner (null = sem responsável), createdDaysAgo, diasInativo (null = never moved)]
type Spec = readonly [string, string | null, number, number | null]

const SPECS: Record<RiskBandKey, ReadonlyArray<Spec>> = {
  recem_criado: [
    ['Burger do Bairro', 'Ana Souza', 1, null],
    ['Açaí Premium', null, 2, null],
    ['Pizza Express Centro', 'Bruno Lima', 4, null],
    ['Sushi House', 'Carla Mendes', 6, 2],
    ['Padaria Pão Quente', null, 7, null],
  ],
  nunca_movimentou: [
    ['Cantina da Nona', 'Ana Souza', 60, null],
    ['Lanches do Zé', null, 95, null],
    ['Restaurante Sabor Caseiro', 'Diego Rocha', 140, null],
    ['Espetinho do Gordo', null, 210, null],
    ['Marmitex Express', 'Elaine Castro', 300, null],
    ['Bar do Português', null, 420, null],
  ],
  ativo: [
    ['Temaki da Praça', 'Ana Souza', 40, 1],
    ['Cia do Peixe', 'Bruno Lima', 65, 2],
    ['Pastelaria Central', null, 90, 3],
    ['Hamburgueria Artesanal', 'Carla Mendes', 120, 4],
    ['Cozinha da Vovó', 'Diego Rocha', 150, 5],
    ['Açaí da Praça', 'Elaine Castro', 180, 6],
    ['Boteco do Mané', 'Ana Souza', 220, 7],
    ['Pizzaria Bella Napoli', null, 260, 1],
    ['Sabor do Nordeste', 'Bruno Lima', 300, 3],
    ['Comida Mineira', 'Carla Mendes', 340, 2],
    ['Grill House', 'Diego Rocha', 380, 5],
    ['Doce Sabor Confeitaria', null, 410, 4],
    ['Esquina Gourmet', 'Elaine Castro', 450, 6],
    ['Tropical Sucos', 'Ana Souza', 480, 7],
    ['Cafeteria Aroma', 'Bruno Lima', 510, 2],
    ['Galeto do Centro', null, 540, 3],
  ],
  alerta: [
    ['Restaurante Maré Alta', 'Carla Mendes', 70, 9],
    ['Sabores da Bahia', null, 110, 12],
    ['Cantinho Italiano', 'Diego Rocha', 150, 15],
    ['Lanchonete do Parque', 'Elaine Castro', 190, 18],
    ['Pizzaria Forno a Lenha', 'Ana Souza', 230, 21],
    ['Empório Natural', null, 270, 24],
    ['Churrascaria Boi na Brasa', 'Bruno Lima', 310, 27],
    ['Crepe & Cia', 'Carla Mendes', 350, 30],
    ['Tapioca da Vila', null, 390, 11],
    ['Sorveteria Gelato', 'Diego Rocha', 430, 16],
    ['Comida Árabe Salim', 'Elaine Castro', 470, 22],
    ['Vegano & Saudável', null, 520, 28],
  ],
  critico: [
    ['Restaurante Velho Oeste', 'Ana Souza', 80, 35],
    ['Bar e Petiscos', null, 120, 48],
    ['Pizzaria do Sul', 'Bruno Lima', 160, 58],
    ['Cantina Toscana', 'Carla Mendes', 200, 72],
    ['Burger Station', null, 240, 88],
    ['Sushi Sakura', 'Diego Rocha', 280, 105],
    ['Comida Caseira da Tia', 'Elaine Castro', 320, 130],
    ['Lanches do Centro', null, 360, 155],
    ['Restaurante Maré Mansa', 'Ana Souza', 400, 180],
    ['Espeto de Ouro', null, 440, 210],
    ['Padaria Estrela', 'Bruno Lima', 480, 260],
    ['Cozinha Oriental', 'Carla Mendes', 520, 300],
    ['Boteco da Esquina', null, 560, 360],
    ['Pizzaria Antiga', 'Diego Rocha', 600, 420],
    ['Restaurante Fechado?', null, 650, 480],
    ['Lanchonete Abandonada', 'Elaine Castro', 700, 540],
    ['Marmitas da Praça', null, 740, 600],
    ['Café do Ponto', null, 800, 700],
  ],
}

/** A plausible synthetic churn score for the demo, coherent with the row's band/inactivity. */
function mockChurn(band: RiskBandKey, diasInativo: number | null, createdDaysAgo: number): {
  prob_churn: number
  faixa_risco: ChurnFaixa
  reasons: string[]
} {
  const d = diasInativo ?? 0
  let base: number
  switch (band) {
    case 'recem_criado': base = 8; break
    case 'ativo': base = 12 + d; break
    case 'alerta': base = 34 + d * 0.4; break
    case 'nunca_movimentou': base = 45 + Math.min(createdDaysAgo / 20, 25); break
    case 'critico': base = 58 + Math.min(d / 12, 40); break
  }
  const prob_churn = Math.round(Math.min(98, Math.max(2, base)) * 10) / 10
  const faixa_risco: ChurnFaixa = prob_churn < 20 ? 'Baixo' : prob_churn < 50 ? 'Médio' : 'Alto'

  // Model-derived reason codes (NOT the silence reason — the app adds that from dias_inativo).
  // Synthetic but coherent with the band, mirroring the rules in research/12_promote.py.
  const reasons: string[] = []
  if (band === 'critico') {
    reasons.push(`Sessões ${40 + (d % 35)}% abaixo da própria média mensal`, 'GMV em queda', `${2 + (createdDaysAgo % 3)} meses seguidos de queda`)
  } else if (band === 'alerta') {
    reasons.push('Tendência de uso negativa', 'Bem abaixo do pico de uso')
  } else if (band === 'nunca_movimentou' && createdDaysAgo < 90) {
    reasons.push(`Cliente novo (${Math.max(1, Math.round(createdDaysAgo / 30))} meses)`)
  }
  return { prob_churn, faixa_risco, reasons: reasons.slice(0, 3) }
}

/** Build the full demo dataset. Rows get sequential ids; `summary`/`owners` are derived from them. */
export function makeMockDataset(): Dataset {
  const data: Restaurant[] = []
  let id = 1000
  for (const band of Object.keys(SPECS) as RiskBandKey[]) {
    for (const [restaurante, owner, createdDaysAgo, diasInativo] of SPECS[band]) {
      data.push({
        restaurant_id: id++,
        restaurante,
        criado_em: brtDaysAgo(createdDaysAgo),
        ultimo_pedido: diasInativo === null ? null : brtDaysAgo(diasInativo),
        dias_inativo: diasInativo,
        status_risco: bandLabel(band),
        responsavel_cs: owner,
        ...mockChurn(band, diasInativo, createdDaysAgo),
      })
    }
  }

  const owners = [...new Set(data.map((r) => r.responsavel_cs).filter((o): o is string => o !== null))].sort()
  const semResponsavel = data.filter((r) => r.responsavel_cs === null).length

  return {
    generated_at: new Date().toISOString(),
    summary: bandCounts(data),
    owners,
    data,
    stale: false,
    warnings: [
      'Modo demonstração: dados fictícios para visualização.',
      `HubSpot: ${semResponsavel} restaurantes sem responsável vinculado.`,
    ],
    scores_generated_at: new Date().toISOString().slice(0, 10),
  }
}

/** True when the app is running in mock/demo mode (`npm run dev:mock`). */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'
