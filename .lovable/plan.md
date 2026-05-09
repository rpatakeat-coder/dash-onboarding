# Roadmap de evolução do Export de PDF

Você escolheu muito — vou organizar em **4 fases independentes** que podem ser entregues uma por vez. Cada fase é executável sozinha e termina com o app funcionando.

---

## Fase 1 — Identidade visual e navegação no PDF

Foco: deixar o PDF com cara de relatório oficial Takeat.

- **Página de capa** (1ª folha do PDF): logo Takeat centralizado, título do relatório, período coberto, nome do usuário que gerou e data/hora.
- **Marca d'água** sutil em diagonal em todas as páginas internas (logo Takeat ~8% opacidade).
- **Rodapé padrão**: "Takeat · Painel de Operações" à esquerda, "Página X de Y" à direita, linha divisória fina.
- **Sumário com âncoras clicáveis**: 2ª página lista as seções (KPIs, Funil, Tendência, Operadores, SLA, Estoque…) com número da página. Clicar no item pula para a seção (jsPDF suporta `link`/`outline`).
- **Outline lateral do PDF**: cada seção registrada no painel de bookmarks do leitor PDF.

**Onde toca:** apenas `ExportPdfButton.tsx` + 1 helper novo `src/lib/pdfBranding.ts` (cover, watermark, footer, outline).

---

## Fase 2 — A4 inteligente e acessibilidade

Foco: PDFs que não cortam tabelas largas e são utilizáveis por leitores de tela.

- **Modo paisagem automático para tabelas largas**: detectar elementos com `data-pdf-landscape` ou tabelas cuja largura natural > A4 portrait, renderizá-las separadamente em páginas landscape e voltar ao portrait depois.
- **Camada de texto selecionável**: além da imagem do html2canvas, sobrepor texto invisível extraído do DOM nas posições certas, para que copiar/colar e busca (Ctrl+F) funcionem dentro do PDF.
- **Tags de acessibilidade básicas**: título do documento, idioma `pt-BR`, autor e assunto via `pdf.setProperties()`.
- **Conformidade PDF/A-2b** (arquivamento): forçar embed de fontes, perfil de cor sRGB e metadados XMP.

**Onde toca:** `ExportPdfButton.tsx`, `pdfPagination.ts` (ramo landscape), novo `src/lib/pdfAccessibility.ts`.

> Observação: PDF/A completo costuma exigir `pdfjs-dist` ou pós-processamento. Vou validar se dá para fazer só com `jsPDF` ou se precisa de uma lib auxiliar (`pdf-lib`) — confirmo no início da fase.

---

## Fase 3 — UX da exportação (modal + persistência + compartilhamento)

Foco: dar ao usuário controle e histórico.

- **Modal de configuração antes de gerar** (substitui o clique direto):
  - Checkboxes para incluir/excluir: Capa, Sumário, KPIs, Funil, Tendência, Operadores, SLA, Estoque, Tabelas detalhadas.
  - Toggle "Incluir filtros aplicados no resumo".
  - Toggle "Modo paisagem para tabelas largas".
  - Botão **Gerar prévia** → continua usando o modal de preview já existente.
- **Histórico de exports** (Supabase):
  - Nova tabela `pdf_exports` (id, user_id, filename, page_count, sections jsonb, storage_path, public_url, expires_at, created_at) com RLS via `has_role` e `user_id = auth.uid()`.
  - Bucket Storage privado `pdf-exports` com policy de leitura própria.
  - Após gerar, salva o blob no bucket e cria a linha de histórico.
  - Painel "Últimas exportações" no modal: lista 10 mais recentes com botão Baixar / Compartilhar / Excluir.
- **Compartilhar link público**:
  - Botão "Gerar link público" cria signed URL (ex.: 7 dias) via `storage.from(...).createSignedUrl`.
  - Modal mostra URL com botão Copiar e contador de expiração.
  - Permite revogar (remove arquivo do bucket → URL invalida).

**Onde toca:**
- Novo `ExportPdfDialog.tsx` (substitui clique direto pelo modal de configuração).
- Novo `useExportHistory.ts` (hook Supabase).
- Migração SQL: tabela + bucket + policies.
- `ExportPdfButton.tsx` orquestra o fluxo.

```text
[Botão Exportar] → [Modal Config + Histórico] → [Gerar] → [Preview] → [Salvar + Compartilhar]
```

---

## Fase 4 — Cobertura completa de testes

Foco: blindar tudo que foi construído.

- **Testes do CSV** (`ExportCsvButton.test.ts`): formatação BR (`1.234,56`), escape de aspas/vírgulas/quebra de linha, paridade de colunas com o que está visível na tela, respeito a filtros aplicados.
- **Testes E2E com Playwright**:
  - Carrega a home, clica em "Exportar PDF", marca/desmarca seções no modal, clica Gerar.
  - Aguarda modal de preview, valida que o `<iframe>` recebeu blob URL.
  - Captura o blob via `page.evaluate` e valida assinatura `%PDF-` e contagem de páginas via `pdf-parse`.
  - Roda em 3 viewports (390, 820, 1400) e 2 zooms do browser.
- **Regressão visual do PDF**: pipeline que renderiza o PDF gerado em PNG por página (via `pdfjs-dist` headless) e compara com snapshot baseline usando `pixelmatch` com tolerância 0.5%. Comita os PNGs em `tests/__pdf_snapshots__/`.
- **Performance/memória**: stress test que injeta dashboard com 10.000 linhas de tabela, mede tempo de geração e pico de memória (`performance.memory` no Chromium); falha se > 8 s ou > 500 MB.

**Onde toca:**
- `src/components/dashboard/ExportCsvButton.test.ts` (novo).
- `tests/e2e/export-pdf.spec.ts` (novo, Playwright).
- `tests/visual/pdf-regression.spec.ts` (novo).
- `playwright.config.ts` (novo) e dependências `@playwright/test`, `pdfjs-dist`, `pixelmatch`, `pdf-parse`.

---

## Ordem sugerida de entrega

1. **Fase 1** (1 PR, ~1 sessão) — ganho visual imediato, baixo risco.
2. **Fase 3** (modal + histórico + share) — maior ganho de UX percebida.
3. **Fase 2** (landscape + acessibilidade) — qualidade técnica.
4. **Fase 4** (testes E2E + visual + perf) — depende das outras estarem prontas para os snapshots fazerem sentido.

---

## Detalhes técnicos importantes

- **Outline do jsPDF**: `pdf.outline.add(null, "Funil", { pageNumber: 3 })` — registra após `addPage()` correspondente.
- **Marca d'água**: aplicar dentro do loop de `slices.forEach` antes do `addImage` da página, com `pdf.saveGraphicsState()` + `setGState({opacity: 0.08})` + `addImage(logo, ...)` + `restoreGraphicsState()`.
- **Capa**: gerar antes do loop principal, `pdf.addPage()` antes da 1ª slice (ajustar `totalPages` e numeração).
- **Texto selecionável**: percorrer nodes de texto do DOM, calcular posição em pt via `getBoundingClientRect()` + `pxPerPt`, usar `pdf.text(..., { renderingMode: 'invisible' })`.
- **Storage policy** (bucket privado):
  ```sql
  create policy "users read own exports"
    on storage.objects for select
    using (bucket_id = 'pdf-exports' and owner = auth.uid());
  ```
- **Histórico** usa `user_roles`/`has_role` para admin ver tudo (opcional).
- **Playwright**: rodar contra `vite preview` em CI; mock do `useDashOperacoes` com fixture estável para snapshots determinísticos.

Quer que eu comece pela **Fase 1** (capa + marca d'água + sumário + outline) assim que aprovar?
