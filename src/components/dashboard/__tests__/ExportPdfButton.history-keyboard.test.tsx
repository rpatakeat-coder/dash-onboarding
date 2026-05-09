import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ExportPdfButton } from "../ExportPdfButton";
import type { ExportHistoryEntry } from "@/hooks/useExportHistory";

const KEY = "takeat:pdf-export-history:v1";

const makeEntry = (i: number): ExportHistoryEntry => ({
  id: `entry-${i}`,
  createdAt: Date.now() - i * 60_000,
  title: `Relatório ${i}`,
  subtitle: "Sub",
  period: "01/05 — 09/05",
  filtersText: "Período: Mês",
  includeCover: true,
  includeToc: true,
  includeWatermark: true,
  includeFooter: true,
  pageCount: 3 + i,
});

const seed = (n: number) => {
  const entries = Array.from({ length: n }, (_, i) => makeEntry(i + 1));
  window.localStorage.setItem(KEY, JSON.stringify(entries));
  return entries;
};

const openModal = () => {
  fireEvent.click(screen.getByTitle("Exportar dashboard em PDF"));
};

const getHistoryItems = () => {
  // <ul> que contém os <li tabindex="0"> do histórico
  const items = document.querySelectorAll<HTMLLIElement>(
    "ul li[tabindex='0']",
  );
  return Array.from(items);
};

describe("ExportPdfButton — histórico: ARIA e teclado", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("cada item do histórico expõe ARIA e tabIndex consistentes", () => {
    seed(3);
    render(<ExportPdfButton />);
    openModal();

    const items = getHistoryItems();
    expect(items).toHaveLength(3);
    items.forEach((li) => {
      expect(li).toHaveAttribute("tabindex", "0");
      expect(li).toHaveAttribute("role", "button");
      expect(li.getAttribute("aria-label") ?? "").toMatch(/Relatório/);
      expect(li.getAttribute("aria-label") ?? "").toMatch(/Enter ou G/);
      // estilo de foco visível aplicado
      expect(li.className).toMatch(/focus-visible:/);
    });
  });

  it("ArrowDown/ArrowUp/Home/End movem o foco entre itens", () => {
    seed(4);
    render(<ExportPdfButton />);
    openModal();

    const items = getHistoryItems();
    items[0].focus();
    expect(document.activeElement).toBe(items[0]);

    fireEvent.keyDown(items[0], { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[1]);

    fireEvent.keyDown(items[1], { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[2]);

    fireEvent.keyDown(items[2], { key: "ArrowUp" });
    expect(document.activeElement).toBe(items[1]);

    fireEvent.keyDown(items[1], { key: "End" });
    expect(document.activeElement).toBe(items[3]);

    fireEvent.keyDown(items[3], { key: "Home" });
    expect(document.activeElement).toBe(items[0]);
  });

  it("PageDown salta 5 itens à frente (clamped no último)", () => {
    seed(8);
    render(<ExportPdfButton />);
    openModal();

    const items = getHistoryItems();
    expect(items).toHaveLength(8);

    items[0].focus();
    fireEvent.keyDown(items[0], { key: "PageDown" });
    expect(document.activeElement).toBe(items[5]);

    // outro PageDown deve clampar no último (índice 7)
    fireEvent.keyDown(items[5], { key: "PageDown" });
    expect(document.activeElement).toBe(items[7]);
  });

  it("PageUp salta 5 itens para trás (clamped no primeiro)", () => {
    seed(8);
    render(<ExportPdfButton />);
    openModal();

    const items = getHistoryItems();
    items[7].focus();
    fireEvent.keyDown(items[7], { key: "PageUp" });
    expect(document.activeElement).toBe(items[2]);

    fireEvent.keyDown(items[2], { key: "PageUp" });
    expect(document.activeElement).toBe(items[0]);
  });

  it("setas pressionadas a partir de um botão interno NÃO movem o foco do item", () => {
    seed(3);
    render(<ExportPdfButton />);
    openModal();

    const items = getHistoryItems();
    // pega um botão interno do primeiro item (ex.: Restaurar)
    const innerButton = within(items[0]).getAllByRole("button")[0];
    innerButton.focus();
    fireEvent.keyDown(innerButton, { key: "ArrowDown", bubbles: true });
    // foco permanece no botão interno (handler ignora quando target != currentTarget)
    expect(document.activeElement).toBe(innerButton);
  });

  it("a dica do cabeçalho documenta as teclas disponíveis", () => {
    seed(1);
    render(<ExportPdfButton />);
    openModal();

    // O cabeçalho do bloco de histórico cita PgUp/PgDn e Enter/G
    const ul = document.querySelector("ul");
    const panel = ul?.parentElement; // bloco do histórico
    expect(panel?.textContent ?? "").toMatch(/PgUp/);
    expect(panel?.textContent ?? "").toMatch(/PgDn/);
    expect(panel?.textContent ?? "").toMatch(/Enter/);
    expect(panel?.textContent ?? "").toMatch(/\bG\b/);
  });
});
